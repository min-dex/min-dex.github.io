// Session-only output history; no DOM, transport, storage or worship writes.
(function(root) {
  let session = '', current = null, previous = null;
  const sessionKey = p => `${p.serviceId}:${p.outputSessionId || ''}`;
  root.MindexPresenterHistory = {
    reset() { session = ''; current = previous = null; },
    record(payload) {
      const nextSession = sessionKey(payload);
      if (session !== nextSession) { this.reset(); session = nextSession; }
      if (payload.safetyBlank) return;
      const live = payload.liveScripture?.active ? payload.liveScripture.slide : null;
      const slide = live || payload.slides[payload.index];
      if (!slide?.id) return;
      const key = live ? `live:${JSON.stringify(live)}` : `slide:${slide.id}`;
      if (current?.key === key) return;
      previous = current;
      current = { key, id: slide.id, live: live ? structuredClone(live) : null };
    },
    target(p) {
      if (session !== sessionKey(p)) return null;
      const entry = p.safetyBlank ? current : previous;
      if (!entry) return null;
      return entry.live || p.slides.some(slide => slide.id === entry.id) ? entry : null;
    },
  };
})(globalThis);

// Controller adapters keep the history store independent of application state.

function presenterReturnTarget(serviceId) {
  const p = state.presenter;
  return isPresenterOutputWindowOpen() && serviceId === p.serviceId ? MindexPresenterHistory.target(p) : null;
}

function restorePresenterPreviousOutput(serviceId) {
  const p = state.presenter;
  const entry = presenterReturnTarget(serviceId);
  if (!entry) return;
  suspendServiceMusicAutoSync();
  liveScriptureRequestSerial += 1;
  p.pptxProgress = null;
  p.jumpDraft = "";
  p.safetyBlank = false;
  p.liveScripture = { ...p.liveScripture, active: Boolean(entry.live), slide: entry.live ? structuredClone(entry.live) : null };
  if (!entry.live) p.index = p.slides.findIndex(slide => slide.id === entry.id);
  clearPresenterBoardSelection({ render: false });
  syncSelectedServiceItemToPresenterSlide(serviceId);
  syncServiceMusicWithPresenterContext(serviceId, { render: false });
  publishPresenterState();
  renderPresenterControlState(serviceId);
  scrollPresenterOutlineToActive(serviceId);
}
