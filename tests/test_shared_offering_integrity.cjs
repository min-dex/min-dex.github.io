const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');
const sourceService={id:'source',date:'2026-10-18',type_id:'sunday-second'};
const target={id:'target',date:sourceService.date,type_id:'sunday-main',allGenerations:true};
const hymn={id:'hymn',label:'봉헌찬송',slot:'offering.praise',section:'offering',song_id:'old',memo:{elementType:'praise',inputMode:'score_db'}};
let rows=[],writes=0;
const c={console,JSON,Map,Set,Error,
 state:{services:[sourceService,target],serviceItems:{}},
 isAllGenerationsWorshipService:s=>!!s?.allGenerations,
 allGenerationsOfferingMediaSpec:s=>s?.date==='2026-08-23'?{}:null,
 serviceItemSlotKey:i=>i.slot||'',templateProjectionSectionKey:i=>i.section||'',
 sundaySharedContentKey:i=>i.slot==='offering.praise'?'offering-hymn':'',
 compactSearchValue:x=>String(x||'').replace(/\s/g,''),parseServiceItemMemo:m=>m||{},
 serviceMemoElementType:m=>m.elementType,worshipAppServiceTypeId:x=>x,
 sundayEditSyncHasLocalDraft:()=>false,serviceTypeDisplayName:x=>x,
 worshipAtomicClient:async()=>({read:async()=>({service:target,sections:[],elements:rows}),save:async()=>writes++}),
 normalizeWorshipService:x=>x,groupWorshipElements:()=>({target:rows}),
 sundayEditSyncSignature:i=>JSON.stringify(i.song_id),sundayEditSyncPreviousSignatureMatches:()=>false,
 loadSongsForIds:async()=>{throw Error('SAFE_PREPARATION')},uniqueList:x=>[...new Set(x)]};
vm.createContext(c);
for(const name of ['allGenerationsHasOfferingReplacement','worshipServiceParticipatesInSharedSundayContent','sundayEditSyncEligible','persistSundayEditSync']){
 const start=source.search(new RegExp('(?:async )?function '+name+'\\('));assert(start>=0);
 vm.runInContext(source.slice(start,source.indexOf('\n}\n',start)+2),c);
}
(async()=>{
 assert(c.sundayEditSyncEligible(hymn,target));
 assert(!c.sundayEditSyncEligible({...hymn,slot:'praise.song.1'},target));
 assert(!c.sundayEditSyncEligible(hymn,{...target,date:'2026-08-23'}));
 for(const memo of [{templateSuppressed:true},{hiddenInPresentation:true},{asset:{url:'own.png'}}])assert(!c.sundayEditSyncEligible({...hymn,memo:{...hymn.memo,...memo}},target));
 const job={sourceServiceId:'source',targetId:'target',key:'offering-hymn',previous:hymn,item:{...hymn,song_id:'new'}};
 await assert.rejects(c.persistSundayEditSync(job),/봉헌찬송 항목이 없습니다/);
 rows=[{label:'봉헌 영상',slot:'offering.media',section:'offering'}];await c.persistSundayEditSync(job);
 for(const allGenerations of [true,false]){
  target.allGenerations=allGenerations;
  rows=[{...hymn,label:'봉헌특송',slot:'offering.special'},hymn];
  await c.persistSundayEditSync(job);
 }
 target.allGenerations=true;
 rows=[{...hymn,song_id:null,raw_title:''}];await assert.rejects(c.persistSundayEditSync(job),/SAFE_PREPARATION/);
 rows=[{...hymn,song_id:'independent'}];await assert.rejects(c.persistSundayEditSync(job),/덮어쓰지 않았습니다/);
 assert.equal(writes,0);
 console.log('PASS shared offering eligibility, missing-target failure, fresh media replacement, vacant fill and independent-content guards');
})().catch(e=>{console.error(e);process.exitCode=1});
