const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{webcrypto}=require('crypto');
(async()=>{for(const root of [require('path').resolve(__dirname,'..')]){
const ctx={crypto:webcrypto,TextEncoder};vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'/mindex.hymn-structure.js','utf8'),ctx);
const forms=[{id:'v',lyrics:'verse'},{id:'c',lyrics:'chorus'},{id:'a',lyrics:'amen'}];const hash=s=>require('crypto').createHash('sha256').update(s).digest('hex');
const records={x:{stanzaApproxMeasures:8,parts:forms.map((f,i)=>({unitId:f.id,textSha256:hash(f.lyrics),kind:['Verse','Chorus','Coda'][i],blockCount:i===0?2:1,approxMeasuresByBlock:[[3.833333,4.166667],[4],[1]][i]}))}};
const result=await ctx.MindexHymnStructure.describe('x',forms,records);assert.equal(result.text,'슬라이드당 약 4마디 / 아멘·Coda 별도 · 약 1마디');
assert.equal((await ctx.MindexHymnStructure.describe('x',[{...forms[0],lyrics:'edit'},...forms.slice(1)],records)).status,'stale');
assert.equal((await ctx.MindexHymnStructure.describe('copy',forms,records)).status,'unreviewed');
records.x.parts[0].approxMeasuresByBlock=[2,4];assert.match((await ctx.MindexHymnStructure.describe('x',forms,records)).text,/약 2–4마디/);
const rawHash=records.x.parts[0].textSha256;records.x.parts[0].textSha256=hash(' verse ');records.x.parts[0].displayTextSha256=rawHash;assert.equal((await ctx.MindexHymnStructure.describe('x',forms,records)).status,'measured');assert.equal((await ctx.MindexHymnStructure.describe('x',[{...forms[0],lyrics:'changed word'},...forms.slice(1)],records)).status,'stale');assert.equal((await ctx.MindexHymnStructure.describe('x',[{...forms[0],lyrics:'ver\nse'},...forms.slice(1)],records)).status,'stale');
}console.log('PASS slide estimates, separate Coda, fractional legacy input, stale/copy guards');})();
