const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('app.js', 'utf8');
const first={id:'first',type_id:'sunday-first',date:'2026-10-11'};
const second={id:'second',type_id:'sunday-second',date:first.date};
const third={id:'third',type_id:'sunday-main',date:first.date};
const item=(id,slot,label,section,song)=>({id,service_id:id.split(':')[0],label,song_id:song,
  _worshipSlotKey:slot,_worshipSectionKey:section,memo:JSON.stringify({elementType:'praise',inputMode:'score_db'})});
const original=item('first:3','praise.song.3','찬양 3','praise','old');
const edited={...original,song_id:'new',_worshipSharedContentDirty:true};
const hymn=item('third:hymn','hymn.main','찬송','hymn_praise',null);
const independent=item('third:3','praise.song.3','찬양 3','praise','independent');
let jobs=[];
const c={console,JSON,Map,Set,
  worshipAppServiceTypeId:x=>x, serviceItemSlotKey:x=>x._worshipSlotKey||'',
  compactSearchValue:x=>String(x||'').replace(/\s/g,''),isSermonCitationSlotKey:()=>false,
  isAllGenerationsWorshipService:s=>!!s?.allGenerations,
  worshipServiceParticipatesInSharedSundayContent:s=>!s?.allGenerations,
  parseServiceItemMemo:x=>JSON.parse(x||'{}'),serializeServiceItemMemo:JSON.stringify,
  serviceMemoElementType:m=>m.elementType,
  state:{services:[first,second,third,{...third,id:'next-week',date:'2026-10-18'}],worshipSections:[],worshipElements:[],dirtyServiceElementIds:new Map()},
  groupWorshipElements:()=>({first:[edited]}),pendingSundayEditSync:new Map(),
  uniqueList:x=>[...new Set(x)],persistPendingSundayEditSync:()=>true,
  sundayEditSyncItemSnapshot:x=>x,persistSundayEditSync:async job=>jobs.push(job),
};
vm.createContext(c);
for(const name of ['sundaySharedContentKey','sundaySharedContentTypesForItem','sundaySharedContentItemIndex','sundayEditSyncEligible','sundayEditSyncContent','sundayEditSyncSignature','applySundayEditSync','syncSharedSundayContentAfterSave']){
  const re=new RegExp(`(?:async )?function ${name}\\(`),start=source.search(re);
  assert(start>=0);vm.runInContext(source.slice(start,source.indexOf('\n}\n',start)+2),c);
}
(async()=>{
 assert.equal(c.sundaySharedContentKey(independent,third),'');
 assert.equal(c.sundaySharedContentItemIndex([independent,hymn],'main-praise:3',third),1);
 assert.equal(c.sundayEditSyncEligible(independent,third),false);
 assert.equal(c.sundayEditSyncEligible(hymn,third),true);
 assert.equal(c.sundayEditSyncEligible(hymn,{...third,allGenerations:true}),false);
 assert.equal(c.sundayEditSyncEligible({...hymn,memo:JSON.stringify({elementType:'praise',asset:{url:'custom'}})},third),false);
 assert.equal(c.sundaySharedContentTypesForItem(hymn,third).length,0,'third hymn must not overwrite first/second');
 await c.syncSharedSundayContentAfterSave(first,[edited],{previousItems:[original]});
 assert.deepEqual(jobs.map(j=>j.targetId).sort(),['second','third']);
 assert(jobs.every(j=>j.key==='main-praise:3'));
 jobs=[];
 await c.syncSharedSundayContentAfterSave(first,[edited],{previousItems:[edited]});
 assert.equal(jobs.length,0,'unchanged saves must not propagate');
 for(const n of [1,2])assert.deepEqual(Array.from(c.sundaySharedContentTypesForItem(item('first:'+n,'praise.song.'+n,'찬양 '+n,'praise','song'),first)),['sunday-first','sunday-second']);
 const applied=c.applySundayEditSync(hymn,edited);
 assert.equal(applied.id,hymn.id);assert.equal(applied.label,'찬송');assert.equal(applied._worshipSlotKey,'hymn.main');assert.equal(applied.song_id,'new');
 // Exercise the real persistence selection/conflict path before any write.
 let targetHymn=hymn;
 Object.assign(c,{
   sundayEditSyncHasLocalDraft:()=>false,serviceTypeDisplayName:x=>x,
   worshipAtomicClient:async()=>({read:async()=>({service:third,sections:[],elements:[]})}),
   normalizeWorshipService:x=>x,
   groupWorshipElements:()=>({third:[independent,targetHymn]}),
   serviceItemHasDirectSundaySharedContent:x=>!!x.song_id,
   loadSongsForIds:async()=>{throw new Error('TEST_REACHED_SAFE_WRITE_PREPARATION');},
 });
 const start=source.indexOf('async function persistSundayEditSync(');
 vm.runInContext(source.slice(start,source.indexOf('\n}\n',start)+2),c);
 const job={sourceServiceId:first.id,targetId:third.id,key:'main-praise:3',previous:original,item:edited};
 await assert.rejects(c.persistSundayEditSync(job),/TEST_REACHED_SAFE_WRITE_PREPARATION/);
 targetHymn={...hymn,song_id:'separately-edited'};
 await assert.rejects(c.persistSundayEditSync(job),/덮어쓰지 않았습니다/);
 c.sundayEditSyncHasLocalDraft=()=>true;
 await assert.rejects(c.persistSundayEditSync(job),/덮어쓰지 않았습니다/);
 console.log('PASS third hymn mapping, independent praise isolation, same-date dispatch, one-way scope, custom media/all-generation guards, unchanged save and target identity');
})().catch(e=>{console.error(e);process.exitCode=1});
