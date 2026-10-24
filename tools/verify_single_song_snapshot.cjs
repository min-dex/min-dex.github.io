/* Offline only. Usage: node tools/verify_single_song_snapshot.cjs SNAPSHOT PLAN OUTPUT_DIR */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const [snapshot,planFile,outDir]=process.argv.slice(2);if(!snapshot||!planFile||!outDir)throw Error('Provide explicit local snapshot, plan and private output directory');
const bytes=fs.readFileSync(snapshot),d=JSON.parse(bytes),plan=JSON.parse(fs.readFileSync(planFile));
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),plan.summary.snapshotSha256,'Snapshot drift');
const c={console,structuredClone,document:{addEventListener(){}},localStorage:{getItem(){return null}},setTimeout,clearTimeout,URL,URLSearchParams,crypto:crypto.webcrypto};c.window=c;c.__mindexRuntimeStarted=true;c.location={search:'',hash:'',pathname:'/'};vm.createContext(c);
for(const f of ['mindex.single-song.js','mindex.constants.js','mindex.worship-model.js','mindex.worship-persistence.js',...(fs.existsSync(path.join(__dirname,'..','mindex.presenter-praise.js'))?['mindex.presenter-praise.js']:[]),'mindex.presenter.js','mindex.worship-input.js','mindex.worship-source.js','mindex.setlist-links.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c,{filename:f});
c.snapshot=d;c.plan=plan;c.assert=assert;
const result=vm.runInContext(`(()=>{
const source=new Map(snapshot.mindex_songs.map(r=>[r.id,r])), canonical=new Map(snapshot.mindex_canonical_songs.map(r=>[r.id,r]));
const versions=new Map(snapshot.mindex_song_versions.map(r=>[r.id,r]));
const records=[],held=[];let units=0,audio=0;
for(const p of plan.records){
 if(!p.idCandidate){held.push(p.legacyVersionId);continue;}
 const v=versions.get(p.legacyVersionId), row=source.get(v.source_song_id)||source.get(v.canonical_song_id)||canonical.get(v.canonical_song_id);
 const song=normalizeServerSong(row);
 const forms=snapshot.mindex_version_units.filter(u=>u.version_id===v.id).map(normalizeRelationalUnit).sort((a,b)=>a.sort_order-b.sort_order||a.id.localeCompare(b.id));
 const normalized=normalizeRelationalVersion(v,0);normalized.forms=normalizeForms(forms);
 song.versions=normalizeSongVersions(song,[normalized]);
 const version=song.versions[0],record=MindexSingleSong.fromLegacySong(song,version,p.idCandidate);
 const view=MindexSingleSong.createCatalog([record]).appSong(record.id);
 assert.equal(JSON.stringify(view.versions[0].forms),JSON.stringify(version.forms));
 assert.equal(JSON.stringify(view.versions[0].audio_set),JSON.stringify(version.audio_set));
 assert.equal(JSON.stringify(view.metadata),JSON.stringify(song.metadata));
 assert.equal(view.versions[0].output_title,version.output_title);
 units+=forms.length;if(version.audio_set)audio++;
 record.provenance={canonical:structuredClone(canonical.get(v.canonical_song_id)),source:structuredClone(row),version:structuredClone(v),units:structuredClone(snapshot.mindex_version_units.filter(u=>u.version_id===v.id))};
 record.revision=0;
 records.push(record);
}
for(const record of records){
 const owner=record.legacy.songId,canonicalId=record.legacy.canonicalId;
 const targetIds=snapshot.mindex_song_relations.filter(r=>r.source_song_id===owner||r.source_song_id===canonicalId).map(r=>r.related_song_id);
 record.relations={same_song:records.filter(r=>r.id!==record.id&&canonicalId&&r.legacy.canonicalId===canonicalId).map(r=>r.id),
 related:records.filter(r=>r.id!==record.id&&targetIds.some(id=>r.legacy.songId===id||r.legacy.canonicalId===id)).map(r=>r.id)};
}
const catalog=MindexSingleSong.createCatalog(records),elements=[];
for(const row of snapshot.mindex_worship_elements){
 if(!row.song_id&&!row.song_version_id)continue;
 const single=catalog.singleItem(row),back=catalog.legacyElement(single);
 assert.deepEqual(back,row);elements.push(single);
}
const pending=[],structuredCounts={resolved:0,pending:0},sourceCounts={changed:0,pending:0};const sourcePatches=[],structuredPatches=[];
function inspect(value,table,rowId,path=''){
 if(typeof value==='string'){
  if(/^-\\s*(?:곡|버전) ID:/m.test(value)){
   const r=MindexSingleSong.rewriteSource(value,catalog);if(r.text!==value){sourceCounts.changed++;sourcePatches.push({table,rowId,path,before:value,after:r.text});}
   for(const q of r.pending){pending.push({table,rowId,...q,path:path+q.path});sourceCounts.pending++;}
  }
  // JSON strings must be inspected without changing their serialization or prose.
  if(/^\\s*[\\[{]/.test(value))try{inspect(JSON.parse(value),table,rowId,path+'/json');}catch{}
 }else if(value&&typeof value==='object'){
  if(!Array.isArray(value)&&(value.songId||value.song_id||value.song_version_id||value.versionId||value.version_id||value.songVersionId)){
   const r=MindexSingleSong.rewriteStructured(value,catalog);
   if(r.pending.length){structuredCounts.pending+=r.pending.length;pending.push(...r.pending.map(q=>({table,rowId,...q,path:path+q.path})));}
   else {structuredCounts.resolved++;structuredPatches.push({table,rowId,path,before:structuredClone(value),after:r.value});}
  }
  for(const [k,v]of Object.entries(value))inspect(v,table,rowId,path+'/'+k);
 }
}
for(const [table,rows]of Object.entries(snapshot))if(table.startsWith('mindex_worship_'))for(const row of rows)for(const [k,v]of Object.entries(row))if(typeof v==='object'||typeof v==='string')inspect(v,table,row.id,'/'+k);
return {records,elements,pending,sourcePatches,structuredPatches,summary:{records:records.length,held:held.length,units,audio,directReferences:elements.length,structuredCounts,sourceCounts,productionWrites:0}};
})()`,c);
assert.deepEqual(fs.readFileSync(snapshot),bytes);
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'catalog.private.json'),JSON.stringify(result.records));
fs.writeFileSync(path.join(outDir,'pending.private.json'),JSON.stringify(result.pending,null,2));
fs.writeFileSync(path.join(outDir,'reference-patches.private.json'),JSON.stringify({sources:result.sourcePatches,structured:result.structuredPatches,elements:result.elements}));
fs.writeFileSync(path.join(outDir,'summary.json'),JSON.stringify(result.summary,null,2));
console.log(JSON.stringify(result.summary,null,2));
