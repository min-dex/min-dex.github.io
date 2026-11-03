const {contextBridge,ipcRenderer} = require('electron');
const invoke = (action,value) => ipcRenderer.invoke('mindex:youtube',action,value);
contextBridge.exposeInMainWorld('youtubeOutput',{
  start:key=>invoke('start',key), write:bytes=>invoke('chunk',bytes), stop:()=>invoke('stop'), abort:()=>invoke('abort'),
  onState:listener=>ipcRenderer.on('mindex:youtube-state',(_event,state)=>listener(state))
});
