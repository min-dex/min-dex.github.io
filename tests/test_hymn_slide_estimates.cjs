const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{webcrypto}=require('crypto');
(async()=>{for(const root of [require('path').resolve(__dirname,'..')]){
const ctx={crypto:webcrypto,TextEncoder};vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'/mindex.hymn-structure.js','utf8'),ctx);
const forms=[{id:'v',lyrics:'verse'},{id:'c',lyrics:'chorus'},{id:'a',lyrics:'amen'}];const hash=s=>require('crypto').createHash('sha256').update(s).digest('hex');
const records={x:{stanzaApproxMeasures:8,parts:forms.map((f,i)=>({unitId:f.id,textSha256:hash(f.lyrics),kind:['Verse','Chorus','Coda'][i],blockCount:i===0?2:1,approxMeasuresByBlock:[[3.833333,4.166667],[4],[1]][i]}))}};
const result=await ctx.MindexHymnStructure.describe('x',forms,records);assert.equal(result.text,'approx. 4 bars');
assert.equal((await ctx.MindexHymnStructure.describe('x',[{...forms[0],lyrics:'edit'},...forms.slice(1)],records)).status,'stale');
assert.equal((await ctx.MindexHymnStructure.describe('copy',forms,records)).status,'unreviewed');
records.x.parts[0].approxMeasuresByBlock=[2,4];assert.equal((await ctx.MindexHymnStructure.describe('x',forms,records)).text,'approx. 4 bars');
const rawHash=records.x.parts[0].textSha256;records.x.parts[0].textSha256=hash(' verse ');records.x.parts[0].displayTextSha256=rawHash;assert.equal((await ctx.MindexHymnStructure.describe('x',forms,records)).status,'measured');assert.equal((await ctx.MindexHymnStructure.describe('x',[{...forms[0],lyrics:'changed word'},...forms.slice(1)],records)).status,'stale');assert.equal((await ctx.MindexHymnStructure.describe('x',[{...forms[0],lyrics:'ver\nse'},...forms.slice(1)],records)).status,'stale');
// Four identical Verse layouts must not overpower the shared refrain layout.
const pairedForms=[1,2,3,4].map(n=>({id:'verse'+n,lyrics:'verse '+n})).concat({id:'refrain',lyrics:'refrain'});
const pairedParts=pairedForms.map((f,i)=>({unitId:f.id,textSha256:hash(f.lyrics),kind:i<4?'Verse':'Chorus',blockCount:3,approxMeasuresByBlock:i<4?[4,2,2]:[4,4,4]}));
const pairedRecords={p:{parts:pairedParts}};
assert.equal((await ctx.MindexHymnStructure.describe('p',pairedForms,pairedRecords)).text,'approx. 4 bars');
const singleForms=[pairedForms[0],pairedForms[4]];
assert.equal((await ctx.MindexHymnStructure.describe('p',singleForms,{p:{parts:[pairedParts[0],pairedParts[4]]}})).text,'approx. 4 bars');
// Native DB values win without a runtime-file request; missing/malformed stay explicit.
assert.equal((await ctx.MindexHymnStructure.describe('db',singleForms,{db:{parts:[pairedParts[0],pairedParts[4]]}})).text,'approx. 4 bars');
assert.equal((await ctx.MindexHymnStructure.describe('db',singleForms,{db:undefined})).status,'unreviewed');
assert.equal((await ctx.MindexHymnStructure.describe('db',singleForms,{db:{}})).status,'stale');
const edited=structuredClone(pairedParts[0]);edited.approxMeasuresByBlock=[8,8,8];
assert.equal((await ctx.MindexHymnStructure.describe('db',[singleForms[0]],{db:{parts:[edited]}})).text,'approx. 8 bars');
assert.equal(pairedParts.length,5); // Display calculation never changes stored sections.
}console.log('PASS slide estimates, separate Coda, fractional legacy input, stale/copy guards');})();
