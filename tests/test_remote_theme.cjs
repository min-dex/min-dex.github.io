const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),build=require('../tools/build_remote_theme.cjs');
assert.equal(fs.readFileSync(path.join(root,'remote.shared.css'),'utf8'),build(),'Regenerate remote.shared.css after changing shared design tokens or UI fonts');
assert(!build().includes('font-family: "Mindex Presenter"'),'controller must not load output fonts');
console.log('PASS standalone remote uses exact current Mindex theme and UI font definitions');
