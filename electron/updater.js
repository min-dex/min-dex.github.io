// Main-process authority: renderer reloads must not reset download/install state.
function createUpdateController({ updater, enabled, presenterOpen, notify }) {
  let state = { status: 'idle', version: '', percent: 0 };
  let checking = null;
  let downloading = null;
  const snapshot = () => ({ ...state, enabled: enabled(), presenterOpen: presenterOpen() });
  const publish = () => notify(snapshot());
  const set = (status, extra = {}) => { state = { ...state, status, ...extra }; publish(); };
  const failure = () => {
    set('error', { message: '업데이트에 연결하지 못했습니다. 잠시 후 다시 확인해 주세요.' });
    return { ok: false, reason: 'update-failed' };
  };
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowDowngrade = false;
  updater.allowPrerelease = false;
  updater.on('update-available', info => set('available', { version: info.version, message: '' }));
  updater.on('update-not-available', () => set('current', { version: '', message: '' }));
  updater.on('download-progress', progress => set('downloading', { percent: Math.max(0, Math.min(100, Number(progress.percent) || 0)) }));
  updater.on('update-downloaded', info => set('downloaded', { version: info.version, percent: 100, message: '' }));
  updater.on('error', failure);
  return {
    snapshot, publish,
    check() {
      if (!enabled()) return Promise.resolve({ ok: false, reason: 'updates-unavailable' });
      if (checking) return checking;
      if (['downloading', 'downloaded', 'installing'].includes(state.status)) return Promise.resolve({ ok: true, state: snapshot() });
      set('checking', { message: '' });
      checking = Promise.resolve().then(() => updater.checkForUpdates())
        .then(() => ({ ok: true, state: snapshot() })).catch(failure)
        .finally(() => { checking = null; });
      return checking;
    },
    download() {
      if (!enabled()) return Promise.resolve({ ok: false, reason: 'updates-unavailable' });
      if (downloading) return downloading;
      if (state.status !== 'available') return Promise.resolve({ ok: false, reason: 'update-not-available' });
      set('downloading', { percent: 0 });
      downloading = Promise.resolve().then(() => updater.downloadUpdate())
        .then(() => ({ ok: true, state: snapshot() })).catch(failure)
        .finally(() => { downloading = null; });
      return downloading;
    },
    install() {
      if (!enabled()) return { ok: false, reason: 'updates-unavailable' };
      if (presenterOpen()) return { ok: false, reason: 'presenter-active' };
      if (state.status !== 'downloaded') return { ok: false, reason: 'update-not-ready' };
      set('installing');
      try { updater.quitAndInstall(false, true); return { ok: true }; }
      catch { return failure(); }
    },
  };
}
module.exports = { createUpdateController };
