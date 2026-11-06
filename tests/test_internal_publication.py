"""Synthetic publisher checks; never contacts GitHub or creates real releases."""
import importlib.util, json, os, pathlib, tempfile, unittest
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
     return json.dumps({'object':{'sha':current}})
    if args[:2]==('release','view'):return json.dumps({'isDraft':True,'assets':[{'name':p.name,'size':p.stat().st_size} for p in (root/'release-artifacts').glob('*')]})
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
if __name__=='__main__':unittest.main()
