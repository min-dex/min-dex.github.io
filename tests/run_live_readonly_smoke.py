"""Run a full live-data smoke suite with production writes blocked.

Uses only the public configuration shipped in index.html; never reads local env
files. Every new browser context (including output popups) receives the guard.
Worship reads use GET so PostgREST enforces a read-only transaction.
Startup state and presence are ephemeral per-context fixtures, never production RPCs.
Detailed logs go to the system temporary directory and redact the public key.
"""
import sys,re,json,collections,traceback,importlib,io,contextlib,argparse,tempfile
from pathlib import Path
from urllib.parse import urlsplit,urlencode
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('suite', choices=['smoke_app','smoke_worship_presenter','smoke_live_readonly_core','check_guard'])
parser.add_argument('--fail-fast',action='store_true',help='Stop at the first reported failure')
args=parser.parse_args()
sys.path.insert(0,str(ROOT/'tests'))
import smoke_app
from playwright.sync_api import Browser
from helpers.readonly_bookkeeping import ReadonlyBookkeeping
markup=(ROOT/'index.html').read_text()
config=re.search(r'window\.MINDEX_SUPABASE\s*=\s*\{(.*?)\}',markup,re.S).group(1)
url=re.search(r'url:\s*"([^"]+)"',config).group(1)
key=re.search(r'anonKey:\s*"([^"]+)"',config).group(1)
host=urlsplit(url).hostname
# Use only the public shipped configuration, never local credential files.
smoke_app.extract_supa_config=lambda:(url,key)
smoke_app.read_env_file=lambda p: (_ for _ in ()).throw(RuntimeError('Local env access forbidden'))
reads=collections.Counter();blocked=collections.Counter();fixtures=collections.Counter();converted=0

def guard(route, bookkeeping=None):
 global converted
 req=route.request;p=urlsplit(req.url);method=req.method
 rpc=p.path.startswith('/rest/v1/rpc/')
 name=p.path.rsplit('/',1)[-1]
 if p.hostname==host and rpc and method=='POST' and bookkeeping is not None and name in ReadonlyBookkeeping.NAMES:
  try:
   data=bookkeeping.handle(name,req.post_data_json)
   fixtures[name]+=1
   route.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps(data))
  except ValueError:
   blocked['invalid bookkeeping request']+=1
   route.fulfill(status=403,content_type='application/json',body='{"message":"Invalid bookkeeping request"}')
  return
 read_rpc=p.hostname==host and p.path=='/rest/v1/rpc/get_worship_service_v1'
 if read_rpc and method=='POST':
  body=req.post_data_json
  if not isinstance(body,dict) or set(body)!={'sid'}:
   blocked['invalid read RPC payload']+=1;route.abort();return
  # Invoke the documented STABLE read RPC via GET so PostgREST uses a read-only transaction.
  converted+=1;reads['GET read RPC']+=1
  # Continue in the browser so concurrent reads do not serialize in urllib.
  route.continue_(url=url+'/rest/v1/rpc/get_worship_service_v1?'+urlencode(body),method='GET',post_data='')
  return
 if method not in ('GET','HEAD','OPTIONS') or (rpc and not read_rpc):
  blocked[method+' '+p.path]+=1
  route.fulfill(status=403,content_type='application/json',body='{"code":"SMOKE_READ_ONLY","message":"Production writes blocked by read-only smoke guard"}')
  return
 if p.hostname==host:
  if not (p.path.startswith('/rest/v1/') or p.path.startswith('/storage/v1/object/')):
   blocked[method+' '+p.path]+=1;route.abort();return
  reads[method+' '+p.path]+=1
 route.continue_()

def protect(context):
 if getattr(context,'_readonly_smoke',False):return
 context._readonly_smoke=True
 bookkeeping=ReadonlyBookkeeping()
 context.route('**/*',lambda route:guard(route,bookkeeping))
 if hasattr(context,'route_web_socket'):
  # No connect_to_server: a local mock socket, never a production connection.
  # Sync close inside this callback deadlocks the current Playwright driver.
  def isolate_websocket(ws):fixtures['isolated_websocket']+=1
  context.route_web_socket('**/*',isolate_websocket)
