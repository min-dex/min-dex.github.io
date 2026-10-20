// Three-way editor recovery: keep remote-only changes; surface real conflicts.
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function mergeEditorDraft(base,draft,current){
 const conflicts=[];
 function merge(b,d,c,path){
  if(equal(b,d)||equal(d,c))return structuredClone(c);
  if(equal(b,c))return structuredClone(d);
  if(object(b)&&object(d)&&object(c)){
   const out={};
   for(const key of new Set([...Object.keys(b),...Object.keys(d),...Object.keys(c)])){
    // Runtime fields are not part of the persisted baseline.
    const value=key.startsWith('_')?c[key]:merge(b[key],d[key],c[key],[...path,key]);
    if(value!==undefined)out[key]=value;
   }
   return out;
  }
  if([b,d,c].every(Array.isArray)){
   const ids=a=>a.map(v=>object(v)&&typeof v.id==='string'?v.id:null);
   const bi=ids(b),di=ids(d),ci=ids(c);
   // Structural/order edits remain a whole-list conflict, never silently sorted.
   if(!bi.includes(null)&&new Set(bi).size===bi.length&&equal(bi,di)&&equal(bi,ci))
    return b.map((v,i)=>merge(v,d[i],c[i],[...path,i]));
  }
  conflicts.push({path:path.join('.'),current:structuredClone(c),draft:structuredClone(d)});
  return structuredClone(d);
 }
 return {value:merge(base,draft,current,[]),conflicts};
}
