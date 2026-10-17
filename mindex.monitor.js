(() => {
  "use strict";
  if (isPresenterOutputRoute()) return;
  const trigger = document.getElementById("monitorPanelBtn");
  if (!trigger) return;
  const requests = new Map();
  const renderKeys = new WeakMap();
  let remoteRows = [];
  let remoteVerified = false, lastReportAt = 0;
  let reporter = null, uploading = false, reading = false;
  let viewSerial = 0, shareSerial = 0, retryAt = 0, failures = 0;
  let enabled = true, name = "";
  try { name = localStorage.getItem("mindex.monitor.name") || ""; } catch {}
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac/.test(ua) ? "macOS" : "Other";
  const browser = /Whale\//.test(ua) ? "Whale" : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const panel = document.createElement("dialog");
  panel.className = "monitor-panel"; panel.setAttribute("aria-labelledby", "monitorTitle");
  panel.innerHTML = `<header><h2 id="monitorTitle">접속 현황</h2><button class="icon-btn" data-close title="닫기" aria-label="닫기"><i data-lucide="x"></i></button></header>
    <section class="monitor-section"><div data-local></div></section>
    <section class="monitor-section" aria-labelledby="monitorRemoteTitle"><div class="monitor-section-heading"><h3 id="monitorRemoteTitle">접속 중</h3><span data-count></span><button class="icon-btn" data-refresh title="새로고침" aria-label="새로고침"><i data-lucide="refresh-cw"></i></button></div>
    <p class="monitor-message" role="status"></p><div data-devices></div></section>
    <details class="monitor-section"><summary>접속 이름 설정</summary><div class="monitor-toolbar"><label for="monitorName">접속 이름</label><input id="monitorName" maxlength="60" autocomplete="off"></div><p class="monitor-share-status" role="status"></p><p>민덱스를 열면 자동으로 표시됩니다.</p></details>`;
  document.body.append(panel);
  const $ = (selector) => panel.querySelector(selector);
  $("#monitorName").value = name || `${os} ${browser}`;
  function message(text) { $(".monitor-message").textContent = text; }
  function shareMessage(text) { $(".monitor-share-status").textContent = text; }
  function timestamp(value) {
    const time = Date.parse(value);
    return Number.isFinite(time) && time <= Date.now() + 5000 ? time : 0;
  }
  function isStale(row) { const time = timestamp(row.last_seen); return !time || Date.now() - time > 45000; }
  function snapshot() {
    const p = state.presenter;
    const output = Boolean(p.outputConnectedAt && Date.now() >= p.outputConnectedAt && Date.now() - p.outputConnectedAt <= PRESENTER_OUTPUT_HEARTBEAT_TTL_MS);
    return { name: $("#monitorName").value.trim().slice(0, 60), os, browser, output };
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
    $("[data-count]").textContent = remoteVerified ? `${rows.length}개 접속` : "";
    renderRows($("[data-devices]"), rows);
    if (!rows.length) $("[data-devices]").textContent = !remoteVerified ? "접속 상태를 확인하지 못했습니다." : "현재 접속 중인 기기가 없습니다.";
  }
  async function rpc(name, args) {
    if (!state.client?.rpc) throw Error("원격 조회에 필요한 DB 클라이언트가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
    if (!navigator.onLine) throw Error("네트워크 연결이 끊겼습니다.");
    const controller = new AbortController();
    requests.set(controller, name === "mindex_monitor_presence" ? "viewer" : "reporter");
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
      if (!token) throw Error("접속 등록 서버 설정 또는 접속 상한을 확인해 주세요.");
      reporter = token;
      if (!await rpc("mindex_monitor_heartbeat", { p_token: token, p_status: snapshot() })) { reporter = null; throw Error("접속 등록이 만료되었습니다."); }
      if (serial !== shareSerial || !enabled) return;
      failures = 0; retryAt = 0; lastReportAt = Date.now();
      shareMessage(`자동 등록됨 · 마지막 응답 ${new Date(lastReportAt).toLocaleTimeString()}`);
    } catch (e) {
      if (serial !== shareSerial || !enabled) return;
      retryAt = Date.now() + Math.min(300000, 15000 * 2 ** Math.min(++failures, 5));
      shareMessage(`${e.message} 자동 재시도 예정 · 마지막 전송 ${lastReportAt ? new Date(lastReportAt).toLocaleTimeString() : "없음"}`);
    } finally { uploading = false; }
  }
  function clearView() {
    viewSerial++;
    for (const [controller, scope] of requests) if (scope === "viewer") controller.abort();
    $("[data-devices]").replaceChildren(); $("[data-count]").textContent = "";
    remoteRows = []; remoteVerified = false; renderKeys.delete($("[data-devices]")); message("");
  }
  async function refresh() {
    if (!panel.open || document.hidden) return;
    renderRows($("[data-local]"), [{ id: "local", status: snapshot() }]);
    if (reading) return;
    renderRemote();
    const serial = viewSerial; reading = true;
    try {
      const rows = await rpc("mindex_monitor_presence", {});
      if (serial !== viewSerial || !panel.open) return;
      if (!Array.isArray(rows)) throw Error("접속 상태를 확인하지 못했습니다.");
      remoteRows = rows.filter((row) => row && typeof row.id === "string" && row.status && typeof row.status === "object" && !Array.isArray(row.status)).slice(0, 100);
      remoteVerified = true; renderRemote();

      message("");
    } catch (e) { if (serial === viewSerial) { remoteVerified = false; renderRemote(); message(e.message); } }
    finally { reading = false; }
  }
  trigger.onclick = () => { if (!panel.open) panel.showModal(); void refresh(); window.lucide?.createIcons({ root: panel }); };
  $("[data-close]").onclick = () => panel.close(); panel.addEventListener("close", clearView);
  $("[data-refresh]").onclick = () => { void refresh(); if (enabled && Date.now() - lastReportAt >= 10000) { retryAt = 0; void upload(); } };
  $("#monitorName").onchange = () => { try { localStorage.setItem("mindex.monitor.name", $("#monitorName").value.slice(0, 60)); } catch {} };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { clearView(); }
    else { if (enabled) { retryAt = 0; void upload(); } void refresh(); }
  });
  window.addEventListener("offline", () => { remoteVerified = false; if (panel.open) renderRemote(); if (enabled) shareMessage("네트워크 연결 끊김 · 전송 대기"); });
  window.addEventListener("online", () => { if (enabled) { retryAt = 0; void upload(); } void refresh(); });
  window.addEventListener("pagehide", () => { shareSerial++; enabled = false; clearView(); const old = reporter; reporter = null; void leave(old); });
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    enabled = true; retryAt = 0; lastReportAt = 0; void upload();
  });
  shareMessage("접속 등록 중…");
  void upload();
  // Sample small state only; network writes retain the existing 15-second cadence.
  setInterval(() => {
    if (enabled && !lastReportAt) void upload();
    if (panel.open) {
      renderRows($("[data-local]"), [{ id: "local", status: snapshot() }]);
      renderRemote();
    }
  }, 2000);
  // Telemetry never awaits, rebuilds, or publishes the presenter state.
  setInterval(() => { if (enabled) { void upload(); } if (panel.open) void refresh(); }, 15000);
})();
