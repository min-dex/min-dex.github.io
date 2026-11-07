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
     if args[1].endswith('/releases/42'):return json.dumps({'draft':True,'assets':[{'name':p.name,'size':p.stat().st_size,'digest':'sha256:'+hashlib.sha256(p.read_bytes()).hexdigest()} for p in (root/'release-artifacts').glob('*')]})
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
 def test_source_target_size_and_hash_are_required_before_install(self):
  from verify_published_upgrade import SOURCES, asset_record
  row={'file':'Mindex-1.0.0-win-x64.exe','bytes':100,'sha256':'a'*64}
  receipt={'version':'1.0.0','channel':'internal','sourceCommit':SOURCES['1.0.0'],'assets':[row]}
  self.assertEqual(asset_record(receipt,'1.0.0','win-x64'),row)
  for change in [{'sourceCommit':'b'*40},{'channel':'release'},{'assets':[row,row]},{'assets':[{**row,'sha256':'bad'}]},{'assets':[{**row,'bytes':-1}]}]:
   with self.assertRaises(ValueError):asset_record({**receipt,**change},'1.0.0','win-x64')
  with self.assertRaises(ValueError):asset_record(receipt,'1.0.0','mac-arm64')

if __name__=='__main__':unittest.main()
