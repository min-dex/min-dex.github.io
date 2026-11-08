// Connect the desktop shell to the renderer update and broadcast controls.
function bindElectronDesktopEvents() {
  const desktop = window.mindexElectron;
  if (!desktop?.isDesktop) return;
  let prompted = "";
  let promptPending = false;
  const showFailure = result => {
    if (result?.ok) return;
    const messages = {
      "presenter-active": "송출을 종료한 뒤 업데이트를 설치해 주세요.",
      "updates-unavailable": "자동 업데이트는 배포용 설치 앱에서 사용할 수 있습니다.",
      "update-not-ready": "업데이트 다운로드가 아직 끝나지 않았습니다.",
    };
    showToast(messages[result?.reason] || "업데이트를 진행하지 못했습니다. 다시 확인해 주세요.", "error");
  };
  const handleState = async update => {
    if (!update || promptPending) return;
    if (update.status === "error") { showToast(update.message, "error"); return; }
    if (!["available", "downloaded"].includes(update.status)) return;
    if (update.presenterOpen || isPresenterOutputWindowOpen()) return;
    const key = `${update.status}:${update.version}`;
    if (prompted === key) return;
    prompted = key;
    promptPending = true;
    try {
      const installing = update.status === "downloaded";
      const message = update.manualInstall
        ? `Mindex 새 버전 ${update.version || ""} 설치 파일을 받을까요? 저장·송출 종료 후 설치해 주세요.`
        : installing
        ? "업데이트 준비가 끝났습니다. 지금 재시작해서 설치할까요?"
        : `Mindex 새 버전 ${update.version || ""}을 내려받을까요?`;
      if (!window.confirm(message)) return;
      if (installing || update.manualInstall) {
        if (isPresenterOutputWindowOpen()) { showFailure({ reason: "presenter-active" }); return; }
        if (hasDirtyChanges({ reconcile: true }) || currentSaveButtonState().dirty) {
          showToast("편집 내용을 먼저 저장한 뒤 업데이트를 다시 확인해 주세요.", "error");
          return;
        }
      }
      const result = await (installing ? desktop.installUpdate() : desktop.downloadUpdate());
      showFailure(result);
      if(result?.ok && result.manualInstall) showToast('설치 파일 다운로드를 열었습니다. 앱을 종료한 뒤 새 버전을 설치해 주세요.');
    } catch { showFailure(); }
    finally {
      promptPending = false;
      // A cached download may finish before the download command resolves.
      const result = await desktop.getUpdateState().catch(() => null);
      if (result?.ok) void handleState(result.state);
    }
  };
  desktop.onUpdateState?.(update => { void handleState(update); });
  const checkUpdate = async () => {
    prompted = "";
    try {
      const result = await desktop.checkForUpdates();
      if (!result?.ok) { showFailure(result); return; }
      const update = result.state;
      if (update.presenterOpen) showToast("송출 종료 후 업데이트를 진행할 수 있습니다.");
      else if (update.status === "current") showToast(update.webSync === "different"
        ? "설치 앱은 최신입니다. 웹과 다른 변경 사항이 있어 다음 업데이트에 반영됩니다."
        : update.webSync === "matched" ? "웹과 설치 앱 모두 최신입니다." : "설치 앱은 최신입니다. 웹 버전은 확인하지 못했습니다.");
      else if (update.status === "downloading") showToast(`업데이트 다운로드 중 · ${Math.round(update.percent)}%`);
      else void handleState(update);
    } catch { showFailure(); }
  };
  desktop.onCheckUpdateRequested?.(checkUpdate);
  if (desktop.platform === "win32") {
    const update = document.getElementById("desktopUpdateBtn");
    const broadcast = document.getElementById("desktopBroadcastBtn");
    if (update && typeof desktop.checkForUpdates === "function") {
      update.hidden = false;
      update.addEventListener("click", checkUpdate);
    }
    if (broadcast && typeof desktop.openBroadcast === "function") {
      broadcast.hidden = false;
      broadcast.addEventListener("click", async () => {
        try {
          if ((await desktop.openBroadcast())?.ok) return;
        } catch {}
        showToast("방송 창을 열지 못했습니다.", "error");
      });
    }
  }
  desktop.getUpdateState?.().then(result => { if (result?.ok) void handleState(result.state); }).catch(() => {});
}
