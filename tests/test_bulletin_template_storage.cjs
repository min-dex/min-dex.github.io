const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const code=app.slice(app.indexOf('async function loadBulletinTemplate('),app.indexOf('function mountServiceBulletinWorkbench('));
let response,calls=[];
const query=new Proxy({}, {get:(_,method)=>(...args)=>{calls.push([method,...args]);return method==='maybeSingle'?Promise.resolve(response):query;}});
const ctx=vm.createContext({state:{client:{from(table){calls.push(['from',table]);return query;}}}});vm.runInContext(code,ctx);
(async()=>{
 response={data:null,error:null};assert.equal(await ctx.loadBulletinTemplate('young-adult-2027'),null);
 assert.deepEqual(calls.find(c=>c[0]==='from'),['from','mindex_bulletin_templates']);
 calls=[];response={data:{revision:1},error:null};const value={layout:{design:'simple'},common:{welcome:'환영'}};
 await ctx.saveBulletinTemplate('young-adult-2027',value,0);assert.equal(calls.find(c=>c[0]==='insert')[1].template_key,'young-adult-2027');
 calls=[];await ctx.saveBulletinTemplate('young-adult-2027',value,2);
 assert.deepEqual(calls.filter(c=>c[0]==='eq'),[['eq','template_key','young-adult-2027'],['eq','revision',2]]);
 for(const error of [null,{code:'23505'}]){response={data:null,error};await assert.rejects(()=>ctx.saveBulletinTemplate('young-adult-2027',value,2),/다른 곳에서/);}
 response={data:null,error:{code:'42501',message:'permission denied'}};await assert.rejects(()=>ctx.saveBulletinTemplate('young-adult-2027',value,2),/저장 실패/);
 response={data:null,error:{code:'PGRST205',message:'missing table'}};await assert.rejects(()=>ctx.loadBulletinTemplate('young-adult-2027'),/저장소/);
 console.log('PASS separate template storage, insert/update revision guard, conflicts, permissions and unavailable schema');
})().catch(e=>{console.error(e);process.exitCode=1;});
