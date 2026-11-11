"""Synthetic publisher checks; never contacts GitHub or creates real releases."""
import hashlib, importlib.util, json, os, pathlib, tempfile, unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('publish_internal',pathlib.Path(__file__).parents[1]/'scripts/publish-internal.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Publication(unittest.TestCase):
 def run_case(self, gate='success', current='a'*40, missing=False):
  calls=[];sha='a'*40
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);(root/'release-artifacts').mkdir()
   (root/'package.json').write_text('{"version":"1.0.0"}')
   (root/'internal-release.json').write_text('{"version":"1.0.0","delivery":"church-internal","publish":true}')
   for target in ['mac-arm64.dmg','mac-x64.dmg','win-x64.exe']:
    if not missing:(root/'release-artifacts'/('Mindex-1.0.0-'+target)).write_bytes(b'x'*1000001)
   def gh(*args):
    calls.append(args)
    if args[0]=='api':
     if 'actions/runs' in args[1]:return json.dumps({'workflow_runs':[{'id':1,'name':'Cloud web checks','head_branch':'main','head_sha':sha,'conclusion':gate}]})
     if 'releases/tags' in args[1]:raise RuntimeError('Draft tag lookup returns 404')
     if args[1].endswith('/releases/42'):return json.dumps({'draft':True,'target_commitish':sha,'assets':[{'name':p.name,'size':p.stat().st_size,'digest':'sha256:'+hashlib.sha256(p.read_bytes()).hexdigest()} for p in (root/'release-artifacts').glob('*')]})
     return json.dumps({'object':{'sha':current}})
    if args[:2]==('release','view'):return json.dumps({'databaseId':42,'isDraft':True,'assets':[{'name':p.name,'size':p.stat().st_size} for p in (root/'release-artifacts').glob('*')]})
    return ''
   old=pathlib.Path.cwd()
   try:
    os.chdir(root)
    with patch.dict(os.environ,{'GITHUB_SHA':sha,'GITHUB_REPOSITORY':'min-dex/min-dex.github.io','GITHUB_REF':'refs/heads/main'}),patch.object(m,'gh',gh),patch.object(m.subprocess,'run',return_value=type('R',(),{'returncode':1})()):
     try:m.main();error=None
     except Exception as e:error=e
   finally:os.chdir(old)
  return calls,error
 def test_verified_release_keeps_draft_until_all_assets_verified(self):
  calls,error=self.run_case();self.assertIsNone(error)
  steps=[x[1] for x in calls if x[0]=='release'];self.assertEqual(steps,['create','upload','view','edit'])
  self.assertIn('--draft',next(x for x in calls if x[:2]==('release','create')))
 def test_failed_or_changed_source_and_missing_assets_never_publish(self):
  for values in [{'gate':'failure'},{'current':'b'*40},{'missing':True}]:
   calls,error=self.run_case(**values);self.assertIsNotNone(error)
   self.assertFalse(any(x[:2]==('release','create') for x in calls))
