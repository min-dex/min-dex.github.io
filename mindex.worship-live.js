// Saved worship invalidations only. Never send documents or write on receipt.
(() => {
  if (isPresenterOutputRoute()) return;
  const key = 'mindex.worship.committed.v1';
  const pending = new Map(), seen = new Set();
  let channel, timer, busy = false, probing = false;
  function schedule(delay = 200) {
    if (!timer && pending.size) timer = setTimeout(() => { timer = null; void flush(); }, delay);
  }
  function receive(message) {
    if (!message || message.project !== state.config.url || typeof message.id !== 'string'
      || typeof message.serviceId !== 'string' || !message.serviceId || seen.has(message.id)) return;
    seen.add(message.id);
    if (seen.size > 256) seen.delete(seen.values().next().value);
    pending.set(message.serviceId, message);
    schedule();
  }
  function publish(serviceId) {
    if (!serviceId || !state.config.url) return;
    const message = { id: createUuid(), project: state.config.url, serviceId };
    seen.add(message.id);
    if (seen.size > 256) seen.delete(seen.values().next().value);
    try { channel?.postMessage(message); } catch {}
    try { localStorage.setItem(key, JSON.stringify(message)); } catch {}
    connectDepartmentRealtime();
    try { void departmentTabSync?.remote?.send({ type: 'broadcast', event: 'worship-committed', payload: message }).catch(() => {}); } catch {}
  }
  async function flush() {
    if (busy || !pending.size) return;
    if (departmentRefreshBlocked()) { schedule(2000); return; }
    busy = true;
    let retry = 2000;
    try {
      for (const [id, message] of [...pending]) {
        if (message.project !== state.config.url) { pending.delete(id); continue; }
        let done = false;
        if (id === state.selectedServiceId && ['service', 'presenter'].includes(state.module)) {
          done = await window.MINDEX_SERVICE_ENTRY.check(id, undefined, { background: true });
        } else if (!sundayEditSyncHasLocalDraft(id)) {
          state.loadedWorshipServiceIds.delete(id);
          state.loadedWorshipPresenterServiceIds.delete(id);
          presenterSlideBuildCache.delete(id);
          done = true;
        }
        if (done && pending.get(id) === message) pending.delete(id);
      }
    } catch { retry = 15000; }
    finally { busy = false; schedule(retry); }
  }
  async function reconcile() {
    if (probing || departmentRefreshBlocked() || !['service', 'presenter'].includes(state.module)) return;
    const id = state.selectedServiceId, client = state.client, project = state.config.url;
    if (!id || state.services.find(row => row.id === id)?._isExpected) return;
    probing = true;
    try {
      const atomic = await worshipAtomicClient();
      if (atomic.pending(id)) return;
      // Revision only: no full documents downloaded on the periodic safety check.
      const { data, error } = await client.from('mindex_worship_services').select('id,save_revision').eq('id', id);
      if (error || client !== state.client || project !== state.config.url || id !== state.selectedServiceId) return;
      if (!data?.length || String(data[0].save_revision) !== atomic.baseline(id)?.revision) {
        receive({ id: createUuid(), project, serviceId: id });
      }
    } catch { /* Retry on wake/reconnect or the next low-frequency check. */ }
    finally { probing = false; }
  }
  try { channel = new BroadcastChannel(key); channel.onmessage = event => receive(event.data); } catch {}
  window.addEventListener('storage', event => {
    if (event.key === key && event.newValue) { try { receive(JSON.parse(event.newValue)); } catch {} }
  });
  function wake() {
    try { receive(JSON.parse(localStorage.getItem(key) || 'null')); } catch {}
    schedule(); void reconcile();
  }
  window.addEventListener('focus', wake);
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', wake);
  document.addEventListener('focusout', () => schedule());
  setInterval(() => { void reconcile(); }, 60000);
  window.MINDEX_WORSHIP_LIVE = { publish, receive, reconcile };
})();
