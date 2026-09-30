const fs = require('node:fs');
const assert = require('node:assert/strict');

const presenter = fs.readFileSync('mindex.presenter.js', 'utf8');
const css = fs.readFileSync('styles.presenter-output.css', 'utf8');

assert.match(presenter, /--line-chars: \$\{presenterLineCharEstimate\(line\)\}/);
assert.doesNotMatch(presenter, /presenterLineCharEstimate\(line\) \+ \(showVerseNumber/);
assert.doesNotMatch(presenter, /presenter-lyric-lines/);
assert.match(css, /position: absolute;/);
assert.match(css, /right: calc\(100% \+ \.22em\);/);
assert.match(css, /top: \.08em/);
assert.match(css, /align-self: center;/);
assert.doesNotMatch(css, /content: attr\(data-verse-no\) "\\00a0"/);
console.log('PASS lyric verse marker uses a non-layout gutter');
