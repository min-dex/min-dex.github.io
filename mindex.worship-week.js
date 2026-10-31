(function(root) {
  const publicSlots = [['sunday-second','주일예배 [2부]'],['sunday-main','주일예배 [3부]'],['sunday-afternoon','주일오후예배'],['wednesday','수요예배'],['friday','금요기도회']];
  const departmentSlots = [['nursery','유치부 예배'],['children','어린이부 예배'],['youth','청소년부 예배'],['young-adult','청년부 예배']];
  const slots = [...publicSlots,...departmentSlots];
  const type = id => ({sun_3rd:'sunday-main',sun_1st:'sunday-first',sun_2nd:'sunday-second',young_adult:'young-adult',wed:'wednesday',fri:'friday',monthly:'friday',kindergarten:'nursery',preschool:'nursery','유치부':'nursery','유치부 예배':'nursery'})[id] || id;
  const date = text => {
    const value = /^\d{4}-\d{2}-\d{2}$/.test(text || '') ? new Date(text+'T00:00:00Z') : new Date(NaN);
    return !Number.isNaN(+value) && value.toISOString().slice(0,10) === text ? value : new Date(NaN);
  };
  const add = (text, days) => { const d=date(text); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); };
  const week = text => {const d=date(text);return Number.isNaN(+d)?'':add(text,-d.getUTCDay());};
  const aliases = s => [s.source_name,s.title,s.service_alias,...(Array.isArray(s.aliases)?s.aliases:[s.aliases])].filter(Boolean).join(' ');
  const absent = s => s && (s.no_gathering === true || s.no_gathering === 'true' || s.source_ref?.no_gathering === true || s.source_ref?.no_gathering === 'true' || /집회\s*없음/.test(aliases(s)));
  function info(text) {
    const key=week(text);if(!key)return {key:'',title:'날짜 없음',range:''};
    const start=date(key),end=date(add(key,6)),middle=date(add(key,3));
    const label=d=>`${d.getUTCMonth()+1}월 ${d.getUTCDate()}일`;
    const range=start.getUTCFullYear()!==end.getUTCFullYear()
      ? `${start.getUTCFullYear()}년 ${label(start)}–${end.getUTCFullYear()}년 ${label(end)}`
      : start.getUTCMonth()===end.getUTCMonth() ? `${start.getUTCMonth()+1}월 ${start.getUTCDate()}–${end.getUTCDate()}일` : `${label(start)}–${label(end)}`;
    return {key,title:`${middle.getUTCMonth()+1}월 ${Math.ceil(middle.getUTCDate()/7)}주`,range};
  }
  function layout(entries=[]) {
    const known=new Set(slots.map(([id])=>id));
    const row=definitions=>definitions.map(([id,name])=>({id,name,entries:entries.filter(e=>type(e.source.service_type_id)===id)}));
    const special=entries.filter(e=>!known.has(type(e.source.service_type_id))).slice().sort((a,b)=>String(a.source.service_date||'').localeCompare(String(b.source.service_date||'')));
    return {public:row(publicSlots),departments:row(departmentSlots),special};
  }
  function build(entries = [], services = []) {
    const usable = services.filter(s=>type(s.service_type_id)!=='sunday-first');
    const keys=[...entries.map(e=>week(e.source.service_date)),...usable.map(s=>week(s.service_date))].filter(Boolean).sort();
    const groups=[];
    for(const key of new Set(keys)) {
      const actual=entries.filter(e=>week(e.source.service_date)===key);
      const scheduled=usable.filter(s=>week(s.service_date)===key);
      const main=actual.find(e=>type(e.source.service_type_id)==='sunday-main')?.source || scheduled.find(s=>type(s.service_type_id)==='sunday-main');
      const allGeneration=main && /온세대/.test(aliases(main));
      const cells=actual.map(e=>{
        const id=type(e.source.service_type_id),name=e.source.service_type_id==='monthly'?'월삭예배':slots.find(row=>row[0]===id)?.[1];
        if(e.candidates.length)return {...e,slotName:name};
        const saved=scheduled.find(s=>s.id===(e.source.service_id||e.source.id)) || scheduled.find(s=>s.service_date===e.source.service_date&&type(s.service_type_id)===id);
        const noGathering=absent(e.source)||absent(saved);
        return {...e,slotName:name,weeklyStatus:e.source.weekly_status||(noGathering?'집회 없음':'콘티 미등록'),weeklyReason:e.source.weekly_reason||(noGathering?(saved?.service_alias||saved?.title||''):'찬양 목록이 아직 등록되지 않았습니다')};
      });
      for(const saved of scheduled) {
        if(saved.id&&actual.some(e=>e.source.service_id===saved.id||e.source.id===saved.id||e.source.id==='worship:'+saved.id))continue;
        if(actual.some(e=>!e.source.service_id&&e.source.service_date===saved.service_date&&type(e.source.service_type_id)===type(saved.service_type_id)))continue;
        const id=type(saved.service_type_id),merged=allGeneration&&['children','youth'].includes(id),noGathering=absent(saved);
        cells.push({source:{...saved,service_id:saved.id,aliases:saved.service_alias||''},candidates:[],missing:true,slotName:saved.service_type_id==='monthly'?'월삭예배':slots.find(row=>row[0]===id)?.[1],weeklyStatus:merged||noGathering?'집회 없음':'콘티 미등록',weeklyReason:merged?'온세대 찬양예배':noGathering?(saved.service_alias||saved.title||''):'찬양 목록이 아직 등록되지 않았습니다'});
      }
      if(cells.length)groups.push({...info(key),entries:cells});
    }
    return groups.reverse();
  }
  root.MindexWorshipWeek={build,info,layout};
})(typeof window==='undefined'?globalThis:window);

