(() => {
  "use strict";
  if (isPresenterOutputRoute()) return;
  const trigger = document.getElementById("monitorPanelBtn");
  if (!trigger) return;
  const REPORT_MS = 60000, STALE_MS = 180000;
  const TOKEN_KEY = "mindex.monitor.deviceReporter";
  const tabs=new Map();
  let tabChannel=null;
  try { tabChannel=new BroadcastChannel("mindex.monitor.presence.v1"); } catch {}
  const tabId = crypto.randomUUID();
  const withDeviceLock = task => navigator.locks?.request ? navigator.locks.request("mindex-monitor-device-report", task) : task();
  let resumeReady = false;
  const requests = new Map();
  const renderKeys = new WeakMap();
  let remoteRows = [];
  let remoteVerified = false, lastReportAt = 0, reportedOutput = null;
  let reporter = null, uploading = false, reading = false;
  let viewSerial = 0, shareSerial = 0, retryAt = 0, failures = 0;
  let enabled = true, name = "";
  try { name = window.MINDEX_SERVER_STORAGE?.getItem("local","mindex.monitor.name") || ""; } catch {}
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac/.test(ua) ? "macOS" : "Other";
  const browser = /Whale\//.test(ua) ? "Whale" : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const panel = document.createElement("dialog");
  panel.className = "monitor-panel"; panel.setAttribute("aria-labelledby", "monitorTitle");
  panel.innerHTML = `<header><h2 id="monitorTitle">접속 현황</h2><button class="icon-btn" data-close title="닫기" aria-label="닫기"><i data-lucide="x"></i></button></header>

    <section class="monitor-section" aria-labelledby="monitorRemoteTitle"><div class="monitor-section-heading"><h3 id="monitorRemoteTitle">접속 기기</h3><span data-count></span><button class="icon-btn" data-refresh title="새로고침" aria-label="새로고침"><i data-lucide="refresh-cw"></i></button></div>
    <p class="monitor-message" role="status"></p><div data-devices></div></section>
    <section class="monitor-section"><h3>이 기기 이름</h3><div class="monitor-toolbar"><label for="monitorName">기기 이름</label><input id="monitorName" maxlength="60" autocomplete="off" placeholder="예: 본당 송출 PC"></div><p class="monitor-share-status" role="status"></p><p>같은 브라우저 프로필의 창·탭은 한 기기로 묶습니다. 브라우저나 프로필이 다르면 별도로 표시합니다.</p></section>`;
  document.body.append(panel);
  const $ = (selector) => panel.querySelector(selector);
  $("#monitorName").value = name || `${os} ${browser}`;
  function message(text) { $(".monitor-message").textContent = text; }
  function shareMessage(text) { $(".monitor-share-status").textContent = text; }
  function timestamp(value) {
    const time = Date.parse(value);
    return Number.isFinite(time) && time <= Date.now() + 5000 ? time : 0;
  }
  function isStale(row) { const time = timestamp(row.last_seen); return !time || Date.now() - time > STALE_MS; }
  function localOutput() {
    const p = state.presenter;
    return Boolean(p.outputConnectedAt && Date.now() >= p.outputConnectedAt && Date.now() - p.outputConnectedAt <= PRESENTER_OUTPUT_HEARTBEAT_TTL_MS);
  }
  function recordTab(remove = false) {
    const value=remove?null:{at:Date.now(),output:localOutput()};
    if(value)tabs.set(tabId,value);else tabs.delete(tabId);
    try{tabChannel?.postMessage({id:tabId,value})}catch{}
  }
  if(tabChannel){
    tabChannel.onmessage=({data})=>{
      if(data?.hello){recordTab();return}
      if(typeof data?.id!=="string"||data.id===tabId)return;
      if(data.value&&Number.isFinite(data.value.at))tabs.set(data.id,data.value);else tabs.delete(data.id);
      if(snapshot().output!==reportedOutput)void upload();
    };
    tabChannel.postMessage({hello:true});
  }
  function snapshot() {
    let output = enabled && localOutput();
    for(const [id,tab] of tabs){
      if(tab.at>Date.now()+5000||Date.now()-tab.at>=STALE_MS){tabs.delete(id);continue}
      if(tab.output===true)output=true;
    }
    return { name: name.trim().slice(0,60) || `${os} ${browser}`, os, browser, output };
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
    identity.textContent = local ? "이 기기" : `${data.os || ""} · ${data.browser || ""}`;
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
    $("[data-count]").textContent = remoteVerified ? `${rows.length}대` : "";
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
  function readToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return reporter || ''; }
  }
  function rememberToken(token) {
    reporter = token;
    try { if (token) localStorage.setItem(TOKEN_KEY,token); else localStorage.removeItem(TOKEN_KEY); } catch {}
  }
  async function resume() {
    recordTab(); resumeReady=true; void upload();
  }
  async function upload() {
    if (!resumeReady || !enabled || uploading || Date.now() < retryAt || !state.client) return;
    const serial = shareSerial; uploading = true;
    try {
      await withDeviceLock(async () => {
      let sent;
      for (let attempt = 0; attempt < 2; attempt++) {
        let token = readToken();
        if (!/^[a-f0-9]{64}$/.test(token)) {
          token = await rpc("mindex_monitor_register", {});
          if (!token || !/^[a-f0-9]{64}$/.test(token)) throw Error("접속 등록 서버 설정 또는 접속 상한을 확인해 주세요.");
          rememberToken(token);
        }
        if (serial !== shareSerial || !enabled) return;
        sent = snapshot();
        if (await rpc("mindex_monitor_ping", {p_token:token,p_status:sent})) break;
        rememberToken(null);
        if (attempt === 1) throw Error("접속 등록이 만료되었습니다.");
      }
      if (serial !== shareSerial || !enabled) return;
      failures = 0; retryAt = 0; lastReportAt = Date.now(); reportedOutput = sent.output;
      shareMessage(`기기 이름 공유됨 · 마지막 응답 ${new Date(lastReportAt).toLocaleTimeString()}`);
      if (panel.open) void refresh();
      });
    } catch (e) {
      if (serial !== shareSerial || !enabled) return;
      retryAt = Date.now() + Math.min(300000, REPORT_MS * 2 ** Math.min(++failures - 1, 3));
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
  $("[data-refresh]").onclick = () => { void refresh(); if (enabled && Date.now() - lastReportAt >= REPORT_MS) { retryAt = 0; void upload(); } };
  $("#monitorName").onchange = async () => {
    const next=$("#monitorName").value.trim().slice(0,60);
    try{
      if(!window.MINDEX_SERVER_STORAGE?.ready)throw Error("서버 연결을 확인해 주세요.");
      await window.MINDEX_SERVER_STORAGE.setItem("local","mindex.monitor.name",next);
      name=next;retryAt=0;void upload();
    }catch{shareMessage("기기 이름을 서버에 저장하지 못했습니다. 다시 시도해 주세요.");}
  };
  function hydrateServerName(){
    name=window.MINDEX_SERVER_STORAGE.getItem("local","mindex.monitor.name","");
    if(document.activeElement!==$("#monitorName"))$("#monitorName").value=name||`${os} ${browser}`;
  }
  window.addEventListener("mindex-server-storage-ready",hydrateServerName);
  window.addEventListener("mindex-server-device-updated",hydrateServerName);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { clearView(); }
    else { if (enabled) { retryAt = 0; void upload(); } void refresh(); }
  });
  window.addEventListener("offline", () => { remoteVerified = false; if (panel.open) renderRemote(); if (enabled) shareMessage("네트워크 연결 끊김 · 전송 대기"); });
  window.addEventListener("online", () => { if (enabled) { retryAt = 0; void upload(); } void refresh(); });
  window.addEventListener("pagehide", () => { recordTab(true); shareSerial++; enabled = false; clearView(); });
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    enabled = true; recordTab(); retryAt = 0; lastReportAt = 0; void upload();
  });
  shareMessage("접속 등록 중…");
  void resume();
  // Output changes are sampled locally; unchanged presence uploads once per minute.
  let lastTabOutput=localOutput(), lastTabWrite=Date.now();
  setInterval(() => {
    if(enabled && (localOutput()!==lastTabOutput || Date.now()-lastTabWrite>30000)) { recordTab(); lastTabOutput=localOutput(); lastTabWrite=Date.now(); }
    if (enabled && (!lastReportAt || snapshot().output !== reportedOutput)) void upload();
    if (panel.open) {
        renderRemote();
    }
  }, 2000);
  // Telemetry never awaits, rebuilds, or publishes the presenter state.
  setInterval(() => { if (enabled) { void upload(); } if (panel.open) void refresh(); }, REPORT_MS);
})();
