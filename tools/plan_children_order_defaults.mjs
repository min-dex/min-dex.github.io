// Explicit maintenance plan only. No network, persistence, lyrics or media rewriting.
// Callers must read fresh aggregates and commit through the existing atomic client.
const clone = value => structuredClone(value);
const alias = key => ({call:'opening',decision:'response_song',response_prayer:'response_song',send:'community_confession',lords:'lords_prayer'}[key] || key);
const defaultIntro = new Map([
  ['creed', {title:'신앙고백',body:'사도신경'}],
  ['community_confession', {title:'공동체고백'}],
  ['lords_prayer', {title:'주기도문'}],
]);
const isDefaultIntro = (value, expected) => value && Object.keys(value).every(key=>['title','body'].includes(key))
  && String(value.title || '') === expected.title && String(value.body || '') === (expected.body || '');
export function planChildrenOrderDefaults(aggregate, reference) {
  const service = aggregate?.service;
  if (!service?.id || service.service_type_id !== 'children') throw Error('CHILDREN_SERVICE_REQUIRED');
  if (service.service_date === '2026-10-25' || service.id === reference?.service?.id) throw Error('REFERENCE_MUST_REMAIN_UNCHANGED');
  if (reference?.service?.service_date !== '2026-10-25' || reference.service.service_type_id !== 'children') throw Error('REFERENCE_REQUIRED');
  const sections = clone(aggregate.sections), elements = clone(aggregate.elements);
  const ranks = new Map([...reference.sections].sort((a,b)=>a.sort_order-b.sort_order).map((row,i)=>[alias(row.section_key),i]));
  const ordered = [...sections].sort((a,b)=>a.sort_order-b.sort_order);
  // Sort recognized sections into their existing slots. User-added sections retain
  // their positions relative to one another; no section or element is deleted.
  const recognized = ordered.filter(row=>ranks.has(alias(row.section_key)));
  const sorted = [...recognized].sort((a,b)=>ranks.get(alias(a.section_key))-ranks.get(alias(b.section_key)) || a.sort_order-b.sort_order);
  let position=0;
  const target = ordered.map(row=>ranks.has(alias(row.section_key))?sorted[position++]:row);
  const changedOrder = target.some((row,i)=>row.id!==ordered[i].id);
  if(changedOrder)target.forEach((row,i)=>{row.sort_order=(i+1)*10;});
  const bySection = new Map(sections.map(row=>[row.id,row]));
  const changes=[];
  for(const element of elements){
    const key=alias(bySection.get(element.section_id)?.section_key);
    const expected=defaultIntro.get(key);
    if(!expected)continue;
    // Only remove the exact old generated header. Custom headings are authored
    // content; keep them even when they use the same slot or section.
    for(const field of ['config','source_ref']){
      if(isDefaultIntro(element[field]?.introSlide,expected)){
        delete element[field].introSlide;
        changes.push({id:element.id,field:field+'.introSlide',action:'remove-exact-default'});
      }
    }
  }
  return {rows:{sections,elements},changes,changedOrder};
}
