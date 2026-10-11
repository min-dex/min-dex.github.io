const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("mindexElectron", {
  isDesktop: true,
  openPresenterOutput: (payload) => ipcRenderer.invoke("mindex:open-presenter", payload),
  closePresenterOutput: () => ipcRenderer.invoke("mindex:close-presenter"),
  fullscreenPresenterOutput: () => ipcRenderer.invoke("mindex:fullscreen-presenter"),
  getPresenterDisplays: () => ipcRenderer.invoke("mindex:get-presenter-displays"),
  setPresenterAlwaysOnTop: (payload) => ipcRenderer.invoke("mindex:set-presenter-always-on-top", payload),
  checkForUpdates: () => ipcRenderer.invoke("mindex:check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("mindex:download-update"),
  installUpdate: () => ipcRenderer.invoke("mindex:install-update"),
  importKeynoteDeck: (payload) => ipcRenderer.invoke("mindex:import-keynote-deck", payload),
  filePathForFile: (file) => webUtils.getPathForFile(file),
  getUpdateState: () => ipcRenderer.invoke("mindex:get-update-state"),
  onUpdateState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("mindex:update-state", handler);
    return () => ipcRenderer.removeListener("mindex:update-state", handler);
  },
  onCheckUpdateRequested: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("mindex:check-update-requested", handler);
    return () => ipcRenderer.removeListener("mindex:check-update-requested", handler);
  },
});