// App navigation labels; stored titles and output/print naming remain independent.
function serviceNavigationDetails(service = {}) {
  const typeId = worshipAppServiceTypeId(service.type_id || service.service_type_id || "");
  const base = serviceTypeDisplayName(typeId);
  const source = service._worshipSourceRef || service.source_ref || {};
  const raw = normalizeServiceDisplayName(serviceAlias(service));
  const reason = String(source.no_gathering_reason || service.no_gathering_reason || service.weekly_reason || "").trim();
  const absent = source.no_gathering === true || source.no_gathering === "true" || service.no_gathering === true || /집회\s*없음/.test(raw);
  let alias = raw.replace(/\s*·\s*정규 집회 없음\s*$/, "").replace(/\s+대체\s*$/, "").trim();
  if (!alias && absent && /(?:으로|로) 대체$/.test(reason)) alias = reason.replace(/(?:으로|로) 대체$/, "").trim();
  const replacement = absent && Boolean(alias) && alias !== base && !/집회\s*없음/.test(alias);
  if (replacement) {
    const department = base.replace(/\s*예배$/, "");
    if (/부$/.test(department) && alias.startsWith(department + " ")) alias = alias.slice(department.length + 1);
  }
  const name = alias || base;
  return {base, name, context:replacement ? `${base} 대체` : name !== base ? base : "", replacement, absent};
}
function serviceNavigationName(service = {}) { return serviceNavigationDetails(service).name; }
function serviceNavigationTypeName(typeId) { return serviceNavigationName({ type_id: typeId }); }
function worshipSetlistNavigationService(source = {}) {
  const aliases = Array.isArray(source.aliases) ? source.aliases : [source.aliases || source.service_alias || ""];
  return {...source, type_id:worshipAppServiceTypeId(source.service_type_id),
    alias:[...new Set(aliases.map(value => String(value || "").trim()).filter(Boolean))].join(" · ")};
}
function worshipSetlistNavigationName(source = {}) { return serviceNavigationName(worshipSetlistNavigationService(source)); }

function renderWorshipSetlistWeekLayout(entries) {
  const card=entry=>entry.weeklyStatus ? renderWorshipWeekStatus(entry) : renderWorshipSetlistArchiveEntry(entry);
  if(state.worshipSetlistArchiveView==='service')return `<div class="svc-setlist-entry-list">${entries.map(card).join('')}</div>`;
  const layout=window.MindexWorshipWeek.layout(entries);
  const row=(cells,label)=>`<div class="svc-setlist-week-row" aria-label="${label}">${cells.map(cell=>`<div class="svc-setlist-week-slot" data-setlist-slot="${cell.id}">${cell.entries.length?cell.entries.map(card).join(''):`<div class="svc-setlist-slot-empty"><strong>${escapeHtml(cell.name)}</strong><span>등록된 예배 없음</span></div>`}</div>`).join('')}</div>`;
  return `<div class="svc-setlist-week-layout">${row(layout.public,'공예배')}${row(layout.departments,'부서 예배')}${layout.special.length?`<div class="svc-setlist-week-row" aria-label="기타 예배">${layout.special.map(card).join('')}</div>`:''}</div>`;
}
