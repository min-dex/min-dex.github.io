const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const context = vm.createContext({ state: { worshipBackgroundRegistry: { '25-S1.png': { dataUrl: 'unchanged' } } } });
const first = source.indexOf('const WORSHIP_BACKGROUND_BASE =');
vm.runInContext(source.slice(first, source.indexOf('\nfunction ', first)), context);
for (const name of ['parseLocalDate', 'churchYearForCalendarDate', 'adventStartDate', 'worshipBackgroundYearCode', 'worshipBackgroundFileName', 'worshipBackgroundTargets', 'worshipBackgroundPath']) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0);
  vm.runInContext(source.slice(start, source.indexOf('\nfunction ', start + 1)), context);
}
const file = context.worshipBackgroundFileName;
for (const [date, year] of [['2025-11-29','25'],['2025-11-30','26'],['2026-11-28','26'],['2026-11-29','27'],['2026-12-25','27'],['2027-01-06','27'],['2027-03-28','27']]) {
  for (let i=1;i<=6;i++) {
    assert.equal(file(`S${i}`, '', date), `${year}-S${i}.png`);
    assert.equal(file('S', i, date), `${year}-S${i}.png`);
  }
  for (const code of ['A','B','C','SH','ST']) {
    assert.equal(file(code, 6, date), `${date.slice(2,4)}-${code}${code.length===1?'6':''}.png`);
  }
}
const before=JSON.stringify(context.state);
for (const date of ['2026-10-30','2026-11-28','2026-11-29','2026-12-25','2027-01-06']) {
  const names=Array.from(context.worshipBackgroundTargets(date), t=>t.fileName);
  for (const name of ['27-S1.png','27-S2.png','25-S1.png','26-S4.png','26-S5.png','26-S6.png']) assert(names.includes(name), `${date}: ${name}`);
  assert(names.includes(`${date.slice(2,4)}-A6.png`));
  assert(names.includes(`${date.slice(2,4)}-ST.png`));
  assert.equal(new Set(names).size,names.length);
}
assert.equal(JSON.stringify(context.state),before);
console.log('PASS church-year Advent boundaries, six seasonal slots, civil-year groups, registration targets and original registry preservation');
