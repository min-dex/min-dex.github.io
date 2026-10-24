// Source-extraction fixtures follow the production ownership boundary.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function readRuntimeSource(name) {
  const files = name === 'app.js'
    ? ['app.js', 'mindex.presenter-live.js', 'mindex.presenter-board.js', 'mindex.presenter-controller.js']
    : name === 'mindex.presenter.js' ? ['mindex.presenter-praise.js', 'mindex.presenter.js'] : [name];
  return files.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
}
module.exports = { readRuntimeSource };
