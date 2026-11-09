export function mountYoutube(acquireStream, hasInput) {
  const engine = window.youtubeOutput;
  if (!engine) return { abort() {}, syncInput() {} };
  const el = id => document.getElementById(id);
  el('youtube').hidden = false;
  let active;
  try { const saved=Number(localStorage.getItem('mindex.broadcast.bitrate')); if(Number.isInteger(saved)&&saved>=5000&&saved<=30000)el('ytBitrate').value=saved; } catch {}
  function syncInput() {
    if (active) return;
    el('ytStart').disabled = !hasInput();
    el('ytStatus').textContent = hasInput() ? '송출 대기' : '카메라 또는 영상 파일을 연결해 주세요.';
  }
  function finish(run, text) {
    if (active !== run) return;
    active = null;
    if (run.recorder?.state === 'recording') run.recorder.stop();
    run.release?.();
    el('ytKey').disabled = el('ytBitrate').disabled = el('ytRecord').disabled = false;
    el('ytStart').disabled = !hasInput();
    el('ytStop').disabled = true;
    for (const id of ['file','test','captureConnect','captureDisconnect']) el(id).inert = false;
    el('ytStatus').textContent = text;
  }
  async function fail(run) {
    if (active !== run) return;
    await engine.abort().catch(()=>{});
    finish(run,'송출이 중단됐습니다. 입력과 연결을 확인해 주세요.');
  }
  engine.onState(state => {
    if (!active) return;
    if (state === 'live' && !active.stopping) el('ytStatus').textContent = active.recording?'송출·녹화 중':'송출 중';
    if (state === 'failed') void fail(active);
  });
  el('ytStart').onclick = async () => {
    if (active || !hasInput() || !el('ytKey').reportValidity() || !el('ytBitrate').reportValidity()) return;
    const bitrateKbps=Number(el('ytBitrate').value);
    try { localStorage.setItem('mindex.broadcast.bitrate',String(bitrateKbps)); } catch {}
    const run = active = {pending:Promise.resolve(),queued:0};
    el('ytKey').disabled = el('ytStart').disabled = el('ytBitrate').disabled = el('ytRecord').disabled = true;
    el('ytStop').disabled = false;
    el('ytStatus').textContent = '연결 중…';
    for (const id of ['file','test','captureConnect','captureDisconnect']) el(id).inert = true;
    try {
      const {stream,release} = await acquireStream();
      if (active !== run) { release(); return; }
      run.release = release;
      const rec = run.recorder = new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:Math.max(20000000,bitrateKbps*2000)});
      const result=await engine.start({key:el('ytKey').value.trim(),bitrateKbps,record:el('ytRecord').checked});
      if(result?.cancelled){finish(run,'저장 선택을 취소했습니다.');return;}
      run.recording=result?.recording;
      if (active !== run) return;
      el('ytKey').value = '';
      rec.ondataavailable = ({data}) => {
        if (!data.size || active !== run) return;
        run.queued += data.size;
        if (run.queued > 8*1024*1024) { void fail(run); return; }
        run.pending = run.pending.then(async () => {
          for (let offset=0; offset<data.size && active===run; offset+=1048576)
            await engine.write(new Uint8Array(await data.slice(offset,offset+1048576).arrayBuffer()));
          run.queued -= data.size;
        }).catch(()=>fail(run));
      };
      rec.onerror = () => void fail(run);
      rec.onstop = async () => {
        await run.pending;
        if (active !== run) return;
        try {
          if (!await engine.stop()) throw Error();
          finish(run,run.recording?'송출 종료 · 녹화 저장 완료':'송출 종료');
        } catch { await fail(run); }
      };
      rec.start(250);
    } catch { await fail(run); }
  };
  el('ytStop').onclick = async () => {
    const run = active;
    if (!run) return;
    run.stopping = true;
    el('ytStop').disabled = true;
    el('ytStatus').textContent = '종료 중…';
    if (run.recorder?.state === 'recording') run.recorder.stop();
    else { await engine.abort(); finish(run,run.recording?'송출 종료 · 녹화 저장 완료':'송출 종료'); }
  };
  syncInput();
  return { abort: () => { if (active) void fail(active); }, syncInput };
}