if args.suite == 'check_guard':
 class RequestFixture:
  def __init__(self,method,path): self.method=method; self.url=url+path
 class RouteFixture:
  def __init__(self,method,path): self.request=RequestFixture(method,path); self.denied=False
  def fulfill(self,**kw): assert kw['status']==403; self.denied=True
  def abort(self): self.denied=True
  def continue_(self): raise AssertionError('Unsafe request escaped the guard')
 for method,path in [('POST','/rest/v1/mindex_songs'),('PATCH','/rest/v1/mindex_worship_services'),
                     ('PUT','/storage/v1/object/test'),('DELETE','/rest/v1/mindex_worship_services'),
                     ('POST','/rest/v1/rpc/save_worship_service_v1'),('GET','/rest/v1/rpc/delete_worship_service_v1'),
                     ('POST','/rest/v1/rpc/mindex_state_write_v1'),('GET','/rest/v1/rpc/mindex_state_write_v1'),
                     ('POST','/rest/v1/rpc/mindex_monitor_register_extra')]:
  fixture=RouteFixture(method,path);guard(fixture);assert fixture.denied
 print('PASS nine mutation/unknown-RPC requests blocked without network access')
 raise SystemExit(0)
oldcontext=Browser.new_context
def new_context(self,*a,**k):
 k['service_workers']='block';c=oldcontext(self,*a,**k);protect(c);return c
def new_page(self,*a,**k):
 # Use the guarded context factory: Browser.new_page otherwise bypasses the
 # shared macOS native-fullscreen safety wrapper in smoke_app.
 return self.new_context(*a,**k).new_page()
Browser.new_context=new_context;Browser.new_page=new_page
suite=args.suite
module=smoke_app if suite=='smoke_app' else importlib.import_module(suite)
log=io.StringIO();code=1
class ReadonlyStop(BaseException): pass
progress=Path(tempfile.gettempdir())/(suite+'-readonly-progress.jsonl')
progress.write_text('')
def trace_progress(frame,event,arg):
 if event!='call' or frame.f_code.co_filename!=module.__file__ or frame.f_code.co_name not in ('pass_','fail','skip'):
  return None
 status={'pass_':'PASS','fail':'FAIL','skip':'SKIP'}[frame.f_code.co_name]
 name=str(frame.f_locals.get('name','unnamed'))
 with progress.open('a') as target:target.write(json.dumps({'status':status,'name':name})+'\n')
 if status=='FAIL' and args.fail_fast:raise ReadonlyStop(name+' :: '+str(frame.f_locals.get('detail','')))
 return None
previous_trace=sys.gettrace()
sys.settrace(trace_progress)
try:
 with contextlib.redirect_stdout(log),contextlib.redirect_stderr(log):
  try:code=module.main()
  except ReadonlyStop as error:print('FAIL '+str(error));code=1
  except Exception:traceback.print_exc()
finally:
 sys.settrace(previous_trace)
 output=log.getvalue().replace(key,'[PUBLIC_KEY_REDACTED]')
 output=re.sub(r'(supabaseAnonKey=)[^&\s\"\']+',r'\1[REDACTED]',output)
 path=Path(tempfile.gettempdir()) / (suite+'-readonly.log');path.write_text(output)
 results=collections.Counter(re.findall(r'^(PASS|FAIL|SKIP) ',output,re.M))
 summary={'suite':suite,'exit':code,'results':dict(results),'reads':sum(reads.values()),'read_rpc_get':converted,'bookkeeping_fixtures':dict(fixtures),'production_writes':0,'blocked':dict(blocked),'log':str(path)}
 (Path(tempfile.gettempdir()) / (suite+'-readonly-summary.json')).write_text(json.dumps(summary,ensure_ascii=False,indent=2))
 print(json.dumps(summary,ensure_ascii=False))
 for line in output.splitlines():
  if line.startswith(('FAIL ','SKIP ')):print(line[:650])
 if not results:print(output[-1800:])

raise SystemExit(code or bool(blocked))
