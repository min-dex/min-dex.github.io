const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('app.js', 'utf8');
const context = {};
vm.createContext(context);
const start = source.indexOf('function normalizeLyricsForStorage(');
const end = source.indexOf('\n}\n', start) + 2;
vm.runInContext(source.slice(start, end), context);

assert.equal(
  context.normalizeLyricsForStorage('  첫 줄  \r\n\t둘째 줄 \n\n\n  셋째 줄  \n '),
  '첫 줄\n둘째 줄\n\n셋째 줄',
);
assert.equal(context.normalizeLyricsForStorage(' \n\n '), '');
assert.match(source, /lyrics: normalizeLyricsForStorage\(form\.lyrics\)/);
assert.match(source, /\.map\(\(line\) => line\.trim\(\)\)/);
console.log('PASS lyric storage whitespace normalization');
