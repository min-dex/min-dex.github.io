const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createUpdateController}=require('../electron/updater');
function fixture(){
 const updater=new EventEmitter();let live=false,enabled=true,installs=0,checks=0,downloads=0;
 updater.checkForUpdates=async()=>{checks++;updater.emit('update-available',{version:'1.2.3'});};
 updater.downloadUpdate=async()=>{downloads++;updater.emit('update-downloaded',{version:'1.2.3'});};
 updater.quitAndInstall=()=>{installs++;};
 const controller=createUpdateController({updater,enabled:()=>enabled,presenterOpen:()=>live,notify:()=>{}});
 return {updater,controller,live:v=>live=v,enable:v=>enabled=v,counts:()=>({checks,downloads,installs})};
}
test('explicit download/install, duplicate checks and downloads coalesce',async()=>{
 const f=fixture(),c=f.controller;
 assert.equal(f.updater.autoDownload,false);assert.equal(f.updater.autoInstallOnAppQuit,false);
 assert.equal(c.install().reason,'update-not-ready');
 await Promise.all([c.check(),c.check()]);
 assert.equal(c.snapshot().status,'available');assert.equal(f.counts().downloads,0);
 await Promise.all([c.download(),c.download()]);assert.equal(c.snapshot().status,'downloaded');
 await c.check();assert.equal(c.snapshot().status,'downloaded');
 f.live(true);assert.equal(c.install().reason,'presenter-active');assert.equal(f.counts().installs,0);
 f.live(false);assert.equal(c.install().ok,true);assert.equal(c.install().ok,false);
 assert.deepEqual(f.counts(),{checks:1,downloads:1,installs:1});
});
test('failed network/download can retry; errors never expose credentials',async()=>{
 const f=fixture(),c=f.controller;
 f.updater.checkForUpdates=async()=>{throw Error('secret-url?token=private');};
 assert.equal((await c.check()).ok,false);assert.equal(c.snapshot().status,'error');
 assert.doesNotMatch(JSON.stringify(c.snapshot()),/secret|private/);
 f.updater.checkForUpdates=async()=>f.updater.emit('update-available',{version:'2.0.0'});
 await c.check();f.updater.downloadUpdate=async()=>{throw Error('offline');};
 assert.equal((await c.download()).ok,false);
 await c.check();f.updater.downloadUpdate=async()=>f.updater.emit('update-downloaded',{version:'2.0.0'});
 await c.download();assert.equal(c.snapshot().status,'downloaded');
 f.enable(false);assert.equal(c.install().reason,'updates-unavailable');assert.equal((await c.check()).ok,false);
});
test('late install attempt rechecks live output, and current-version state clears stale availability',async()=>{
 const f=fixture(),c=f.controller;await c.check();
 f.updater.checkForUpdates=async()=>f.updater.emit('update-not-available',{});
 await c.check();assert.equal((await c.download()).reason,'update-not-available');
 assert.equal(c.snapshot().status,'current');
});
test('main-process IPC accepts controller only and blocks install while presenter exists',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
 const handlers={},windows=[];let installed=0,testBuild=false,broadcastActive=false,applicationMenu;
 class Window extends EventEmitter {
  constructor(options){super();this.options=options;this.shown=0;this.fullscreen=false;this.webContents=new EventEmitter();this.webContents.send=()=>{};this.webContents.mainFrame={};windows.push(this);}
  isDestroyed(){return false;} isVisible(){return true;} isMinimized(){return false;}
  show(){this.shown++;} setFullScreen(value){this.fullscreen=value;} focus(){} close(){} loadFile(){} loadURL(){} setAlwaysOnTop(){} setBounds(){}
 }
 const app=new EventEmitter();app.isPackaged=true;app.getAppPath=()=>'/fixture';app.whenReady=()=>Promise.resolve();
 const updater=new EventEmitter();updater.checkForUpdates=async()=>updater.emit('update-available',{version:'1.0.0'});
 updater.downloadUpdate=async()=>updater.emit('update-downloaded',{version:'1.0.0'});updater.quitAndInstall=()=>installed++;
 const display={id:1,bounds:{x:0,y:0,width:1920,height:1080}};
 const electron={app,BrowserWindow:Window,ipcMain:{handle:(k,h)=>handlers[k]=h},
  screen:{getAllDisplays:()=>[display],getPrimaryDisplay:()=>display},Menu:{getApplicationMenu:()=>null,buildFromTemplate:items=>({items}),setApplicationMenu:menu=>{applicationMenu=menu;}}};
 const broadcast = Object.assign(()=>{}, {isActive:()=>broadcastActive});
 const context={require:name=>name==='./output-close-guard'?require('../electron/output-close-guard'):name==='./youtube-window'?broadcast:name==='./test-isolation'?require('../electron/test-isolation'):name==='../mindex-build.json'?{channel:'release'}:name==='../package.json'?{mindexTestBuild:testBuild}:name==='electron'?electron:name==='electron-updater'?{autoUpdater:updater}:name==='./updater'?{createUpdateController}:name==='./keynote-importer'?{}:require(name),
  process:{platform:'darwin',env:{}},__dirname:path.resolve(__dirname,'../electron'),console,setTimeout:()=>0,setInterval:()=>0,clearInterval(){},clearTimeout(){}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../electron/main.js'),'utf8'),context);
 await new Promise(r=>setImmediate(r));
 assert.deepEqual(Array.from(applicationMenu.items,item=>item.role),['appMenu','fileMenu','editMenu','viewMenu','windowMenu']);
 const event={sender:windows[0].webContents,senderFrame:windows[0].webContents.mainFrame};
 for(const name of ["open-presenter","close-presenter","fullscreen-presenter","set-presenter-always-on-top","import-keynote-deck","check-for-updates"]){
  for(const foreign of [{sender:{}},{sender:event.sender,senderFrame:{}}])assert.equal((await handlers["mindex:"+name](foreign,{})).reason,"untrusted-window");
 }
 assert.equal(handlers['mindex:install-update']({sender:{}}).reason,'untrusted-window');
 await handlers['mindex:check-for-updates'](event);await handlers['mindex:download-update'](event);
 handlers['mindex:open-presenter'](event,{});
 const output=windows[1];assert.equal(output.options.backgroundColor,'#000000');assert.equal(output.shown,0);
 output.emit('ready-to-show');assert.equal(output.shown,0,'native document readiness must not expose an unpainted frame');
 assert.equal(handlers['mindex:presenter-frame-ready'](event).ok,false);
 assert.equal(handlers['mindex:presenter-frame-ready']({sender:output.webContents,senderFrame:{}}).ok,false);
 const outputEvent={sender:output.webContents,senderFrame:output.webContents.mainFrame};
 assert.equal(handlers['mindex:presenter-frame-ready'](outputEvent).ok,true);assert.equal(output.shown,1);assert.equal(output.fullscreen,true);
 handlers['mindex:presenter-frame-ready'](outputEvent);assert.equal(output.shown,1);

 assert.equal(handlers['mindex:install-update'](event).reason,'presenter-active');assert.equal(installed,0);
 handlers['mindex:close-presenter'](event);
 assert.equal(handlers['mindex:install-update'](event).reason,'presenter-active');
 windows[1].emit('closed');broadcastActive=true;
 assert.equal(handlers['mindex:install-update'](event).reason,'presenter-active');assert.equal(installed,0);
 broadcastActive=false;assert.equal(handlers['mindex:install-update'](event).ok,true);assert.equal(installed,1);
 testBuild=true;assert.equal((await handlers['mindex:check-for-updates'](event)).reason,'updates-unavailable');
});
