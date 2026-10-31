"""Only on an ephemeral Windows runner. Synthetic state RPC, no real accounts."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

assert os.environ.get('GITHUB_ACTIONS') == 'true' and sys.platform == 'win32'
before = sys.argv[1] == 'before'
proof = Path(os.environ['RUNNER_TEMP']) / 'upgrade-before.json'
installer, = Path('app/dist/test').glob('*.exe')
result = subprocess.run([str(installer.resolve()), '/S', '/currentuser'], timeout=240, check=True)
exe, = (Path(os.environ['LOCALAPPDATA']) / 'Programs').glob('*/Mindex Test.exe')
record = {} if before else json.loads(proof.read_text())
if not before:
    assert record['exe'] == str(exe)
rows = record.get('rows', {})
service = {'id': 'fixture-worship', 'service_date': '2026-10-25', 'service_alias': 'Update fixture'}
def rpc(name, args):
    scope = args['p_scope']
    prefix = scope if scope == 'shared' else scope + ':' + args['p_token']
    records = rows.get(prefix, {})
    if name == 'mindex_state_read_v1':
        return {'data': list(records.values()), 'error': None}
    assert before and name == 'mindex_state_write_v1'
    row = {'key': args['p_key'], 'value': args['p_value'], 'revision': '1', 'requestId': args['p_request_id']}
    assert row['key'] not in records and args['p_revision'] == '0'
    rows.setdefault(prefix, {})[row['key']] = row
    return {'data': row, 'error': None}

# Only the disposable runner's normal Test app profile is used across installs.
# Block external network from the executable before its first launch.
if before:
    subprocess.run(['netsh','advfirewall','firewall','add','rule','name=Mindex isolated upgrade','dir=out','action=block','program='+str(exe),'enable=yes'],check=True)
proc = subprocess.Popen([str(exe),'--remote-debugging-port=19243','--disable-background-networking',
                         '--host-resolver-rules=MAP * ~NOTFOUND','--mute-audio'])
with sync_playwright() as pw:
    for _ in range(60):
        try:
            browser = pw.chromium.connect_over_cdp('http://127.0.0.1:19243',timeout=2000)
            break
        except Exception:
            time.sleep(1)
    else:
        raise RuntimeError('installed app did not open')
    context = browser.contexts[0]
    page = context.pages[0] if context.pages else context.wait_for_event('page')
    page.wait_for_function("location.protocol === 'file:' && typeof fetchWorshipServiceListRows === 'function'")
    info = page.evaluate('() => window.mindexElectron.getBuildInfo()')
    assert info['testBuild'] and info['build']['sourceCommit'] == os.environ['OLD' if before else 'NEW']
    page.expose_function('fixtureRpc', rpc)
    data = page.evaluate("""async ({before,service}) => {
      const client = window.supabase.createClient('https://fixture.invalid', 'fixture-public-id', {
        auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async (url, options) => {
          if (!String(url).includes('/rest/v1/mindex_worship_service') || (options?.method||'GET')!=='GET') throw Error('unexpected worship request');
          return new Response(JSON.stringify([service]),{status:200,headers:{'Content-Type':'application/json'}});
        }}});
      state.client=client;
      const storage=window.MINDEX_SERVER_STORAGE;
      await storage.initialize({rpc:(name,args)=>window.fixtureRpc(name,args)},'upgrade-fixture');
      const key='mindex.editor.draft.v2:service:fixture-worship:rehearsal';
      const draft=JSON.stringify({schema:1,module:'service',id:service.id,value:{service,items:[{raw_title:'Unsaved sermon'}],serviceTypes:[]}});
      if(before){
        await storage.setItem('local',key,draft);
        await storage.setItem('local','mindex.theme','dark');
        await storage.setItem('local','mindex.music.fadeStop','true');
      }
      const worship=await fetchWorshipServiceListRows();
      if(worship.length!==1 || worship[0].id!==service.id || storage.getItem('local',key)!==draft ||
         storage.getItem('local','mindex.theme')!=='dark'||storage.getItem('local','mindex.music.fadeStop')!=='true')throw Error('fixture readback mismatch');
      return {worship,draft:storage.getItem('local',key),theme:storage.getItem('local','mindex.theme'),
        fade:storage.getItem('local','mindex.music.fadeStop'),identity:localStorage.getItem('mindex.server.identity:upgrade-fixture')};
    }""", {'before':before,'service':service})
    assert data['identity'] and len(data['identity']) == 64
    page.close()
    proc.wait(timeout=30)
if before:
    proof.write_text(json.dumps(dict(exe=str(exe),data=data,rows=rows)))
else:
    assert record['data'] == data and record['rows'] == rows
print('Verified:', info['build']['sourceCommit'], 'worship, private draft, theme, fade setting and same device identity')
