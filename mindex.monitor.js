(() => {
  "use strict";
  if (isPresenterOutputRoute()) return;
  const trigger = document.getElementById("monitorPanelBtn");
  if (!trigger) return;
  const eventNames = { open: "접속", view: "화면 이동", service: "예배 선택", edit: "입력 편집", save_start: "예배 저장 시작", save_ok: "예배 저장 완료", save_failed: "예배 저장 흐름 오류", output_on: "송출창 응답 시작", output_off: "송출창 응답 끊김" };
  const events = [];
  const requests = new Map();
  const renderKeys = new WeakMap();
  let remoteRows = [];
  let remoteVerified = false, lastReportAt = 0, lastActivityAt = 0;
  let loginPending = false, viewerExpiresAt = 0;
  let reporter = null, admin = null, uploading = false, reading = false, previous = null;
  let lastEdit = 0, loginSerial = 0, viewSerial = 0, shareSerial = 0, retryAt = 0, failures = 0;
  let enabled = false, name = "";
  try { enabled = localStorage.getItem("mindex.monitor.share") === "true"; name = localStorage.getItem("mindex.monitor.name") || ""; } catch {}
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac/.test(ua) ? "macOS" : "Other";
  const browser = /Whale\//.test(ua) ? "Whale" : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const version = window.MINDEX_RELEASE || document.querySelector('script[src*="/app.js?"]')?.src.split("?v=")[1] || "unknown";
  const panel = document.createElement("dialog");
  panel.className = "monitor-panel"; panel.setAttribute("aria-labelledby", "monitorTitle");
  panel.innerHTML = `<header><h2 id="monitorTitle">접속 현황</h2><button class="icon-btn" data-close title="닫기" aria-label="닫기"><i data-lucide="x"></i></button></header>
    <section class="monitor-section"><div data-local></div></section>
    <section class="monitor-section" aria-labelledby="monitorRemoteTitle"><div class="monitor-section-heading"><h3 id="monitorRemoteTitle">접속 중</h3><span data-count></span><button class="icon-btn" data-refresh title="새로고침" aria-label="새로고침"><i data-lucide="refresh-cw"></i></button><button class="icon-btn" data-lock hidden title="조회 잠금" aria-label="조회 잠금"><i data-lucide="lock"></i></button></div>
    <form><label for="monitorPassword">관리자 비밀번호</label><input id="monitorPassword" type="password" autocomplete="current-password" required maxlength="128"><button class="btn secondary" type="submit">조회</button></form><p class="monitor-message" role="status"></p><div data-devices></div></section>
    <details class="monitor-section"><summary>이 기기 공유 설정</summary><div class="monitor-toolbar"><label for="monitorName">접속 이름</label><input id="monitorName" maxlength="60" autocomplete="off"><label><input type="checkbox" data-share>상태 공유</label></div><p class="monitor-share-status" role="status"></p><p>공유한 브라우저 접속만 표시됩니다.</p></details>`;
  document.body.append(panel);
  const $ = (selector) => panel.querySelector(selector);
  $("[data-share]").checked = enabled; $("#monitorName").value = name || `${os} ${browser}`;
  function message(text) { $(".monitor-message").textContent = text; }
  function shareMessage(text) { $(".monitor-share-status").textContent = text; }
  function timestamp(value) {
    const time = Date.parse(value);
    return Number.isFinite(time) && time <= Date.now() + 5000 ? time : 0;
  }
  function isStale(row) { const time = timestamp(row.last_seen); return !time || Date.now() - time > 45000; }
  function record(kind) {
    if (!enabled || !eventNames[kind]) return;
    events.push({ kind, at: new Date().toISOString() });
    if (events.length > 20) events.shift();
  }
  function snapshot() {
    const p = state.presenter;
    const service = state.services.find((s) => s.id === state.selectedServiceId);
    const output = Boolean(p.outputConnectedAt && Date.now() >= p.outputConnectedAt && Date.now() - p.outputConnectedAt <= PRESENTER_OUTPUT_HEARTBEAT_TTL_MS);
    const current = { module: state.module, serviceId: service?.id || "", output };
    if (previous) {
      if (previous.module !== current.module) record("view");
      if (previous.serviceId !== current.serviceId) record("service");
      if (previous.output !== output) record(output ? "output_on" : "output_off");
    }
    previous = current;
    return { name: $("#monitorName").value.trim().slice(0, 60), os, browser, version,
      module: String(state.module || ""), serviceId: service?.id || "", serviceDate: service?.date || "", serviceType: service?.type_id || "", output,
      outputServiceId: p.serviceId || "", slide: output ? Number(p.index) + 1 : 0, count: output ? p.slides?.length || 0 : 0,
      dirty: Boolean(state.dirty?.service), saving: Boolean(state.saving),
      video: output && p.videoHealth && Date.now() - p.videoHealth.receivedAt < 5000 ? p.videoHealth.status : "",
      events: events.map((event) => ({ ...event })) };
  }
  function renderDevice(root, data, lastSeen, id = "local") {
    const local = id === "local";
    const row = document.createElement("section"); row.className = "monitor-device";
    row.dataset.health = "fresh";
    const heading = document.createElement("strong");
    heading.textContent = String(data.name || `${data.os || ""} ${data.browser || ""}`.trim() || "이름 없는 접속").slice(0, 80); row.append(heading);
    const status = document.createElement("span"); status.className = "monitor-health";
    status.textContent = data.output === true ? "송출 중" : "송출 안 함"; row.append(status);
    const identity = document.createElement("p"); identity.className = "monitor-environment";
    identity.textContent = local ? "이 기기" : `${data.os || ""} · ${data.browser || ""} · ${id.slice(0, 8)}`;
    row.append(identity); root.append(row);
  }
  function renderRows(root, rows) {
    const key = JSON.stringify(rows.map(row=>[row.id,row.status.name,row.status.os,row.status.browser,row.status.output]));
    if (renderKeys.get(root) === key) return;
    renderKeys.set(root, key); root.replaceChildren();
    for (const row of rows) renderDevice(root, row.status, row.last_seen, row.id);
  }
  function renderRemote() {
    const rows = remoteVerified ? remoteRows.filter(row => !isStale(row)) : [];
    $("[data-count]").textContent = admin && remoteVerified ? `${rows.length}개 접속` : "";
    renderRows($("[data-devices]"), rows);
    if (!rows.length) $("[data-devices]").textContent = !remoteVerified ? "접속 상태를 확인하지 못했습니다." : "현재 공유 중인 접속이 없습니다.";
  }
  async function rpc(name, args) {
    if (!state.client?.rpc) throw Error("원격 조회에 필요한 DB 클라이언트가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
    if (!navigator.onLine) throw Error("네트워크 연결이 끊겼습니다.");
    const controller = new AbortController();
    requests.set(controller, ["mindex_monitor_login", "mindex_monitor_read"].includes(name) ? "viewer" : "reporter");
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const { data, error } = await state.client.rpc(name, args).abortSignal(controller.signal);
      if (controller.signal.aborted) throw Error("서버 응답 시간이 초과되었습니다.");
      if (error) throw Error(error.code === "PGRST202" || error.code === "42883" ? "원격 조회 서버 설정이 필요합니다." : "서버 요청에 실패했습니다.");
      return data;
    } catch (error) {
      if (controller.signal.aborted) throw Error("서버 응답 시간이 초과되었습니다.");
      throw Error(["원격 조회 서버 설정이 필요합니다.", "서버 요청에 실패했습니다."].includes(error?.message) ? error.message : "서버에 연결하지 못했습니다.");
    } finally { clearTimeout(timeout); requests.delete(controller); }
  }
  async function leave(token) { if (token) { try { await rpc("mindex_monitor_leave", { p_token: token }); } catch {} } }
  async function upload() {
    if (!enabled || uploading || Date.now() < retryAt || !state.client) return;
    const serial = shareSerial; uploading = true;
    try {
      const token = reporter || await rpc("mindex_monitor_register", {});
      if (serial !== shareSerial || !enabled) { void leave(token); return; }
      if (!token) throw Error("상태 공유 서버 설정 또는 접속 상한을 확인해 주세요.");
      reporter = token;
      if (!await rpc("mindex_monitor_heartbeat", { p_token: token, p_status: snapshot() })) { reporter = null; throw Error("상태 공유 세션이 종료되었습니다."); }
      if (serial !== shareSerial || !enabled) return;
      failures = 0; retryAt = 0; lastReportAt = Date.now();
      shareMessage(`상태 공유 중 · 마지막 전송 ${new Date(lastReportAt).toLocaleTimeString()}`);
    } catch (e) {
      if (serial !== shareSerial || !enabled) return;
      retryAt = Date.now() + Math.min(300000, 15000 * 2 ** Math.min(++failures, 5));
      shareMessage(`${e.message} 자동 재시도 예정 · 마지막 전송 ${lastReportAt ? new Date(lastReportAt).toLocaleTimeString() : "없음"}`);
    } finally { uploading = false; }
  }
  function lock() {
    loginSerial++; viewSerial++; const old = admin; admin = null; void leave(old);
    for (const [controller, scope] of requests) if (scope === "viewer") controller.abort();
    viewerExpiresAt = 0; $("#monitorPassword").value = "";
    $("form").hidden = false; $("[data-lock]").hidden = true; $("[data-devices]").replaceChildren();
    $("[data-count]").textContent = ""; remoteRows = []; remoteVerified = false;
    renderKeys.delete($("[data-devices]"));
    message("");
  }
  async function refresh() {
    if (!panel.open) return;
    renderRows($("[data-local]"), [{ id: "local", status: snapshot() }]);
    if (!admin || reading) return;
    renderRemote();
    const serial = viewSerial; reading = true;
    try {
      const rows = await rpc("mindex_monitor_read", { p_token: admin });
      if (serial !== viewSerial || !panel.open) return;
      if (!Array.isArray(rows)) { lock(); message("인증이 만료되었습니다."); return; }
      remoteRows = rows.filter((row) => row && typeof row.id === "string" && row.status && typeof row.status === "object" && !Array.isArray(row.status)).slice(0, 100);
      remoteVerified = true; renderRemote();

      message("");
    } catch (e) { if (serial === viewSerial) { remoteVerified = false; renderRemote(); message(e.message); } }
    finally { reading = false; }
  }
  trigger.onclick = () => { if (!panel.open) panel.showModal(); lastActivityAt = Date.now(); void refresh(); window.lucide?.createIcons({ root: panel }); };
  $("[data-close]").onclick = () => panel.close(); panel.addEventListener("close", lock);
  $("[data-lock]").onclick = () => { lock(); $("#monitorPassword").focus(); };
  $("[data-refresh]").onclick = () => { void refresh(); if (enabled && Date.now() - lastReportAt >= 10000) { retryAt = 0; void upload(); } };
  $("#monitorName").onchange = () => { try { localStorage.setItem("mindex.monitor.name", $("#monitorName").value.slice(0, 60)); } catch {} };
  $("[data-share]").onchange = () => {
    enabled = $("[data-share]").checked; shareSerial++; events.length = 0; previous = null;
    try { localStorage.setItem("mindex.monitor.share", String(enabled)); } catch {}
    if (enabled) { retryAt = 0; record("open"); shareMessage("상태 공유 연결 중"); void upload(); }
    else { const old = reporter; reporter = null; void leave(old); shareMessage("상태 공유 중지"); }
  };
  $("form").onsubmit = async (event) => {
    event.preventDefault();
    if (loginPending || !panel.open || document.hidden) return;
    loginPending = true;
    const serial = ++loginSerial; const submit = $("button[type=submit]"); submit.disabled = true;
    const password = $("#monitorPassword").value; $("#monitorPassword").value = "";
    try {
      const token = await rpc("mindex_monitor_login", { p_password: password });
      if (serial !== loginSerial || !panel.open) { void leave(token); return; }
      if (!token) { message("비밀번호·서버 설정 또는 시도 제한을 확인해 주세요."); return; }
      admin = token; viewerExpiresAt = Date.now() + 30 * 60 * 1000; lastActivityAt = Date.now();
      $("form").hidden = true; $("[data-lock]").hidden = false; await refresh();
    } catch (e) { if (serial === loginSerial) message(e.message); }
    finally { submit.disabled = false; loginPending = false; }
  };
  document.addEventListener("input", (e) => {
    if (!enabled || panel.contains(e.target) || !e.target.closest?.("#detailPane, #mindexRightSidebar") || Date.now() - lastEdit < 15000) return;
    lastEdit = Date.now(); record("edit");
  }, true);
  window.addEventListener("mindex:save-result", (e) => record(e.detail));
  for (const name of ["pointerdown", "keydown", "input"]) panel.addEventListener(name, () => { lastActivityAt = Date.now(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { lock(); }
    else { if (enabled) { retryAt = 0; void upload(); } void refresh(); }
  });
  window.addEventListener("offline", () => { remoteVerified = false; if (panel.open && admin) renderRemote(); if (enabled) shareMessage("네트워크 연결 끊김 · 전송 대기"); });
  window.addEventListener("online", () => { if (enabled) { retryAt = 0; void upload(); } void refresh(); });
  window.addEventListener("pagehide", () => { shareSerial++; enabled = false; lock(); reporter = null; });
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    try { enabled = localStorage.getItem("mindex.monitor.share") === "true"; } catch { enabled = false; }
    $("[data-share]").checked = enabled;
  });
  record("open");
  shareMessage(enabled ? "상태 공유 연결 대기" : "상태 공유 꺼짐");
  // Sample small state only; network writes retain the existing 15-second cadence.
  setInterval(() => {
    if (enabled) snapshot();
    if (admin && (Date.now() >= viewerExpiresAt || Date.now() - lastActivityAt >= 5 * 60 * 1000)) { lock(); message("자동 잠금되었습니다."); }
    if (panel.open) {
      renderRows($("[data-local]"), [{ id: "local", status: snapshot() }]);
      if (admin) renderRemote();
    }
  }, 2000);
  // Telemetry never awaits, rebuilds, or publishes the presenter state.
  setInterval(() => { if (enabled) { snapshot(); void upload(); } if (panel.open) void refresh(); }, 15000);
})();
