const {contextBridge,ipcRenderer} = require('electron');
const invoke = (action,value) => ipcRenderer.invoke('mindex:youtube',action,value);
contextBridge.exposeInMainWorld('youtubeOutput',{
  start:options=>invoke('start',options), write:bytes=>invoke('chunk',bytes), stop:()=>invoke('stop'), abort:()=>invoke('abort'),
  onState:listener=>ipcRenderer.on('mindex:youtube-state',(_event,state)=>listener(state))
});