class PublishedUpgradeIdentity(unittest.TestCase):
 def test_download_timeout_retries_but_invalid_installers_still_fail(self):
  import io, verify_published_upgrade as upgrade
  payload=b'verified fixture'
  record={'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest()}
  class Interrupted(io.BytesIO):
   def read(self, amount):
    if self.tell(): raise TimeoutError('network interruption')
    return super().read(4)
  with tempfile.TemporaryDirectory() as folder:
   installer=pathlib.Path(folder)/'fixture.exe'
   fetch=lambda: upgrade.download_installer('https://example.invalid/fixture.exe',installer,record)
   with patch.object(upgrade.urllib.request,'urlopen',side_effect=[Interrupted(payload),io.BytesIO(payload)]) as open_url,patch.object(upgrade.time,'sleep'):
    upgrade.retry_download(fetch)
    self.assertEqual(open_url.call_count,2)
    self.assertEqual(installer.read_bytes(),payload)
   with patch.object(upgrade.urllib.request,'urlopen',return_value=io.BytesIO(b'x'*len(payload))) as open_url:
    with self.assertRaisesRegex(RuntimeError,'integrity mismatch'):upgrade.retry_download(fetch)
    self.assertEqual(open_url.call_count,1)
 def test_source_target_size_and_hash_are_required_before_install(self):
  from verify_published_upgrade import SOURCES, asset_record
  row={'file':'Mindex-1.0.0-win-x64.exe','id':1,'bytes':100,'sha256':'a'*64}
  receipt={'version':'1.0.0','channel':'internal','sourceCommit':SOURCES['1.0.0'],'assets':[row]}
  self.assertEqual(asset_record(receipt,'1.0.0','win-x64'),row)
  for change in [{'sourceCommit':'b'*40},{'channel':'release'},{'assets':[row,row]},{'assets':[{**row,'sha256':'bad'}]},{'assets':[{**row,'bytes':-1}]}]:
   with self.assertRaises(ValueError):asset_record({**receipt,**change},'1.0.0','win-x64')
  with self.assertRaises(ValueError):asset_record(receipt,'1.0.0','mac-arm64')
 def test_required_published_upgrade_fixture_records_are_complete(self):
  import verify_published_upgrade as upgrade
  fixtures=json.loads(upgrade.PUBLISHED_FIXTURES.read_text())
  self.assertEqual(fixtures.keys(),upgrade.PUBLISHED_SOURCES.keys())
  for version,receipt in fixtures.items():
   for target in ('mac-arm64','mac-x64','win-x64'):
    self.assertGreater(upgrade.asset_record(receipt,version,target)['bytes'],1000000)

 def test_rejected_token_retries_the_same_public_asset_without_credentials(self):
  import io, verify_published_upgrade as upgrade
  request=upgrade.api_request('/assets/1?download=1','fixture','application/octet-stream')
  rejected=upgrade.urllib.error.HTTPError(request.full_url,401,'Unauthorized',{},io.BytesIO())
  with patch.object(upgrade.urllib.request,'urlopen',side_effect=[rejected,io.BytesIO(b'fixture')]) as read:
   self.assertEqual(upgrade.open_release(request,60).read(),b'fixture')
  public=read.call_args.args[0]
  self.assertFalse(public.has_header('Authorization'))
  self.assertEqual(public.full_url,request.full_url+'&public=1')
  self.assertEqual(public.get_header('Accept'),'application/octet-stream')

 def test_failed_old_install_acceptance_stops_before_candidate_install(self):
  import io, types, verify_published_upgrade as upgrade
  with tempfile.TemporaryDirectory() as folder:
   root=pathlib.Path(folder);candidate=root/'Mindex-1.0.9-win-x64.exe';candidate.write_bytes(b'candidate')
   payload=b'published fixture';row={'file':'Mindex-1.0.0-win-x64.exe','id':1,'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest()}
   receipt={'version':'1.0.0','channel':'internal','sourceCommit':upgrade.SOURCES['1.0.0'],'assets':[row]}
   calls=[]
   def run(args,**kwargs):
    self.assertNotIn('MINDEX_QA_GITHUB_TOKEN',os.environ)
    calls.append(args)
    if args[1]=='tests/install_test_fixture.py':pathlib.Path(args[3]).write_text(json.dumps({'exe':'synthetic.exe'}))
    else:raise RuntimeError('synthetic seed failure')
   def read(url,**kwargs):
    self.assertNotIn('Authorization',url.headers)
    self.assertEqual(url.unredirected_hdrs.get('Authorization'),'Bearer fixture')
    self.assertIn('/assets/1?download=1&mindexVerify=',url.full_url)
    self.assertEqual(url.get_header('Accept'),'application/octet-stream')
    return io.BytesIO(payload)
   manifest=root/'manifest.json'
   manifest.write_text(json.dumps({'1.0.0':receipt}))
   with patch.dict(os.environ,{'GITHUB_ACTIONS':'true','RUNNER_TEMP':folder,'MINDEX_QA_GITHUB_TOKEN':'fixture'}),patch.object(upgrade,'PUBLISHED_FIXTURES',manifest),patch.object(upgrade,'PUBLISHED_SOURCES',{'1.0.0':upgrade.SOURCES['1.0.0']}),patch.object(upgrade.sys,'platform','win32'),patch.object(upgrade.tempfile,'gettempdir',return_value=folder),patch.object(upgrade.sys,'argv',['verify',str(candidate),'win-x64','b'*40,'1.0.9']),patch.object(upgrade.urllib.request,'urlopen',read),patch.object(upgrade.shutil,'disk_usage',return_value=types.SimpleNamespace(free=100*1024**3)),patch.object(upgrade.subprocess,'run',run):
    with self.assertRaisesRegex(RuntimeError,'synthetic seed failure'):upgrade.main()
   self.assertEqual(len(calls),2)
   self.assertFalse(any(str(candidate) in args for args in calls))

class CiCleanup(unittest.TestCase):
 def test_windows_upgrade_requires_the_runner_temporary_root(self):
  import verify_published_upgrade as upgrade
  with tempfile.TemporaryDirectory() as runner, tempfile.TemporaryDirectory() as other:
   with patch.object(upgrade.sys,'platform','win32'),patch.dict(os.environ,{'RUNNER_TEMP':runner}),patch.object(upgrade.tempfile,'gettempdir',return_value=runner):
    self.assertEqual(upgrade.upgrade_temp_root(),pathlib.Path(runner).resolve())
   with patch.object(upgrade.sys,'platform','win32'),patch.dict(os.environ,{'RUNNER_TEMP':runner}),patch.object(upgrade.tempfile,'gettempdir',return_value=other):
    with self.assertRaisesRegex(RuntimeError,'TEMP/TMP'):upgrade.upgrade_temp_root()

 def test_cleanup_retries_only_windows_sharing_locks(self):
  import cleanup_desktop_ci as clean
  locked=PermissionError('still closing');locked.winerror=32
  with patch.object(clean.shutil,'rmtree',side_effect=[locked,None]) as remove, patch.object(clean.time,'sleep') as sleep:
   clean.remove_completed_tree('validated-fixture');self.assertEqual(remove.call_count,2);sleep.assert_called_once_with(1)
  with patch.object(clean.shutil,'rmtree',side_effect=PermissionError('denied')), patch.object(clean.time,'sleep') as sleep:
   with self.assertRaises(PermissionError):clean.remove_completed_tree('validated-fixture')
   sleep.assert_not_called()
  with patch.object(clean.shutil,'rmtree',side_effect=locked) as remove, patch.object(clean.time,'sleep'):
   with self.assertRaises(PermissionError):clean.remove_completed_tree('validated-fixture')
   self.assertEqual(remove.call_count,21)

 def test_internal_cleanup_retains_installers_and_signed_receipts(self):
  import cleanup_desktop_ci as clean
  import uuid
  token=uuid.uuid4().hex
  with tempfile.TemporaryDirectory() as project, tempfile.TemporaryDirectory() as runner, tempfile.TemporaryDirectory(prefix='mindex-install-qa-') as install:
   root=pathlib.Path(project);temp=pathlib.Path(runner)
   profile=pathlib.Path(tempfile.gettempdir())/('mindex-isolated-upgrade-'+token)
   profile.mkdir()
   try:
    (profile/'fixture-only.json').write_text(json.dumps({'token':token,'appId':'kr.mindex.app.test'}))
    (pathlib.Path(install)/'fixture-only').write_text('kr.mindex.app.test')
    (temp/'internal-install.json').write_text(json.dumps({'root':install}))
    (temp/'internal-proof.json').write_text(json.dumps({'token':token,'profile':str(profile/'data')}))
    output=root/'dist/internal';output.mkdir(parents=True)
    for name in ('win-unpacked','mac-arm64','mac'):(output/name).mkdir()
    for name in ('Mindex-1.0.2.exe','Mindex-1.0.2.dmg','encoder-mac-arm64.json'):(output/name).write_text('keep')
    with patch.dict(os.environ,{'GITHUB_ACTIONS':'true'}):clean.cleanup(root,temp,'internal')
    self.assertFalse((output/'win-unpacked').exists());self.assertFalse((output/'mac').exists());self.assertFalse((output/'mac-arm64').exists())
    for name in ('Mindex-1.0.2.exe','Mindex-1.0.2.dmg','encoder-mac-arm64.json'):self.assertEqual((output/name).read_text(),'keep')
    self.assertTrue((temp/'internal-proof.json').exists())
   finally:
    if profile.exists():
     import shutil;shutil.rmtree(profile)

 def test_only_owned_completed_fixtures_removed_and_receipts_kept(self):
  import cleanup_desktop_ci as clean
  with tempfile.TemporaryDirectory() as project, tempfile.TemporaryDirectory() as runner, tempfile.TemporaryDirectory(prefix='mindex-install-qa-') as install:
   root=pathlib.Path(project);temp=pathlib.Path(runner);token='a'*32
   profile=pathlib.Path(tempfile.gettempdir())/('mindex-isolated-upgrade-'+token)
   self.assertFalse(profile.exists());profile.mkdir()
   try:
    (profile/'fixture-only.json').write_text(json.dumps({'token':token,'appId':'kr.mindex.app.test'}))
    (pathlib.Path(install)/'fixture-only').write_text('kr.mindex.app.test')
    (temp/'install-fixture.json').write_text(json.dumps({'root':install}))
    (temp/'upgrade-proof.json').write_text(json.dumps({'token':token,'profile':str(profile/'설정'),'label':'한글 예배 검증'},ensure_ascii=False),encoding='utf-8')
    (root/'dist/test').mkdir(parents=True);(root/'dist/internal').mkdir();(root/'dist/internal/keep.dmg').write_text('keep')
    with patch.dict(os.environ,{'GITHUB_ACTIONS':'false'}):
     with self.assertRaises(RuntimeError):clean.cleanup(root,temp,'test')
    with patch.dict(os.environ,{'GITHUB_ACTIONS':'true'}):
     (pathlib.Path(install)/'fixture-only').write_text('wrong')
     with self.assertRaises(AssertionError):clean.cleanup(root,temp,'test')
     self.assertTrue(profile.exists());self.assertTrue((root/'dist/test').exists())
     (pathlib.Path(install)/'fixture-only').write_text('kr.mindex.app.test')
     read=pathlib.Path.read_text
     # Emulate the Windows legacy default; the helper must explicitly use UTF-8.
     with patch.object(pathlib.Path,'read_text',lambda file,encoding=None,errors=None:read(file,encoding=encoding or 'cp1252',errors=errors)):
      clean.cleanup(root,temp,'test')
    self.assertFalse(profile.exists());self.assertFalse((root/'dist/test').exists())
    self.assertTrue((temp/'upgrade-proof.json').exists());self.assertTrue((root/'dist/internal/keep.dmg').exists())
   finally:
    if profile.exists():
     import shutil;shutil.rmtree(profile)

if __name__=='__main__':unittest.main()
