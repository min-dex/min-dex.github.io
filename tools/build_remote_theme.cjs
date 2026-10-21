// Keep the small standalone controller aligned without loading the editor layout.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function build(){
 const source=fs.readFileSync(path.join(root,'styles.css'),'utf8');
 const fonts=source.match(/@font-face\s*\{[^}]*\}/g).filter(block=>block.includes('font-family: "Pretendard Variable"'));
 const light=source.match(/:root \{[^}]*\}/)[0];
 const dark=source.match(/body\[data-theme="dark"\] \{[^}]*\}/)[0].replace('body[',':root[');
 return '/* Generated from styles.css by tools/build_remote_theme.cjs. Do not edit. */\n'+[...fonts,light,dark].join('\n')+'\n';
}
module.exports=build;
if(require.main===module)fs.writeFileSync(path.join(root,'remote.shared.css'),build());
