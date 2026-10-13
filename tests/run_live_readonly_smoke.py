"""Run a full live-data smoke suite with production writes blocked.

Uses only the public configuration shipped in index.html; never reads local env
files. Every new browser context (including output popups) receives the guard.
Read RPCs are sent as GET so PostgREST enforces a read-only transaction.
Detailed logs go to the system temporary directory and redact the public key.
"""
import sys,re,json,collections,traceback,importlib,io,contextlib,argparse,tempfile
from pathlib import Path
from urllib.parse import urlsplit,urlencode
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('suite', choices=['smoke_app','smoke_worship_presenter','check_guard'])
args=parser.parse_args()
sys.path.insert(0,str(ROOT/'tests'))
import smoke_app
from playwright.sync_api import Browser
markup=(ROOT/'index.html').read_text()
config=re.search(r'window\.MINDEX_SUPABASE\s*=\s*\{(.*?)\}',markup,re.S).group(1)
url=re.search(r'url:\s*"([^"]+)"',config).group(1)
key=re.search(r'anonKey:\s*"([^"]+)"',config).group(1)
host=urlsplit(url).hostname
# Use only the public shipped configuration, never local credential files.
smoke_app.extract_supa_config=lambda:(url,key)
smoke_app.read_env_file=lambda p: (_ for _ in ()).throw(RuntimeError('Local env access forbidden'))
reads=collections.Counter();blocked=collections.Counter();converted=0

def guard(route):
 global converted
 req=route.request;p=urlsplit(req.url);method=req.method
 rpc=p.path.startswith('/rest/v1/rpc/')
 read_rpc=p.hostname==host and p.path=='/rest/v1/rpc/get_worship_service_v1'
 if read_rpc and method=='POST':
  body=req.post_data_json
  if not isinstance(body,dict) or set(body)!={'sid'}:
   blocked['invalid read RPC payload']+=1;route.abort();return
  # Invoke the documented STABLE read RPC via GET so PostgREST uses a read-only transaction.
  headers={k:v for k,v in req.headers.items() if k.lower() not in ('content-type','content-length','host')}
  try:
   with urlopen(Request(url+'/rest/v1/rpc/get_worship_service_v1?'+urlencode(body),headers=headers,method='GET'),timeout=30) as response:
    data=response.read();status=response.status
   converted+=1;reads['GET read RPC']+=1
   route.fulfill(status=status,content_type='application/json',body=data)
  except Exception as error:
   route.fulfill(status=502,content_type='application/json',body=json.dumps({'message':'Read RPC request failed','type':type(error).__name__}))
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
 context.route('**/*',guard)
 if hasattr(context,'route_web_socket'):context.route_web_socket('**/*',lambda ws:ws.close())
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
                     ('POST','/rest/v1/rpc/save_worship_service_v1'),('GET','/rest/v1/rpc/delete_worship_service_v1')]:
  fixture=RouteFixture(method,path);guard(fixture);assert fixture.denied
 print('PASS six mutation/unknown-RPC requests blocked without network access')
 raise SystemExit(0)
oldcontext=Browser.new_context;oldpage=Browser.new_page
def new_context(self,*a,**k):
 k['service_workers']='block';c=oldcontext(self,*a,**k);protect(c);return c
def new_page(self,*a,**k):
 k['service_workers']='block';p=oldpage(self,*a,**k);protect(p.context);return p
Browser.new_context=new_context;Browser.new_page=new_page
suite=args.suite
module=smoke_app if suite=='smoke_app' else importlib.import_module(suite)
log=io.StringIO();code=1
try:
 with contextlib.redirect_stdout(log),contextlib.redirect_stderr(log):
  try:code=module.main()
  except Exception:traceback.print_exc()
finally:
 output=log.getvalue().replace(key,'[PUBLIC_KEY_REDACTED]')
 output=re.sub(r'(supabaseAnonKey=)[^&\s\"\']+',r'\1[REDACTED]',output)
 path=Path(tempfile.gettempdir()) / (suite+'-readonly.log');path.write_text(output)
 results=collections.Counter(re.findall(r'^(PASS|FAIL|SKIP) ',output,re.M))
 summary={'suite':suite,'exit':code,'results':dict(results),'reads':sum(reads.values()),'read_rpc_get':converted,'blocked':dict(blocked),'log':str(path)}
 (Path(tempfile.gettempdir()) / (suite+'-readonly-summary.json')).write_text(json.dumps(summary,ensure_ascii=False,indent=2))
 print(json.dumps(summary,ensure_ascii=False))
 for line in output.splitlines():
  if line.startswith(('FAIL ','SKIP ')):print(line[:650])
 if not results:print(output[-1800:])

raise SystemExit(code or bool(blocked))
