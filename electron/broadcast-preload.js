const {contextBridge,ipcRenderer}=require('electron');
const invoke=(action,chunk)=>ipcRenderer.invoke('mindex:rehearse-rtmps',action,chunk);
contextBridge.exposeInMainWorld('localEncoder',{
  start:()=>invoke('start'),write:chunk=>invoke('chunk',chunk),finish:()=>invoke('finish'),cancel:()=>invoke('cancel')
});
