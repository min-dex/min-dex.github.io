const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = { state: { worshipSetlistArchiveYear:'2026', worshipSetlistArchiveView: 'date', worshipSetlistArchiveMonth: '09' } };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'mindex.worship-week.js'), 'utf8'), context);
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
for(const name of ['normalizedSetlistArchiveYear','worshipSetlistArchiveYears','filterWorshipSetlistArchivePeriod']) { const start=app.indexOf('function '+name+'(');vm.runInContext(app.slice(start,app.indexOf('\nfunction ',start+1)),context); }
const services = [{id:'monthly',service_date:'2026-09-04',service_type_id:'monthly',service_alias:'온세대 월삭예배'}];
const entries = context.MindexWorshipWeek.build([], services).flatMap(group => group.entries);
const monthly = entries.find(entry => entry.source.service_date === '2026-09-04');
assert.equal(monthly.source.service_type_id, 'monthly');
assert.equal(monthly.slotName, '월삭예배');
assert.equal(monthly.weeklyStatus, '콘티 미등록');
const filtered = context.filterWorshipSetlistArchivePeriod(entries);
assert(filtered.every(entry => entry.source.service_date.startsWith('2026-09')));
assert(filtered.includes(monthly));
context.state.worshipSetlistArchiveView = 'service';
assert.deepEqual(context.filterWorshipSetlistArchivePeriod(entries), filtered);
console.log('PASS monthly identity and calendar-month boundaries');

const boundary = context.MindexWorshipWeek.build([
 {source:{service_date:'2025-12-28',service_type_id:'youth'},candidates:[{raw_title:'실제 콘티'}]},
 {source:{service_date:'2026-01-02',service_type_id:'monthly'},candidates:[]}
], [], {statusStartDate:'2026-01-01'}).flatMap(group=>group.entries);
assert.equal(boundary.filter(entry=>entry.source.service_date.startsWith('2025')).length,1);
assert.equal(boundary.find(entry=>entry.source.service_date==='2025-12-28').candidates.length,1);
context.state.worshipSetlistArchiveMonth='';
for(const year of ['2025','2026','2027']){
 context.state.worshipSetlistArchiveYear=year;
 const rows=context.filterWorshipSetlistArchivePeriod(boundary);
 assert.equal(rows.length,year==='2027'?0:1);
 assert(rows.every(e=>e.source.service_date.startsWith(year)));
}
context.state.worshipSetlistArchiveYear='2030';
const years=context.worshipSetlistArchiveYears(boundary);
assert(years.includes('2025')&&years.includes('2026')&&years.includes('2031')&&years.includes('2029'));
assert.equal(new Set(years).size,years.length);
assert(app.includes('data-setlist-period="year"'));
assert.equal(context.MindexWorshipWeek.info('2026-01-02').title,'12월 5주');
assert(context.MindexWorshipWeek.info('2026-01-02').range.includes('2025년'));
assert(context.MindexWorshipWeek.info('2026-01-02').range.includes('2026년'));
console.log('PASS year/month filters in both views, empty future, civil-year boundary partition and Wednesday week label');
