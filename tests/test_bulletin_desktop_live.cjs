// Two isolated installed apps share synthetic RPC rows. No production profile/network access.
const {_electron}=require('playwright');
const {closeIsolatedElectron}=require('./helpers/close-isolated-electron.cjs');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
async function main(){
 const [exe,sha,version]=process.argv.slice(2);
 assert(exe&&/^[a-f0-9]{40}$/.test(sha)&&version);
 const entries=new Map(),receipts=new Map(),weekly=new Map(),apps=[];
 const tokens=[crypto.randomBytes(16).toString('hex'),crypto.randomBytes(16).toString('hex')];
 const key='youth-tov';
 const rpc=async(name,args)=>{
  assert.equal(args.p_scope,'shared');
  assert.equal(args.p_token,'');
  if(name==='mindex_state_read_v1')return {data:[...entries.values()]};
  assert.equal(name,'mindex_state_write_v1');
  assert.equal(args.p_key,'mindex.bulletin.template.v1:'+key);
  if(receipts.has(args.p_request_id))return {data:receipts.get(args.p_request_id)};
  const old=entries.get(args.p_key);
  if((old?.revision||'0')!==args.p_revision)return {error:{message:'STATE_REVISION_CONFLICT'}};
  const row={key:args.p_key,value:args.p_value,revision:String(BigInt(args.p_revision)+1n),requestId:args.p_request_id};
  entries.set(row.key,row);receipts.set(row.requestId,row);return {data:row};
 };
 try{
  for(let n=0;n<2;n++){
   const app=await _electron.launch({executablePath:path.resolve(exe),env:{...process.env,MINDEX_ISOLATED_TEST:'1',MINDEX_TEST_PROFILE_TOKEN:tokens[n]}});
   apps.push(app);
   await app.evaluate(({BrowserWindow},index)=>{const win=BrowserWindow.getAllWindows()[0];win.setBounds({x:index*730,y:0,width:720,height:950});win.show();},n);
   const native=await app.evaluate(({app})=>({profile:app.getPath('userData'),version:app.getVersion(),isolation:globalThis.__mindexTestIsolation,packaged:app.isPackaged}));
   assert(native.packaged&&native.isolation.networkBlocked);
   assert.equal(native.version,version);
   assert.equal(native.profile,path.join(fs.realpathSync(os.tmpdir()),'mindex-isolated-upgrade-'+tokens[n],'userData'));
   const page=await app.firstWindow();
   await page.waitForFunction(()=>!!window.MindexBulletin&&typeof loadBulletinTemplate==='function'&&!document.body.classList.contains('ui-booting'));
   const identity=await page.evaluate(()=>window.mindexElectron.getBuildInfo());
   assert.equal(identity.build.sourceCommit,sha);
   await page.exposeFunction('bulletinFixtureRpc',rpc);
   await page.exposeFunction('readBulletinFixture',()=>structuredClone(weekly.get(n)));
   await page.exposeFunction('saveBulletinFixture',(value,revision)=>{
    const prior=weekly.get(n);
    assert.equal(prior.revision,revision);
    const row={revision:revision+1,...structuredClone(value)};
    weekly.set(n,row);return row;
   });
   const row=await page.evaluate(async seed=>{
    const B=MindexBulletin;
    state.client={rpc:(...args)=>window.bulletinFixtureRpc(...args)};
    state.config.url='';
    const source=B.resolveSource({service:{id:'bulletin-desktop-fixture',service_type_id:'youth',service_date:'2026-11-22'}});
    source.order=[{id:'sermon',label:'설교',content:'검증용 설교',person:'검증용 담당'}];
    const doc={...B.normalizeSnapshot({settings:{design:'youth-tov',theme:''},fields:{outline:'기존 설교 요점',news:'직접 작성한 주간 소식',welcome:'직접 작성한 환영',staff:'보존할 임원진'}}),source};
    window.bulletinFixtureSource=source;
    if(seed)await saveBulletinTemplate('youth-tov',B.templateValue(doc),0);
    return {revision:4,...B.storedValue(doc)};
   },n===0);
   weekly.set(n,row);
   await page.evaluate(()=>{
    const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:2147483647;background:var(--ui-surface-panel)';
    document.body.append(host);window.bulletinLiveDocs=new Map();
    window.bulletinLiveEditor=MindexBulletin.mount(host,{serviceId:bulletinFixtureSource.id,scope:'installed-fixture',documents:bulletinLiveDocs,
     services:[{id:bulletinFixtureSource.id,label:'검증용 주보'}],
     loadSource:async()=>structuredClone(bulletinFixtureSource),loadDraft:()=>window.readBulletinFixture(),
     saveDraft:(_id,value,revision)=>window.saveBulletinFixture(value,revision),
     loadTemplate:loadBulletinTemplate,saveTemplate:saveBulletinTemplate});
   });
   await page.waitForFunction(()=>bulletinLiveDocs.get(bulletinFixtureSource.id)?.settings.templateRevision===1&&document.querySelector('[data-bulletin-template-edit]')?.disabled===false);
  }
  const a=await apps[0].firstWindow(),b=await apps[1].firstWindow();
  const originalWeekly=JSON.stringify([...weekly]);
  const originalFields=await b.evaluate(()=>JSON.stringify(bulletinLiveDocs.get(bulletinFixtureSource.id).fields));
  await a.locator('[data-bulletin-template-edit]').click();
  await a.waitForFunction(()=>!!document.querySelector('[data-bulletin-editor-key]'));
  await a.getByText('입력칸 설정',{exact:true}).click();
  await a.locator('[data-bulletin-editor-key]').selectOption('outline');
  await a.locator('[data-bulletin-editor-label]').fill('말씀 정리');
  await a.locator('[data-bulletin-frame]').selectOption('newsTitle');
  await a.locator('[data-bulletin-design-label=newsTitle]').fill('우리의 소식');
  await a.locator('[data-bulletin-dimension=x]').fill('22.5');
  await a.locator('[data-bulletin-dimension=x]').dispatchEvent('change');
  await a.locator('[data-bulletin-save]').click();
  await b.waitForFunction(()=>bulletinLiveDocs.get(bulletinFixtureSource.id)?.settings.templateRevision===2,{},{timeout:45000});
  assert.equal(await b.locator('[data-frame-id=newsTitle]').first().textContent(),'우리의 소식');
  assert((await b.locator('[data-bulletin-field=outline]').locator('..').innerText()).includes('말씀 정리'));
  assert.equal(await b.evaluate(()=>bulletinLiveDocs.get(bulletinFixtureSource.id).frames.find(f=>f.id==='newsTitle').x),22.5);
  assert.equal(await b.evaluate(()=>JSON.stringify(bulletinLiveDocs.get(bulletinFixtureSource.id).fields)),originalFields);
  assert.equal(JSON.stringify([...weekly]),originalWeekly,'Receiving a template must not write weekly content');
  await b.locator('[data-bulletin-field=outline]').fill('작성 중인 설교 요점');
  await a.locator('[data-bulletin-design-label=newsTitle]').fill('새 공통 제목');
  await a.locator('[data-bulletin-save]').click();
  await a.waitForFunction(()=>document.querySelector('[data-bulletin-save]').disabled);
  await b.waitForTimeout(16000);
  assert.equal(await b.evaluate(()=>bulletinLiveDocs.get(bulletinFixtureSource.id).settings.templateRevision),2);
  assert.equal(await b.locator('[data-bulletin-field=outline]').inputValue(),'작성 중인 설교 요점');
  await b.locator('[data-bulletin-save]').click();
  await b.waitForFunction(()=>bulletinLiveDocs.get(bulletinFixtureSource.id).settings.templateRevision===3,{},{timeout:45000});
  assert.equal(await b.locator('[data-frame-id=newsTitle]').first().textContent(),'새 공통 제목');
  assert.equal(await b.locator('[data-bulletin-field=outline]').inputValue(),'작성 중인 설교 요점');
  assert.equal(await b.locator('[data-bulletin-field=news]').inputValue(),'직접 작성한 주간 소식');
  for(const app of apps)assert.equal(await app.evaluate(({app})=>app.getVersion()),version);
  console.log('PASS installed two-app bulletin settings via shared RPC: text/layout/labels update without restart; dirty input and weekly content preserved');
 }catch(error){
  console.error('Isolated bulletin assertion failed before cleanup:',error);throw error;
 }finally{
  const closed=await Promise.allSettled(apps.map((app,index)=>closeIsolatedElectron(app,tokens[index])));
  for(const [index,token] of tokens.entries()){
   if(closed[index]?.status!=='fulfilled')continue;
   const dir=path.join(fs.realpathSync(os.tmpdir()),'mindex-isolated-upgrade-'+token),marker=path.join(dir,'fixture-only.json');
   if(!fs.existsSync(marker))continue;
   assert(!fs.lstatSync(dir).isSymbolicLink()&&!fs.lstatSync(marker).isSymbolicLink());
   const saved=JSON.parse(fs.readFileSync(marker));
   assert.equal(saved.token,token);assert.equal(saved.appId,'kr.mindex.app.test');
   fs.rmSync(dir,{recursive:true,maxRetries:5,retryDelay:100});
  }
  const errors=closed.filter(result=>result.status==='rejected').map(result=>result.reason);
  if(errors.length)throw new AggregateError(errors,'Isolated bulletin app cleanup failed');
  console.log('PASS owned isolated bulletin window cleanup');
 }
}
main().catch(error=>{console.error(error);if(process.env.GITHUB_ACTIONS==='true')process.exit(1);else process.exitCode=1;});
