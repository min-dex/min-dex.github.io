const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("mindexElectron", {
  isDesktop: true,
  openBroadcastLab: () => ipcRenderer.invoke("mindex:open-broadcast-lab"),
  getBuildInfo: () => ipcRenderer.invoke("mindex:get-build-info"),
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

// The offline test can still open when the database-backed home cannot load.
window.addEventListener("DOMContentLoaded", async () => {
  const error = document.getElementById("bootError");
  if (!error) return;
  const info = await ipcRenderer.invoke("mindex:get-build-info");
  if (!info.testBuild) return;
  const button = document.createElement("button");
  button.type = "button"; button.dataset.broadcastLab = ""; button.textContent = "방송 합성 시험";
  button.onclick = () => ipcRenderer.invoke("mindex:open-broadcast-lab");
  error.append(button);
}, { once:true });
