const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const take=(start,end)=>src.slice(src.indexOf(start),src.indexOf(end,src.indexOf(start)));
let answer=null,inserts=0;
const c={String,Number,window:{prompt:()=>answer},praiseServiceCreates:new Set(),state:{config:{url:'fixture'},selectedServiceId:'svc',services:[{id:'svc',type_id:'wednesday'}],songs:[],serviceItems:{},dirty:{}},
 servicePraiseInputMode:()=>"lyrics_db",parseServiceItemMemo:()=>({}),
 isSongServiceLabel:x=>/^찬양/.test(x),isSpecialSongServiceItem:x=>x.label==='특송',escapeAttr:String,escapeHtml:String,findDeferredServiceTextInput:()=>null,linkedSongLoadPromises:new Map(),renderServiceSongVersionPicker:()=>"",
 serviceSongPickerResults:()=>c.searchResults,renderServiceSongPickerResult:s=>s.title,searchResults:[],
 getServiceItems:()=>c.state.serviceItems.svc,showToast:()=>{},presenterPreparationSongContentHasConnection:x=>x.includes('+'),
 resolveExistingPraiseSongForServiceInputAfterCatalogLoad:async()=>null,requireClient:()=>true,
 stripHymnNo:x=>({title:x}),presenterPreparationSongContent:x=>x,createUuid:()=> 'version',serializeSongMemo:JSON.stringify,
 normalizeServerSong:x=>x,sortSongs:()=>0,clearSearchCaches:()=>{},getDefaultVersionId:()=> 'version',normalizeServiceItemsInCurrentOrder:x=>x,
 renderCurrentServiceModuleDetail:()=>{},updateSaveState:()=>{}};
c.createEmptyPraiseAtomic=async options=>{inserts++;return {id:'new-song',title:options.title}};
c.linkServiceItemToPraiseSong=(item,song)=>{item.song_id=song.id;item.version_id='version';item.song_version_id='version';};
c.state.client={from:()=>({insert:payload=>{inserts++;return {select:()=>({single:async()=>({data:{id:'new-song',...payload}})})}}})};
vm.createContext(c);
vm.runInContext(take('function renderServiceSongPicker(', '\nfunction renderServiceSongVersionPicker'),c);
vm.runInContext(take('function renderServicePraiseLinkControl(', '\nfunction renderServiceItemLinkControl'),c);
vm.runInContext(take('async function createPraiseSongFromServiceItem(', '\nfunction selectServiceSongForItem'),c);
(async()=>{
 assert.equal(c.renderServicePraiseLinkControl({label:'찬양 3'},2),'');
 assert.equal(c.renderServicePraiseLinkControl({label:'특송'},2),'');
 const db={strictSong:true,service:{}};
 for(const label of ['찬양 3','특송']){
  const item={label,raw_title:'등록할 새 곡'};
  assert.match(c.renderServiceSongPicker(item,2,db),/data-service-song-create="2">새 곡 등록/);
  assert.doesNotMatch(c.renderServiceSongPicker({...item,raw_title:' '},2,db),/data-service-song-create/);
  assert.equal(c.renderServiceSongPicker(item,2,{strictSong:false}), '');
  c.searchResults=[{title:'기존 찬양'}];
  assert.doesNotMatch(c.renderServiceSongPicker(item,2,db),/data-service-song-create/);
  c.searchResults=[];
  assert.doesNotMatch(c.renderServiceSongPicker({...item,song_id:'loading'},2,db),/data-service-song-create/);
 }

 assert.match(c.renderServicePraiseLinkControl({label:'찬양 3',song_id:'keep'},2),/data-service-db-song="keep"/);
 assert.doesNotMatch(c.renderServicePraiseLinkControl({label:'찬양 3',song_id:'keep'},2),/새 곡 추가/);
 assert.equal(c.renderServicePraiseLinkControl({label:'대표기도'},2),'');
 const item={id:'slot',label:'찬양 3',raw_title:'',memo:'medley metadata',sort_order:30};
 const sibling={id:'keep',song_id:'existing',sort_order:40,memo:'keep medley'};
 c.state.serviceItems.svc=[item,sibling];const initial=JSON.stringify(c.state.serviceItems.svc);
 await c.createPraiseSongFromServiceItem(0);assert.equal(inserts,0);assert.equal(JSON.stringify(c.state.serviceItems.svc),initial);
 answer='  ';await c.createPraiseSongFromServiceItem(0);assert.equal(inserts,0);
 answer='첫 곡 + 다음 곡';await c.createPraiseSongFromServiceItem(0);assert.equal(inserts,0);
 for(const mode of ['manual_praise','audio_praise']){c.servicePraiseInputMode=()=>mode;await c.createPraiseSongFromServiceItem(0);assert.equal(inserts,0);}
 c.servicePraiseInputMode=()=>"lyrics_db";c.findDeferredServiceTextInput=()=>({value:'새 찬양'});
 answer='다른 제목';await c.createPraiseSongFromServiceItem(0);assert.equal(inserts,1);assert.equal(item.raw_title,'새 찬양');assert.equal(item.song_id,'new-song');assert.equal(item.memo,'medley metadata');assert.equal(item.sort_order,30);assert.equal(sibling.song_id,'existing');
 await c.createPraiseSongFromServiceItem(0);assert.equal(inserts,1);
 console.log('PASS search-only/direct/special/linked buttons, cancel/blank, medley guard, title creation and sibling identity');
})().catch(e=>{console.error(e);process.exitCode=1});
