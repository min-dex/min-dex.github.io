import { o as m } from "./parser-CJhMJQf-.js";
self.onmessage = (a) => {
  const { id: r, bytes: n } = a.data;
  try {
    const e = new Uint8Array(n);
    if (!(e[0] === 80 && e[1] === 75))
      throw new Error("Worker 仅支持 .pptx；.ppt 请在主线程解析");
    const { presentation: t, assets: p } = m(e), { dispose: d, ...i } = t, o = p.map((s) => {
      const f = s.data.slice();
      return { mime: s.mime, data: f.buffer };
    }), c = { id: r, ok: !0, presentation: i, assets: o };
    self.postMessage(c, o.map((s) => s.data));
  } catch (e) {
    const t = { id: r, ok: !1, error: e instanceof Error ? e.message : String(e) };
    self.postMessage(t);
  }
};
