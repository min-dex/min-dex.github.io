// Web/PWA releases apply only after every editor and operation is safe to leave.
(() => {
  function create({version, readVersion, blocked, notify, reload, now = Date.now}) {
    let target = '', confirmations = 0, checking = false, applying = false, lastInput = now(), confirmedAt = 0;
    function touch() { lastInput = now(); }
    function apply() {
      if (!target || confirmations < 2 || applying || checking || now() - confirmedAt > 45000) return false;
      // Recheck at the last synchronous boundary; never save or discard for the user.
      if (blocked() || now() - lastInput < 5000) { notify(true); return false; }
      applying = true;
      notify(false);
      reload();
      return true;
    }
    async function check() {
      if (checking || applying) return;
      checking = true;
      try {
        const next = await readVersion();
        if (!/^[0-9A-Za-z._-]{4,80}$/.test(String(next || ''))) { confirmations = 0; return; }
        if (next === version) { target = ''; confirmations = 0; notify(false); return; }
        confirmations = next === target ? confirmations + 1 : 1;
        target = next;
        confirmedAt = now();
        notify(true);
        apply();
      } catch { confirmations = 0; /* Offline or an invalid response keeps the current editor intact. */ }
      finally { checking = false; apply(); }
    }
    return {check, apply, touch};
  }
  window.MindexLiveUpdate = Object.freeze({create});
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  if (window.mindexElectron?.isDesktop || typeof state === 'undefined' || isPresenterOutputRoute()) return;
  if (!/^[0-9A-Za-z._-]{4,80}$/.test(String(window.MINDEX_RELEASE || ''))) return;
  let notice, printing = false, pointerActive = false, composing = false;
  const blocked = () => {
    try {
      if (printing || pointerActive || composing || navigator.onLine === false || document.hidden || document.body.classList.contains('ui-booting') || !window.MINDEX_SERVER_STORAGE?.ready
        || window.MINDEX_SERVER_STORAGE.pending || window.MINDEX_DRAFT_HANDOFF?.pending
        || departmentRefreshBlocked() || hasDirtyChanges() || currentSaveButtonState().dirty
        || serviceHasPendingTextEdits(state.selectedServiceId) || presenterPptxImports.size || document.querySelector('[aria-busy="true"],.cal-cell.is-save-error')
        || [...document.querySelectorAll('[data-initial-value]')].some(node => 'value' in node
          ? node.value !== node.dataset.initialValue
          : node.isContentEditable && node.textContent.replace(/\n/g,' ').trim() !== String(node.dataset.initialValue).replace(/\n/g,' ').trim())) return true;
      for (const documents of bulletinTabSessions.values()) for (const doc of documents.values()) {
        if (doc.dirty || doc.saving || doc.saveError) return true;
      }
      const controller = refs.detailPane?.querySelector('[data-bulletin-owner]')?.bulletinController;
      return Boolean(controller && (!controller.canApplyUpdate || !controller.canApplyUpdate()));
    } catch { return true; }
  };
  const updater = create({
    version: window.MINDEX_RELEASE,
    readVersion: async () => {
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(`./mindex-release.json?t=${Date.now()}`, {cache:'no-store', signal:controller.signal});
        if (!response.ok) throw Error('release unavailable');
        return (await response.json()).version;
      } finally { clearTimeout(timeout); }
    },
    blocked,
    notify: visible => {
      if (visible && !notice) {
        notice = document.createElement('div');notice.className = 'live-update-notice';notice.setAttribute('role','status');
        notice.textContent = '새 버전이 준비됐어요. 편집 내용을 저장하고 작업을 마치면 자동으로 반영해요.';
        document.body.append(notice);
      }
      if (notice) notice.hidden = !visible;
    },
    reload: () => {
      const url = new URL(location.href);url.searchParams.set('mindex-retry', String(Date.now()));
      location.replace(url.href);
    },
  });
  window.addEventListener('beforeprint', () => { printing = true; });
  window.addEventListener('afterprint', () => { printing = false; updater.touch(); });
  for (const event of ['input','change','keydown','pointerdown','compositionstart','compositionend']) document.addEventListener(event, updater.touch, true);
  document.addEventListener('pointerdown', () => { pointerActive = true; }, true);
  document.addEventListener('pointerup', () => { pointerActive = false; updater.touch(); }, true);
  document.addEventListener('pointercancel', () => { pointerActive = false; updater.touch(); }, true);
  document.addEventListener('pointermove', event => { if (event.buttons) updater.touch(); }, true);
  document.addEventListener('compositionstart', () => { composing = true; }, true);
  document.addEventListener('compositionend', () => { composing = false; updater.touch(); }, true);
  document.addEventListener('wheel', updater.touch, {capture:true,passive:true});
  const wake = () => { pointerActive = false; updater.touch(); if (!document.hidden) void updater.check(); };
  window.addEventListener('focus', wake);window.addEventListener('online', wake);document.addEventListener('visibilitychange', wake);
  setInterval(() => { if (!document.hidden) void updater.check(); }, 30000);
  setInterval(updater.apply, 1000);
  setTimeout(() => void updater.check(), 5000);
})();
