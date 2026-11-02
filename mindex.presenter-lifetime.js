/* Browser-local ownership: an unrelated app tab never becomes a live sender. */
(() => {
  const url = new URL(location.href);
  const output = url.searchParams.get('output') === 'presenter';
  const scope = `${url.pathname.replace(/index\.html$/, '')}:${url.searchParams.get('preset') || 'gwc'}`;
  const prefix = `mindex.presenter.lifetime:${scope}`;
  const tokenKey = `${prefix}:resume`;
  const locks = navigator.locks;
  let session = '', owned = false, ownerRelease = null, mainRelease = null, generation = 0;
  let mainPending = false, mainEpoch = 0;
  const listeners = new Set();
  const stored = () => { try { return sessionStorage.getItem(tokenKey) || ''; } catch { return ''; } };
  function claim(id, explicit = false) {
    if (output || !id || (session === id && owned)) return;
    const attempt = ++generation;
    ownerRelease?.(); ownerRelease = null;
    session = id; owned = explicit;
    if (explicit) { try { sessionStorage.setItem(tokenKey, id); } catch {} }
    if (!locks?.request) return;
    locks.request(`${prefix}:owner:${id}`, { ifAvailable: true }, lock => {
      if (!lock || attempt !== generation) { if (attempt === generation) owned = false; return; }
      owned = true;
      try { sessionStorage.setItem(tokenKey, id); } catch {}
      for (const notify of listeners) notify();
      return new Promise(resolve => { ownerRelease = resolve; });
    }).catch(() => { if (attempt === generation) owned = false; });
  }
  function enter() {
    if (output || mainRelease || mainPending || !locks?.request) return;
    mainPending = true; const epoch = ++mainEpoch;
    locks.request(`${prefix}:main`, { mode: 'shared' }, () => {
      if (epoch !== mainEpoch) return;
      mainPending = false; return new Promise(resolve => { mainRelease = resolve; });
    }).catch(() => { if (epoch === mainEpoch) mainPending = false; });
    const resume = stored();
    if (resume) claim(resume);
  }
  function leave() {
    ++generation; ++mainEpoch; mainPending = false; owned = false;
    ownerRelease?.(); ownerRelease = null;
    mainRelease?.(); mainRelease = null;
  }
  function monitorOutput(close, { graceMs = 8000, pollMs = 1000 } = {}) {
    const opener = window.opener;
    if (!output || !url.searchParams.get('outputSession') || !locks?.query || !opener) return () => {};
    let stopped = false, checking = false, emptySince = null;
    const poll = async () => {
      if (stopped || checking) return;
      checking = true;
      try {
        // A live opener covers reload/slow startup without relying on timer heartbeats.
        if (!opener.closed) { emptySince = null; return; }
        const { held } = await locks.query();
        if (stopped) return;
        if (held.some(lock => lock.name === `${prefix}:main`)) { emptySince = null; return; }
        if (emptySince === null) emptySince = Date.now();
        if (Date.now() - emptySince >= graceMs) { stop(); close(); }
      } catch { emptySince = null; } // Uncertain ownership keeps the live frame.
      finally { checking = false; }
    };
    const timer = setInterval(poll, pollMs);
    function stop() { stopped = true; clearInterval(timer); }
    return stop;
  }
  globalThis.MindexPresenterLifetime = {
    claim: id => claim(id, true),
    owns: id => output ? id === url.searchParams.get('outputSession') : Boolean(id && owned && session === id),
    onOwner(notify) { listeners.add(notify); if (owned) notify(); },
    attachFromOpener(id, source) {
      if (output || owned || !id || (stored() && stored() !== id)) return;
      try {
        const candidate = new URL(source.location.href);
        if (source !== window && !source.closed && source.opener === window
          && candidate.searchParams.get('output') === 'presenter'
          && candidate.searchParams.get('outputSession') === id) claim(id);
      } catch {} // Only a proven original opener can migrate an older live session.
    },
    monitorOutput,
  };
  if (!output) { enter(); addEventListener('pagehide', leave); addEventListener('pageshow', enter); }
})();
