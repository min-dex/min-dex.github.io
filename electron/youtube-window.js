const {app,BrowserWindow,ipcMain,dialog} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const {pathToFileURL} = require('node:url');
const {startEncoder} = require('./youtube-engine');
const {bitrate} = require('./youtube-profile');
const entry = path.join(app.getAppPath(),'tools/broadcast-prototype/index.html');
const expected = pathToFileURL(entry).href;
let panel, owner, encoder;
function cancel() { owner?.abort(); owner = null; encoder = null; }
app.on('before-quit',event => { if (!event.defaultPrevented) cancel(); });
ipcMain.handle('mindex:youtube',async (event,action,value) => {
  if (!panel || event.sender !== panel.webContents || event.senderFrame !== panel.webContents.mainFrame || event.senderFrame.url !== expected)
    throw Error('방송 창에서만 사용할 수 있습니다.');
  if (action === 'start') {
    if (owner) throw Error('송출이 진행 중입니다.');
    const token = owner = new AbortController();
    try {
      const options = typeof value === 'string' ? {key:value} : value;
      if (!options || typeof options !== 'object') throw Error('송출 설정을 확인해 주세요.');
      const bitrateKbps = bitrate(options.bitrateKbps);
      let recordingPath;
      if (options.record === true) {
        const chosen = await dialog.showSaveDialog(panel,{title:'송출과 같은 품질로 녹화',
          defaultPath:path.join(app.getPath('videos'),'Mindex-'+new Date().toISOString().replace(/[:.]/g,'-')+'.mp4'),
          filters:[{name:'MP4 녹화',extensions:['mp4']}]});
        token.signal.throwIfAborted();
        if (chosen.canceled || !chosen.filePath) { cancel(); return {cancelled:true}; }
        recordingPath = chosen.filePath;
      }
      let destination;
      if (require('../package.json').mindexTestBuild === true || globalThis.__mindexTestIsolation) {
        const port = Number(process.env.MINDEX_QA_RTMPS_PORT);
        if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('로컬 수신기를 준비해 주세요.');
        destination = {host:'127.0.0.1',servername:'localhost',port,ca:fs.readFileSync(process.env.MINDEX_QA_RTMPS_CA)};
      }
      const exe = path.join(process.resourcesPath,'broadcast-engine',process.platform === 'win32'?'ffmpeg.exe':'ffmpeg');
      const run = await startEncoder({exe,key:options.key,bitrateKbps,recordingPath,destination,signal:token.signal,onState(state) {
        if (owner !== token) return;
        panel.webContents.send('mindex:youtube-state',state);
        if (state !== 'live') { owner = null; encoder = null; }
      }});
      if (owner === token) encoder = run;
      return {recording:recordingPath?path.basename(recordingPath):null};
    } catch { if (owner === token) cancel(); throw Error('방송 연결을 열지 못했습니다.'); }
  }
  if (action === 'abort') { cancel(); return; }
  if (!encoder) throw Error('방송 연결이 없습니다.');
  if (action === 'chunk') return encoder.write(value);
  if (action === 'stop') return encoder.stop();
  throw Error('지원하지 않는 명령입니다.');
});
module.exports = function openPanel(parent) {
  if (panel) { panel.focus(); return; }
  panel = new BrowserWindow({parent,width:1320,height:900,webPreferences:{sandbox:true,contextIsolation:true,
    nodeIntegration:false,backgroundThrottling:false,preload:path.join(__dirname,'youtube-preload.js')}});
  panel.on('closed',() => { cancel(); panel = null; });
  panel.webContents.on('render-process-gone',cancel);
  panel.webContents.on('will-navigate',event => event.preventDefault());
  const hall = pathToFileURL(path.join(path.dirname(entry),'hall-output.html')).href;
  panel.webContents.setWindowOpenHandler(({url}) => url.startsWith(hall+'#') && /^[0-9a-f-]{36}$/.test(url.slice(hall.length+1))
    ? {action:'allow',overrideBrowserWindowOptions:{parent:panel,webPreferences:{sandbox:true,preload:undefined}}} : {action:'deny'});
  panel.loadFile(entry).catch(() => panel?.close());
};
module.exports.isActive = () => Boolean(owner);
