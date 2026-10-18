// The in-app manual and its Markdown handoff share one content source.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const sandbox = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'mindex.manuals.js'), 'utf8'), sandbox);
const manual = sandbox.window.MINDEX_MANUALS[0];
const lines = [`# ${manual.title}`, '', manual.summary, '', `> ${manual.notice}`, ''];
let category;
for (const section of manual.sections) {
  if (category !== section.category) {
    category = section.category;
    lines.push(`## ${category}`, '');
  }
  lines.push(`### ${section.title}`, '');
  if (section.layout === 'schedule') {
    for (const group of section.groups) {
      lines.push(`#### ${group.title}`, '', '| 항목 | 내용 |', '| --- | --- |');
      for (const [label, value] of group.rows) lines.push(`| ${label} | ${value} |`);
      lines.push('');
    }
  } else if (section.layout === 'camera') {
    for (const camera of section.cameras) {
      lines.push(`#### ${camera.title}`, '');
      for (const [position, label] of camera.positions) lines.push(`- ${position}: ${label}`);
      lines.push('');
    }
  } else if (section.steps) {
    section.steps.forEach((step, i) => {
      lines.push(`${i+1}. ${typeof step === 'string' ? step : step.title}`);
      for (const item of step.items || []) lines.push(`   - ${item}`);
    });
    lines.push('');
  }
  for (const item of section.items || []) lines.push(`- ${item}`);
  if (section.items?.length) lines.push('');
  if (section.note) lines.push(`> ${section.note}`, '');
}
lines.push('## 원본·출처', '', `정리 기준: ${manual.reviewedAt}`, '');
for (const source of manual.sources) lines.push(`- [${source.title}](${source.url})`);
lines.push('', '노션 「예배」 원본의 정리·삭제는 통합 내용과 운영 반영을 확인한 뒤 사용자가 결정한다.', '내용 수정은 `mindex.manuals.js`에서 한 뒤', '`node tools/build_manual_docs.cjs`로 이 문서를 갱신한다.', '');
const output = lines.join('\n');
const target = path.join(root, 'docs/manuals/operations.md');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== output) throw Error('Manual docs are stale: run node tools/build_manual_docs.cjs');
  console.log('PASS in-app manual and Markdown share the same content');
} else fs.writeFileSync(target, output);
