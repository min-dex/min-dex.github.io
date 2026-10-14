import { k as N, c as de, n as Dt, e as dr, a as Me, b as Tt, w as _t, d as Ys, z as pr, u as mr, i as gr, m as br, p as os, s as wr, f as yr } from "./parser-CJhMJQf-.js";
import { h as Qu, g as tf, j as ef, l as nf } from "./parser-CJhMJQf-.js";
import { presetGeom as xr } from "./geometry.js";
function qs(t) {
  if (!(t != null && t.length)) return [];
  const e = [];
  for (const n of t) {
    const o = n.clickGroup ?? 0;
    (e[o] ?? (e[o] = [])).push(n);
  }
  return e.filter(Boolean);
}
function Ks(t, e) {
  const n = /* @__PURE__ */ new Set();
  for (let o = e; o < t.length; o++)
    for (const s of t[o]) s.kind === "entrance" && n.add(s.target);
  for (let o = 0; o < e; o++)
    for (const s of t[o]) s.kind === "exit" && n.add(s.target);
  for (let o = e; o < t.length; o++)
    for (const s of t[o]) s.kind === "entrance" && n.add(s.target);
  return n;
}
function $r(t) {
  const e = qs(t.animations);
  if (!e.length) return /* @__PURE__ */ new Set();
  const n = Ks(e, e.length);
  if (!n.size) return n;
  const o = [], s = (r) => {
    for (const i of r)
      i.id !== void 0 && o.push(i.id), i.kind === "group" && s(i.children);
  };
  return s(t.elements), o.length && o.every((r) => n.has(r)) ? /* @__PURE__ */ new Set() : n;
}
const Pt = (t) => t * 96 / 72, v = (t) => {
  if (!Number.isFinite(t)) return "0";
  const e = Math.round(t * 100) / 100;
  return Object.is(e, -0) ? "0" : String(e);
}, tt = (t, e, n) => t < e ? e : t > n ? n : t, Ft = (t, e = 0) => Number.isFinite(t) ? t : e;
function bt(t, e, n, o, s, r, i) {
  return {
    kind: "shape",
    x: Ft(t),
    y: Ft(e),
    w: Math.max(Ft(n), 0),
    h: Math.max(Ft(o), 0),
    rot: 0,
    flipH: !1,
    flipV: !1,
    path: s,
    fill: r,
    stroke: i,
    text: null
  };
}
const Mr = (t, e) => `M 0 0 L ${v(t)} 0 L ${v(t)} ${v(e)} L 0 ${v(e)} Z`;
function we(t, e, n) {
  return bt(t.x, t.y, t.w, t.h, Mr(t.w, t.h), e, n);
}
function $t(t, e, n, o, s) {
  if (!s || ![t, e, n, o].every(Number.isFinite)) return null;
  const r = Math.min(t, n), i = Math.min(e, o);
  return bt(
    r,
    i,
    Math.abs(n - t),
    Math.abs(o - e),
    `M ${v(t - r)} ${v(e - i)} L ${v(n - r)} ${v(o - i)}`,
    null,
    s
  );
}
function Rn(t, e, n, o) {
  const s = t.map((u) => u.filter(([f, h]) => Number.isFinite(f) && Number.isFinite(h))).filter((u) => u.length >= 3);
  if (!s.length) return null;
  let r = 1 / 0, i = 1 / 0, c = -1 / 0, a = -1 / 0;
  for (const u of s)
    for (const [f, h] of u)
      r = Math.min(r, f), i = Math.min(i, h), c = Math.max(c, f), a = Math.max(a, h);
  const l = s.map((u) => "M " + u.map(([f, h]) => `${v(f - r)} ${v(h - i)}`).join(" L ") + " Z").join(" ");
  return bt(r, i, c - r, a - i, l, e, n);
}
const Er = (t, e = 0.25) => pt(t, "#ffffff", e), Dn = (t, e = 0.2) => pt(t, "#000000", e);
function Zs(t, e, n) {
  return Rn([t], e, n);
}
function ht(t, e, n, o, s, r = {}) {
  const i = {
    text: s,
    b: r.bold ?? !1,
    i: !1,
    u: !1,
    strike: !1,
    size: r.size ?? Pt(10),
    color: r.color ?? "rgb(0,0,0)",
    fonts: r.fonts ?? []
  }, c = {
    align: r.align ?? "center",
    lvl: 0,
    marL: 0,
    indent: 0,
    bullet: null,
    lineHeight: 1.15,
    spaceBefore: 0,
    spaceAfter: 0,
    runs: [i]
  }, a = {
    anchor: r.anchor ?? "middle",
    insets: [0, 0, 0, 0],
    wrap: !1,
    fontScale: 1,
    paragraphs: [c]
  };
  return {
    kind: "shape",
    x: Ft(t),
    y: Ft(e),
    w: Math.max(Ft(n), 0),
    h: Math.max(Ft(o), 0),
    rot: r.rot ?? 0,
    flipH: !1,
    flipV: !1,
    path: null,
    fill: null,
    stroke: null,
    text: a
  };
}
function Un(t, e) {
  let n = 0;
  for (const o of t) {
    const s = o.codePointAt(0) ?? 32;
    s >= 4352 && s <= 8191 || s >= 11904 && s <= 42191 || s >= 44032 && s <= 55203 || s >= 63744 && s <= 64255 || s >= 65072 && s <= 65376 ? n += 1 : `iljtf.,:;'"|!I[]()`.includes(o) ? n += 0.3 : "mwMW@%".includes(o) ? n += 0.85 : o >= "A" && o <= "Z" ? n += 0.66 : n += 0.53;
  }
  return n * e;
}
const dt = (t) => ({ type: "solid", color: t });
function Js(t, e) {
  const n = t.clrMap[e] ?? e, o = (t.theme[n] ?? t.theme[e] ?? "000000").replace(/^#/, "");
  return "#" + (o.length >= 6 ? o.slice(0, 6) : o.padStart(6, "0"));
}
function rs(t) {
  const e = t.trim();
  if (e.startsWith("#")) {
    const o = e.slice(1), s = o.length === 3 ? o.split("").map((r) => r + r).join("") : o.padStart(6, "0");
    return [
      parseInt(s.slice(0, 2), 16) || 0,
      parseInt(s.slice(2, 4), 16) || 0,
      parseInt(s.slice(4, 6), 16) || 0
    ];
  }
  const n = e.match(/-?[\d.]+/g);
  return n && n.length >= 3 ? [Number(n[0]) || 0, Number(n[1]) || 0, Number(n[2]) || 0] : [0, 0, 0];
}
function pt(t, e, n) {
  const o = rs(t), s = rs(e), r = tt(n, 0, 1), i = o.map((c, a) => Math.round(c + (s[a] - c) * r));
  return `rgb(${i[0]},${i[1]},${i[2]})`;
}
function Qs(t, e) {
  const n = (e % 6 + 6) % 6, o = Js(t, `accent${n + 1}`), s = Math.floor(e / 6);
  return s <= 0 ? o : s % 2 === 1 ? pt(o, "#ffffff", tt(0.3 * Math.ceil(s / 2), 0, 0.72)) : pt(o, "#000000", tt(0.22 * (s / 2), 0, 0.6));
}
function Vt(t, e) {
  if (!t) return null;
  if (N(t, "noFill")) return { type: "none" };
  const n = N(t, "solidFill");
  if (n) return dt(de(n, e) ?? "rgb(0,0,0)");
  const o = N(t, "gradFill");
  if (o) {
    const r = Tt(N(o, "gsLst"), "gs").map((c) => ({ pos: (Dt(c, "pos") ?? 0) / 1e5, color: de(c, e) ?? "rgb(0,0,0)" })).sort((c, a) => c.pos - a.pos);
    if (!r.length) return null;
    const i = N(o, "lin");
    return { type: "gradient", angle: i ? (Dt(i, "ang") ?? 0) / 6e4 : 90, stops: r };
  }
  const s = N(t, "pattFill");
  if (s) {
    const r = de(N(s, "fgClr"), e);
    if (r) return dt(r);
  }
  return null;
}
const kr = {
  dash: [4, 3],
  dashDot: [4, 3, 1, 3],
  dot: [1, 3],
  lgDash: [8, 3],
  lgDashDot: [8, 3, 1, 3],
  lgDashDotDot: [8, 3, 1, 3, 1, 3],
  sysDash: [3, 3],
  sysDashDot: [3, 3, 1, 3],
  sysDashDotDot: [3, 3, 1, 3, 1, 3],
  sysDot: [1, 1]
}, Nn = { color: null, width: null, dash: null, none: !1, present: !1 };
function It(t, e) {
  if (!t) return { ...Nn };
  const n = { color: null, width: null, dash: null, none: !1, present: !0 };
  if (N(t, "noFill"))
    return n.none = !0, n;
  n.color = de(N(t, "solidFill"), e);
  const o = Dt(t, "w");
  o !== null && (n.width = dr(o));
  const s = Me(N(t, "prstDash"), "val");
  return s && s !== "solid" && (n.dash = (kr[s] ?? [4, 3]).map((r) => r * Math.max(n.width ?? 1, 1))), n;
}
function lt(t, e, n) {
  const o = t ?? Nn;
  if (o.none) return null;
  const s = o.color ?? e;
  if (!s) return null;
  const r = o.width ?? n;
  return r > 0 ? { color: s, width: r, dash: o.dash } : null;
}
function Sr(t) {
  const e = [];
  let n = "", o = !1;
  for (let s = 0; s < t.length; s++) {
    const r = t[s];
    if (r === '"') {
      o = !o, n += r;
      continue;
    }
    if (r === "\\") {
      n += r + (t[s + 1] ?? ""), s++;
      continue;
    }
    if (r === ";" && !o) {
      e.push(n), n = "";
      continue;
    }
    n += r;
  }
  return e.push(n), e;
}
const nn = (t) => t.replace(/\\(.)/g, "$1").replace(/"/g, "").replace(/[*_](.)/g, "").replace(/@/g, "");
function Tr(t) {
  if (Number.isInteger(t)) return String(t);
  const e = Math.abs(t);
  return e !== 0 && (e >= 1e11 || e < 1e-4) ? t.toExponential(2) : String(Math.round(t * 1e6) / 1e6);
}
function Cr(t) {
  return t.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function sn(t, e) {
  const n = e.replace(/\[[^\]]*\]/g, "");
  let o = t;
  const s = o < 0;
  o = Math.abs(o);
  const r = (n.match(/%/g) ?? []).length;
  r && (o *= Math.pow(100, r));
  const i = n.match(/[#0?][#0?,]*(\.[#0?]+)?/);
  if (!i) return (s ? "-" : "") + nn(n);
  const c = i[0], a = i.index ?? 0, l = nn(n.slice(0, a)), u = nn(n.slice(a + c.length)), f = c.indexOf(".");
  let h = f < 0 ? c : c.slice(0, f);
  const m = f < 0 ? "" : c.slice(f + 1), d = h.match(/,+$/);
  d && (o /= Math.pow(1e3, d[0].length), h = h.slice(0, -d[0].length));
  const p = h.includes(","), w = m.length, b = (m.match(/0/g) ?? []).length;
  let g = o.toFixed(Math.min(w, 20));
  w > b && (g = g.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""), (g.split(".")[1] ?? "").length < b && (g = o.toFixed(b)));
  let [y, $] = g.split(".");
  const x = (h.match(/0/g) ?? []).length;
  return y.length < x && (y = y.padStart(x, "0")), x === 0 && y === "0" && $ && (y = ""), p && (y = Cr(y)), (s ? "-" : "") + l + y + ($ ? "." + $ : "") + u;
}
function jt(t, e) {
  if (!Number.isFinite(t)) return "";
  const n = (e ?? "").trim();
  if (!n || /^general$/i.test(n)) return Tr(t);
  if (/e[+-]/i.test(n)) return t.toExponential(2);
  const o = Sr(n);
  return t < 0 && o.length > 1 && o[1].trim() ? sn(-t, o[1]) : t === 0 && o.length > 2 && o[2].trim() ? sn(0, o[2]) : sn(t, o[0] ?? "");
}
const pe = (t) => Number(t.toPrecision(12));
function Bn(t, e, n = 5) {
  let o = Number.isFinite(t) ? t : 0, s = Number.isFinite(e) ? e : 1;
  if (s < o && ([o, s] = [s, o]), o === s)
    if (o === 0)
      o = 0, s = 1;
    else {
      const f = Math.abs(o) * 0.5;
      o -= f, s += f;
    }
  const r = (s - o) / Math.max(1, n), i = Math.pow(10, Math.floor(Math.log10(r))), c = r / i, a = (c <= 1 ? 1 : c <= 2 ? 2 : c <= 5 ? 5 : 10) * i, l = pe(Math.floor(o / a + 1e-9) * a);
  let u = pe(Math.ceil(s / a - 1e-9) * a);
  return u > l || (u = pe(l + a)), { min: l, max: u, step: a };
}
function Lr(t) {
  const e = [];
  if (!(t.step > 0) || !Number.isFinite(t.min) || !Number.isFinite(t.max)) return [t.min];
  const n = Math.floor((t.max - t.min) / t.step + 1e-6), o = Math.min(n, 60);
  for (let r = 0; r <= o; r++) e.push(pe(t.min + r * t.step));
  const s = e[e.length - 1];
  return s !== void 0 && t.max - s > t.step * 1e-6 && e.push(pe(t.max)), e;
}
const Ar = {
  barChart: "bar",
  bar3DChart: "bar",
  lineChart: "line",
  line3DChart: "line",
  stockChart: "stock",
  pieChart: "pie",
  pie3DChart: "pie",
  ofPieChart: "ofPie",
  doughnutChart: "doughnut",
  areaChart: "area",
  area3DChart: "area",
  scatterChart: "scatter",
  bubbleChart: "bubble",
  radarChart: "radar",
  surfaceChart: "surface",
  surface3DChart: "surface"
}, to = (t) => t === "scatter" || t === "bubble", gt = (t, e, n) => {
  const o = N(t, e);
  return o ? Ys(o, "val", !0) : n;
}, st = (t, e) => Dt(N(t, e), "val"), ct = (t, e) => Me(N(t, e), "val");
function eo(t) {
  if (!t) return null;
  for (const e of ["numRef", "strRef", "multiLvlStrRef"]) {
    const n = N(t, e);
    if (n) return N(n, "numCache") ?? N(n, "strCache") ?? N(n, "multiLvlStrCache");
  }
  return N(t, "numLit") ?? N(t, "strLit") ?? null;
}
function no(t, e) {
  var o;
  const n = new Array(Math.max(0, Math.min(e, 2e4))).fill("");
  for (const s of Tt(t, "pt")) {
    const r = Dt(s, "idx") ?? -1;
    if (!(r < 0 || r > 2e4)) {
      for (; n.length <= r; ) n.push("");
      n[r] = ((o = N(s, "v")) == null ? void 0 : o.textContent) ?? "";
    }
  }
  return n;
}
function Ne(t) {
  var r;
  const e = eo(t);
  if (!e) return { vals: [], fmt: null };
  const n = ((r = N(e, "formatCode")) == null ? void 0 : r.textContent) ?? null;
  return { vals: no(e, Dt(N(e, "ptCount"), "val") ?? 0).map((i) => {
    if (i === "") return null;
    const c = Number(i);
    return Number.isFinite(c) ? c : null;
  }), fmt: n };
}
function Pr(t) {
  const e = eo(t);
  if (!e) return [];
  if (e.localName === "numCache" || e.localName === "numLit") {
    const { vals: s, fmt: r } = Ne(t);
    return s.map((i) => i === null ? "" : jt(i, r));
  }
  const n = Tt(e, "lvl"), o = n.length ? n[0] : e;
  return no(o, Dt(N(e, "ptCount"), "val") ?? 0);
}
function Fn(t) {
  var s;
  const e = N(t, "rich");
  if (e)
    return Tt(e, "p").map((i) => {
      var a;
      let c = "";
      for (let l = i.firstElementChild; l; l = l.nextElementSibling)
        l.localName === "r" || l.localName === "fld" ? c += ((a = N(l, "t")) == null ? void 0 : a.textContent) ?? "" : l.localName === "br" && (c += " ");
      return c;
    }).join(" ").trim();
  const n = N(t, "strRef");
  if (n) {
    const r = N(n, "strCache"), i = Tt(r, "pt")[0];
    return (((s = N(i, "v")) == null ? void 0 : s.textContent) ?? "").trim();
  }
  const o = N(t, "v");
  return ((o == null ? void 0 : o.textContent) ?? "").trim();
}
function me(t, e) {
  const n = _t(t, "p", "pPr", "defRPr") ?? _t(t, "rich", "p", "pPr", "defRPr"), o = _t(t, "rich", "p", "r", "rPr"), s = n ?? o;
  if (!s) return { size: null, color: null, bold: !1 };
  const r = Dt(s, "sz");
  return {
    size: r !== null ? Pt(r / 100) : null,
    color: de(N(s, "solidFill"), e),
    bold: Ys(s, "b", !1)
  };
}
const so = {
  del: !0,
  showVal: !1,
  showCat: !1,
  showSer: !1,
  showPercent: !1,
  showSize: !1,
  fmt: null,
  pos: null,
  size: null,
  color: null
};
function oo(t, e, n) {
  if (!t) return n;
  const o = gt(t, "delete", !1), s = me(N(t, "txPr"), e), r = {
    del: o,
    showVal: gt(t, "showVal", n.showVal),
    showCat: gt(t, "showCatName", n.showCat),
    showSer: gt(t, "showSerName", n.showSer),
    showPercent: gt(t, "showPercent", n.showPercent),
    showSize: gt(t, "showBubbleSize", n.showSize),
    fmt: Me(N(t, "numFmt"), "formatCode") ?? n.fmt,
    pos: ct(t, "dLblPos") ?? n.pos,
    size: s.size ?? n.size,
    color: s.color ?? n.color
  };
  return o ? { ...so, fmt: r.fmt } : r;
}
const Ct = (t) => !t.del && (t.showVal || t.showCat || t.showSer || t.showPercent || t.showSize);
function Ir(t, e) {
  if (!t) return null;
  const n = N(t, "spPr");
  return {
    symbol: ct(t, "symbol") ?? "auto",
    size: st(t, "size") ?? 5,
    fill: Vt(n, e),
    ln: It(N(n, "ln"), e)
  };
}
function Or(t, e, n, o, s) {
  const r = N(t, "spPr"), i = Vt(r, n), c = It(N(r, "ln"), n), a = to(e), l = N(t, "val") ?? N(t, "yVal") ?? N(t, "bubbleSize"), { vals: u, fmt: f } = Ne(l), h = N(t, "xVal"), m = a && h ? Ne(h).vals : null, d = e === "bubble" ? N(t, "bubbleSize") : null, p = d ? Ne(d) : null, w = Pr(N(t, "cat") ?? (a ? h : null)), b = /* @__PURE__ */ new Map();
  for (const $ of Tt(t, "dPt")) {
    const x = st($, "idx");
    if (x === null || x < 0) continue;
    const M = N($, "spPr");
    b.set(x, { fill: Vt(M, n), ln: It(N(M, "ln"), n), explosion: st($, "explosion") ?? 0 });
  }
  const g = e === "line" || e === "scatter" || e === "radar" || e === "stock";
  let y;
  return i && i.type === "solid" ? y = i.color : g && c.color ? y = c.color : y = Qs(n, o), {
    idx: st(t, "idx") ?? o,
    order: st(t, "order") ?? o,
    name: Fn(N(t, "tx")) || `系列 ${o + 1}`,
    cats: w,
    vals: u,
    xs: m,
    sizes: p ? p.vals : null,
    sizeFmt: p ? p.fmt : null,
    fill: i,
    ln: c,
    marker: Ir(N(t, "marker"), n),
    smooth: gt(t, "smooth", !1),
    fmt: f,
    dLbls: oo(N(t, "dLbls"), n, s),
    dPts: b,
    color: y
  };
}
const qe = (t) => t.grouping === "stacked" || t.grouping === "percentStacked";
function vr(t, e) {
  if (!t) return null;
  const n = N(t, "upBars"), o = N(t, "downBars");
  return {
    gapWidth: st(t, "gapWidth") ?? 150,
    upFill: Vt(N(n, "spPr"), e),
    downFill: Vt(N(o, "spPr"), e),
    upLn: It(_t(n, "spPr", "ln"), e),
    downLn: It(_t(o, "spPr", "ln"), e)
  };
}
function zr(t) {
  return {
    type: (ct(t, "ofPieType") ?? "pie") === "bar" ? "bar" : "pie",
    splitType: ct(t, "splitType") ?? "auto",
    splitPos: st(t, "splitPos"),
    custSplit: Tt(N(t, "custSplit"), "secondPiePt").map((e) => Dt(e, "val") ?? -1).filter((e) => e >= 0),
    secondSize: st(t, "secondPieSize") ?? 75,
    serLines: N(t, "serLines") !== null
  };
}
function Rr(t, e, n, o) {
  const s = ct(t, "grouping") ?? (e === "bar" ? "clustered" : "standard"), r = oo(N(t, "dLbls"), n, so), c = Tt(t, "ser").map((l, u) => Or(l, e, n, o + u, r));
  c.sort((l, u) => l.order - u.order);
  const a = /* @__PURE__ */ new Map();
  for (const l of Tt(N(t, "bandFmts"), "bandFmt")) {
    const u = st(l, "idx"), f = Vt(N(l, "spPr"), n);
    u !== null && u >= 0 && f && a.set(u, f);
  }
  return {
    kind: e,
    tag: t.localName,
    is3D: t.localName.endsWith("3DChart"),
    grouping: s,
    barDir: (ct(t, "barDir") ?? "col") === "bar" ? "bar" : "col",
    gapWidth: st(t, "gapWidth") ?? 150,
    overlap: st(t, "overlap") ?? (s === "stacked" || s === "percentStacked" ? 100 : 0),
    holeSize: st(t, "holeSize") ?? 50,
    firstSliceAng: st(t, "firstSliceAng") ?? 0,
    varyColors: gt(t, "varyColors", e === "pie" || e === "doughnut" || e === "ofPie"),
    showMarker: gt(t, "marker", !1),
    radarStyle: ct(t, "radarStyle") ?? "marker",
    scatterStyle: ct(t, "scatterStyle") ?? "lineMarker",
    axIds: Tt(t, "axId").map((l) => Me(l, "val") ?? ""),
    series: c,
    dLbls: r,
    bubbleScale: st(t, "bubbleScale") ?? 100,
    bubbleSizeBy: ct(t, "sizeRepresents") ?? "area",
    upDown: vr(N(t, "upDownBars"), n),
    hiLowLines: N(t, "hiLowLines") ? It(_t(N(t, "hiLowLines"), "spPr", "ln"), n) : null,
    ofPie: e === "ofPie" ? zr(t) : null,
    wireframe: gt(t, "wireframe", !1),
    bandFills: a
  };
}
const Dr = {
  catAx: "cat",
  valAx: "val",
  dateAx: "date",
  serAx: "ser"
};
function Fe(t) {
  return {
    id: "",
    kind: t,
    del: !1,
    pos: null,
    crosses: null,
    crossAx: "",
    crossBetween: "between",
    min: null,
    max: null,
    majorUnit: null,
    reversed: !1,
    fmt: null,
    majorGrid: null,
    line: { ...Nn },
    tickLblPos: "nextTo",
    majorTick: "out",
    lblSize: null,
    lblColor: null,
    title: null
  };
}
function Ur(t, e, n) {
  const o = N(t, "scaling"), s = N(t, "majorGridlines"), r = me(N(t, "txPr"), n);
  return {
    id: ct(t, "axId") ?? "",
    kind: e,
    del: gt(t, "delete", !1),
    pos: ct(t, "axPos"),
    crosses: ct(t, "crosses"),
    crossAx: ct(t, "crossAx") ?? "",
    crossBetween: ct(t, "crossBetween") ?? "between",
    min: st(o, "min"),
    max: st(o, "max"),
    majorUnit: st(t, "majorUnit"),
    reversed: ct(o, "orientation") === "maxMin",
    fmt: Me(N(t, "numFmt"), "formatCode"),
    majorGrid: s ? It(_t(s, "spPr", "ln"), n) : null,
    line: It(_t(t, "spPr", "ln"), n),
    tickLblPos: ct(t, "tickLblPos") ?? "nextTo",
    majorTick: ct(t, "majorTickMark") ?? "out",
    lblSize: r.size,
    lblColor: r.color,
    title: (() => {
      const i = N(t, "title");
      return !i || gt(t, "delete", !1) ? null : Fn(N(i, "tx")) || null;
    })()
  };
}
function Nr(t) {
  const e = N(t, "manualLayout");
  if (!e) return null;
  const n = (s) => st(e, s), o = {
    target: ct(e, "layoutTarget") ?? "outer",
    x: n("x"),
    y: n("y"),
    w: n("w"),
    h: n("h")
  };
  return o.x === null && o.y === null && o.w === null && o.h === null ? null : o;
}
function Br(t) {
  return t ? {
    rotX: st(t, "rotX") ?? 15,
    rotY: st(t, "rotY") ?? 20,
    depthPercent: st(t, "depthPercent") ?? 100
  } : null;
}
function Fr(t, e) {
  const n = N(t, "chart"), o = N(n, "plotArea"), s = me(N(t, "txPr"), e), r = [], i = [];
  let c = 0;
  if (o)
    for (let y = o.firstElementChild; y; y = y.nextElementSibling) {
      const $ = Ar[y.localName];
      if (!$) continue;
      if ($ === "other") {
        i.push(y.localName);
        continue;
      }
      const x = Rr(y, $, e, c);
      c += x.series.length, r.push(x);
    }
  const a = [];
  if (o)
    for (let y = o.firstElementChild; y; y = y.nextElementSibling) {
      const $ = Dr[y.localName];
      $ && a.push(Ur(y, $, e));
    }
  const l = N(n, "title"), u = gt(n, "autoTitleDeleted", !1), f = N(l, "tx"), h = l && !gt(l, "delete", !1) ? Fn(f) : "", m = me(f ?? N(l, "txPr"), e), d = me(N(l, "txPr"), e), p = N(n, "legend"), w = /* @__PURE__ */ new Set();
  for (const y of Tt(p, "legendEntry")) {
    const $ = st(y, "idx");
    $ !== null && gt(y, "delete", !1) && w.add($);
  }
  const b = N(t, "spPr"), g = N(o, "spPr");
  return {
    title: h && !u ? h : null,
    titleSize: m.size ?? d.size ?? Pt(14),
    titleColor: m.color ?? d.color,
    titleBold: m.bold || d.bold,
    legendPos: p ? ct(p, "legendPos") ?? "r" : null,
    legendOverlay: gt(p, "overlay", !1),
    legendDeleted: w,
    groups: r,
    axes: a,
    view3D: Br(N(n, "view3D")),
    fill: Vt(b, e),
    ln: It(N(b, "ln"), e),
    plotFill: Vt(g, e),
    plotLn: It(N(g, "ln"), e),
    plotLayout: Nr(N(o, "layout")),
    textSize: s.size ?? Pt(10),
    textColor: s.color ?? Js(e, "tx1"),
    unsupported: i
  };
}
const it = (t) => t * 1.4, ro = (t) => t * 2.9, He = (t, e) => Un(t, e) + e * 0.5;
function ie(t) {
  let e = 0;
  for (const n of t.labels) {
    const o = He(n, t.size);
    o > e && (e = o);
  }
  return e;
}
const Kt = (t) => !t.axis.del && t.axis.tickLblPos !== "none", Hr = 0.08;
function _r(t, e) {
  const n = Math.max(Math.min(e.h, e.w * 1.2) * Hr, 6), o = tt(t ? t.rotX : 15, -60, 60), s = tt(t ? t.rotY : 20, -90, 90), r = tt((t ? t.depthPercent : 100) / 100, 0.2, 3), i = n * tt(s / 20, -2, 2) * r, c = -n * tt(o / 20, -2, 2) * r;
  return Math.abs(i) < 1 && Math.abs(c) < 1 ? { dx: n * 0.5, dy: -n * 0.4 } : { dx: i, dy: c };
}
function jr(t, e) {
  const n = Math.abs(e.dx), o = Math.abs(e.dy);
  return {
    x: t.x + (e.dx < 0 ? n : 0),
    y: t.y + (e.dy < 0 ? o : 0),
    w: Math.max(t.w - n, 8),
    h: Math.max(t.h - o, 8)
  };
}
function Vr(t, e, n) {
  const o = [], s = t.x, r = t.x + t.w, i = t.y, c = t.y + t.h, a = dt(pt(n, "#ffffff", 0.93)), l = dt(pt(n, "#ffffff", 0.86)), u = dt(pt(n, "#ffffff", 0.89)), f = (d, p) => {
    const w = Zs(d, p, null);
    w && o.push(w);
  };
  f([[s + e.dx, i + e.dy], [r + e.dx, i + e.dy], [r + e.dx, c + e.dy], [s + e.dx, c + e.dy]], a);
  const h = e.dx >= 0 ? s : r;
  f([[h, i], [h + e.dx, i + e.dy], [h + e.dx, c + e.dy], [h, c]], u);
  const m = e.dy <= 0 ? c : i;
  return f([[s, m], [r, m], [r + e.dx, m + e.dy], [s + e.dx, m + e.dy]], l), o;
}
function io(t, e) {
  return t > 0 && e > 0 && t <= e * (5 / 6) ? 0 : t;
}
function ao(t) {
  if (t.lo !== t.hi) return t;
  if (t.lo === 0) return { lo: 0, hi: 1 };
  const e = Math.abs(t.lo) * 0.2;
  return { lo: t.lo - e, hi: t.hi + e };
}
function Ke(t) {
  let e = 1 / 0, n = -1 / 0, o = !1;
  const s = (r) => {
    Number.isFinite(r) && (r < e && (e = r), r > n && (n = r));
  };
  for (const r of t)
    if ((r.kind === "bar" || r.kind === "area") && (o = !0), r.grouping === "percentStacked") {
      let i = !1, c = !1;
      for (const a of r.series)
        for (const l of a.vals)
          l !== null && (l < 0 ? i = !0 : l > 0 && (c = !0));
      s(0), (c || !i) && s(1), i && s(-1);
    } else if (qe(r)) {
      let i = 0;
      for (const c of r.series) i = Math.max(i, c.vals.length);
      for (let c = 0; c < i; c++) {
        let a = 0, l = 0;
        for (const u of r.series) {
          const f = u.vals[c];
          f == null || !Number.isFinite(f) || (f >= 0 ? a += f : l += f);
        }
        s(a), s(l);
      }
    } else
      for (const i of r.series) for (const c of i.vals) c !== null && s(c);
  return e === 1 / 0 ? { lo: 0, hi: 1 } : (o ? (e = Math.min(e, 0), n = Math.max(n, 0)) : e = io(e, n), ao({ lo: e, hi: n }));
}
function Wr(t) {
  let e = 1 / 0, n = -1 / 0;
  for (const o of t)
    for (const s of o.series)
      if (s.xs)
        for (const r of s.xs)
          r === null || !Number.isFinite(r) || (r < e && (e = r), r > n && (n = r));
      else s.vals.length && (e = Math.min(e, 1), n = Math.max(n, s.vals.length));
  return e === 1 / 0 ? { lo: 0, hi: 1 } : ao({ lo: io(e, n), hi: n });
}
function Gr(t, e, n) {
  const o = Bn(t.lo, t.hi, n);
  let s = e.min !== null && Number.isFinite(e.min) ? e.min : o.min, r = e.max !== null && Number.isFinite(e.max) ? e.max : o.max;
  r < s && ([s, r] = [r, s]);
  let i = e.majorUnit !== null && Number.isFinite(e.majorUnit) ? e.majorUnit : o.step;
  for (r === s && (r = s + Math.abs(i) || s + 1), i > 0 || (i = (r - s) / Math.max(1, n)), i > 0 || (i = 1); (r - s) / i > 100; ) i *= 2;
  return { min: s, max: r, step: i };
}
const ye = (t, e) => Math.round(tt(t / Math.max(e * 3.2, 1), 2, 12));
function xn(t, e, n, o, s, r) {
  const i = Gr(n, t, o), c = Lr(i), a = t.fmt ?? s;
  return {
    axis: t,
    side: e,
    scale: i,
    ticks: c,
    labels: c.map((l) => jt(l, a)),
    between: !1,
    catCount: c.length,
    size: t.lblSize ?? r.textSize,
    color: t.lblColor ?? r.textColor
  };
}
function Xr(t, e, n, o, s) {
  return {
    axis: t,
    side: e,
    scale: null,
    ticks: n.map((r, i) => i),
    labels: n.slice(),
    between: o,
    catCount: n.length,
    size: t.lblSize ?? s.textSize,
    color: t.lblColor ?? s.textColor
  };
}
function is(t, e, n, o) {
  const s = e ? t.h : t.w, r = Math.max(n.catCount, 1), i = n.between ? s / r : r > 1 ? s / (r - 1) : s, c = n.axis.reversed, a = (b) => {
    const g = c ? s - b : b;
    return e ? t.y + t.h - g : t.x + g;
  }, l = (b) => a(n.between ? (b + 0.5) * i : b * i), u = (b) => a(b * i), f = o.scale ?? { min: 0, max: 1 }, h = f.max - f.min || 1, m = o.axis.reversed, d = (b) => {
    let g = (b - f.min) / h;
    return Number.isFinite(g) || (g = 0), m && (g = 1 - g), e ? t.x + g * t.w : t.y + t.h - g * t.h;
  }, p = (b) => Number.isFinite(b) ? tt(b, f.min, f.max) : f.min, w = (b, g) => e ? [g, b] : [b, g];
  return { rect: t, horizontal: e, catView: n, valView: o, band: i, cat: l, edge: u, val: d, clampVal: p, zero: d(p(0)), pt: w };
}
function Yr(t, e, n) {
  const o = e.scale ?? { min: 0, max: 1 }, s = n.scale ?? { min: 0, max: 1 }, r = o.max - o.min || 1, i = s.max - s.min || 1;
  return {
    rect: t,
    x: (c) => {
      let a = (c - o.min) / r;
      return Number.isFinite(a) || (a = 0), e.axis.reversed && (a = 1 - a), t.x + a * t.w;
    },
    y: (c) => {
      let a = (c - s.min) / i;
      return Number.isFinite(a) || (a = 0), n.axis.reversed && (a = 1 - a), t.y + t.h - a * t.h;
    },
    clampX: (c) => Number.isFinite(c) ? tt(c, o.min, o.max) : o.min,
    clampY: (c) => Number.isFinite(c) ? tt(c, s.min, s.max) : s.min
  };
}
function $n(t, e, n, o, s = null) {
  const r = t.textSize * 0.45, i = it(t.textSize * 1.05) + r * 0.6, c = { l: t.textSize * 0.4, r: t.textSize * 0.8, t: t.textSize * 0.8, b: t.textSize * 0.3 };
  if (Kt(n)) {
    const a = ie(n) + r;
    n.side === "r" ? c.r += a : c.l += a;
  }
  if (n.axis.title && (n.side === "r" ? c.r += i : c.l += i), s) {
    const a = s.side;
    if (Kt(s)) {
      const l = a === "t" || a === "b" ? it(s.size) + r : ie(s) + r;
      c[a] += l;
    }
    s.axis.title && (c[a] += i);
  }
  if (Kt(e)) {
    const a = (o ? ro(e.size) : it(e.size)) + r;
    if (e.side === "t" ? c.t += a : c.b += a, e.scale) {
      const l = ie(e) / 2;
      c.l += l, c.r += l;
    }
  }
  return e.axis.title && (e.side === "t" ? c.t += i : c.b += i), c;
}
function Mn(t, e) {
  const n = t.w * 0.72, o = t.h * 0.72;
  let { l: s, r, t: i, b: c } = e;
  if (s + r > n) {
    const a = n / (s + r);
    s *= a, r *= a;
  }
  if (i + c > o) {
    const a = o / (i + c);
    i *= a, c *= a;
  }
  return {
    x: t.x + s,
    y: t.y + i,
    w: Math.max(t.w - s - r, 8),
    h: Math.max(t.h - i - c, 8)
  };
}
function _e(t, e, n, o, s, r) {
  const i = s ? s.dx : 0, c = s ? s.dy : 0, a = $t(t + i, e + c, n + i, o + c, r);
  return a ? [a] : [];
}
function co(t, e, n) {
  const o = [], { rect: s, hAxis: r, vAxis: i } = e, c = pt(t.textColor, "#ffffff", 0.78), a = pt(t.textColor, "#ffffff", 0.45), l = t.textSize * 0.45, u = e.depth, f = i.axis.majorGrid ? lt(i.axis.majorGrid, c, 1) : null;
  if (f) {
    const b = e.vEdge ?? e.vPos, g = e.vEdge ? e.vEdgeCount : i.ticks.length, y = u && u.dx < 0 ? s.x + s.w : s.x;
    for (let $ = 0; $ < g; $++) {
      const x = b($);
      if (o.push(..._e(s.x, x, s.x + s.w, x, u, f)), u) {
        const M = $t(y, x, y + u.dx, x + u.dy, f);
        M && o.push(M);
      }
    }
  }
  const h = r.axis.majorGrid ? lt(r.axis.majorGrid, c, 1) : null;
  if (h) {
    const b = e.hEdge ?? e.hPos, g = e.hEdge ? e.hEdgeCount : r.ticks.length, y = u && u.dy > 0 ? s.y : s.y + s.h;
    for (let $ = 0; $ < g; $++) {
      const x = b($);
      if (o.push(..._e(x, s.y, x, s.y + s.h, u, h)), u) {
        const M = $t(x, y, x + u.dx, y + u.dy, h);
        M && o.push(M);
      }
    }
  }
  if (!r.axis.del) {
    const b = lt(r.axis.line, a, 1), g = b ? $t(s.x, e.hLineAt, s.x + s.w, e.hLineAt, b) : null;
    g && o.push(g);
  }
  if (!i.axis.del) {
    const b = lt(i.axis.line, a, 1), g = b ? $t(e.vLineAt, s.y, e.vLineAt, s.y + s.h, b) : null;
    g && o.push(g);
  }
  let m = 0;
  if (Kt(r)) {
    const b = r.size, g = e.hWrap ? ro(b) : it(b);
    m = g + l;
    const y = r.side === "t" ? s.y - l - g : s.y + s.h + l;
    for (let $ = 0; $ < r.labels.length; $++) {
      const x = r.labels[$];
      if (!x) continue;
      const M = e.hWrap ? Math.max(e.hBand * 0.98, b * 2) : He(x, b), k = ht(e.hPos($) - M / 2, y, M, g, x, {
        size: b,
        color: r.color,
        align: "center",
        anchor: r.side === "t" ? "bottom" : "top",
        fonts: n
      });
      e.hWrap && k.text && (k.text.wrap = !0), o.push(k);
    }
  }
  let d = 0;
  if (Kt(i)) {
    const b = i.size, g = it(b);
    d = ie(i) + l;
    for (let y = 0; y < i.labels.length; y++) {
      const $ = i.labels[y];
      if (!$) continue;
      const x = He($, b), M = i.side === "r" ? s.x + s.w + l : s.x - l - x;
      o.push(
        ht(M, e.vPos(y) - g / 2, x, g, $, {
          size: b,
          color: i.color,
          align: i.side === "r" ? "left" : "right",
          anchor: "middle",
          fonts: n
        })
      );
    }
  }
  const p = t.textSize * 1.05, w = it(p);
  if (r.axis.title) {
    const b = r.side === "t" ? s.y - m - l - w : s.y + s.h + m + l * 0.4;
    o.push(
      ht(s.x, b, s.w, w, r.axis.title, {
        size: p,
        color: t.textColor,
        align: "center",
        anchor: "middle",
        fonts: n
      })
    );
  }
  if (i.axis.title) {
    const b = i.side === "r" ? s.x + s.w + d + l * 0.4 + w / 2 : s.x - d - l * 0.4 - w / 2, g = s.y + s.h / 2;
    o.push(
      ht(b - s.h / 2, g - w / 2, s.h, w, i.axis.title, {
        size: p,
        color: t.textColor,
        align: "center",
        anchor: "middle",
        fonts: n,
        rot: i.side === "r" ? 90 : -90
      })
    );
  }
  return o;
}
function qr(t, e, n) {
  const o = [], { rect: s, view: r } = e, i = r.side === "l" || r.side === "r", c = pt(t.textColor, "#ffffff", 0.78), a = pt(t.textColor, "#ffffff", 0.45), l = t.textSize * 0.45;
  if (e.grid && r.axis.majorGrid) {
    const m = lt(r.axis.majorGrid, c, 1);
    for (let d = 0; d < r.ticks.length; d++) {
      const p = e.pos(d);
      o.push(
        ...i ? _e(s.x, p, s.x + s.w, p, e.depth, m) : _e(p, s.y, p, s.y + s.h, e.depth, m)
      );
    }
  }
  if (!r.axis.del) {
    const m = lt(r.axis.line, a, 1), d = i ? $t(e.at, s.y, e.at, s.y + s.h, m) : $t(s.x, e.at, s.x + s.w, e.at, m);
    d && o.push(d);
  }
  const u = r.size, f = it(u);
  let h = 0;
  if (Kt(r)) {
    h = i ? ie(r) + l : f + l;
    for (let m = 0; m < r.labels.length; m++) {
      const d = r.labels[m];
      if (!d) continue;
      const p = He(d, u);
      if (i) {
        const w = r.side === "r" ? s.x + s.w + l : s.x - l - p;
        o.push(
          ht(w, e.pos(m) - f / 2, p, f, d, {
            size: u,
            color: r.color,
            align: r.side === "r" ? "left" : "right",
            anchor: "middle",
            fonts: n
          })
        );
      } else {
        const w = r.side === "t" ? s.y - l - f : s.y + s.h + l;
        o.push(
          ht(e.pos(m) - p / 2, w, p, f, d, {
            size: u,
            color: r.color,
            align: "center",
            anchor: r.side === "t" ? "bottom" : "top",
            fonts: n
          })
        );
      }
    }
  }
  if (r.axis.title) {
    const m = t.textSize * 1.05, d = it(m);
    if (i) {
      const p = r.side === "r" ? s.x + s.w + h + l * 0.4 + d / 2 : s.x - h - l * 0.4 - d / 2;
      o.push(
        ht(p - s.h / 2, s.y + s.h / 2 - d / 2, s.h, d, r.axis.title, {
          size: m,
          color: t.textColor,
          align: "center",
          anchor: "middle",
          fonts: n,
          rot: r.side === "r" ? 90 : -90
        })
      );
    } else {
      const p = r.side === "t" ? s.y - h - l - d : s.y + s.h + h + l * 0.4;
      o.push(
        ht(s.x, p, s.w, d, r.axis.title, {
          size: m,
          color: t.textColor,
          align: "center",
          anchor: "middle",
          fonts: n
        })
      );
    }
  }
  return o;
}
function Kr(t, e) {
  return !Kt(t) || t.scale ? !1 : ie(t) > e * 1.02;
}
const Wt = Math.PI * 2, as = ["circle", "square", "diamond", "triangle", "x", "plus", "star", "dot"];
function Mt(t, e, n, o) {
  const s = e.dPts.get(n), r = t.varyColors ? Qs(o, n) : e.color, i = (s == null ? void 0 : s.fill) ?? e.fill ?? dt(r);
  return { fill: i, color: i.type === "solid" ? i.color : r };
}
function Zt(t, e, n, o) {
  const s = t.dPts.get(e);
  return lt(s != null && s.ln.present ? s.ln : t.ln, n, o);
}
const nt = (t) => t == null || !Number.isFinite(t) ? null : t;
function Zr(t) {
  let e = 1 / 0, n = 1 / 0, o = -1 / 0, s = -1 / 0;
  for (const [r, i] of t)
    r < e && (e = r), i < n && (n = i), r > o && (o = r), i > s && (s = i);
  return { x: e, y: n, w: o - e, h: s - n };
}
function Jr(t, e, n) {
  const o = t.map(([r, i]) => [r - e, i - n]);
  let s = `M ${v(o[0][0])} ${v(o[0][1])}`;
  for (let r = 0; r < o.length - 1; r++) {
    const i = o[r === 0 ? 0 : r - 1], c = o[r], a = o[r + 1], l = o[r + 2 < o.length ? r + 2 : o.length - 1], u = [c[0] + (a[0] - i[0]) / 6, c[1] + (a[1] - i[1]) / 6], f = [a[0] - (l[0] - c[0]) / 6, a[1] - (l[1] - c[1]) / 6];
    s += ` C ${v(u[0])} ${v(u[1])} ${v(f[0])} ${v(f[1])} ${v(a[0])} ${v(a[1])}`;
  }
  return s;
}
function Hn(t, e, n, o, s) {
  const r = t.map((a) => a.filter(([l, u]) => Number.isFinite(l) && Number.isFinite(u))).filter((a) => a.length >= (o ? 3 : 2));
  if (!r.length) return null;
  const i = Zr(r.flat()), c = r.map(
    (a) => (s && a.length > 2 ? Jr(a, i.x, i.y) : "M " + a.map(([l, u]) => `${v(l - i.x)} ${v(u - i.y)}`).join(" L ")) + (o ? " Z" : "")
  ).join(" ");
  return bt(i.x, i.y, i.w, i.h, c, e, n);
}
function xe(t, e, n) {
  return `M ${v(t - n)} ${v(e)} A ${v(n)} ${v(n)} 0 1 1 ${v(t + n)} ${v(e)} A ${v(n)} ${v(n)} 0 1 1 ${v(t - n)} ${v(e)} Z`;
}
function Qr(t, e) {
  const n = e, o = e * 2;
  switch (t) {
    case "square":
      return { d: `M 0 0 L ${v(o)} 0 L ${v(o)} ${v(o)} L 0 ${v(o)} Z`, open: !1 };
    case "diamond":
      return { d: `M ${v(n)} 0 L ${v(o)} ${v(n)} L ${v(n)} ${v(o)} L 0 ${v(n)} Z`, open: !1 };
    case "triangle":
      return { d: `M ${v(n)} 0 L ${v(o)} ${v(o)} L 0 ${v(o)} Z`, open: !1 };
    case "x":
      return { d: `M 0 0 L ${v(o)} ${v(o)} M ${v(o)} 0 L 0 ${v(o)}`, open: !0 };
    case "plus":
      return { d: `M ${v(n)} 0 L ${v(n)} ${v(o)} M 0 ${v(n)} L ${v(o)} ${v(n)}`, open: !0 };
    case "star":
      return {
        d: `M ${v(n)} 0 L ${v(n)} ${v(o)} M 0 ${v(n)} L ${v(o)} ${v(n)} M 0 0 L ${v(o)} ${v(o)} M ${v(o)} 0 L 0 ${v(o)}`,
        open: !0
      };
    case "dash":
      return { d: `M 0 ${v(n)} L ${v(o)} ${v(n)}`, open: !0 };
    case "dot":
      return { d: xe(n, n, e * 0.55), open: !1 };
    default:
      return { d: xe(n, n, e), open: !1 };
  }
}
function Ze(t, e, n) {
  const o = t.kind === "scatter" ? t.scatterStyle !== "line" && t.scatterStyle !== "smooth" : t.showMarker;
  let s = e.marker ? e.marker.symbol : o ? "auto" : "none";
  return s === "auto" && (s = o ? as[n % as.length] : "none"), s;
}
function Je(t, e, n, o, s) {
  var u, f;
  if (n === "none" || !Number.isFinite(t) || !Number.isFinite(e)) return null;
  const r = Math.max(Pt(tt(((u = o.marker) == null ? void 0 : u.size) ?? 5, 2, 72)) / 2, 1), { d: i, open: c } = Qr(n, r), a = (f = o.marker) == null ? void 0 : f.fill, l = o.marker ? lt(o.marker.ln, null, 0) : null;
  return c ? bt(t - r, e - r, r * 2, r * 2, i, null, l ?? { color: s, width: 1.25, dash: null }) : bt(t - r, e - r, r * 2, r * 2, i, a ?? dt(s), l);
}
function Ut(t, e, n, o, s, r = null) {
  const i = t.dLbls, c = [];
  return i.showSer && c.push(t.name), i.showCat && c.push(s.cats[e] ?? ""), i.showVal && c.push(jt(n, i.fmt ?? t.fmt)), i.showSize && r !== null && c.push(jt(r, t.sizeFmt ?? i.fmt ?? t.fmt)), i.showPercent && o !== null && c.push(jt(o, i.fmt && i.fmt.includes("%") ? i.fmt : "0%")), c.filter((a) => a !== "").join(" ");
}
function Nt(t, e, n, o, s) {
  if (!n || !Number.isFinite(t) || !Number.isFinite(e)) return null;
  const r = o.size ?? s.size * 0.92, i = Math.max(n.length * r * 0.75, r * 2), c = it(r);
  return ht(t - i / 2, e - c / 2, i, c, n, {
    size: r,
    color: o.color ?? s.color,
    align: "center",
    anchor: "middle",
    fonts: s.fonts
  });
}
function ti(t, e, n, o, s) {
  const r = [], i = t.x, c = t.x + t.w, a = t.y, l = t.y + t.h, u = (m, d) => {
    const p = Zs(m, dt(d), s);
    p && r.push(p);
  }, f = e.dx >= 0 ? c : i;
  u([[f, a], [f + e.dx, a + e.dy], [f + e.dx, l + e.dy], [f, l]], Dn(o));
  const h = e.dy <= 0 ? a : l;
  return u([[i, h], [c, h], [c + e.dx, h + e.dy], [i + e.dx, h + e.dy]], Er(o)), r.push(bt(t.x, t.y, t.w, t.h, `M 0 0 L ${v(t.w)} 0 L ${v(t.w)} ${v(t.h)} L 0 ${v(t.h)} Z`, n, s)), r;
}
function ei(t, e, n, o, s = null) {
  const r = [], i = tt(t.gapWidth, 0, 800) / 100, c = tt(t.overlap, -100, 100) / 100, a = Math.max(n.total, 1), l = 1 + (a - 1) * (1 - c) + i;
  let u = e.band / (l > 0 ? l : 1);
  u > 0 || (u = e.band * 0.6), u = Math.min(u, e.band);
  const f = u * (1 + (a - 1) * (1 - c)), h = u * (1 - c), m = qe(t), d = t.grouping === "percentStacked", p = t.series.reduce((x, M) => Math.max(x, M.vals.length), 0), w = new Array(p).fill(0), b = new Array(p).fill(0), g = new Array(p).fill(0);
  if (d)
    for (let x = 0; x < p; x++) {
      let M = 0;
      for (const k of t.series) M += Math.abs(nt(k.vals[x]) ?? 0);
      g[x] = M;
    }
  const y = [], $ = [];
  if (t.series.forEach((x, M) => {
    const k = n.base + (m ? 0 : M), T = e.horizontal ? -1 : 1;
    for (let S = 0; S < p; S++) {
      const A = nt(x.vals[S]);
      if (A === null) continue;
      const P = d ? g[S] > 0 ? A / g[S] : 0 : A;
      let L = 0;
      m && (L = P >= 0 ? w[S] : b[S], P >= 0 ? w[S] += P : b[S] += P);
      const C = e.cat(S) + T * (-f / 2 + k * h + u / 2), R = e.val(e.clampVal(L)), z = e.val(e.clampVal(L + P)), [D, I] = e.pt(C - u / 2, R), [O, _] = e.pt(C + u / 2, z), U = {
        x: Math.min(D, O),
        y: Math.min(I, _),
        w: Math.abs(O - D),
        h: Math.abs(_ - I)
      }, { fill: B, color: X } = Mt(t, x, S, o.ctx);
      if (U.w > 0.05 && U.h > 0.05 && $.push({ r: U, fill: B, color: X, stroke: Zt(x, S, null, 0), anchor: e.pt(C, R) }), Ct(x.dLbls)) {
        const Y = Ut(x, S, A, d && g[S] > 0 ? Math.abs(A) / g[S] : null, o), Z = x.dLbls.size ?? o.size * 0.92, K = it(Z) * 0.6, kt = x.dLbls.pos ?? (m ? "ctr" : "outEnd");
        let Ot = (U.x + U.x + U.w) / 2, Xt = (U.y + U.y + U.h) / 2;
        if (kt !== "ctr") {
          const at = kt === "inEnd" || kt === "inBase" ? -1 : 1;
          e.horizontal ? Ot = (P >= 0 ? U.x + U.w : U.x) + at * (P >= 0 ? K : -K) : Xt = (P >= 0 ? U.y : U.y + U.h) - at * (P >= 0 ? K : -K);
        }
        const Yt = Nt(Ot, Xt, Y, x.dLbls, o);
        Yt && y.push(Yt);
      }
    }
  }), s) {
    const x = (M) => M.anchor[0] * s.dx + M.anchor[1] * s.dy;
    $.sort((M, k) => x(M) - x(k));
    for (const M of $) r.push(...ti(M.r, s, M.fill, M.color, M.stroke));
  } else
    for (const x of $)
      r.push(
        bt(
          x.r.x,
          x.r.y,
          x.r.w,
          x.r.h,
          `M 0 0 L ${v(x.r.w)} 0 L ${v(x.r.w)} ${v(x.r.h)} L 0 ${v(x.r.h)} Z`,
          x.fill,
          x.stroke
        )
      );
  return r.concat(y);
}
function lo(t) {
  const e = t.series.reduce((a, l) => Math.max(a, l.vals.length), 0), n = qe(t), o = t.grouping === "percentStacked", s = new Array(e).fill(0);
  if (o)
    for (let a = 0; a < e; a++) {
      let l = 0;
      for (const u of t.series) l += Math.abs(nt(u.vals[a]) ?? 0);
      s[a] = l;
    }
  const r = new Array(e).fill(0), i = [], c = [];
  for (const a of t.series) {
    const l = [], u = [];
    for (let f = 0; f < e; f++) {
      const h = nt(a.vals[f]);
      if (h === null) {
        l.push(null), u.push(null);
        continue;
      }
      const m = o ? s[f] > 0 ? h / s[f] : 0 : h;
      n ? (u.push(r[f]), r[f] += m, l.push(r[f])) : (u.push(0), l.push(m));
    }
    i.push(l), c.push(u);
  }
  return { top: i, bottom: c };
}
function ni(t, e, n) {
  const o = [], s = [], { top: r } = lo(t), i = t.grouping === "percentStacked";
  return t.series.forEach((c, a) => {
    const l = r[a] ?? [], u = [];
    let f = [];
    const h = [];
    for (let w = 0; w < l.length; w++) {
      const b = l[w];
      if (b === null) {
        f.length && u.push(f), f = [], h.push(null);
        continue;
      }
      const g = e.pt(e.cat(w), e.val(e.clampVal(b)));
      f.push(g), h.push(g);
    }
    f.length && u.push(f);
    const m = lt(c.ln, c.color, Pt(2.25)), d = Hn(u, null, m, !1, c.smooth);
    d && o.push(d);
    const p = Ze(t, c, a);
    for (let w = 0; w < h.length; w++) {
      const b = h[w];
      if (!b) continue;
      const { color: g } = Mt(t, c, w, n.ctx), y = Je(b[0], b[1], p, c, t.varyColors ? g : c.color);
      if (y && s.push(y), Ct(c.dLbls)) {
        const $ = nt(c.vals[w]) ?? 0, x = Ut(c, w, $, i ? l[w] ?? 0 : null, n), M = c.dLbls.size ?? n.size * 0.92, k = Nt(b[0], b[1] - it(M) * 0.85, x, c.dLbls, n);
        k && s.push(k);
      }
    }
  }), o.concat(s);
}
function si(t, e, n) {
  const o = [], s = [], { top: r, bottom: i } = lo(t), c = t.grouping === "percentStacked";
  return t.series.forEach((a, l) => {
    const u = r[l] ?? [], f = i[l] ?? [], h = [];
    let m = [], d = [];
    const p = () => {
      m.length >= 2 && h.push(m.concat(d.slice().reverse())), m = [], d = [];
    };
    for (let g = 0; g < u.length; g++) {
      const y = u[g];
      if (y === null) {
        p();
        continue;
      }
      m.push(e.pt(e.cat(g), e.val(e.clampVal(y)))), d.push(e.pt(e.cat(g), e.val(e.clampVal(f[g] ?? 0))));
    }
    p();
    const { fill: w } = Mt(t, a, 0, n.ctx), b = Hn(h, w, lt(a.ln, null, 0), !0, a.smooth);
    if (b && o.push(b), Ct(a.dLbls))
      for (let g = 0; g < u.length; g++) {
        const y = u[g];
        if (y === null) continue;
        const [$, x] = e.pt(e.cat(g), e.val(e.clampVal(y))), M = nt(a.vals[g]) ?? 0, k = a.dLbls.size ?? n.size * 0.92, T = Nt($, x - it(k) * 0.8, Ut(a, g, M, c ? y : null, n), a.dLbls, n);
        T && s.push(T);
      }
  }), o.concat(s);
}
function oi(t, e, n) {
  const o = [], s = [], r = t.scatterStyle !== "marker" && t.scatterStyle !== "none";
  return t.series.forEach((i, c) => {
    const a = [];
    let l = [];
    const u = [];
    for (let h = 0; h < i.vals.length; h++) {
      const m = nt(i.vals[h]), d = i.xs ? nt(i.xs[h]) : h + 1;
      if (m === null || d === null) {
        l.length && a.push(l), l = [], u.push(null);
        continue;
      }
      const p = [e.x(e.clampX(d)), e.y(e.clampY(m))];
      l.push(p), u.push(p);
    }
    if (l.length && a.push(l), r) {
      const h = lt(i.ln, i.color, Pt(2.25)), m = Hn(a, null, h, !1, i.smooth || t.scatterStyle === "smoothMarker");
      m && o.push(m);
    }
    const f = Ze(t, i, c);
    for (let h = 0; h < u.length; h++) {
      const m = u[h];
      if (!m) continue;
      const { color: d } = Mt(t, i, h, n.ctx), p = Je(m[0], m[1], f === "none" && !r ? "circle" : f, i, t.varyColors ? d : i.color);
      if (p && s.push(p), Ct(i.dLbls)) {
        const w = i.dLbls.size ?? n.size * 0.92, b = Nt(m[0], m[1] - it(w) * 0.85, Ut(i, h, nt(i.vals[h]) ?? 0, null, n), i.dLbls, n);
        b && s.push(b);
      }
    }
  }), o.concat(s);
}
function ri(t, e, n) {
  const o = tt(t.bubbleScale, 0, 300) / 100, s = Math.max(2, Math.min(e.rect.w, e.rect.h) * 0.13 * o);
  let r = 0;
  for (const u of t.series)
    for (const f of u.sizes ?? []) {
      const h = nt(f);
      h !== null && (r = Math.max(r, Math.abs(h)));
    }
  const i = t.bubbleSizeBy !== "w", c = [];
  for (const u of t.series)
    for (let f = 0; f < u.vals.length; f++) {
      const h = nt(u.vals[f]), m = u.xs ? nt(u.xs[f]) : f + 1;
      if (h === null || m === null) continue;
      const d = u.sizes ? Math.abs(nt(u.sizes[f]) ?? 0) : 0, p = r > 0 ? d / r : 1, w = Math.max(1.5, s * (i ? Math.sqrt(p) : p)), { fill: b, color: g } = Mt(t, u, f, n.ctx), y = t.varyColors ? g : u.color;
      c.push({
        x: e.x(e.clampX(m)),
        y: e.y(e.clampY(h)),
        r: w,
        fill: t.varyColors ? dt(y) : b,
        color: y,
        stroke: Zt(u, f, Dn(y, 0.35), Math.max(1, Pt(0.75))),
        label: Ct(u.dLbls) ? Ut(u, f, h, null, n, u.sizes ? nt(u.sizes[f]) : null) : "",
        lblSpec: u
      });
    }
  c.sort((u, f) => f.r - u.r);
  const a = [], l = [];
  for (const u of c)
    if (a.push(bt(u.x - u.r, u.y - u.r, u.r * 2, u.r * 2, xe(u.r, u.r, u.r), u.fill, u.stroke)), u.label) {
      const f = Nt(u.x, u.y, u.label, u.lblSpec.dLbls, n);
      f && l.push(f);
    }
  return a.concat(l);
}
function ii(t, e, n) {
  var w;
  const o = t.series.length;
  if (o < 3) return [];
  const s = o >= 4 ? t.series.slice(o - 4) : t.series, r = o >= 4 ? s[0] : null, i = s[o >= 4 ? 1 : 0], c = s[o >= 4 ? 2 : 1], a = s[o >= 4 ? 3 : 2], l = pt(n.color, "rgb(255,255,255)", 0.15), u = lt(t.hiLowLines, l, 1) ?? { color: l, width: 1, dash: null }, f = Math.max(i.vals.length, c.vals.length, a.vals.length), h = tt(((w = t.upDown) == null ? void 0 : w.gapWidth) ?? 150, 0, 500) / 100, m = Math.max(1.5, Math.min(e.band / (1 + h), e.band * 0.9)), d = Math.max(1.5, m / 2), p = [];
  for (let b = 0; b < f; b++) {
    const g = nt(i.vals[b]), y = nt(c.vals[b]), $ = nt(a.vals[b]), x = r ? nt(r.vals[b]) : null;
    if (g === null || y === null) continue;
    const M = e.cat(b), k = e.val(e.clampVal(Math.max(g, y))), T = e.val(e.clampVal(Math.min(g, y))), [S, A] = e.pt(M, k), [P, L] = e.pt(M, T), C = $t(S, A, P, L, u);
    if (C && p.push(C), t.upDown && x !== null && $ !== null) {
      const R = $ >= x, z = e.val(e.clampVal(x)), D = e.val(e.clampVal($)), [I, O] = e.pt(M - m / 2, Math.min(z, D)), [_, U] = e.pt(M + m / 2, Math.max(z, D)), B = {
        x: Math.min(I, _),
        y: Math.min(O, U),
        w: Math.max(Math.abs(_ - I), 1),
        h: Math.max(Math.abs(U - O), 1)
      }, Y = (R ? t.upDown.upFill : t.upDown.downFill) ?? dt(R ? "rgb(255,255,255)" : l), Z = lt(R ? t.upDown.upLn : t.upDown.downLn, l, 1) ?? { color: l, width: 1, dash: null };
      p.push(bt(
        B.x,
        B.y,
        B.w,
        B.h,
        `M 0 0 L ${v(B.w)} 0 L ${v(B.w)} ${v(B.h)} L 0 ${v(B.h)} Z`,
        Y,
        Z
      ));
    } else {
      if (x !== null) {
        const [R, z] = e.pt(M, e.val(e.clampVal(x))), D = $t(R - (e.horizontal ? 0 : d), z - (e.horizontal ? d : 0), R, z, u);
        D && p.push(D);
      }
      if ($ !== null) {
        const [R, z] = e.pt(M, e.val(e.clampVal($))), D = $t(R, z, R + (e.horizontal ? 0 : d), z + (e.horizontal ? d : 0), u);
        D && p.push(D);
      }
    }
    if (Ct(a.dLbls) && $ !== null) {
      const [R, z] = e.pt(M, e.val(e.clampVal($))), D = a.dLbls.size ?? n.size * 0.92, I = Nt(R + m, z - it(D) * 0.2, Ut(a, b, $, null, n), a.dLbls, n);
      I && p.push(I);
    }
  }
  return p;
}
function En(t, e, n, o, s, r) {
  const i = (l, u) => `${v(t + l * Math.cos(u))} ${v(e + l * Math.sin(u))}`, c = r - s;
  if (c >= Wt - 1e-6) {
    const l = xe(t, e, o);
    return n > 0.01 ? `${l} ${xe(t, e, n)}` : l;
  }
  const a = c > Math.PI ? 1 : 0;
  return n <= 0.01 ? `M ${v(t)} ${v(e)} L ${i(o, s)} A ${v(o)} ${v(o)} 0 ${a} 1 ${i(o, r)} Z` : `M ${i(o, s)} A ${v(o)} ${v(o)} 0 ${a} 1 ${i(o, r)} L ${i(n, r)} A ${v(n)} ${v(n)} 0 ${a} 0 ${i(n, s)} Z`;
}
const on = 0.55, cs = 0.17, uo = (t, e, n, o, s) => `${v(t + n * Math.cos(s))} ${v(e + o * Math.sin(s))}`;
function ai(t, e, n, o, s, r) {
  const i = (l) => uo(t, e, n, o, l), c = r - s;
  if (c >= Wt - 1e-6)
    return `M ${v(t - n)} ${v(e)} A ${v(n)} ${v(o)} 0 1 1 ${v(t + n)} ${v(e)} A ${v(n)} ${v(o)} 0 1 1 ${v(t - n)} ${v(e)} Z`;
  const a = c > Math.PI ? 1 : 0;
  return `M ${v(t)} ${v(e)} L ${i(s)} A ${v(n)} ${v(o)} 0 ${a} 1 ${i(r)} Z`;
}
function ci(t, e) {
  const n = [];
  for (let o = -1; o <= 2; o++) {
    const s = Math.max(t, o * Wt), r = Math.min(e, o * Wt + Math.PI);
    r - s > 1e-4 && n.push([s, r]);
  }
  return n;
}
function li(t, e, n, o, s, r, i) {
  const c = (l, u) => uo(t, e + u, n, o, l), a = r - s > Math.PI ? 1 : 0;
  return `M ${c(s, 0)} A ${v(n)} ${v(o)} 0 ${a} 1 ${c(r, 0)} L ${c(r, i)} A ${v(n)} ${v(o)} 0 ${a} 0 ${c(s, i)} Z`;
}
function ui(t, e, n) {
  var w;
  const o = t.series[0];
  if (!o) return [];
  const s = Ct(o.dLbls) ? 0.8 : 0.94, r = Math.min(e.w / 2, e.h / (2 * on + cs)) * s;
  if (!(r > 0)) return [];
  const i = r * on, c = r * cs, a = e.x + e.w / 2, l = e.y + (e.h - (2 * i + c)) / 2 + i, u = o.vals.map((b) => Math.abs(nt(b) ?? 0)), f = u.reduce((b, g) => b + g, 0);
  if (!(f > 0)) return [];
  const h = [], m = [], d = [];
  let p = (tt(t.firstSliceAng, 0, 360) - 90) * (Math.PI / 180);
  for (let b = 0; b < u.length; b++) {
    const g = u[b] / f, y = g * Wt;
    if (!(y > 0)) continue;
    const $ = p + y, x = p + y / 2, M = tt(((w = o.dPts.get(b)) == null ? void 0 : w.explosion) ?? 0, 0, 400) / 100 * r * 0.5, k = a + Math.cos(x) * M, T = l + Math.sin(x) * M * on, { fill: S, color: A } = Mt(t, o, b, n.ctx), P = Zt(o, b, null, 0);
    for (const [L, C] of ci(p, $)) {
      const R = bt(
        k - r,
        T - i,
        r * 2,
        i * 2 + c,
        li(r, i, r, i, L, C, c),
        dt(Dn(A)),
        P
      );
      h.push({ el: R, depth: Math.sin((L + C) / 2) });
    }
    if (m.push(bt(k - r, T - i, r * 2, i * 2, ai(r, i, r, i, p, $), S, P)), Ct(o.dLbls)) {
      const L = o.dLbls.pos === "outEnd" || o.dLbls.pos === "bestFit", C = L ? 1.2 : 0.62, R = Math.sin(x), z = R > 0 ? c * (L ? 1 : 0.5) : 0, D = Ut(o, b, nt(o.vals[b]) ?? 0, g, n), I = Nt(k + Math.cos(x) * r * C, T + R * i * C + z, D, o.dLbls, n);
      I && d.push(I);
    }
    p = $;
  }
  return h.sort((b, g) => b.depth - g.depth), h.map((b) => b.el).concat(m, d);
}
function fi(t, e, n) {
  const o = [], s = [], r = t.kind === "doughnut" ? t.series : t.series.slice(0, 1);
  if (!r.length) return o;
  const i = r.some((h) => Ct(h.dLbls)), c = Math.min(e.w, e.h) / 2 * (i ? 0.78 : 0.92);
  if (!(c > 0)) return o;
  const a = e.x + e.w / 2, l = e.y + e.h / 2, u = t.kind === "doughnut" ? tt(t.holeSize, 0, 90) / 100 : 0, f = c * (1 - u) / r.length;
  return r.forEach((h, m) => {
    var y;
    const d = c * u + m * f, p = d + f, w = h.vals.map(($) => Math.abs(nt($) ?? 0)), b = w.reduce(($, x) => $ + x, 0);
    if (!(b > 0)) return;
    let g = (tt(t.firstSliceAng, 0, 360) - 90) * (Math.PI / 180);
    for (let $ = 0; $ < w.length; $++) {
      const x = w[$] / b, M = x * Wt;
      if (!(M > 0)) continue;
      const k = g + M / 2, T = tt(((y = h.dPts.get($)) == null ? void 0 : y.explosion) ?? 0, 0, 400) / 100 * p * 0.5, S = a + Math.cos(k) * T, A = l + Math.sin(k) * T, { fill: P } = Mt(t, h, $, n.ctx);
      if (o.push(
        bt(
          S - p,
          A - p,
          p * 2,
          p * 2,
          En(p, p, d, p, g, g + M),
          P,
          Zt(h, $, null, 0)
        )
      ), Ct(h.dLbls)) {
        const C = h.dLbls.pos === "outEnd" || h.dLbls.pos === "bestFit" ? p * 1.16 : (d + p) / 2 + (d > 0 ? 0 : p * 0.12), R = Ut(h, $, nt(h.vals[$]) ?? 0, x, n), z = Nt(S + Math.cos(k) * C, A + Math.sin(k) * C, R, h.dLbls, n);
        z && s.push(z);
      }
      g += M;
    }
  }), o.concat(s);
}
function hi(t, e) {
  const n = t.ofPie, o = /* @__PURE__ */ new Set();
  if (!n || !e.length) return o;
  const s = e.reduce((r, i) => r + i, 0);
  switch (n.splitType) {
    case "val": {
      const r = n.splitPos ?? 0;
      e.forEach((i, c) => {
        i < r && o.add(c);
      });
      break;
    }
    case "percent": {
      const r = (n.splitPos ?? 0) / 100;
      e.forEach((i, c) => {
        s > 0 && i / s < r && o.add(c);
      });
      break;
    }
    case "custom":
      for (const r of n.custSplit) r >= 0 && r < e.length && o.add(r);
      break;
    default: {
      const r = tt(Math.round(n.splitPos ?? 2), 1, Math.max(e.length - 1, 1));
      for (let i = Math.max(e.length - r, 1); i < e.length; i++) o.add(i);
    }
  }
  return o.size >= e.length && o.delete(0), o;
}
function di(t, e, n) {
  const o = t.series[0], s = t.ofPie;
  if (!o || !s) return [];
  const r = o.vals.map((z) => Math.abs(nt(z) ?? 0)), i = r.reduce((z, D) => z + D, 0);
  if (!(i > 0)) return [];
  const c = hi(t, r), a = r.map((z, D) => D).filter((z) => !c.has(z)), l = r.map((z, D) => D).filter((z) => c.has(z)), u = l.reduce((z, D) => z + r[D], 0), f = Ct(o.dLbls), h = e.w * 0.08, m = (e.w - h) / 2, d = Math.max(6, Math.min(m * (f ? 0.72 : 0.86), e.h * (f ? 0.38 : 0.46))), p = Math.max(4, Math.min(d * tt(s.secondSize, 5, 200) / 100, m * 0.86, e.h * 0.46)), w = e.y + e.h / 2, b = e.x + m / 2, g = e.x + m + h + m / 2, y = [], $ = [], x = pt(n.color, "rgb(255,255,255)", 0.55), M = (z, D, I, O) => {
    if (!f) return;
    const _ = I === null ? `其他 ${jt(u / i, "0%")}` : Ut(o, I, O, i > 0 ? O / i : null, n), U = Nt(z, D, _, o.dLbls, n);
    U && $.push(U);
  }, k = a.map((z) => ({ idx: z, v: r[z] }));
  u > 0 && k.push({ idx: null, v: u });
  let T = (tt(t.firstSliceAng, 0, 360) - 90) * (Math.PI / 180), S = 0, A = 0;
  for (const z of k) {
    const D = z.v / i * Wt;
    if (!(D > 0)) continue;
    const I = T + D / 2, O = z.idx === null ? dt(x) : Mt(t, o, z.idx, n.ctx).fill, _ = z.idx === null ? null : Zt(o, z.idx, null, 0);
    y.push(bt(b - d, w - d, d * 2, d * 2, En(d, d, 0, d, T, T + D), O, _));
    const U = o.dLbls.pos === "outEnd" || o.dLbls.pos === "bestFit" ? d * 1.15 : d * 0.62;
    M(b + Math.cos(I) * U, w + Math.sin(I) * U, z.idx, z.v), z.idx === null && (S = T, A = T + D), T += D;
  }
  const P = u > 0 ? u : 1;
  let L = w - p, C = w + p, R = g - p;
  if (s.type === "bar") {
    const z = Math.max(8, p * 0.9), D = Math.max(12, p * 2);
    L = w - D / 2, C = w + D / 2, R = g - z / 2;
    let I = L;
    for (const O of l) {
      const _ = r[O] / P * D;
      if (!(_ > 0)) continue;
      const { fill: U } = Mt(t, o, O, n.ctx);
      y.push(bt(
        R,
        I,
        z,
        _,
        `M 0 0 L ${v(z)} 0 L ${v(z)} ${v(_)} L 0 ${v(_)} Z`,
        U,
        Zt(o, O, null, 0)
      )), M(R + z / 2, I + _ / 2, O, r[O]), I += _;
    }
  } else {
    let z = -Math.PI / 2;
    for (const D of l) {
      const I = r[D] / P * Wt;
      if (!(I > 0)) continue;
      const O = z + I / 2, { fill: _ } = Mt(t, o, D, n.ctx);
      y.push(bt(g - p, w - p, p * 2, p * 2, En(p, p, 0, p, z, z + I), _, Zt(o, D, null, 0)));
      const U = o.dLbls.pos === "outEnd" || o.dLbls.pos === "bestFit" ? p * 1.18 : p * 0.62;
      M(g + Math.cos(O) * U, w + Math.sin(O) * U, D, r[D]), z += I;
    }
  }
  if (s.serLines !== !1 && u > 0) {
    const z = { color: pt(n.color, "rgb(255,255,255)", 0.45), width: 1, dash: null }, D = [b + Math.cos(S) * d, w + Math.sin(S) * d], I = [b + Math.cos(A) * d, w + Math.sin(A) * d], O = D[1] <= I[1] ? D : I, _ = D[1] <= I[1] ? I : D, U = $t(O[0], O[1], R, L, z), B = $t(_[0], _[1], R, C, z);
    U && y.push(U), B && y.push(B);
  }
  return y.concat($);
}
const Ce = [
  "rgb(49,84,163)",
  "rgb(84,148,200)",
  "rgb(160,208,224)",
  "rgb(224,238,196)",
  "rgb(253,224,144)",
  "rgb(244,146,74)",
  "rgb(200,60,44)"
];
function ls(t) {
  const e = tt(t, 0, 1) * (Ce.length - 1), n = Math.min(Math.floor(e), Ce.length - 2);
  return pt(Ce[n], Ce[n + 1], e - n);
}
function pi(t, e, n) {
  const o = t.series.length, s = t.series.reduce((M, k) => Math.max(M, k.vals.length), 0);
  if (!o || !s) return [];
  const r = Math.min(e.rect.w * 0.16, n.size * 7), i = Math.min(e.rect.w * 0.2, Math.max(n.size * 4, Un(mi(t.series.map((M) => M.name)), n.size) + n.size)), c = it(n.size) * 1.2, a = e.rect.x + i, l = e.rect.y, u = Math.max(e.rect.w - i - r - n.size, 12), f = Math.max(e.rect.h - c, 12), h = u / s, m = f / o, d = e.max - e.min || 1, p = [], w = { color: "rgba(255,255,255,0.75)", width: 0.75, dash: null };
  t.series.forEach((M, k) => {
    const T = l + f - (k + 1) * m;
    for (let S = 0; S < s; S++) {
      const A = nt(M.vals[S]);
      if (A === null) continue;
      const P = (A - e.min) / d, L = tt(Math.floor(P * e.bands), 0, e.bands - 1), C = t.bandFills.get(L) ?? dt(ls(e.bands > 1 ? L / (e.bands - 1) : P));
      p.push(we({ x: a + S * h, y: T, w: h, h: m }, C, w));
    }
    p.push(ht(e.rect.x, T + m / 2 - c / 2, Math.max(i - n.size * 0.4, 8), c, M.name, {
      size: n.size,
      color: n.color,
      align: "right",
      anchor: "middle",
      fonts: n.fonts
    }));
  });
  for (let M = 0; M < s && M < n.cats.length; M++)
    p.push(ht(a + M * h, l + f, h, c, n.cats[M], {
      size: n.size,
      color: n.color,
      align: "center",
      anchor: "middle",
      fonts: n.fonts
    }));
  const b = Math.min(n.size * 1.1, r * 0.35), g = a + u + n.size * 0.6, y = f * 0.9, $ = l + (f - y) / 2, x = y / e.bands;
  for (let M = 0; M < e.bands; M++) {
    const k = t.bandFills.get(M) ?? dt(ls(e.bands > 1 ? M / (e.bands - 1) : 0.5));
    p.push(we({ x: g, y: $ + y - (M + 1) * x, w: b, h: x }, k, null)), p.push(
      ht(
        g + b + n.size * 0.3,
        $ + y - (M + 1) * x - it(n.size * 0.85) / 2,
        r,
        it(n.size * 0.85),
        jt(e.min + (M + 1) * d / e.bands, e.fmt),
        {
          size: n.size * 0.85,
          color: n.color,
          align: "left",
          anchor: "middle",
          fonts: n.fonts
        }
      )
    );
  }
  return p;
}
const mi = (t) => t.reduce((e, n) => n.length > e.length ? n : e, "");
function kn(t, e, n) {
  const o = t.angle(e), s = t.radius * t.norm(n);
  return [t.cx + s * Math.sin(o), t.cy - s * Math.cos(o)];
}
function gi(t, e, n, o, s, r) {
  const i = [];
  if (t.count < 3) return i;
  for (const a of e) {
    const l = [];
    for (let f = 0; f < t.count; f++) l.push(kn(t, f, a));
    const u = Rn([l], null, o);
    u && i.push(u);
  }
  for (let a = 0; a < t.count; a++) {
    const l = t.angle(a), u = $t(t.cx, t.cy, t.cx + t.radius * Math.sin(l), t.cy - t.radius * Math.cos(l), s);
    u && i.push(u);
  }
  const c = n.size * 1.4;
  for (let a = 0; a < t.count && a < n.cats.length; a++) {
    const l = t.angle(a), u = n.size * 0.9, f = t.cx + (t.radius + u) * Math.sin(l), h = t.cy - (t.radius + u) * Math.cos(l), m = Math.sin(l), d = m > 0.2 ? "left" : m < -0.2 ? "right" : "center", p = Math.max(n.size * 6, 30), w = d === "left" ? f : d === "right" ? f - p : f - p / 2;
    i.push(ht(w, h - c / 2, p, c, n.cats[a], {
      size: n.size,
      color: n.color,
      align: d,
      fonts: n.fonts
    }));
  }
  for (const a of e) {
    if (a === 0) continue;
    const [l, u] = kn(t, 0, a);
    i.push(ht(l + 2, u - c / 2, n.size * 5, c, r(a), {
      size: n.size * 0.9,
      color: n.color,
      align: "left",
      fonts: n.fonts
    }));
  }
  return i;
}
function bi(t, e, n) {
  const o = [], s = [], r = t.radarStyle === "filled", i = t.radarStyle === "marker";
  return t.series.forEach((c, a) => {
    const { fill: l, color: u } = Mt(t, c, 0, n.ctx), f = [];
    for (let p = 0; p < e.count; p++) {
      const w = c.vals[p];
      w == null || !Number.isFinite(w) || f.push(kn(e, p, w));
    }
    if (f.length < 2) return;
    const h = lt(c.ln, u, 2) ?? { color: u, width: 2, dash: null }, m = r ? l.type === "solid" ? { type: "solid", color: wi(l.color, 0.45) } : l : null, d = Rn([f], m, h);
    if (d && o.push(d), i) {
      const p = Ze(t, c, a);
      for (const [w, b] of f) {
        const g = Je(w, b, p, c, u);
        g && s.push(g);
      }
    }
  }), o.concat(s);
}
function wi(t, e) {
  const n = t.match(/rgba?\(([^)]+)\)/);
  if (!n) return t;
  const o = n[1].split(",").map((s) => Number(s.trim()));
  return `rgba(${o[0] || 0},${o[1] || 0},${o[2] || 0},${e})`;
}
function yi(t, e, n, o) {
  const s = Math.max(Number.isFinite(e) ? e : 0, 1), r = Math.max(Number.isFinite(n) ? n : 0, 1);
  try {
    return Mi(t, s, r, o);
  } catch {
    return [_n(s, r, "图表渲染失败")];
  }
}
function _n(t, e, n) {
  return { kind: "unsupported", x: 0, y: 0, w: t, h: e, rot: 0, flipH: !1, flipV: !1, label: n };
}
function xi(t, e, n, o) {
  const s = [];
  if (e.length > 0 && e.every((c) => c.kind === "pie" || c.kind === "doughnut" || c.kind === "ofPie")) {
    const c = e[0], a = c.series[0];
    if (!a) return s;
    const l = Math.max(a.vals.length, n.length);
    for (let u = 0; u < l; u++) {
      if (t.legendDeleted.has(u)) continue;
      const { fill: f, color: h } = Mt(c, a, u, o);
      s.push({ label: n[u] ?? String(u + 1), fill: f, color: h, stroke: null, marker: null, line: !1 });
    }
    return s;
  }
  let i = 0;
  for (const c of e)
    c.series.forEach((a, l) => {
      const u = i++;
      if (t.legendDeleted.has(u)) return;
      const f = c.kind === "line" || c.kind === "scatter";
      s.push({
        label: a.name,
        fill: f ? dt(a.color) : a.fill ?? dt(a.color),
        color: a.color,
        stroke: f ? lt(a.ln, a.color, Pt(2)) : null,
        marker: f ? { sym: Ze(c, a, l), s: a } : null,
        line: f
      });
    });
  return s;
}
function $i(t, e, n, o) {
  const s = [];
  if (!t.legendPos || !e.length) return { els: s, region: n };
  const r = t.textSize, i = r * 1.2, c = r * 0.72, a = r * 1.75, l = r * 0.35, u = r * 0.9, f = e.map((b) => i + l + Un(b.label, r) + u), h = t.legendPos, m = h === "t" || h === "b";
  let d, p = n;
  const w = (b, g, y, $) => {
    const x = y + a / 2;
    if (b.line) {
      const M = $t(g, x, g + i, x, b.stroke ?? { color: b.color, width: Pt(2), dash: null });
      if (M && s.push(M), b.marker && b.marker.sym !== "none") {
        const k = Je(g + i / 2, x, b.marker.sym, b.marker.s, b.color);
        k && s.push(k);
      }
    } else
      s.push(we({ x: g, y: x - c / 2, w: i, h: c }, b.fill, null));
    s.push(
      ht(g + i + l, y, $, a, b.label, {
        size: r,
        color: t.textColor,
        align: "left",
        anchor: "middle",
        fonts: o
      })
    );
  };
  if (m) {
    const b = n.w, g = [];
    let y = [], $ = 0;
    for (let T = 0; T < e.length; T++) {
      const S = Math.min(f[T], b);
      y.length && $ + S > b && (g.push(y), y = [], $ = 0), y.push(T), $ += S;
    }
    y.length && g.push(y);
    const x = Math.max(1, Math.floor(n.h * 0.4 / a)), M = g.slice(0, x), k = M.length * a;
    d = h === "t" ? { x: n.x, y: n.y, w: n.w, h: k } : { x: n.x, y: n.y + n.h - k, w: n.w, h: k }, t.legendOverlay || (p = h === "t" ? { x: n.x, y: n.y + k, w: n.w, h: n.h - k } : { x: n.x, y: n.y, w: n.w, h: n.h - k }), M.forEach((T, S) => {
      const A = T.reduce((C, R) => C + Math.min(f[R], b), 0);
      let P = d.x + Math.max((d.w - A) / 2, 0);
      const L = d.y + S * a;
      for (const C of T) {
        const R = Math.min(f[C], b);
        w(e[C], P, L, Math.max(R - i - l - u * 0.5, r)), P += R;
      }
    });
  } else {
    const b = Math.max(1, Math.floor(n.h / a)), g = Math.max(1, Math.ceil(e.length / b)), y = f.reduce((A, P) => P > A ? P : A, 0), $ = Math.min(y * g, n.w * 0.45), x = $ / g, M = Math.min(b, Math.ceil(e.length / g)), k = h !== "l";
    d = {
      x: k ? n.x + n.w - $ : n.x,
      y: n.y,
      w: $,
      h: n.h
    }, t.legendOverlay || (p = k ? { x: n.x, y: n.y, w: n.w - $, h: n.h } : { x: n.x + $, y: n.y, w: n.w - $, h: n.h });
    const T = M * a, S = h === "tr" ? d.y : d.y + Math.max((d.h - T) / 2, 0);
    for (let A = 0; A < e.length && A < M * g; A++) {
      const P = Math.floor(A / M), L = A % M;
      w(e[A], d.x + P * x, S + L * a, Math.max(x - i - l - r * 0.2, r));
    }
  }
  return { els: s, region: p };
}
function fo(t) {
  let e = [], n = 0;
  for (const r of t)
    for (const i of r.series)
      i.vals.length > n && (n = i.vals.length), i.cats.length > e.length && (e = i.cats);
  const o = Math.max(n, e.length), s = [];
  for (let r = 0; r < o; r++) s.push(e[r] || String(r + 1));
  return s;
}
function Qt(t, e, n, o) {
  if (!e) return t;
  const s = e.x !== null ? e.x * n : t.x, r = e.y !== null ? e.y * o : t.y, i = e.w !== null ? e.w * n : t.w, c = e.h !== null ? e.h * o : t.h;
  return !(i > 4) || !(c > 4) || !Number.isFinite(s) || !Number.isFinite(r) ? t : { x: s, y: r, w: i, h: c };
}
const jn = (t) => {
  for (const e of t) for (const n of e.series) if (n.fmt) return n.fmt;
  return null;
};
function Mi(t, e, n, o) {
  const s = Fr(t, o.ctx), r = [o.fonts.minor.latin, o.fonts.minor.ea].filter((S) => !!S), i = [], c = s.fill ?? dt("rgb(255,255,255)"), a = lt(s.ln, null, 0);
  (c.type !== "none" || a) && i.push(we({ x: 0, y: 0, w: e, h: n }, c.type === "none" ? null : c, a));
  const l = s.groups.filter((S) => S.series.length > 0), u = l.filter(
    (S) => S.kind === "bar" || S.kind === "line" || S.kind === "area" || S.kind === "stock"
  ), f = l.filter((S) => to(S.kind)), h = l.filter((S) => S.kind === "pie" || S.kind === "doughnut"), m = l.filter((S) => S.kind === "ofPie"), d = l.filter((S) => S.kind === "radar"), p = l.filter((S) => S.kind === "surface"), w = s.unsupported.slice();
  if (!u.length && !f.length && !h.length && !d.length && !m.length && !p.length) {
    const S = w.length ? Array.from(new Set(w)).join("/") : "未知类型";
    return i.concat([_n(e, n, `不支持的图表类型: ${S}`)]);
  }
  const b = Math.min(s.textSize * 0.55, Math.min(e, n) * 0.06);
  let g = { x: b, y: b, w: Math.max(e - b * 2, 8), h: Math.max(n - b * 2, 8) };
  if (s.title) {
    const S = s.titleSize, A = Math.min(it(S) + s.textSize * 0.5, g.h * 0.3);
    i.push(
      ht(g.x, g.y, g.w, A, s.title, {
        size: S,
        bold: s.titleBold,
        color: s.titleColor ?? s.textColor,
        align: "center",
        anchor: "middle",
        fonts: r
      })
    ), g = { x: g.x, y: g.y + A, w: g.w, h: Math.max(g.h - A, 8) };
  }
  const y = u.length ? u : f.length ? f : d.length ? d : p.length ? p : m.length ? m : h, $ = fo(y), x = p.length && p.length === l.length ? [] : xi(s, y, $, o.ctx), M = $i(s, x, g, r);
  g = M.region, s.plotLayout && s.plotLayout.target !== "inner" && (g = Qt(g, s.plotLayout, e, n));
  const k = { ctx: o.ctx, fonts: r, size: s.textSize, color: s.textColor, cats: $ }, T = [];
  if (u.length ? T.push(...Si(s, u, $, g, e, n, r, k)) : f.length ? T.push(...Ti(s, f, g, e, n, r, k)) : d.length ? T.push(...Ai(s, d, g, e, n, k)) : p.length ? T.push(...Ci(s, p, g, e, n, k)) : m.length ? T.push(...Li(s, m, g, e, n, k)) : T.push(...Oi(s, h, g, e, n, k)), i.push(...T, ...M.els), w.length) {
    const S = Array.from(new Set(w)).join("/"), A = s.textSize * 0.9;
    i.push(
      ht(g.x, g.y + g.h - it(A), g.w, it(A), `未渲染: ${S}`, {
        size: A,
        color: s.textColor,
        align: "right",
        anchor: "middle",
        fonts: r
      })
    );
  }
  return i;
}
function Ei(t, e) {
  return t.crosses === "max" ? !0 : e ? t.pos === "t" : t.pos === "r";
}
function ki(t, e, n) {
  const o = /* @__PURE__ */ new Map();
  for (const h of t.axes) h.id && o.set(h.id, h);
  const s = t.axes.find((h) => h.kind === "cat" || h.kind === "date") ?? Fe("cat"), r = t.axes.find((h) => h.kind === "val") ?? Fe("val"), i = [], c = /* @__PURE__ */ new Map();
  for (const h of e) {
    let m = null, d = null;
    for (const b of h.axIds) {
      const g = o.get(b);
      g && (g.kind === "val" ? d || (d = g) : (g.kind === "cat" || g.kind === "date") && (m || (m = g)));
    }
    const p = d && d.id || "v#";
    let w = c.get(p);
    w || (w = { cat: m ?? s, val: d ?? r, groups: [] }, c.set(p, w), i.push(p)), w.groups.push(h);
  }
  if (!i.length) return { primary: { cat: s, val: r, groups: e }, secondary: null };
  if (i.length === 1) return { primary: c.get(i[0]), secondary: null };
  let a = i.findIndex((h) => !Ei(c.get(h).val, n));
  a < 0 && (a = 0);
  const l = c.get(i[a]), u = i.filter((h, m) => m !== a).map((h) => c.get(h)), f = { cat: u[0].cat, val: u[0].val, groups: u.flatMap((h) => h.groups) };
  return { primary: l, secondary: f };
}
function Si(t, e, n, o, s, r, i, c) {
  const a = e.some((B) => B.kind === "bar" && B.barDir === "bar"), { primary: l, secondary: u } = ki(t, e, a), f = l.cat, h = a ? f.pos === "r" ? "r" : "l" : f.pos === "t" ? "t" : "b", m = a ? l.val.pos === "t" ? "t" : "b" : l.val.pos === "r" ? "r" : "l", d = a ? m === "b" ? "t" : "b" : m === "l" ? "r" : "l", p = a ? o.w : o.h, w = ye(p, t.textSize), b = (B, X) => {
    const Y = B.groups.some((Z) => Z.grouping === "percentStacked") ? "0%" : jn(B.groups);
    return xn(B.val, X, Ke(B.groups), w, Y, t);
  }, g = b(l, m), y = u ? b(u, d) : null, $ = e.some((B) => B.kind === "bar"), x = e.every((B) => B.kind === "area"), M = $ ? !0 : x ? !1 : f.crossBetween !== "midCat", k = Xr(f, h, n, M, t), T = a ? g : k, S = a ? k : g;
  let A = Mn(o, $n(t, T, S, !1, y)), P = !1;
  if (!a && n.length) {
    const B = M ? A.w / Math.max(n.length, 1) : A.w / Math.max(n.length - 1, 1);
    P = Kr(k, B), P && (A = Mn(o, $n(t, T, S, !0, y)));
  }
  t.plotLayout && t.plotLayout.target === "inner" && (A = Qt(A, t.plotLayout, s, r));
  const L = e.some((B) => B.is3D);
  let C = null;
  L && (C = _r(t.view3D, A), A = jr(A, C));
  const R = is(A, a, k, g), z = y ? is(A, a, k, y) : null, D = M ? n.length + 1 : n.length, I = a ? {
    rect: A,
    hAxis: g,
    vAxis: k,
    hPos: (B) => R.val(g.ticks[B] ?? 0),
    vPos: (B) => R.cat(B),
    hEdge: null,
    hEdgeCount: 0,
    vEdge: (B) => R.edge(B),
    vEdgeCount: D,
    hLineAt: m === "t" ? A.y : A.y + A.h,
    vLineAt: R.zero,
    hWrap: !1,
    hBand: 0,
    depth: C
  } : {
    rect: A,
    hAxis: k,
    vAxis: g,
    hPos: (B) => R.cat(B),
    vPos: (B) => R.val(g.ticks[B] ?? 0),
    hEdge: (B) => R.edge(B),
    hEdgeCount: D,
    vEdge: null,
    vEdgeCount: 0,
    hLineAt: R.zero,
    vLineAt: m === "r" ? A.x + A.w : A.x,
    hWrap: P,
    hBand: R.band,
    depth: C
  }, O = [];
  if (O.push(...Ee(t, A)), C && O.push(...Vr(A, C, t.textColor)), O.push(...co(t, I, i)), y && z) {
    const B = d === "l" || d === "r";
    O.push(
      ...qr(
        t,
        {
          rect: A,
          view: y,
          pos: (X) => z.val(y.ticks[X] ?? 0),
          at: B ? d === "r" ? A.x + A.w : A.x : d === "t" ? A.y : A.y + A.h,
          grid: !g.axis.majorGrid && !!y.axis.majorGrid,
          depth: C
        },
        i
      )
    );
  }
  const _ = (B) => {
    const X = /* @__PURE__ */ new Map();
    let Y = 0;
    for (const Z of B)
      X.set(Z, Y), Y += qe(Z) ? 1 : Z.series.length;
    return (Z) => ({ base: X.get(Z) ?? 0, total: Math.max(Y, 1) });
  }, U = (B, X) => {
    const Y = B.groups.filter((K) => K.kind === "bar"), Z = _(Y);
    for (const K of B.groups) K.kind === "area" && O.push(...si(K, X, c));
    for (const K of Y) O.push(...ei(K, X, Z(K), c, K.is3D ? C : null));
    for (const K of B.groups) K.kind === "line" && O.push(...ni(K, X, c));
    for (const K of B.groups) K.kind === "stock" && O.push(...ii(K, X, c));
  };
  return U(l, R), u && z && U(u, z), O;
}
function Ti(t, e, n, o, s, r, i) {
  const c = t.axes.filter((g) => g.kind !== "ser"), a = c.find((g) => g.pos === "b" || g.pos === "t") ?? c[0] ?? Fe("val"), l = c.find((g) => g !== a) ?? Fe("val"), u = a.pos === "t" ? "t" : "b", f = l.pos === "r" ? "r" : "l", h = xn(a, u, Wr(e), ye(n.w, t.textSize), null, t), m = xn(l, f, Ke(e), ye(n.h, t.textSize), jn(e), t);
  let d = Mn(n, $n(t, h, m, !1));
  t.plotLayout && t.plotLayout.target === "inner" && (d = Qt(d, t.plotLayout, o, s));
  const p = Yr(d, h, m), w = {
    rect: d,
    hAxis: h,
    vAxis: m,
    hPos: (g) => p.x(h.ticks[g] ?? 0),
    vPos: (g) => p.y(m.ticks[g] ?? 0),
    hEdge: null,
    hEdgeCount: 0,
    vEdge: null,
    vEdgeCount: 0,
    hLineAt: p.y(p.clampY(0)),
    vLineAt: p.x(p.clampX(0)),
    hWrap: !1,
    hBand: 0,
    depth: null
  }, b = [];
  b.push(...Ee(t, d)), b.push(...co(t, w, r));
  for (const g of e)
    b.push(...g.kind === "bubble" ? ri(g, p, i) : oi(g, p, i));
  return b;
}
function Ci(t, e, n, o, s, r) {
  let i = n;
  t.plotLayout && (i = Qt(i, t.plotLayout, o, s));
  const c = Ke(e), a = Bn(c.lo, c.hi, ye(i.h, t.textSize)), l = Math.max(2, Math.min(Math.round((a.max - a.min) / a.step), 12)), u = t.axes.find((m) => m.kind === "val"), f = {
    rect: i,
    min: a.min,
    max: a.max,
    bands: l,
    fmt: (u == null ? void 0 : u.fmt) ?? jn(e)
  }, h = Ee(t, i);
  for (const m of e) h.push(...pi(m, f, r));
  return h;
}
function Li(t, e, n, o, s, r) {
  let i = n;
  t.plotLayout && (i = Qt(i, t.plotLayout, o, s));
  const c = Ee(t, i);
  for (const a of e) c.push(...di(a, i, r));
  return c;
}
function Ai(t, e, n, o, s, r) {
  var A, P;
  let i = n;
  t.plotLayout && (i = Qt(i, t.plotLayout, o, s));
  const c = fo(e), a = Math.max(c.length, ((P = (A = e[0]) == null ? void 0 : A.series[0]) == null ? void 0 : P.vals.length) ?? 0);
  if (a < 3) return [_n(o, s, "雷达图至少需要 3 个类目")];
  const l = Ke(e), u = Bn(Math.min(l.lo, 0), l.hi, ye(Math.min(i.w, i.h), t.textSize)), f = u.max - u.min || 1, h = t.textSize * 4, m = Math.max(Math.min(i.w, i.h) - h, 24), d = i.x + i.w / 2, p = i.y + i.h / 2, w = {
    cx: d,
    cy: p,
    radius: m / 2,
    norm: (L) => Pi((L - u.min) / f),
    angle: (L) => L * Math.PI * 2 / a,
    count: a
  }, b = [];
  for (let L = u.min; L <= u.max + u.step * 0.5; L += u.step) b.push(Ii(L));
  const g = t.axes.find((L) => L.kind === "val"), y = t.axes.find((L) => L.kind === "cat"), $ = pt(t.textColor, "rgb(255,255,255)", 0.72), x = pt(t.textColor, "rgb(255,255,255)", 0.55), M = lt((g == null ? void 0 : g.majorGrid) ?? null, $, 1) ?? { color: $, width: 1, dash: null }, k = lt((y == null ? void 0 : y.line) ?? null, x, 1) ?? { color: x, width: 1, dash: null }, T = (g == null ? void 0 : g.fmt) ?? null, S = gi(w, b, r, M, k, (L) => jt(L, T));
  for (const L of e) S.push(...bi(L, w, r));
  return S;
}
const Pi = (t) => Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0, Ii = (t) => Number(t.toPrecision(12));
function Oi(t, e, n, o, s, r) {
  let i = n;
  t.plotLayout && (i = Qt(i, t.plotLayout, o, s));
  const c = Math.max(Math.min(i.w, i.h), 8), a = {
    x: i.x + (i.w - c) / 2,
    y: i.y + (i.h - c) / 2,
    w: c,
    h: c
  }, l = [];
  l.push(...Ee(t, i));
  for (const u of e) l.push(...u.is3D ? ui(u, i, r) : fi(u, a, r));
  return l;
}
function Ee(t, e) {
  const n = lt(t.plotLn, null, 0), o = t.plotFill && t.plotFill.type !== "none" ? t.plotFill : null;
  return !o && !n ? [] : [we(e, o, n)];
}
let vi = 0;
const zi = (t) => `${t}${(++vi).toString(36)}`, H = (t) => Number.isFinite(t) ? String(Math.round(t * 100) / 100) : "0", us = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"), ho = [1, 0, 0, 1, 0, 0];
function Sn(t, e) {
  const [n, o, s, r, i, c] = t, [a, l, u, f, h, m] = e;
  return [
    a * n + u * o,
    l * n + f * o,
    a * s + u * r,
    l * s + f * r,
    a * i + u * c + h,
    l * i + f * c + m
  ];
}
function G(t, e, n) {
  return { x: t[0] * e + t[2] * n + t[4], y: t[1] * e + t[3] * n + t[5] };
}
function fs(t) {
  const e = Math.abs(t[0] * t[3] - t[1] * t[2]), n = Math.sqrt(e);
  return Number.isFinite(n) && n > 1e-9 ? n : 1;
}
function Ri(t) {
  const e = Math.hypot(t[2], t[3]);
  return Number.isFinite(e) && e > 1e-9 ? e : 1;
}
class xt {
  constructor(e, n = 0, o) {
    this.p = 0, this.dv = new DataView(e.buffer, e.byteOffset, e.byteLength), this.end = Math.min(o ?? e.length, e.length), this.p = n;
  }
  has(e) {
    return this.p + e <= this.end;
  }
  get left() {
    return Math.max(0, this.end - this.p);
  }
  skip(e) {
    this.p += e;
  }
  seek(e) {
    this.p = e;
  }
  u8() {
    return this.has(1) ? this.dv.getUint8(this.p++) : (this.p += 1, 0);
  }
  i16() {
    if (!this.has(2))
      return this.p += 2, 0;
    const e = this.dv.getInt16(this.p, !0);
    return this.p += 2, e;
  }
  u16() {
    if (!this.has(2))
      return this.p += 2, 0;
    const e = this.dv.getUint16(this.p, !0);
    return this.p += 2, e;
  }
  i32() {
    if (!this.has(4))
      return this.p += 4, 0;
    const e = this.dv.getInt32(this.p, !0);
    return this.p += 4, e;
  }
  u32() {
    if (!this.has(4))
      return this.p += 4, 0;
    const e = this.dv.getUint32(this.p, !0);
    return this.p += 4, e;
  }
  f32() {
    if (!this.has(4))
      return this.p += 4, 0;
    const e = this.dv.getFloat32(this.p, !0);
    return this.p += 4, Number.isFinite(e) ? e : 0;
  }
  /** COLORREF 0x00BBGGRR */
  color() {
    const e = this.u32();
    return Tn(e & 255, e >> 8 & 255, e >> 16 & 255);
  }
  /** 32 位点（EMF POINTL）*/
  ptL() {
    return { x: this.i32(), y: this.i32() };
  }
  /** 16 位点（EMF POINT16 / WMF POINT16）*/
  pt16() {
    return { x: this.i16(), y: this.i16() };
  }
  /** EMF RECTL：左上右下 */
  rectL() {
    return { l: this.i32(), t: this.i32(), r: this.i32(), b: this.i32() };
  }
  /** UTF-16LE 定长字符串（字节数），截到第一个 NUL */
  utf16(e) {
    let n = "";
    const o = e >> 1;
    for (let s = 0; s < o; s++) {
      const r = this.u16();
      if (r === 0) {
        this.skip((o - s - 1) * 2);
        break;
      }
      n += String.fromCharCode(r);
    }
    return n;
  }
  /** 单字节字符串（按 latin1 近似），截到第一个 NUL */
  ansi(e) {
    let n = "";
    for (let o = 0; o < e; o++) {
      const s = this.u8();
      if (s === 0) {
        this.skip(e - o - 1);
        break;
      }
      n += String.fromCharCode(s);
    }
    return n;
  }
  // ---- 以下为 PICT（QuickDraw）所需：它是大端，与 EMF/WMF 相反 ----
  get pos() {
    return this.p;
  }
  get limit() {
    return this.end;
  }
  i8() {
    return this.u8() << 24 >> 24;
  }
  /** 大端 16 位有符号 */
  i16be() {
    if (!this.has(2))
      return this.p += 2, 0;
    const e = this.dv.getInt16(this.p, !1);
    return this.p += 2, e;
  }
  /** 大端 16 位无符号 */
  u16be() {
    if (!this.has(2))
      return this.p += 2, 0;
    const e = this.dv.getUint16(this.p, !1);
    return this.p += 2, e;
  }
  /** 大端 32 位无符号 */
  u32be() {
    if (!this.has(4))
      return this.p += 4, 0;
    const e = this.dv.getUint32(this.p, !1);
    return this.p += 4, e;
  }
  /** 取 len 字节并前移；越界时按剩余长度截断 */
  take(e) {
    const n = Math.max(0, Math.min(e, this.end - this.p)), o = new Uint8Array(this.dv.buffer, this.dv.byteOffset + this.p, n);
    return this.p += e, o;
  }
}
const rn = (t) => (t & 255).toString(16).padStart(2, "0"), Tn = (t, e, n) => `#${rn(t)}${rn(e)}${rn(n)}`, Di = 1, hs = 5, Ui = 1, po = 0, Ni = 1, Bi = 2, Fi = 3, Hi = 4, At = 5, te = 0, ke = 1, _i = 2, ds = 3, ps = 5, ge = () => ({ kind: "pen", style: po, width: 1, color: "#000000", cap: 0, join: 0 }), mo = () => ({ kind: "brush", style: te, color: "#ffffff", hatch: 0, href: null }), Se = () => ({
  kind: "font",
  height: -12,
  escapement: 0,
  weight: 400,
  italic: !1,
  underline: !1,
  strike: !1,
  face: "Arial",
  charset: 0
}), ji = () => ({ ...ge(), style: At }), ee = (t) => ({ kind: "brush", style: te, color: t, hatch: 0, href: null });
function Vi(t) {
  switch (t & 255) {
    case 0:
      return ee("#ffffff");
    case 1:
      return ee("#c0c0c0");
    case 2:
      return ee("#808080");
    case 3:
      return ee("#404040");
    case 4:
      return ee("#000000");
    case 5:
      return { ...mo(), style: ke };
    case 6:
      return { ...ge(), color: "#ffffff" };
    case 7:
      return ge();
    case 8:
      return ji();
    case 10:
    case 11:
    case 12:
    case 13:
    case 14:
    case 16:
    case 17:
      return Se();
    case 18:
      return ee("#ffffff");
    case 19:
      return ge();
    default:
      return null;
  }
}
const Cn = 1, Wi = 7, Gi = 8;
function Xi(t) {
  return {
    ...t,
    pen: { ...t.pen },
    brush: { ...t.brush },
    font: { ...t.font },
    world: [...t.world],
    winOrg: { ...t.winOrg },
    winExt: { ...t.winExt },
    vpOrg: { ...t.vpOrg },
    vpExt: { ...t.vpExt },
    pos: { ...t.pos }
  };
}
const Yi = {
  2: 0.1,
  // MM_LOMETRIC
  3: 0.01,
  // MM_HIMETRIC
  4: 25.4 / 100,
  // MM_LOENGLISH
  5: 25.4 / 1e3,
  // MM_HIENGLISH
  6: 25.4 / 1440
  // MM_TWIPS
};
class qi {
  constructor() {
    this.els = [], this.defs = [], this.cache = /* @__PURE__ */ new Map(), this.count = 0;
  }
  add(e) {
    this.els.push(e), this.count++;
  }
  /** 按 key 去重的 <defs> 条目，返回引用 id */
  def(e, n, o) {
    const s = this.cache.get(e);
    if (s !== void 0) return s;
    const r = zi(n);
    return this.defs.push(o(r)), this.cache.set(e, r), r;
  }
  render(e, n, o) {
    const s = Math.max(1, e.r - e.l), r = Math.max(1, e.b - e.t), i = this.defs.length ? `<defs>${this.defs.join("")}</defs>` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${H(n)}" height="${H(o)}" viewBox="${H(e.l)} ${H(e.t)} ${H(s)} ${H(r)}" preserveAspectRatio="xMidYMid meet">` + i + this.els.join("") + "</svg>";
  }
}
class an {
  constructor() {
    this.d = [], this.started = !1;
  }
  get empty() {
    return this.d.length === 0;
  }
  get data() {
    return this.d.join("");
  }
  clear() {
    this.d = [], this.started = !1;
  }
  move(e) {
    yt(e) && (this.d.push(`M${H(e.x)} ${H(e.y)}`), this.started = !0);
  }
  line(e) {
    yt(e) && (this.started ? this.d.push(`L${H(e.x)} ${H(e.y)}`) : this.move(e));
  }
  cubic(e, n, o) {
    !yt(e) || !yt(n) || !yt(o) || (this.started || this.move(e), this.d.push(`C${H(e.x)} ${H(e.y)} ${H(n.x)} ${H(n.y)} ${H(o.x)} ${H(o.y)}`));
  }
  close() {
    this.started && this.d.push("Z");
  }
}
const yt = (t) => Number.isFinite(t.x) && Number.isFinite(t.y), Ki = 0.5522847498307936;
function ne(t, e, n, o, s, r, i) {
  const c = [], a = r - s, l = Math.max(1, Math.ceil(Math.abs(a) / (Math.PI / 2))), u = a / l, f = Ki * Math.abs(u) / (Math.PI / 2) * Math.sign(u);
  let h = s;
  for (let m = 0; m < l; m++) {
    const d = h + u, p = Math.cos(h), w = Math.sin(h), b = Math.cos(d), g = Math.sin(d), y = { x: t + n * (p - f * w), y: e + o * (w + f * p) }, $ = { x: t + n * (b + f * g), y: e + o * (g - f * b) }, x = { x: t + n * b, y: e + o * g };
    c.push([G(i, y.x, y.y), G(i, $.x, $.y), G(i, x.x, x.y)]), h = d;
  }
  return c;
}
const ms = (t, e, n, o, s, r) => G(r, t + n * Math.cos(s), e + o * Math.sin(s));
function gs(t, e, n, o, s, r) {
  const i = n !== 0 ? (s - t) / n : 0, c = o !== 0 ? (r - e) / o : 0;
  return i === 0 && c === 0 ? 0 : Math.atan2(c, i);
}
class Vn {
  constructor(e) {
    this.stack = [], this.objs = [], this.svg = new qi(), this.path = new an(), this.inPath = !1, this.dev = e, this.dc = {
      pen: ge(),
      brush: mo(),
      font: Se(),
      textColor: "#000000",
      bkColor: "#ffffff",
      bkMode: 2,
      polyFill: 1,
      textAlign: 0,
      world: [...ho],
      mapMode: Cn,
      winOrg: { x: 0, y: 0 },
      winExt: { x: 1, y: 1 },
      vpOrg: { x: 0, y: 0 },
      vpExt: { x: 1, y: 1 },
      clip: null,
      pos: { x: 0, y: 0 }
    };
  }
  get drawn() {
    return this.svg.count;
  }
  // -------- 变换 --------
  /** 逻辑坐标 → 设备坐标的完整矩阵 */
  xf() {
    const e = this.dc;
    let n, o;
    const s = Yi[e.mapMode];
    if (e.mapMode === Cn)
      n = 1, o = 1;
    else if (s !== void 0)
      n = s * this.dev.pxPerMmX, o = -s * this.dev.pxPerMmY;
    else if (n = e.winExt.x !== 0 ? e.vpExt.x / e.winExt.x : 1, o = e.winExt.y !== 0 ? e.vpExt.y / e.winExt.y : 1, e.mapMode === Wi) {
      const i = Math.min(Math.abs(n), Math.abs(o));
      n = i * Math.sign(n || 1), o = i * Math.sign(o || 1);
    }
    (!Number.isFinite(n) || n === 0) && (n = 1), (!Number.isFinite(o) || o === 0) && (o = 1);
    const r = [n, 0, 0, o, e.vpOrg.x - e.winOrg.x * n, e.vpOrg.y - e.winOrg.y * o];
    return Sn(e.world, r);
  }
  tp(e, n) {
    return G(this.xf(), e, n);
  }
  // -------- DC 栈 / 对象表 --------
  save() {
    this.stack.push(Xi(this.dc));
  }
  restore(e = -1) {
    if (!this.stack.length) return;
    let n = e < 0 ? -e : Math.max(1, this.stack.length - e);
    n = Math.min(n, this.stack.length);
    let o;
    for (let s = 0; s < n; s++) o = this.stack.pop();
    o && (this.dc = o);
  }
  putObj(e, n) {
    e < 0 || e > 65535 || (this.objs[e] = n);
  }
  /** WMF：对象放进第一个空槽 */
  addObj(e) {
    for (let n = 0; n < this.objs.length; n++)
      if (!this.objs[n]) {
        this.objs[n] = e;
        return;
      }
    this.objs.length < 65536 && this.objs.push(e);
  }
  delObj(e) {
    e >= 0 && e < this.objs.length && (this.objs[e] = null);
  }
  selectIdx(e) {
    const n = e & 2147483648 || (e & 4294934528) === 32768 ? Vi(e) : this.objs[e] ?? null;
    n && this.select(n);
  }
  select(e) {
    e.kind === "pen" ? this.dc.pen = e : e.kind === "brush" ? this.dc.brush = e : this.dc.font = e;
  }
  // -------- 裁剪 --------
  intersectClip(e) {
    const n = this.xf(), o = [
      G(n, e.l, e.t),
      G(n, e.r, e.t),
      G(n, e.r, e.b),
      G(n, e.l, e.b)
    ];
    if (o.some((c) => !yt(c))) return;
    const s = `M${H(o[0].x)} ${H(o[0].y)}L${H(o[1].x)} ${H(o[1].y)}L${H(o[2].x)} ${H(o[2].y)}L${H(o[3].x)} ${H(o[3].y)}Z`, r = this.dc.clip, i = `clip:${s}|${r ?? ""}`;
    this.dc.clip = this.svg.def(i, "c", (c) => `<clipPath id="${c}"${r ? ` clip-path="url(#${r})"` : ""}><path d="${s}"/></clipPath>`);
  }
  /** EXTSELECTCLIPRGN 用：清除裁剪 */
  clearClip() {
    this.dc.clip = null;
  }
  /**
   * 用一组矩形（区域）设置裁剪。intersect=true 时与当前裁剪求交（嵌套 clipPath），
   * 否则替换。矩形之间是并集——clipPath 的多个子元素天然如此。
   */
  setClipRects(e, n) {
    const o = this.xf(), s = [];
    for (const a of e) {
      const l = G(o, a.l, a.t), u = G(o, a.r, a.b);
      if (!yt(l) || !yt(u)) continue;
      const f = Math.min(l.x, u.x), h = Math.min(l.y, u.y), m = Math.abs(u.x - l.x), d = Math.abs(u.y - l.y);
      !(m > 0) || !(d > 0) || s.push(`<rect x="${H(f)}" y="${H(h)}" width="${H(m)}" height="${H(d)}"/>`);
    }
    if (!s.length) return;
    const r = n ? this.dc.clip : null, i = s.join(""), c = `rgn:${i}|${r ?? ""}`;
    this.dc.clip = this.svg.def(c, "c", (a) => `<clipPath id="${a}"${r ? ` clip-path="url(#${r})"` : ""}>${i}</clipPath>`);
  }
  clipAttr() {
    return this.dc.clip ? ` clip-path="url(#${this.dc.clip})"` : "";
  }
  // -------- 画笔 / 画刷 → SVG 属性 --------
  strokeAttrs() {
    const e = this.dc.pen;
    if (e.style === At) return ' stroke="none"';
    const n = Math.max(e.width, 0) * fs(this.xf()), o = n < 0.75 ? 0.75 : n;
    let s = ` stroke="${e.color}" stroke-width="${H(o)}"`;
    const r = Zi(e.style, o);
    return r && (s += ` stroke-dasharray="${r}"`), r ? s += ' stroke-linecap="butt"' : e.cap === 256 ? s += ' stroke-linecap="square"' : e.cap === 512 ? s += ' stroke-linecap="butt"' : e.cap === 0 && (s += ' stroke-linecap="round"'), e.join === 4096 ? s += ' stroke-linejoin="bevel"' : e.join === 8192 ? s += ' stroke-linejoin="miter"' : e.join === 0 && (s += ' stroke-linejoin="round"'), s;
  }
  fillAttrs() {
    const e = this.dc.brush;
    if (e.style === ke) return ' fill="none"';
    if (e.style === _i) {
      const n = this.dc.bkMode === 2 ? this.dc.bkColor : "none", o = `h:${e.hatch}:${e.color}:${n}`;
      return ` fill="url(#${this.svg.def(o, "h", (r) => Ji(r, e.hatch, e.color, n))})"`;
    }
    if ((e.style === ds || e.style === ps) && e.href) {
      const n = `p:${e.href.length}:${e.href.slice(-32)}`;
      return ` fill="url(#${this.svg.def(n, "q", (s) => `<pattern id="${s}" width="16" height="16" patternUnits="userSpaceOnUse"><image xlink:href="${e.href}" width="16" height="16" preserveAspectRatio="none"/></pattern>`)})"`;
    }
    return e.style === ds || e.style === ps ? ` fill="${e.color}"` : ` fill="${e.color}"`;
  }
  ruleAttr() {
    return this.dc.polyFill === 1 ? ' fill-rule="evenodd"' : "";
  }
  /** 输出一条 path；mode 决定描边 / 填充 */
  emit(e, n) {
    if (!e) return;
    const o = n === "stroke" ? ' fill="none"' : this.fillAttrs() + this.ruleAttr(), s = n === "fill" ? ' stroke="none"' : this.strokeAttrs();
    this.svg.add(`<path d="${e}"${o}${s}${this.clipAttr()}/>`);
  }
  /** 绘图记录的统一出口：路径模式下累积，否则立即输出 */
  draw(e, n) {
    if (this.inPath) {
      e(this.path);
      return;
    }
    const o = new an();
    e(o), this.emit(o.data, n);
  }
  // -------- 路径模式 --------
  beginPath() {
    this.path.clear(), this.inPath = !0;
  }
  endPath() {
    this.inPath = !1;
  }
  abortPath() {
    this.path.clear(), this.inPath = !1;
  }
  closeFigure() {
    this.path.close();
  }
  finishPath(e) {
    this.inPath = !1, this.emit(this.path.data, e), this.path.clear();
  }
  /** SELECTCLIPPATH：把当前路径当作裁剪区 */
  clipToPath() {
    const e = this.path.data;
    if (this.inPath = !1, !e) return;
    const n = this.dc.clip;
    this.dc.clip = this.svg.def(`clipP:${e}|${n ?? ""}`, "c", (o) => `<clipPath id="${o}"${n ? ` clip-path="url(#${n})"` : ""}><path d="${e}"/></clipPath>`), this.path.clear();
  }
  // -------- 绘图原语（入参均为逻辑坐标）--------
  moveTo(e, n) {
    this.dc.pos = { x: e, y: n }, this.inPath && this.path.move(this.tp(e, n));
  }
  lineTo(e, n) {
    const o = this.xf(), s = G(o, this.dc.pos.x, this.dc.pos.y), r = G(o, e, n);
    this.inPath ? this.path.line(r) : this.emit(`M${H(s.x)} ${H(s.y)}L${H(r.x)} ${H(r.y)}`, "stroke"), this.dc.pos = { x: e, y: n };
  }
  polyline(e, n) {
    if (e.length < 2) return;
    const o = this.xf(), s = e.map((i) => G(o, i.x, i.y));
    this.draw((i) => {
      i.move(s[0]);
      for (let c = 1; c < s.length; c++) i.line(s[c]);
      n && i.close();
    }, n ? "both" : "stroke");
    const r = e[e.length - 1];
    this.dc.pos = { x: r.x, y: r.y };
  }
  /** POLYLINETO：从当前点续画 */
  polylineTo(e) {
    if (!e.length) return;
    const n = this.xf();
    if (this.inPath)
      for (const s of e) this.path.line(G(n, s.x, s.y));
    else {
      const s = G(n, this.dc.pos.x, this.dc.pos.y);
      let r = `M${H(s.x)} ${H(s.y)}`;
      for (const i of e) {
        const c = G(n, i.x, i.y);
        r += `L${H(c.x)} ${H(c.y)}`;
      }
      this.emit(r, "stroke");
    }
    const o = e[e.length - 1];
    this.dc.pos = { x: o.x, y: o.y };
  }
  polyBezier(e, n) {
    const o = this.xf(), s = e.map((i) => G(o, i.x, i.y)), r = (i) => {
      let c = 0;
      if (n)
        this.inPath || i.move(G(o, this.dc.pos.x, this.dc.pos.y));
      else {
        if (!s.length) return;
        i.move(s[0]), c = 1;
      }
      for (; c + 2 < s.length; c += 3) i.cubic(s[c], s[c + 1], s[c + 2]);
    };
    if (this.inPath) r(this.path);
    else {
      const i = new an();
      r(i), this.emit(i.data, "stroke");
    }
    if (e.length) {
      const i = e[e.length - 1];
      this.dc.pos = { x: i.x, y: i.y };
    }
  }
  polyPoly(e, n) {
    const o = this.xf();
    this.draw((s) => {
      for (const r of e)
        if (!(r.length < 2)) {
          s.move(G(o, r[0].x, r[0].y));
          for (let i = 1; i < r.length; i++) s.line(G(o, r[i].x, r[i].y));
          n && s.close();
        }
    }, n ? "both" : "stroke");
  }
  rect(e) {
    const n = this.xf();
    if (!this.inPath && n[1] === 0 && n[2] === 0) {
      const s = G(n, e.l, e.t), r = G(n, e.r, e.b);
      if (yt(s) && yt(r)) {
        const i = Math.abs(r.x - s.x), c = Math.abs(r.y - s.y);
        this.svg.add(`<rect x="${H(Math.min(s.x, r.x))}" y="${H(Math.min(s.y, r.y))}" width="${H(i)}" height="${H(c)}"${this.fillAttrs()}${this.strokeAttrs()}${this.clipAttr()}/>`);
        return;
      }
    }
    const o = [G(n, e.l, e.t), G(n, e.r, e.t), G(n, e.r, e.b), G(n, e.l, e.b)];
    this.draw((s) => {
      s.move(o[0]), s.line(o[1]), s.line(o[2]), s.line(o[3]), s.close();
    }, "both");
  }
  ellipse(e) {
    const n = this.xf(), o = (e.l + e.r) / 2, s = (e.t + e.b) / 2, r = Math.abs(e.r - e.l) / 2, i = Math.abs(e.b - e.t) / 2;
    this.draw((c) => {
      c.move(ms(o, s, r, i, 0, n));
      for (const a of ne(o, s, r, i, 0, Math.PI * 2, n)) c.cubic(a[0], a[1], a[2]);
      c.close();
    }, "both");
  }
  roundRect(e, n, o) {
    const s = this.xf(), r = Math.min(e.l, e.r), i = Math.min(e.t, e.b), c = Math.max(e.l, e.r), a = Math.max(e.t, e.b), l = Math.min(Math.abs(n) / 2, (c - r) / 2), u = Math.min(Math.abs(o) / 2, (a - i) / 2);
    if (l <= 0 || u <= 0) {
      this.rect(e);
      return;
    }
    this.draw((f) => {
      f.move(G(s, r + l, i)), f.line(G(s, c - l, i));
      for (const h of ne(c - l, i + u, l, u, -Math.PI / 2, 0, s)) f.cubic(h[0], h[1], h[2]);
      f.line(G(s, c, a - u));
      for (const h of ne(c - l, a - u, l, u, 0, Math.PI / 2, s)) f.cubic(h[0], h[1], h[2]);
      f.line(G(s, r + l, a));
      for (const h of ne(r + l, a - u, l, u, Math.PI / 2, Math.PI, s)) f.cubic(h[0], h[1], h[2]);
      f.line(G(s, r, i + u));
      for (const h of ne(r + l, i + u, l, u, Math.PI, Math.PI * 1.5, s)) f.cubic(h[0], h[1], h[2]);
      f.close();
    }, "both");
  }
  /** GDI 弧默认逆时针（屏幕上看），即参数角递减方向 */
  arc(e, n, o, s, r, i, c = !1) {
    const a = this.xf(), l = (e.l + e.r) / 2, u = (e.t + e.b) / 2, f = Math.abs(e.r - e.l) / 2, h = Math.abs(e.b - e.t) / 2;
    if (f <= 0 || h <= 0) return;
    const m = gs(l, u, f, h, n, o);
    let d = gs(l, u, f, h, s, r), p = m - d;
    for (; p <= 0; ) p += Math.PI * 2;
    d = m - p;
    const w = i === "arc" ? "stroke" : "both";
    this.draw((g) => {
      const y = ms(l, u, f, h, m, a);
      i === "pie" ? (g.move(G(a, l, u)), g.line(y)) : c && this.inPath ? g.line(y) : g.move(y);
      for (const $ of ne(l, u, f, h, m, d, a)) g.cubic($[0], $[1], $[2]);
      i !== "arc" && g.close();
    }, w);
    const b = { x: l + f * Math.cos(d), y: u + h * Math.sin(d) };
    this.dc.pos = b;
  }
  /** POLYDRAW：点 + 类型数组（PT_MOVETO 6 / PT_LINETO 2 / PT_BEZIERTO 4 / PT_CLOSEFIGURE 1）*/
  polyDraw(e, n) {
    const o = this.xf(), s = Math.min(e.length, n.length);
    this.draw((r) => {
      for (let i = 0; i < s; i++) {
        const c = n[i] & 6;
        c === 4 && i + 2 < s ? (r.cubic(G(o, e[i].x, e[i].y), G(o, e[i + 1].x, e[i + 1].y), G(o, e[i + 2].x, e[i + 2].y)), i += 2) : c === 6 ? r.move(G(o, e[i].x, e[i].y)) : r.line(G(o, e[i].x, e[i].y)), n[i] & 1 && r.close();
      }
    }, "stroke"), s && (this.dc.pos = { x: e[s - 1].x, y: e[s - 1].y });
  }
  // -------- 文本 --------
  text(e, n, o, s, r) {
    if (!o) return;
    const i = this.xf(), c = G(i, e, n);
    if (!yt(c)) return;
    const a = this.dc.font, u = (a.height < 0 ? -a.height : a.height * 0.87) * Ri(i);
    if (!(u > 0) || !Number.isFinite(u)) return;
    if (r && this.dc.bkMode === 2) {
      const p = G(i, r.l, r.t), w = G(i, r.r, r.b);
      yt(p) && yt(w) && this.svg.add(`<rect x="${H(Math.min(p.x, w.x))}" y="${H(Math.min(p.y, w.y))}" width="${H(Math.abs(w.x - p.x))}" height="${H(Math.abs(w.y - p.y))}" fill="${this.dc.bkColor}"${this.clipAttr()}/>`);
    }
    const f = this.dc.textAlign, h = (f & 6) === 2 ? "end" : (f & 6) === 6 ? "middle" : "start", m = (f & 24) === 24 ? "" : (f & 24) === 8 ? "text-after-edge" : "text-before-edge";
    let d = ` x="${H(c.x)}" y="${H(c.y)}"`;
    if (a.escapement && (d += ` transform="rotate(${H(-a.escapement / 10)} ${H(c.x)} ${H(c.y)})"`), d += ` font-family="${us(Qi(a.face))}" font-size="${H(u)}" fill="${this.dc.textColor}"`, a.weight >= 600 && (d += ` font-weight="${a.weight}"`), a.italic && (d += ' font-style="italic"'), a.underline && a.strike ? d += ' text-decoration="underline line-through"' : a.underline ? d += ' text-decoration="underline"' : a.strike && (d += ' text-decoration="line-through"'), h !== "start" && (d += ` text-anchor="${h}"`), m && (d += ` dominant-baseline="${m}"`), s && s.length) {
      let p = 0;
      for (const b of s) p += b;
      const w = p * fs(i);
      w > 0 && Number.isFinite(w) && (d += ` textLength="${H(w)}" lengthAdjust="spacingAndGlyphs"`);
    }
    this.svg.add(`<text${d} xml:space="preserve"${this.clipAttr()}>${us(o)}</text>`);
  }
  // -------- 位图 --------
  image(e, n) {
    const o = this.xf(), s = e.r - e.l, r = e.b - e.t, i = G(o, e.l, e.t), c = G(o, e.l + s, e.t + r);
    if (!yt(i) || !yt(c)) return;
    const a = Math.min(i.x, c.x), l = Math.min(i.y, c.y), u = Math.abs(c.x - i.x), f = Math.abs(c.y - i.y);
    !(u > 0) || !(f > 0) || this.svg.add(`<image x="${H(a)}" y="${H(l)}" width="${H(u)}" height="${H(f)}" preserveAspectRatio="none" xlink:href="${n}"${this.clipAttr()}/>`);
  }
  render(e, n, o) {
    return this.svg.render(e, n, o);
  }
}
function Zi(t, e) {
  const n = Math.max(e, 1);
  switch (t) {
    case Ni:
      return `${H(n * 6)} ${H(n * 3)}`;
    case Bi:
      return `${H(n)} ${H(n * 3)}`;
    case Fi:
      return `${H(n * 6)} ${H(n * 3)} ${H(n)} ${H(n * 3)}`;
    case Hi:
      return `${H(n * 6)} ${H(n * 3)} ${H(n)} ${H(n * 3)} ${H(n)} ${H(n * 3)}`;
    default:
      return "";
  }
}
const bs = {
  0: "M0 4H8",
  // HS_HORIZONTAL
  1: "M4 0V8",
  // HS_VERTICAL
  2: "M0 0L8 8",
  // HS_FDIAGONAL
  3: "M0 8L8 0",
  // HS_BDIAGONAL
  4: "M0 4H8M4 0V8",
  // HS_CROSS
  5: "M0 0L8 8M0 8L8 0"
  // HS_DIAGCROSS
};
function Ji(t, e, n, o) {
  const s = bs[e] ?? bs[0], r = o === "none" ? "" : `<rect width="8" height="8" fill="${o}"/>`;
  return `<pattern id="${t}" width="8" height="8" patternUnits="userSpaceOnUse">${r}<path d="${s}" stroke="${n}" stroke-width="1" fill="none"/></pattern>`;
}
const ws = ", 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif";
function Qi(t) {
  const e = t.trim();
  return e ? /^(symbol|wingdings|webdings)/i.test(e) ? `'${e}'` : `'${e}'${ws}` : `Arial${ws}`;
}
const ta = {
  0: "windows-1252",
  1: "windows-1252",
  2: "windows-1252",
  77: "macintosh",
  128: "shift_jis",
  129: "euc-kr",
  130: "euc-kr",
  134: "gbk",
  136: "big5",
  161: "windows-1253",
  162: "windows-1254",
  163: "windows-1258",
  177: "windows-1255",
  178: "windows-1256",
  186: "windows-1257",
  204: "windows-1251",
  222: "windows-874",
  238: "windows-1250"
};
function Ln(t, e) {
  const n = ta[e];
  if (n && typeof TextDecoder < "u")
    try {
      return new TextDecoder(n, { fatal: !1 }).decode(t).replace(/\0+$/, "");
    } catch {
    }
  let o = "";
  for (let s = 0; s < t.length && t[s] !== 0; s++)
    o += String.fromCharCode(t[s]);
  return o;
}
const vt = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function $e(t) {
  let e = "", n = 0;
  for (; n + 2 < t.length; n += 3) {
    const s = t[n] << 16 | t[n + 1] << 8 | t[n + 2];
    e += vt[s >> 18 & 63] + vt[s >> 12 & 63] + vt[s >> 6 & 63] + vt[s & 63];
  }
  const o = t.length - n;
  if (o === 1) {
    const s = t[n] << 16;
    e += vt[s >> 18 & 63] + vt[s >> 12 & 63] + "==";
  } else if (o === 2) {
    const s = t[n] << 16 | t[n + 1] << 8;
    e += vt[s >> 18 & 63] + vt[s >> 12 & 63] + vt[s >> 6 & 63] + "=";
  }
  return e;
}
let cn = null;
function ea(t) {
  if (!cn) {
    const n = new Int32Array(256);
    for (let o = 0; o < 256; o++) {
      let s = o;
      for (let r = 0; r < 8; r++) s = s & 1 ? 3988292384 ^ s >>> 1 : s >>> 1;
      n[o] = s;
    }
    cn = n;
  }
  let e = -1;
  for (let n = 0; n < t.length; n++) e = cn[(e ^ t[n]) & 255] ^ e >>> 8;
  return (e ^ -1) >>> 0;
}
function ln(t, e) {
  const n = new Uint8Array(e.length + 12), o = new DataView(n.buffer);
  o.setUint32(0, e.length);
  for (let s = 0; s < 4; s++) n[4 + s] = t.charCodeAt(s);
  return n.set(e, 8), o.setUint32(e.length + 8, ea(n.subarray(4, e.length + 8))), n;
}
function go(t, e, n) {
  const o = new Uint8Array(n * (e * 4 + 1));
  for (let f = 0; f < n; f++)
    o[f * (e * 4 + 1)] = 0, o.set(t.subarray(f * e * 4, (f + 1) * e * 4), f * (e * 4 + 1) + 1);
  const s = new Uint8Array(13), r = new DataView(s.buffer);
  r.setUint32(0, e), r.setUint32(4, n), s[8] = 8, s[9] = 6;
  const c = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    ln("IHDR", s),
    ln("IDAT", pr(o, { level: 6 })),
    ln("IEND", new Uint8Array(0))
  ];
  let a = 0;
  for (const f of c) a += f.length;
  const l = new Uint8Array(a);
  let u = 0;
  for (const f of c)
    l.set(f, u), u += f.length;
  return l;
}
const na = 8192 * 8192;
function un(t) {
  if (!t) return { shift: 0, scale: 0 };
  let e = 0, n = t;
  for (; !(n & 1); )
    n >>>= 1, e++;
  let o = 0;
  for (; n & 1; )
    n >>>= 1, o++;
  return { shift: e, scale: o > 0 ? 255 / ((1 << o) - 1) : 0 };
}
function sa(t, e, n, o, s, r) {
  if (!(o > 0) || !(s > 0)) return null;
  const i = new Uint8Array(o * s);
  let c = e;
  const a = Math.min(t.length, e + n);
  let l = 0, u = s - 1;
  const f = (h) => {
    l >= 0 && l < o && u >= 0 && u < s && (i[u * o + l] = h), l++;
  };
  for (; c + 1 < a && u >= 0; ) {
    const h = t[c++], m = t[c++];
    if (h > 0) {
      if (r) {
        const d = m >> 4 & 15, p = m & 15;
        for (let w = 0; w < h; w++) f(w % 2 === 0 ? d : p);
      } else
        for (let d = 0; d < h; d++) f(m);
      continue;
    }
    if (m === 0) {
      l = 0, u--;
      continue;
    }
    if (m === 1) break;
    if (m === 2) {
      if (c + 1 >= a) break;
      l += t[c++], u -= t[c++];
      continue;
    }
    if (r) {
      const d = m + 1 >> 1;
      if (c + d > a) break;
      for (let p = 0; p < m; p++) {
        const w = t[c + (p >> 1)];
        f(p % 2 === 0 ? w >> 4 & 15 : w & 15);
      }
      c += d + (d & 1);
    } else {
      if (c + m > a) break;
      for (let d = 0; d < m; d++) f(t[c + d]);
      c += m + (m & 1);
    }
  }
  return i;
}
function oa(t, e, n, o, s) {
  if (e < 0 || n < 12 || e + 12 > t.length) return null;
  const r = new xt(t, e, Math.min(t.length, e + Math.max(n, 12))), i = r.u32();
  let c, a, l, u = 0, f = 0, h = !1;
  if (i === 12)
    h = !0, c = r.i16(), a = r.i16(), r.u16(), l = r.u16();
  else if (i >= 16)
    c = r.i32(), a = r.i32(), r.u16(), l = r.u16(), i >= 24 && (u = r.u32(), r.u32()), i >= 36 && (r.u32(), r.u32(), f = r.u32());
  else return null;
  const m = a < 0;
  if (a = Math.abs(a), !(c > 0) || !(a > 0) || c * a > na || u === 4 || u === 5) return null;
  const d = u === 1, p = u === 2;
  if (u !== 0 && u !== 3 && !d && !p || d && l !== 8 || p && l !== 4 || ![1, 4, 8, 16, 24, 32].includes(l)) return null;
  let w = 0, b = 0, g = 0;
  if (u === 3) {
    const C = new xt(t, e + i, t.length);
    w = C.u32(), b = C.u32(), g = C.u32();
  } else l === 16 ? (w = 31744, b = 992, g = 31) : l === 32 && (w = 16711680, b = 65280, g = 255);
  let y = null;
  if (l <= 8) {
    const C = f > 0 ? Math.min(f, 1 << l) : 1 << l, R = h ? 3 : 4, z = e + i + (u === 3 ? 12 : 0);
    y = new Uint8Array(C * 3);
    const D = new xt(t, z, t.length);
    for (let I = 0; I < C; I++) {
      const O = D.u8(), _ = D.u8(), U = D.u8();
      R === 4 && D.u8(), y[I * 3] = U, y[I * 3 + 1] = _, y[I * 3 + 2] = O;
    }
  }
  const $ = c * l + 31 >> 5 << 2, x = o, M = Math.min(s > 0 ? s : t.length - x, t.length - x);
  if (x < 0 || x >= t.length) return null;
  if (d || p) {
    const C = sa(t, x, M, c, a, p);
    if (!C) return null;
    const R = new Uint8Array(c * a * 4);
    for (let z = 0; z < C.length; z++) {
      const D = C[z] * 3, I = z * 4;
      y && D + 2 < y.length && (R[I] = y[D], R[I + 1] = y[D + 1], R[I + 2] = y[D + 2]), R[I + 3] = 255;
    }
    return { w: c, h: a, rgba: R };
  }
  if (M < $) return null;
  const k = Math.min(a, Math.floor(M / $));
  if (k <= 0) return null;
  const T = new Uint8Array(c * a * 4), S = un(w), A = un(b), P = un(g);
  let L = !1;
  for (let C = 0; C < k; C++) {
    const R = m ? C : a - 1 - C;
    let z = x + C * $, D = R * c * 4;
    for (let I = 0; I < c; I++) {
      let O = 0, _ = 0, U = 0, B = 255;
      if (l === 24)
        U = t[z], _ = t[z + 1], O = t[z + 2], z += 3;
      else if (l === 32) {
        const X = t[z] | t[z + 1] << 8 | t[z + 2] << 16 | t[z + 3] << 24;
        O = S.scale ? ((X & w) >>> S.shift) * S.scale : 0, _ = A.scale ? ((X & b) >>> A.shift) * A.scale : 0, U = P.scale ? ((X & g) >>> P.shift) * P.scale : 0, B = t[z + 3], B !== 0 && (L = !0), z += 4;
      } else if (l === 16) {
        const X = t[z] | t[z + 1] << 8;
        O = ((X & w) >>> S.shift) * S.scale, _ = ((X & b) >>> A.shift) * A.scale, U = ((X & g) >>> P.shift) * P.scale, z += 2;
      } else {
        const X = I * l, Y = t[x + C * $ + (X >> 3)] ?? 0, Z = l === 8 ? Y : l === 4 ? X % 8 === 0 ? Y >> 4 : Y & 15 : Y >> 7 - (X & 7) & 1, K = Z * 3;
        y && K + 2 < y.length ? (O = y[K], _ = y[K + 1], U = y[K + 2]) : O = _ = U = Z ? 255 : 0;
      }
      T[D] = O | 0, T[D + 1] = _ | 0, T[D + 2] = U | 0, T[D + 3] = B, D += 4;
    }
  }
  if (l === 32 && !L)
    for (let C = 3; C < T.length; C += 4) T[C] = 255;
  return { w: c, h: a, rgba: T };
}
function Te(t, e, n, o, s) {
  try {
    if (e >= 0 && e + 20 <= t.length) {
      const i = new xt(t, e, t.length);
      if (i.u32() >= 24) {
        i.skip(12);
        const a = i.u32();
        if ((a === 4 || a === 5) && s > 0 && o + s <= t.length)
          return `data:${a === 4 ? "image/jpeg" : "image/png"};base64,${$e(t.subarray(o, o + s))}`;
      }
    }
    const r = oa(t, e, n, o, s);
    return r ? `data:image/png;base64,${$e(go(r.rgba, r.w, r.h))}` : null;
  } catch {
    return null;
  }
}
function bo(t, e) {
  if (e + 4 > t.length) return 0;
  const n = new xt(t, e, t.length), o = n.u32();
  if (o === 12) {
    n.skip(4);
    const c = new xt(t, e + 10, t.length).u16();
    return 12 + (c <= 8 ? (1 << c) * 3 : 0);
  }
  if (o < 16 || o > 200) return 0;
  const s = new xt(t, e + 14, t.length).u16(), r = o >= 20 ? new xt(t, e + 16, t.length).u32() : 0;
  let i = o >= 36 ? new xt(t, e + 32, t.length).u32() : 0;
  return s <= 8 ? i = i > 0 ? Math.min(i, 1 << s) : 1 << s : i = 0, o + (r === 3 ? 12 : 0) + i * 4;
}
const ra = 1179469088, ia = 1e5, F = {
  HEADER: 1,
  POLYBEZIER: 2,
  POLYGON: 3,
  POLYLINE: 4,
  POLYBEZIERTO: 5,
  POLYLINETO: 6,
  POLYPOLYLINE: 7,
  POLYPOLYGON: 8,
  SETWINDOWEXTEX: 9,
  SETWINDOWORGEX: 10,
  SETVIEWPORTEXTEX: 11,
  SETVIEWPORTORGEX: 12,
  EOF: 14,
  SETPIXELV: 15,
  SETMAPMODE: 17,
  SETBKMODE: 18,
  SETPOLYFILLMODE: 19,
  SETTEXTALIGN: 22,
  SETTEXTCOLOR: 24,
  SETBKCOLOR: 25,
  MOVETOEX: 27,
  INTERSECTCLIPRECT: 30,
  SCALEVIEWPORTEXTEX: 31,
  SCALEWINDOWEXTEX: 32,
  SAVEDC: 33,
  RESTOREDC: 34,
  SETWORLDTRANSFORM: 35,
  MODIFYWORLDTRANSFORM: 36,
  SELECTOBJECT: 37,
  CREATEPEN: 38,
  CREATEBRUSHINDIRECT: 39,
  DELETEOBJECT: 40,
  ELLIPSE: 42,
  RECTANGLE: 43,
  ROUNDRECT: 44,
  ARC: 45,
  CHORD: 46,
  PIE: 47,
  LINETO: 54,
  ARCTO: 55,
  POLYDRAW: 56,
  BEGINPATH: 59,
  ENDPATH: 60,
  CLOSEFIGURE: 61,
  FILLPATH: 62,
  STROKEANDFILLPATH: 63,
  STROKEPATH: 64,
  SELECTCLIPPATH: 67,
  ABORTPATH: 68,
  EXTSELECTCLIPRGN: 75,
  BITBLT: 76,
  STRETCHBLT: 77,
  STRETCHDIBITS: 81,
  EXTCREATEFONTINDIRECTW: 82,
  EXTTEXTOUTA: 83,
  EXTTEXTOUTW: 84,
  POLYBEZIER16: 85,
  POLYGON16: 86,
  POLYLINE16: 87,
  POLYBEZIERTO16: 88,
  POLYLINETO16: 89,
  POLYPOLYLINE16: 90,
  POLYPOLYGON16: 91,
  POLYDRAW16: 92,
  CREATEMONOBRUSH: 93,
  CREATEDIBPATTERNBRUSHPT: 94,
  EXTCREATEPEN: 95
};
function wo(t) {
  if (t.length < 88) return !1;
  const e = new DataView(t.buffer, t.byteOffset, t.byteLength);
  return e.getUint32(0, !0) === 1 && e.getUint32(40, !0) === ra;
}
function aa(t, e = {}) {
  try {
    return ca(t, e);
  } catch {
    return null;
  }
}
function ca(t, e) {
  if (!wo(t)) return null;
  const n = new xt(t, 0, t.length);
  n.skip(8);
  const o = n.rectL(), s = n.rectL();
  n.skip(16), n.skip(16);
  const r = n.i32(), i = n.i32(), c = n.i32(), a = n.i32(), l = c > 0 && r > 0 ? r / c : 96 / 25.4, u = a > 0 && i > 0 ? i / a : 96 / 25.4, f = new Vn({ pxPerMmX: l, pxPerMmY: u });
  let h = o;
  if (!(h.r > h.l) || !(h.b > h.t)) {
    const y = Math.round((s.r - s.l) * l / 100), $ = Math.round((s.b - s.t) * u / 100);
    h = { l: 0, t: 0, r: y > 0 ? y : 1024, b: $ > 0 ? $ : 768 };
  }
  h = { l: h.l, t: h.t, r: h.r + 1, b: h.b + 1 };
  const m = (s.r - s.l) * 96 / 2540, d = (s.b - s.t) * 96 / 2540, p = e.width ?? (m > 0 ? m : h.r - h.l), w = e.height ?? (d > 0 ? d : h.b - h.t);
  f.dc.mapMode = Cn;
  let b = 0, g = 0;
  for (; b + 8 <= t.length && g < ia; ) {
    const y = new DataView(t.buffer, t.byteOffset, t.byteLength), $ = y.getUint32(b, !0), x = y.getUint32(b + 4, !0);
    if (x < 8 || x % 4 !== 0 || b + x > t.length || $ === F.EOF) break;
    $ !== F.HEADER && la(f, t, $, b, x), b += x, g++;
  }
  return f.render(h, p, w);
}
function la(t, e, n, o, s) {
  const r = new xt(e, o + 8, o + s);
  switch (n) {
    case F.POLYGON:
      t.polyline(le(r), !0);
      break;
    case F.POLYLINE:
      t.polyline(le(r), !1);
      break;
    case F.POLYBEZIER:
      t.polyBezier(le(r), !1);
      break;
    case F.POLYLINETO:
      t.polylineTo(le(r));
      break;
    case F.POLYBEZIERTO:
      t.polyBezier(le(r), !0);
      break;
    case F.POLYGON16:
      t.polyline(ue(r), !0);
      break;
    case F.POLYLINE16:
      t.polyline(ue(r), !1);
      break;
    case F.POLYBEZIER16:
      t.polyBezier(ue(r), !1);
      break;
    case F.POLYLINETO16:
      t.polylineTo(ue(r));
      break;
    case F.POLYBEZIERTO16:
      t.polyBezier(ue(r), !0);
      break;
    case F.POLYPOLYGON:
      t.polyPoly(Le(r, !1), !0);
      break;
    case F.POLYPOLYLINE:
      t.polyPoly(Le(r, !1), !1);
      break;
    case F.POLYPOLYGON16:
      t.polyPoly(Le(r, !0), !0);
      break;
    case F.POLYPOLYLINE16:
      t.polyPoly(Le(r, !0), !1);
      break;
    case F.POLYDRAW:
    case F.POLYDRAW16: {
      r.skip(16);
      const i = ae(r.i32()), c = [];
      for (let l = 0; l < i; l++) c.push(n === F.POLYDRAW ? r.ptL() : r.pt16());
      const a = [];
      for (let l = 0; l < i; l++) a.push(r.u8());
      t.polyDraw(c, a);
      break;
    }
    case F.RECTANGLE:
      t.rect(r.rectL());
      break;
    case F.ELLIPSE:
      t.ellipse(r.rectL());
      break;
    case F.ROUNDRECT: {
      const i = r.rectL();
      t.roundRect(i, r.i32(), r.i32());
      break;
    }
    case F.ARC:
    case F.CHORD:
    case F.PIE:
    case F.ARCTO: {
      const i = r.rectL(), c = r.ptL(), a = r.ptL(), l = n === F.CHORD ? "chord" : n === F.PIE ? "pie" : "arc";
      t.arc(i, c.x, c.y, a.x, a.y, l, n === F.ARCTO);
      break;
    }
    case F.MOVETOEX: {
      const i = r.ptL();
      t.moveTo(i.x, i.y);
      break;
    }
    case F.LINETO: {
      const i = r.ptL();
      t.lineTo(i.x, i.y);
      break;
    }
    case F.SETPIXELV: {
      const i = r.ptL(), c = r.color();
      t.dc.brush = { kind: "brush", style: te, color: c, hatch: 0, href: null }, t.dc.pen = { ...t.dc.pen, style: At }, t.rect({ l: i.x, t: i.y, r: i.x + 1, b: i.y + 1 });
      break;
    }
    case F.BEGINPATH:
      t.beginPath();
      break;
    case F.ENDPATH:
      t.endPath();
      break;
    case F.CLOSEFIGURE:
      t.closeFigure();
      break;
    case F.FILLPATH:
      t.finishPath("fill");
      break;
    case F.STROKEPATH:
      t.finishPath("stroke");
      break;
    case F.STROKEANDFILLPATH:
      t.finishPath("both");
      break;
    case F.ABORTPATH:
      t.abortPath();
      break;
    case F.SELECTCLIPPATH:
      t.clipToPath();
      break;
    case F.CREATEPEN: {
      const i = r.i32();
      t.putObj(i, fa(r));
      break;
    }
    case F.EXTCREATEPEN: {
      const i = r.i32();
      t.putObj(i, ha(r));
      break;
    }
    case F.CREATEBRUSHINDIRECT: {
      const i = r.i32();
      t.putObj(i, da(r));
      break;
    }
    case F.CREATEMONOBRUSH:
    case F.CREATEDIBPATTERNBRUSHPT: {
      const i = r.i32();
      t.putObj(i, pa(r, e, o));
      break;
    }
    case F.EXTCREATEFONTINDIRECTW: {
      const i = r.i32();
      t.putObj(i, ma(r));
      break;
    }
    case F.SELECTOBJECT:
      t.selectIdx(r.u32());
      break;
    case F.DELETEOBJECT:
      t.delObj(r.u32());
      break;
    case F.SETWORLDTRANSFORM:
      t.dc.world = ys(r);
      break;
    case F.MODIFYWORLDTRANSFORM: {
      const i = ys(r), c = r.u32();
      c === 1 ? t.dc.world = [...ho] : c === 2 ? t.dc.world = Sn(i, t.dc.world) : c === 3 && (t.dc.world = Sn(t.dc.world, i));
      break;
    }
    case F.SETWINDOWEXTEX:
      t.dc.winExt = { x: r.i32(), y: r.i32() };
      break;
    case F.SETWINDOWORGEX:
      t.dc.winOrg = r.ptL();
      break;
    case F.SETVIEWPORTEXTEX:
      t.dc.vpExt = { x: r.i32(), y: r.i32() };
      break;
    case F.SETVIEWPORTORGEX:
      t.dc.vpOrg = r.ptL();
      break;
    case F.SETMAPMODE:
      t.dc.mapMode = r.u32();
      break;
    case F.SCALEVIEWPORTEXTEX: {
      const i = r.i32(), c = r.i32(), a = r.i32(), l = r.i32();
      c && (t.dc.vpExt.x = t.dc.vpExt.x * i / c), l && (t.dc.vpExt.y = t.dc.vpExt.y * a / l);
      break;
    }
    case F.SCALEWINDOWEXTEX: {
      const i = r.i32(), c = r.i32(), a = r.i32(), l = r.i32();
      c && (t.dc.winExt.x = t.dc.winExt.x * i / c), l && (t.dc.winExt.y = t.dc.winExt.y * a / l);
      break;
    }
    case F.SAVEDC:
      t.save();
      break;
    case F.RESTOREDC:
      t.restore(r.i32());
      break;
    case F.SETBKMODE:
      t.dc.bkMode = r.u32();
      break;
    case F.SETPOLYFILLMODE:
      t.dc.polyFill = r.u32();
      break;
    case F.SETTEXTALIGN:
      t.dc.textAlign = r.u32();
      break;
    case F.SETTEXTCOLOR:
      t.dc.textColor = r.color();
      break;
    case F.SETBKCOLOR:
      t.dc.bkColor = r.color();
      break;
    case F.INTERSECTCLIPRECT:
      t.intersectClip(r.rectL());
      break;
    case F.EXTSELECTCLIPRGN:
      ga(t, r);
      break;
    case F.EXTTEXTOUTW:
    case F.EXTTEXTOUTA:
      ba(t, r, e, o, s, n === F.EXTTEXTOUTW);
      break;
    case F.STRETCHDIBITS:
      wa(t, r, e, o);
      break;
    case F.BITBLT:
    case F.STRETCHBLT:
      ya(t, r, e, o, n === F.STRETCHBLT);
      break;
  }
}
const ua = 1 << 20, ae = (t) => t > 0 && t < ua ? t | 0 : 0;
function le(t) {
  t.skip(16);
  const e = Math.min(ae(t.i32()), t.left >> 3), n = [];
  for (let o = 0; o < e; o++) n.push(t.ptL());
  return n;
}
function ue(t) {
  t.skip(16);
  const e = Math.min(ae(t.i32()), t.left >> 2), n = [];
  for (let o = 0; o < e; o++) n.push(t.pt16());
  return n;
}
function Le(t, e) {
  t.skip(16);
  const n = ae(t.i32()), o = ae(t.i32());
  if (!n || !o || n > o) return [];
  const s = [];
  let r = 0;
  for (let l = 0; l < n; l++) {
    const u = ae(t.i32());
    s.push(u), r += u;
  }
  if (r > o) return [];
  const i = e ? t.left >> 2 : t.left >> 3, c = [];
  let a = 0;
  for (const l of s) {
    const u = [];
    for (let f = 0; f < l && a < i; f++, a++) u.push(e ? t.pt16() : t.ptL());
    c.push(u);
  }
  return c;
}
function fa(t) {
  const e = t.u32(), n = t.i32();
  return t.i32(), {
    kind: "pen",
    style: e & 15,
    width: Math.abs(n) || 1,
    color: t.color(),
    cap: 0,
    join: 0
  };
}
function ha(t) {
  t.skip(16);
  const e = t.u32(), n = t.u32(), o = t.u32(), s = t.color();
  return {
    kind: "pen",
    style: o === ke ? At : e & 15,
    width: Math.max(n || 1, 1),
    color: s,
    cap: e & 3840,
    join: e & 61440
  };
}
function da(t) {
  const e = t.u32(), n = t.color(), o = t.u32();
  return { kind: "brush", style: e, color: n, hatch: o, href: null };
}
function pa(t, e, n) {
  t.u32();
  const o = t.u32(), s = t.u32(), r = t.u32(), i = t.u32(), c = s > 0 ? Te(e, n + o, s, n + r, i) : null;
  return { kind: "brush", style: c ? 5 : te, color: "#808080", hatch: 0, href: c };
}
function ma(t) {
  const e = t.i32();
  t.i32();
  const n = t.i32();
  t.i32();
  const o = t.i32(), s = t.u8() !== 0, r = t.u8() !== 0, i = t.u8() !== 0, c = t.u8();
  t.skip(4);
  const a = t.utf16(64), l = Se();
  return {
    kind: "font",
    height: e || l.height,
    escapement: n,
    weight: o > 0 ? o : 400,
    italic: s,
    underline: r,
    strike: i,
    charset: c,
    face: a || l.face
  };
}
function ys(t) {
  return [t.f32(), t.f32(), t.f32(), t.f32(), t.f32(), t.f32()];
}
function ga(t, e) {
  const n = e.u32(), o = e.u32();
  if (n === 0) {
    o === hs && t.clearClip();
    return;
  }
  e.u32();
  const s = e.u32(), r = e.u32();
  if (e.u32(), e.rectL(), s !== Ui || r <= 0 || r > 65536) return;
  const i = [];
  for (let c = 0; c < r; c++) i.push(e.rectL());
  o === hs ? t.setClipRects(i, !1) : o === Di && t.setClipRects(i, !0);
}
function ba(t, e, n, o, s, r) {
  e.skip(16), e.u32();
  const i = e.f32();
  e.f32();
  const c = e.ptL(), a = e.u32(), l = e.u32(), u = e.u32(), f = e.rectL(), h = e.u32();
  if (!a || a > 65536) return;
  const m = o + l, d = r ? a * 2 : a;
  if (l < 8 || m + d > o + s) return;
  const p = r ? new xt(n, m, m + d).utf16(d) : Ln(n.subarray(m, m + d), t.dc.font.charset);
  if (!p) return;
  let w = null;
  const b = o + h;
  if (h >= 8 && b + a * 4 <= o + s) {
    const y = new xt(n, b, b + a * 4);
    w = [];
    for (let $ = 0; $ < a; $++) w.push(y.i32());
    i > 0 && i !== 1 && Number.isFinite(i) && (w = w.map(($) => $ * i));
  }
  const g = u & 2 ? f : null;
  t.text(c.x, c.y, p, w, g);
}
function wa(t, e, n, o) {
  e.skip(16);
  const s = e.i32(), r = e.i32();
  e.i32(), e.i32(), e.i32(), e.i32();
  const i = e.u32(), c = e.u32(), a = e.u32(), l = e.u32();
  e.u32(), e.u32();
  const u = e.i32(), f = e.i32();
  if (!c || !l) return;
  const h = Te(n, o + i, c, o + a, l);
  h && t.image({ l: s, t: r, r: s + u, b: r + f }, h);
}
function ya(t, e, n, o, s) {
  e.skip(16);
  const r = e.i32(), i = e.i32(), c = e.i32(), a = e.i32();
  e.u32(), e.i32(), e.i32(), e.skip(24), e.u32(), e.u32();
  const l = e.u32(), u = e.u32(), f = e.u32(), h = e.u32();
  if (s && (e.i32(), e.i32()), !u || !h) return;
  const m = Te(n, o + l, u, o + f, h);
  m && t.image({ l: r, t: i, r: r + c, b: i + a }, m);
}
const yo = 2596720087, xa = 1e5, j = {
  EOF: 0,
  SAVEDC: 30,
  SETBKMODE: 258,
  SETMAPMODE: 259,
  SETPOLYFILLMODE: 262,
  RESTOREDC: 295,
  SELECTOBJECT: 301,
  SETTEXTALIGN: 302,
  DELETEOBJECT: 496,
  SETBKCOLOR: 513,
  SETTEXTCOLOR: 521,
  SETWINDOWORG: 523,
  SETWINDOWEXT: 524,
  SETVIEWPORTORG: 525,
  SETVIEWPORTEXT: 526,
  OFFSETWINDOWORG: 527,
  OFFSETVIEWPORTORG: 529,
  LINETO: 531,
  MOVETO: 532,
  CREATEPENINDIRECT: 762,
  CREATEFONTINDIRECT: 763,
  CREATEBRUSHINDIRECT: 764,
  POLYGON: 804,
  POLYLINE: 805,
  SCALEWINDOWEXT: 1040,
  SCALEVIEWPORTEXT: 1042,
  INTERSECTCLIPRECT: 1046,
  ELLIPSE: 1048,
  ARC: 2071,
  RECTANGLE: 1051,
  SETPIXEL: 1055,
  TEXTOUT: 1313,
  POLYPOLYGON: 1336,
  ROUNDRECT: 1564,
  PATBLT: 1565,
  PIE: 2074,
  CHORD: 2096,
  EXTTEXTOUT: 2610,
  DIBBITBLT: 2368,
  DIBSTRETCHBLT: 2881,
  STRETCHDIB: 3907,
  // 需要占用对象表槽位、但暂不实现的创建类记录
  CREATEPALETTE: 247,
  CREATEBRUSH: 248,
  CREATEPATTERNBRUSH: 505,
  DIBCREATEPATTERNBRUSH: 322,
  CREATEREGION: 1791,
  CREATEBITMAP: 1790,
  CREATEBITMAPINDIRECT: 765
};
function xo(t) {
  if (t.length < 20) return !1;
  const e = new DataView(t.buffer, t.byteOffset, t.byteLength);
  if (e.getUint32(0, !0) === yo) return !0;
  const n = e.getUint16(0, !0), o = e.getUint16(2, !0), s = e.getUint16(4, !0);
  return (n === 1 || n === 2) && o === 9 && (s === 256 || s === 768);
}
function $a(t, e = {}) {
  try {
    return Ma(t, e);
  } catch {
    return null;
  }
}
function Ma(t, e) {
  if (!xo(t)) return null;
  const n = new DataView(t.buffer, t.byteOffset, t.byteLength);
  let o = 0, s = null, r = 1440;
  if (n.getUint32(0, !0) === yo && (s = {
    l: n.getInt16(6, !0),
    t: n.getInt16(8, !0),
    r: n.getInt16(10, !0),
    b: n.getInt16(12, !0)
  }, r = n.getUint16(14, !0) || 1440, o = 22), o + 18 > t.length) return null;
  o += 18, (!s || !(s.r > s.l) || !(s.b > s.t)) && (s = Ea(t, n, o), r = 96);
  const i = s.r - s.l, c = s.b - s.t, a = r / 25.4, l = new Vn({ pxPerMmX: a, pxPerMmY: a });
  l.dc.mapMode = Gi, l.dc.winOrg = { x: s.l, y: s.t }, l.dc.winExt = { x: i, y: c }, l.dc.vpOrg = { x: s.l, y: s.t }, l.dc.vpExt = { x: i, y: c };
  const u = e.width ?? i / r * 96, f = e.height ?? c / r * 96;
  let h = 0;
  for (; o + 6 <= t.length && h < xa; ) {
    const m = n.getUint32(o, !0), d = n.getUint16(o + 4, !0);
    if (m < 3) break;
    const p = m * 2;
    if (o + p > t.length || d === j.EOF) break;
    ka(l, t, d, o, p), o += p, h++;
  }
  return l.render({ l: s.l, t: s.t, r: s.r, b: s.b }, u, f);
}
function Ea(t, e, n) {
  let o = { x: 0, y: 0 }, s = null, r = n, i = 0;
  for (; r + 6 <= t.length && i < 2e3; ) {
    const l = e.getUint32(r, !0), u = e.getUint16(r + 4, !0);
    if (l < 3 || r + l * 2 > t.length || u === j.EOF) break;
    u === j.SETWINDOWORG && l >= 5 && (o = { x: e.getInt16(r + 8, !0), y: e.getInt16(r + 6, !0) }), u === j.SETWINDOWEXT && l >= 5 && !s && (s = { x: e.getInt16(r + 8, !0), y: e.getInt16(r + 6, !0) }), r += l * 2, i++;
  }
  const c = s ? Math.abs(s.x) : 0, a = s ? Math.abs(s.y) : 0;
  return { l: o.x, t: o.y, r: o.x + (c || 1024), b: o.y + (a || 768) };
}
function ka(t, e, n, o, s) {
  const r = o + s, i = new xt(e, o + 6, r);
  switch (n) {
    case j.POLYGON:
      t.polyline(xs(i), !0);
      break;
    case j.POLYLINE:
      t.polyline(xs(i), !1);
      break;
    case j.POLYPOLYGON: {
      const c = i.u16();
      if (!c || c > 16384) break;
      const a = [];
      for (let u = 0; u < c; u++) a.push(i.u16());
      const l = [];
      for (const u of a) {
        const f = [];
        for (let h = 0; h < u && i.has(4); h++) f.push(i.pt16());
        l.push(f);
      }
      t.polyPoly(l, !0);
      break;
    }
    case j.RECTANGLE:
      t.rect(fe(i));
      break;
    case j.ELLIPSE:
      t.ellipse(fe(i));
      break;
    case j.ROUNDRECT: {
      const c = i.i16(), a = i.i16();
      t.roundRect(fe(i), a, c);
      break;
    }
    case j.ARC:
    case j.CHORD:
    case j.PIE: {
      const c = i.i16(), a = i.i16(), l = i.i16(), u = i.i16(), f = fe(i);
      t.arc(f, u, l, a, c, n === j.CHORD ? "chord" : n === j.PIE ? "pie" : "arc");
      break;
    }
    case j.MOVETO: {
      const c = i.i16(), a = i.i16();
      t.moveTo(a, c);
      break;
    }
    case j.LINETO: {
      const c = i.i16(), a = i.i16();
      t.lineTo(a, c);
      break;
    }
    case j.SETPIXEL: {
      const c = i.color(), a = i.i16(), l = i.i16();
      t.dc.brush = { kind: "brush", style: te, color: c, hatch: 0, href: null }, t.dc.pen = { ...t.dc.pen, style: At }, t.rect({ l, t: a, r: l + 1, b: a + 1 });
      break;
    }
    case j.PATBLT: {
      i.u32();
      const c = i.i16(), a = i.i16(), l = i.i16(), u = i.i16();
      t.dc.pen = { ...t.dc.pen, style: At }, t.rect({ l: u, t: l, r: u + a, b: l + c });
      break;
    }
    case j.CREATEPENINDIRECT:
      t.addObj(Ta(i));
      break;
    case j.CREATEBRUSHINDIRECT:
      t.addObj(Ca(i));
      break;
    case j.CREATEFONTINDIRECT:
      t.addObj(La(i));
      break;
    case j.SELECTOBJECT:
      t.selectIdx(i.u16());
      break;
    case j.DELETEOBJECT:
      t.delObj(i.u16());
      break;
    case j.CREATEPALETTE:
    case j.CREATEBRUSH:
    case j.CREATEREGION:
    case j.CREATEBITMAP:
    case j.CREATEBITMAPINDIRECT:
      t.addObj({ kind: "brush", style: ke, color: "#000000", hatch: 0, href: null });
      break;
    case j.CREATEPATTERNBRUSH:
    case j.DIBCREATEPATTERNBRUSH:
      t.addObj(Aa(e, o, s, n));
      break;
    case j.SETWINDOWORG: {
      const c = i.i16(), a = i.i16();
      t.dc.winOrg = { x: a, y: c };
      break;
    }
    case j.SETWINDOWEXT: {
      const c = i.i16(), a = i.i16();
      t.dc.winExt = { x: a, y: c };
      break;
    }
    case j.SETVIEWPORTORG: {
      const c = i.i16(), a = i.i16();
      t.dc.vpOrg = { x: a, y: c };
      break;
    }
    case j.SETVIEWPORTEXT: {
      const c = i.i16(), a = i.i16();
      t.dc.vpExt = { x: a, y: c };
      break;
    }
    case j.OFFSETWINDOWORG: {
      const c = i.i16(), a = i.i16();
      t.dc.winOrg = { x: t.dc.winOrg.x + a, y: t.dc.winOrg.y + c };
      break;
    }
    case j.OFFSETVIEWPORTORG: {
      const c = i.i16(), a = i.i16();
      t.dc.vpOrg = { x: t.dc.vpOrg.x + a, y: t.dc.vpOrg.y + c };
      break;
    }
    case j.SCALEWINDOWEXT: {
      const c = i.i16(), a = i.i16(), l = i.i16(), u = i.i16();
      l && (t.dc.winExt.x = t.dc.winExt.x * u / l), c && (t.dc.winExt.y = t.dc.winExt.y * a / c);
      break;
    }
    case j.SCALEVIEWPORTEXT: {
      const c = i.i16(), a = i.i16(), l = i.i16(), u = i.i16();
      l && (t.dc.vpExt.x = t.dc.vpExt.x * u / l), c && (t.dc.vpExt.y = t.dc.vpExt.y * a / c);
      break;
    }
    case j.SETMAPMODE:
      t.dc.mapMode = i.u16();
      break;
    case j.SAVEDC:
      t.save();
      break;
    case j.RESTOREDC:
      t.restore(i.i16());
      break;
    case j.SETBKMODE:
      t.dc.bkMode = i.u16();
      break;
    case j.SETBKCOLOR:
      t.dc.bkColor = i.color();
      break;
    case j.SETTEXTCOLOR:
      t.dc.textColor = i.color();
      break;
    case j.SETTEXTALIGN:
      t.dc.textAlign = i.u16();
      break;
    case j.SETPOLYFILLMODE:
      t.dc.polyFill = i.u16();
      break;
    case j.INTERSECTCLIPRECT:
      t.intersectClip(fe(i));
      break;
    case j.TEXTOUT: {
      const c = i.u16();
      if (c > 32768) break;
      const a = i.p, l = c + (c & 1);
      i.skip(l);
      const u = i.i16(), f = i.i16(), h = Ln(e.subarray(a, Math.min(a + c, r)), t.dc.font.charset);
      t.text(f, u, h, null, null);
      break;
    }
    case j.EXTTEXTOUT: {
      const c = i.i16(), a = i.i16(), l = i.u16(), u = i.u16();
      if (l > 32768) break;
      let f = null;
      if (u & 6) {
        const w = i.i16(), b = i.i16(), g = i.i16(), y = i.i16();
        f = { l: w, t: b, r: g, b: y };
      }
      const h = i.p, m = l + (l & 1);
      i.skip(m);
      let d = null;
      if (i.left >= l * 2 && l > 0) {
        d = [];
        for (let w = 0; w < l; w++) d.push(i.i16());
      }
      const p = Ln(e.subarray(h, Math.min(h + l, r)), t.dc.font.charset);
      t.text(a, c, p, d, u & 2 ? f : null);
      break;
    }
    case j.STRETCHDIB: {
      i.u32(), i.u16(), i.i16(), i.i16(), i.i16(), i.i16();
      const c = i.i16(), a = i.i16(), l = i.i16(), u = i.i16();
      fn(t, e, i.p, r, u, l, a, c);
      break;
    }
    case j.DIBSTRETCHBLT: {
      const c = s === 28;
      if (i.u32(), i.i16(), i.i16(), i.i16(), i.i16(), c) break;
      const a = i.i16(), l = i.i16(), u = i.i16(), f = i.i16();
      fn(t, e, i.p, r, f, u, l, a);
      break;
    }
    case j.DIBBITBLT: {
      const c = s === 24;
      if (i.u32(), i.i16(), i.i16(), c) break;
      const a = i.i16(), l = i.i16(), u = i.i16(), f = i.i16();
      fn(t, e, i.p, r, f, u, l, a);
      break;
    }
  }
}
function fn(t, e, n, o, s, r, i, c) {
  if (n >= o || i === 0 || c === 0) return;
  const a = bo(e, n);
  if (!a) return;
  const l = Te(e, n, a, n + a, o - n - a);
  l && t.image({ l: s, t: r, r: s + i, b: r + c }, l);
}
const Sa = 1 << 18;
function xs(t) {
  const e = t.u16();
  if (!e || e > Sa) return [];
  const n = Math.min(e, t.left >> 2), o = [];
  for (let s = 0; s < n; s++) o.push(t.pt16());
  return o;
}
function fe(t) {
  const e = t.i16(), n = t.i16(), o = t.i16();
  return { l: t.i16(), t: o, r: n, b: e };
}
function Ta(t) {
  const e = t.u16(), n = t.i16();
  return t.i16(), {
    kind: "pen",
    style: e & 15,
    width: Math.abs(n) || 1,
    color: t.color(),
    cap: e & 3840,
    join: e & 61440
  };
}
function Ca(t) {
  const e = t.u16(), n = t.color(), o = t.u16();
  return { kind: "brush", style: e, color: n, hatch: o, href: null };
}
function La(t) {
  const e = t.i16();
  t.i16();
  const n = t.i16();
  t.i16();
  const o = t.i16(), s = t.u8() !== 0, r = t.u8() !== 0, i = t.u8() !== 0, c = t.u8();
  t.skip(4);
  const a = t.ansi(Math.min(32, t.left)), l = Se();
  return {
    kind: "font",
    height: e || l.height,
    escapement: n,
    weight: o > 0 ? o : 400,
    italic: s,
    underline: r,
    strike: i,
    charset: c,
    face: a || l.face
  };
}
function Aa(t, e, n, o) {
  const s = { kind: "brush", style: te, color: "#808080", hatch: 0, href: null };
  if (o !== j.DIBCREATEPATTERNBRUSH) return s;
  const r = e + 6 + 4, i = e + n, c = bo(t, r);
  if (!c || r + c >= i) return s;
  const a = Te(t, r, c, r + c, i - r - c);
  return a ? { kind: "brush", style: 5, color: "#808080", hatch: 0, href: a } : s;
}
const $s = 2e5, Ms = 0, Pa = 1, Ia = 2, Oa = 3, hn = 4, va = {
  0: 0,
  2: 8,
  3: 2,
  4: 2,
  5: 2,
  6: 4,
  7: 4,
  8: 2,
  9: 8,
  10: 8,
  11: 4,
  12: 4,
  13: 2,
  14: 4,
  15: 4,
  16: 8,
  21: 2,
  22: 2,
  23: 0,
  24: 0,
  25: 0,
  26: 6,
  27: 6,
  28: 0,
  29: 6,
  30: 0,
  31: 6,
  35: 2,
  45: 6,
  46: 0,
  47: 0,
  61: 0,
  62: 0,
  63: 0,
  77: 0,
  78: 0,
  79: 0,
  93: 0,
  94: 0,
  95: 0,
  109: 12,
  110: 12,
  111: 12,
  125: 0,
  126: 0,
  127: 0,
  141: 0,
  142: 0,
  143: 0
};
function za(t) {
  return $o(t) !== null;
}
function $o(t) {
  if (!t || t.length < 16) return null;
  for (const e of [512, 0]) {
    if (e + 12 > t.length) continue;
    const n = new DataView(t.buffer, t.byteOffset + e, t.length - e), o = n.getInt16(2, !1), s = n.getInt16(4, !1), r = n.getInt16(6, !1), i = n.getInt16(8, !1);
    if (!(i > s) || !(r > o)) continue;
    const c = n.getUint16(10, !1);
    if (c === 17 && n.getUint16(12, !1) === 767)
      return { off: e + 14, v2: !0, bounds: { l: s, t: o, r: i, b: r } };
    if (c >> 8 === 17 && (c & 255) === 1)
      return { off: e + 12, v2: !1, bounds: { l: s, t: o, r: i, b: r } };
  }
  return null;
}
function Ra(t, e = {}) {
  try {
    return Ua(t, e);
  } catch {
    return null;
  }
}
function Da() {
  return {
    fg: "#000000",
    bg: "#ffffff",
    penW: 1,
    penH: 1,
    penSolid: !0,
    fillSolid: !0,
    fillColor: "#000000",
    txFont: 0,
    txSize: 12,
    txFace: 0,
    ovalW: 0,
    ovalH: 0,
    origin: { x: 0, y: 0 }
  };
}
function Ua(t, e) {
  const n = $o(t);
  if (!n) return null;
  const { bounds: o, v2: s } = n, r = o.r - o.l, i = o.b - o.t, c = new Vn({ pxPerMmX: 72 / 25.4, pxPerMmY: 72 / 25.4 }), a = new xt(t, n.off, t.length), l = Da(), u = () => ({
    kind: "pen",
    style: l.penSolid && l.penW > 0 ? po : At,
    width: Math.max(l.penW, l.penH),
    color: l.fg,
    cap: 0,
    join: 0
  }), f = (P, L) => ({ kind: "brush", style: L ? te : ke, color: P, hatch: 0, href: null }), h = (P) => {
    switch (P) {
      case Ms:
        return c.select(u()), c.select(f("#000000", !1)), !0;
      case Pa:
      case hn:
        return c.select({ ...u(), style: At }), c.select(f(P === hn ? l.fillColor : l.fg, P === hn ? l.fillSolid : l.penSolid)), !0;
      case Ia:
        return c.select({ ...u(), style: At }), c.select(f(l.bg, !0)), !0;
      case Oa:
        return c.select({ ...u(), style: At }), c.select(f(l.fg, !0)), !0;
      default:
        return !1;
    }
  }, m = () => {
    const P = a.i16be(), L = a.i16be(), C = a.i16be(), R = a.i16be();
    return { l: L, t: P, r: R, b: C };
  }, d = () => {
    const P = a.i16be();
    return { x: a.i16be(), y: P };
  }, p = () => {
    const P = a.u16be(), L = a.u16be(), C = a.u16be();
    return Tn(P >> 8, L >> 8, C >> 8);
  }, w = () => {
    const P = a.u16be();
    if (P < 10)
      return a.skip(Math.max(0, P - 2)), null;
    const L = m();
    return a.skip(P - 10), L;
  };
  let b = { l: 0, t: 0, r: 0, b: 0 }, g = { l: 0, t: 0, r: 0, b: 0 }, y = { l: 0, t: 0, r: 0, b: 0 }, $ = [], x = null, M = { x: 0, y: 0 }, k = !1;
  const T = (P, L) => {
    if (h(L)) {
      switch (P) {
        case "rect":
          c.rect(b);
          break;
        case "rrect":
          c.roundRect(y, l.ovalW, l.ovalH);
          break;
        case "oval":
          c.ellipse(g);
          break;
        case "poly":
          $.length > 1 && c.polyline($, !0);
          break;
        case "arc": {
          if (!x) return;
          const { rect: C, start: R, ext: z } = x, D = (C.l + C.r) / 2, I = (C.t + C.b) / 2, O = (C.r - C.l) / 2, _ = (C.b - C.t) / 2, U = (Y) => {
            const Z = (90 - Y) * Math.PI / 180;
            return { x: D + O * Math.cos(Z), y: I - _ * Math.sin(Z) };
          }, B = U(R), X = U(R + z);
          c.arc(C, B.x, B.y, X.x, X.y, L === Ms ? "arc" : "pie");
          break;
        }
      }
      k = !0;
    }
  }, S = (P, L, C) => {
    if (!C) return;
    const R = { ...Se(), height: -Math.max(l.txSize, 1), weight: l.txFace & 1 ? 700 : 400, italic: !!(l.txFace & 2) };
    c.select(R), c.dc.textAlign = 24, c.dc.textColor = l.fg, c.text(P, L, C, null, null), k = !0;
  };
  let A = 0;
  for (; a.has(s ? 2 : 1) && A++ < $s && (s && (a.pos - n.off) % 2 === 1 && a.skip(1), !!a.has(s ? 2 : 1)); ) {
    const P = s ? a.u16be() : a.u8();
    if (P === 255) break;
    switch (P) {
      case 1: {
        const L = w();
        L && c.intersectClip(L);
        break;
      }
      case 7: {
        const L = d();
        l.penW = Math.abs(L.x), l.penH = Math.abs(L.y);
        break;
      }
      case 9:
      case 10: {
        const C = [a.u8(), a.u8(), a.u8(), a.u8(), a.u8(), a.u8(), a.u8(), a.u8()].some((R) => R !== 0);
        P === 9 ? l.penSolid = C : (l.fillSolid = C, l.fillColor = l.fg);
        break;
      }
      case 11: {
        const L = d();
        l.ovalW = Math.abs(L.x), l.ovalH = Math.abs(L.y);
        break;
      }
      case 12: {
        const L = d();
        l.origin = L;
        break;
      }
      case 13:
        l.txSize = a.u16be();
        break;
      case 3:
        l.txFont = a.u16be();
        break;
      case 4:
        l.txFace = a.u8(), a.skip(1);
        break;
      case 14:
      case 15: {
        const L = a.u32be(), C = L === 0 ? "#000000" : L === 30 ? "#ffffff" : Tn(L >> 16 & 255, L >> 8 & 255, L & 255);
        P === 14 ? l.fg = C : l.bg = C;
        break;
      }
      case 26:
        l.fg = p();
        break;
      case 27:
        l.bg = p();
        break;
      case 32: {
        const L = d(), C = d();
        c.select(u()), c.moveTo(L.x, L.y), c.lineTo(C.x, C.y), M = C, k = !0;
        break;
      }
      case 33: {
        const L = d();
        c.select(u()), c.moveTo(M.x, M.y), c.lineTo(L.x, L.y), M = L, k = !0;
        break;
      }
      case 34: {
        const L = d(), C = a.i8(), R = a.i8();
        c.select(u()), c.moveTo(L.x, L.y), c.lineTo(L.x + C, L.y + R), M = { x: L.x + C, y: L.y + R }, k = !0;
        break;
      }
      case 35: {
        const L = a.i8(), C = a.i8();
        c.select(u()), c.moveTo(M.x, M.y), c.lineTo(M.x + L, M.y + C), M = { x: M.x + L, y: M.y + C }, k = !0;
        break;
      }
      case 40: {
        const L = d();
        S(L.x, L.y, a.ansi(a.u8())), M = L;
        break;
      }
      case 41: {
        const L = a.u8(), C = a.ansi(a.u8());
        M = { x: M.x + L, y: M.y }, S(M.x, M.y, C);
        break;
      }
      case 42: {
        const L = a.u8(), C = a.ansi(a.u8());
        M = { x: M.x, y: M.y + L }, S(M.x, M.y, C);
        break;
      }
      case 43: {
        const L = a.u8(), C = a.u8(), R = a.ansi(a.u8());
        M = { x: M.x + L, y: M.y + C }, S(M.x, M.y, R);
        break;
      }
      case 44: {
        const L = a.u16be();
        a.skip(Math.max(0, L));
        break;
      }
      case 48:
      case 49:
      case 50:
      case 51:
      case 52:
        b = m(), T("rect", P & 7);
        break;
      case 56:
      case 57:
      case 58:
      case 59:
      case 60:
        T("rect", P & 7);
        break;
      case 64:
      case 65:
      case 66:
      case 67:
      case 68:
        y = m(), T("rrect", P & 7);
        break;
      case 72:
      case 73:
      case 74:
      case 75:
      case 76:
        T("rrect", P & 7);
        break;
      case 80:
      case 81:
      case 82:
      case 83:
      case 84:
        g = m(), T("oval", P & 7);
        break;
      case 88:
      case 89:
      case 90:
      case 91:
      case 92:
        T("oval", P & 7);
        break;
      case 96:
      case 97:
      case 98:
      case 99:
      case 100: {
        const L = m(), C = a.i16be(), R = a.i16be();
        x = { rect: L, start: C, ext: R }, T("arc", P & 7);
        break;
      }
      case 104:
      case 105:
      case 106:
      case 107:
      case 108: {
        const L = a.i16be(), C = a.i16be();
        x && (x = { rect: x.rect, start: L, ext: C }), T("arc", P & 7);
        break;
      }
      case 112:
      case 113:
      case 114:
      case 115:
      case 116: {
        const L = a.u16be(), C = a.pos + L - 2;
        m();
        const R = [];
        for (; a.pos + 4 <= C; ) R.push(d());
        a.seek(C), $ = R, T("poly", P & 7);
        break;
      }
      case 120:
      case 121:
      case 122:
      case 123:
      case 124:
        T("poly", P & 7);
        break;
      case 128:
      case 129:
      case 130:
      case 131:
      case 132: {
        const L = w();
        L && (b = L, T("rect", P & 7));
        break;
      }
      case 136:
      case 137:
      case 138:
      case 139:
      case 140:
        T("rect", P & 7);
        break;
      case 144:
      case 145:
      case 152:
      case 153:
      case 154:
      case 155: {
        if (!Fa(a, P, c)) return null;
        k = !0;
        break;
      }
      case 160:
        a.skip(2);
        break;
      case 161: {
        a.skip(2);
        const L = a.u16be();
        a.skip(L);
        break;
      }
      case 3072:
        a.skip(24);
        break;
      case 33280:
      case 33281: {
        const L = a.u32be(), C = a.pos + L, R = Ba(a, C);
        R && (c.image(o, R), k = !0), a.seek(Math.min(C, t.length));
        break;
      }
      default: {
        const L = va[P];
        if (L !== void 0) {
          a.skip(L);
          break;
        }
        const C = Na(P, a);
        if (C < 0) {
          A = $s;
          break;
        }
        a.skip(C);
      }
    }
  }
  return k ? c.render(o, e.width ?? r, e.height ?? i) : null;
}
function Na(t, e) {
  return t >= 256 && t <= 32767 ? (t >> 8 & 255) * 2 : t >= 32768 && t <= 33023 ? 0 : t >= 33024 && e.has(4) ? e.u32be() : -1;
}
function Ba(t, e) {
  const n = t.pos, o = t.take(Math.max(0, Math.min(e, t.limit) - n));
  t.seek(n);
  for (let s = 0; s + 3 < o.length; s++) {
    if (o[s] === 255 && o[s + 1] === 216 && o[s + 2] === 255)
      return `data:image/jpeg;base64,${$e(o.subarray(s))}`;
    if (o[s] === 137 && o[s + 1] === 80 && o[s + 2] === 78 && o[s + 3] === 71)
      return `data:image/png;base64,${$e(o.subarray(s))}`;
  }
  return null;
}
function Fa(t, e, n) {
  const o = e === 154 || e === 155, s = e === 145 || e === 153 || e === 155;
  o && t.skip(4);
  const r = t.u16be() & 32767, i = t.i16be(), c = t.i16be(), a = t.i16be(), u = t.i16be() - c, f = a - i;
  if (u <= 0 || f <= 0 || u > 2e4 || f > 2e4) return !1;
  const h = r >= 8;
  let m = 1, d = 1, p = [];
  if (o || (r & 32768) !== 0 || e === 152 || e === 153) {
    if (t.skip(2), t.u16be(), t.skip(4), t.skip(8), t.skip(2), m = t.u16be(), d = t.u16be(), t.u16be(), t.skip(4), t.skip(8), !o) {
      t.skip(4), t.skip(2);
      const k = t.u16be() + 1;
      if (k > 0 && k <= 256) {
        p = new Array(k);
        for (let T = 0; T < k; T++)
          t.skip(2), p[T] = [t.u16be() >> 8, t.u16be() >> 8, t.u16be() >> 8];
      }
    }
  } else
    m = 1;
  t.i16be(), t.i16be(), t.i16be(), t.i16be();
  const b = { t: t.i16be(), l: t.i16be(), b: t.i16be(), r: t.i16be() };
  if (t.skip(2), s) {
    const k = t.u16be();
    t.skip(Math.max(0, k - 2));
  }
  const g = r;
  if (g * f > 64 * 1024 * 1024) return !1;
  const y = new Uint8Array(g * f).fill(255);
  let $ = 0;
  for (let k = 0; k < f; k++) {
    if (!h) {
      if (!t.has(g)) break;
      y.set(t.take(g), k * g), $++;
      continue;
    }
    const T = r > 250 ? t.u16be() : t.u8();
    if (T <= 0 || !t.has(T)) break;
    Ha(t.take(T), y, k * g, g), $++;
  }
  if (!$) return !1;
  const x = new Uint8Array(u * f * 4);
  for (let k = 0; k < f; k++)
    for (let T = 0; T < u; T++) {
      let S = 0, A = 0, P = 0;
      if (o && m === 32) {
        const C = k * g, R = d === 3 ? 0 : u;
        S = y[C + R + T], A = y[C + R + u + T], P = y[C + R + u * 2 + T];
      } else if (o && m === 16) {
        const C = y[k * g + T * 2] << 8 | y[k * g + T * 2 + 1];
        S = (C >> 10 & 31) * 8, A = (C >> 5 & 31) * 8, P = (C & 31) * 8;
      } else if (m === 8) {
        const C = y[k * g + T];
        [S, A, P] = p[C] ?? [C, C, C];
      } else if (m === 4) {
        const C = y[k * g + (T >> 1)], R = T & 1 ? C & 15 : C >> 4;
        [S, A, P] = p[R] ?? [0, 0, 0];
      } else {
        const R = y[k * g + (T >> 3)] >> 7 - (T & 7) & 1;
        [S, A, P] = p[R] ?? (R ? [0, 0, 0] : [255, 255, 255]);
      }
      const L = (k * u + T) * 4;
      x[L] = S, x[L + 1] = A, x[L + 2] = P, x[L + 3] = 255;
    }
  const M = `data:image/png;base64,${$e(go(x, u, f))}`;
  return n.image({ l: b.l, t: b.t, r: b.r, b: b.b }, M), !0;
}
function Ha(t, e, n, o) {
  let s = 0, r = n;
  const i = n + o;
  for (; s < t.length && r < i; ) {
    const c = t[s++] << 24 >> 24;
    if (c >= 0) {
      const a = Math.min(c + 1, i - r, t.length - s);
      e.set(t.subarray(s, s + a), r), s += a, r += a;
    } else {
      if (s >= t.length) break;
      const a = Math.min(1 - c, i - r);
      e.fill(t[s++], r, r + a), r += a;
    }
  }
}
function _a(t) {
  return !t || t.length < 20 ? null : wo(t) ? "emf" : xo(t) ? "wmf" : za(t) ? "pict" : null;
}
function ja(t, e) {
  try {
    const n = _a(t);
    return n === "emf" ? aa(t, e) : n === "wmf" ? $a(t, e) : n === "pict" ? Ra(t, e) : null;
  } catch {
    return null;
  }
}
const Ae = 4294967294, Pe = 4294967295;
class Mo {
  constructor(e) {
    if (this.fat = [], this.miniFat = [], this.dir = [], this.miniStream = new Uint8Array(0), e.length < 512 || e[0] !== 208 || e[1] !== 207)
      throw new Error("不是有效的 CFB 复合文档");
    this.bytes = e, this.view = new DataView(e.buffer, e.byteOffset, e.byteLength), this.sectorSize = 1 << this.view.getUint16(30, !0), this.miniSectorSize = 1 << this.view.getUint16(32, !0), this.miniCutoff = this.view.getUint32(56, !0), this.readFat(), this.readDirectory(), this.readMiniFat();
  }
  offsetOf(e) {
    return (e + 1) * this.sectorSize;
  }
  readFat() {
    const e = [];
    for (let r = 0; r < 109; r++) e.push(this.view.getUint32(76 + r * 4, !0));
    let n = this.view.getUint32(68, !0);
    const o = this.sectorSize / 4;
    let s = 0;
    for (; n !== Ae && n !== Pe && s++ < 1e5; ) {
      const r = this.offsetOf(n);
      if (r + this.sectorSize > this.bytes.length) break;
      for (let i = 0; i < o - 1; i++) e.push(this.view.getUint32(r + i * 4, !0));
      n = this.view.getUint32(r + (o - 1) * 4, !0);
    }
    for (const r of e) {
      if (r === Pe || r === Ae) continue;
      const i = this.offsetOf(r);
      if (!(i + this.sectorSize > this.bytes.length))
        for (let c = 0; c < o; c++) this.fat.push(this.view.getUint32(i + c * 4, !0));
    }
  }
  chain(e, n) {
    const o = [];
    let s = e, r = 0;
    for (; s !== Ae && s !== Pe && s >= 0 && s < n.length && r++ < 1e6; )
      o.push(s), s = n[s];
    return o;
  }
  readChain(e, n) {
    const o = this.chain(e, this.fat), s = new Uint8Array(o.length * this.sectorSize);
    return o.forEach((r, i) => {
      const c = this.offsetOf(r);
      s.set(this.bytes.subarray(c, Math.min(c + this.sectorSize, this.bytes.length)), i * this.sectorSize);
    }), s.subarray(0, n);
  }
  readDirectory() {
    const e = this.view.getUint32(48, !0), n = this.chain(e, this.fat), o = this.readChain(e, n.length * this.sectorSize), s = new DataView(o.buffer, o.byteOffset, o.byteLength);
    for (let r = 0; r + 128 <= o.length; r += 128) {
      const i = s.getUint16(r + 64, !0);
      if (i === 0 || i > 64) continue;
      let c = "";
      for (let a = 0; a < i - 2; a += 2) c += String.fromCharCode(s.getUint16(r + a, !0));
      this.dir.push({
        name: c,
        type: s.getUint8(r + 66),
        start: s.getUint32(r + 116, !0),
        size: s.getUint32(r + 120, !0)
      });
    }
  }
  readMiniFat() {
    const e = this.view.getUint32(60, !0);
    if (e !== Ae && e !== Pe) {
      const o = this.chain(e, this.fat), s = this.readChain(e, o.length * this.sectorSize), r = new DataView(s.buffer, s.byteOffset, s.byteLength);
      for (let i = 0; i + 4 <= s.length; i += 4) this.miniFat.push(r.getUint32(i, !0));
    }
    const n = this.dir.find((o) => o.type === 5);
    n && (this.miniStream = this.readChain(n.start, n.size));
  }
  streamNames() {
    return this.dir.filter((e) => e.type === 2).map((e) => e.name);
  }
  stream(e) {
    const n = this.dir.find((r) => r.type === 2 && r.name.toLowerCase() === e.toLowerCase());
    if (!n) return null;
    if (n.size >= this.miniCutoff) return this.readChain(n.start, n.size);
    const o = this.chain(n.start, this.miniFat), s = new Uint8Array(o.length * this.miniSectorSize);
    return o.forEach((r, i) => {
      s.set(
        this.miniStream.subarray(r * this.miniSectorSize, (r + 1) * this.miniSectorSize),
        i * this.miniSectorSize
      );
    }), s.subarray(0, n.size);
  }
}
let Wn = null, Eo = null;
function Va(t) {
  Eo = t;
}
function Wa() {
  return Eo;
}
function Ga(t) {
  Wn = t;
}
function ju() {
  return Wn !== null;
}
function Xa() {
  return Wn;
}
function dn(t, e) {
  return (t << e | t >>> 32 - e) >>> 0;
}
function Gn(t, e, n) {
  const o = t.length * 8, s = Math.ceil((t.length + 1 + n) / e) * e, r = new Uint8Array(s);
  r.set(t), r[t.length] = 128;
  const i = new DataView(r.buffer);
  return i.setUint32(s - 4, o >>> 0, !1), i.setUint32(s - 8, Math.floor(o / 4294967296), !1), r;
}
function zt(t) {
  const e = [1732584193, 4023233417, 2562383102, 271733878, 3285377520], n = Gn(t, 64, 8), o = new Uint32Array(80), s = new DataView(n.buffer);
  for (let c = 0; c < n.length; c += 64) {
    for (let m = 0; m < 16; m++) o[m] = s.getUint32(c + m * 4, !1);
    for (let m = 16; m < 80; m++) o[m] = dn(o[m - 3] ^ o[m - 8] ^ o[m - 14] ^ o[m - 16], 1);
    let [a, l, u, f, h] = e;
    for (let m = 0; m < 80; m++) {
      let d, p;
      m < 20 ? (d = l & u | ~l & f, p = 1518500249) : m < 40 ? (d = l ^ u ^ f, p = 1859775393) : m < 60 ? (d = l & u | l & f | u & f, p = 2400959708) : (d = l ^ u ^ f, p = 3395469782);
      const w = dn(a, 5) + d + h + p + o[m] >>> 0;
      h = f, f = u, u = dn(l, 30), l = a, a = w;
    }
    e[0] = e[0] + a >>> 0, e[1] = e[1] + l >>> 0, e[2] = e[2] + u >>> 0, e[3] = e[3] + f >>> 0, e[4] = e[4] + h >>> 0;
  }
  const r = new Uint8Array(20), i = new DataView(r.buffer);
  for (let c = 0; c < 5; c++) i.setUint32(c * 4, e[c], !1);
  return r;
}
const Ya = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
function qa(t) {
  const e = new Uint32Array([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]), n = Gn(t, 64, 8), o = new DataView(n.buffer), s = new Uint32Array(64), r = (a, l) => a >>> l | a << 32 - l;
  for (let a = 0; a < n.length; a += 64) {
    for (let g = 0; g < 16; g++) s[g] = o.getUint32(a + g * 4, !1);
    for (let g = 16; g < 64; g++) {
      const y = r(s[g - 15], 7) ^ r(s[g - 15], 18) ^ s[g - 15] >>> 3, $ = r(s[g - 2], 17) ^ r(s[g - 2], 19) ^ s[g - 2] >>> 10;
      s[g] = s[g - 16] + y + s[g - 7] + $ >>> 0;
    }
    let [l, u, f, h, m, d, p, w] = e;
    for (let g = 0; g < 64; g++) {
      const y = r(m, 6) ^ r(m, 11) ^ r(m, 25), $ = m & d ^ ~m & p, x = w + y + $ + Ya[g] + s[g] >>> 0, M = r(l, 2) ^ r(l, 13) ^ r(l, 22), k = l & u ^ l & f ^ u & f, T = M + k >>> 0;
      w = p, p = d, d = m, m = h + x >>> 0, h = f, f = u, u = l, l = x + T >>> 0;
    }
    const b = [l, u, f, h, m, d, p, w];
    for (let g = 0; g < 8; g++) e[g] = e[g] + b[g] >>> 0;
  }
  const i = new Uint8Array(32), c = new DataView(i.buffer);
  for (let a = 0; a < 8; a++) c.setUint32(a * 4, e[a], !1);
  return i;
}
const Ka = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298,
  3391569614,
  3515267271,
  3940187606,
  4118630271,
  116418474,
  174292421,
  289380356,
  460393269,
  685471733,
  852142971,
  1017036298,
  1126000580,
  1288033470,
  1501505948,
  1607167915,
  1816402316
]), Za = new Uint32Array([
  3609767458,
  602891725,
  3964484399,
  2173295548,
  4081628472,
  3053834265,
  2937671579,
  3664609560,
  2734883394,
  1164996542,
  1323610764,
  3590304994,
  4068182383,
  991336113,
  633803317,
  3479774868,
  2666613458,
  944711139,
  2341262773,
  2007800933,
  1495990901,
  1856431235,
  3175218132,
  2198950837,
  3999719339,
  766784016,
  2566594879,
  3203337956,
  1034457026,
  2466948901,
  3758326383,
  168717936,
  1188179964,
  1546045734,
  1522805485,
  2643833823,
  2343527390,
  1014477480,
  1206759142,
  344077627,
  1290863460,
  3158454273,
  3505952657,
  106217008,
  3606008344,
  1432725776,
  1467031594,
  851169720,
  3100823752,
  1363258195,
  3750685593,
  3785050280,
  3318307427,
  3812723403,
  2003034995,
  3602036899,
  1575990012,
  1125592928,
  2716904306,
  442776044,
  593698344,
  3733110249,
  2999351573,
  3815920427,
  3928383900,
  566280711,
  3454069534,
  4000239992,
  1914138554,
  2731055270,
  3203993006,
  320620315,
  587496836,
  1086792851,
  365543100,
  2618297676,
  3409855158,
  4234509866,
  987167468,
  1246189591
]), Ja = [
  1779033703,
  4089235720,
  3144134277,
  2227873595,
  1013904242,
  4271175723,
  2773480762,
  1595750129,
  1359893119,
  2917565137,
  2600822924,
  725511199,
  528734635,
  4215389547,
  1541459225,
  327033209
], Qa = [
  3418070365,
  3238371032,
  1654270250,
  914150663,
  2438529370,
  812702999,
  355462360,
  4144912697,
  1731405415,
  4290775857,
  2394180231,
  1750603025,
  3675008525,
  1694076839,
  1203062813,
  3204075428
];
function ko(t, e, n) {
  const o = new Uint32Array(8), s = new Uint32Array(8);
  for (let p = 0; p < 8; p++)
    o[p] = e[p * 2], s[p] = e[p * 2 + 1];
  const r = Gn(t, 128, 16), i = new DataView(r.buffer), c = new Uint32Array(80), a = new Uint32Array(80);
  let l = 0, u = 0;
  const f = (p, w, b) => {
    if (b < 32)
      l = p >>> b | w << 32 - b, u = w >>> b | p << 32 - b;
    else if (b === 32)
      l = w, u = p;
    else {
      const g = b - 32;
      l = w >>> g | p << 32 - g, u = p >>> g | w << 32 - g;
    }
  }, h = (p, w, b) => {
    b < 32 ? (l = p >>> b, u = w >>> b | p << 32 - b) : (l = 0, u = p >>> b - 32);
  };
  for (let p = 0; p < r.length; p += 128) {
    for (let O = 0; O < 16; O++)
      c[O] = i.getUint32(p + O * 8, !1), a[O] = i.getUint32(p + O * 8 + 4, !1);
    for (let O = 16; O < 80; O++) {
      f(c[O - 15], a[O - 15], 1);
      let _ = l, U = u;
      f(c[O - 15], a[O - 15], 8), _ ^= l, U ^= u, h(c[O - 15], a[O - 15], 7), _ ^= l, U ^= u, f(c[O - 2], a[O - 2], 19);
      let B = l, X = u;
      f(c[O - 2], a[O - 2], 61), B ^= l, X ^= u, h(c[O - 2], a[O - 2], 6), B ^= l, X ^= u;
      const Y = (a[O - 16] >>> 0) + (U >>> 0) + (a[O - 7] >>> 0) + (X >>> 0);
      a[O] = Y >>> 0, c[O] = c[O - 16] + _ + c[O - 7] + B + Math.floor(Y / 4294967296) >>> 0;
    }
    let w = o[0], b = s[0], g = o[1], y = s[1], $ = o[2], x = s[2], M = o[3], k = s[3], T = o[4], S = s[4], A = o[5], P = s[5], L = o[6], C = s[6], R = o[7], z = s[7];
    for (let O = 0; O < 80; O++) {
      f(T, S, 14);
      let _ = l, U = u;
      f(T, S, 18), _ ^= l, U ^= u, f(T, S, 41), _ ^= l, U ^= u;
      const B = T & A ^ ~T & L, X = S & P ^ ~S & C;
      let Y = (z >>> 0) + (U >>> 0) + (X >>> 0) + Za[O] + (a[O] >>> 0);
      const Z = Y >>> 0, K = R + _ + B + Ka[O] + c[O] + Math.floor(Y / 4294967296) >>> 0;
      f(w, b, 28);
      let kt = l, Ot = u;
      f(w, b, 34), kt ^= l, Ot ^= u, f(w, b, 39), kt ^= l, Ot ^= u;
      const Xt = w & g ^ w & $ ^ g & $, Yt = b & y ^ b & x ^ y & x;
      Y = (Ot >>> 0) + (Yt >>> 0);
      const ut = Y >>> 0, at = kt + Xt + Math.floor(Y / 4294967296) >>> 0;
      R = L, z = C, L = A, C = P, A = T, P = S, Y = (k >>> 0) + (Z >>> 0), S = Y >>> 0, T = M + K + Math.floor(Y / 4294967296) >>> 0, M = $, k = x, $ = g, x = y, g = w, y = b, Y = (Z >>> 0) + (ut >>> 0), b = Y >>> 0, w = K + at + Math.floor(Y / 4294967296) >>> 0;
    }
    const D = [w, g, $, M, T, A, L, R], I = [b, y, x, k, S, P, C, z];
    for (let O = 0; O < 8; O++) {
      const _ = (s[O] >>> 0) + (I[O] >>> 0);
      s[O] = _ >>> 0, o[O] = o[O] + D[O] + Math.floor(_ / 4294967296) >>> 0;
    }
  }
  const m = new Uint8Array(64), d = new DataView(m.buffer);
  for (let p = 0; p < 8; p++)
    d.setUint32(p * 8, o[p], !1), d.setUint32(p * 8 + 4, s[p], !1);
  return m.subarray(0, n);
}
const tc = (t) => ko(t, Ja, 64), ec = (t) => ko(t, Qa, 48);
function Es(t) {
  switch (t.toUpperCase().replace(/[-_]/g, "")) {
    case "SHA1":
      return zt;
    case "SHA256":
      return qa;
    case "SHA384":
      return ec;
    case "SHA512":
      return tc;
    default:
      return null;
  }
}
const qt = new Uint8Array(256), So = new Uint8Array(256), nc = new Uint8Array([1, 2, 4, 8, 16, 32, 64, 128, 27, 54, 108, 216, 171, 77]);
(function() {
  const e = new Uint8Array(256), n = new Uint8Array(256);
  let o = 1;
  for (let s = 0; s < 256; s++)
    e[s] = o, n[o] = s, o ^= o << 1 ^ (o & 128 ? 283 : 0), o &= 255;
  for (let s = 0; s < 256; s++) {
    let r = s ? e[255 - n[s]] : 0, i = r;
    for (let c = 0; c < 4; c++)
      r = (r << 1 | r >>> 7) & 255, i ^= r;
    qt[s] = i ^ 99;
  }
  for (let s = 0; s < 256; s++) So[qt[s]] = s;
})();
function sc(t) {
  return (t << 1 ^ (t & 128 ? 27 : 0)) & 255;
}
function mt(t, e) {
  let n = 0;
  for (; e; )
    e & 1 && (n ^= t), t = sc(t), e >>= 1;
  return n & 255;
}
function To(t) {
  const e = t.length / 4, n = e + 6, o = [];
  for (let r = 0; r < e; r++) o.push([t[r * 4], t[r * 4 + 1], t[r * 4 + 2], t[r * 4 + 3]]);
  for (let r = e; r < 4 * (n + 1); r++) {
    let i = o[r - 1].slice();
    r % e === 0 ? i = [qt[i[1]] ^ nc[r / e - 1], qt[i[2]], qt[i[3]], qt[i[0]]] : e > 6 && r % e === 4 && (i = i.map((c) => qt[c])), o.push(i.map((c, a) => c ^ o[r - e][a]));
  }
  const s = [];
  for (let r = 0; r <= n; r++) {
    const i = new Uint8Array(16);
    for (let c = 0; c < 4; c++) for (let a = 0; a < 4; a++) i[c * 4 + a] = o[r * 4 + c][a];
    s.push(i);
  }
  return s;
}
function Co(t, e, n, o, s) {
  const r = new Uint8Array(16);
  for (let i = 0; i < 16; i++) r[i] = e[n + i] ^ t[t.length - 1][i];
  for (let i = t.length - 2; i >= 0; i--) {
    const c = r.slice();
    for (let a = 0; a < 4; a++)
      for (let l = 0; l < 4; l++) r[(a + l) % 4 * 4 + l] = c[a * 4 + l];
    for (let a = 0; a < 16; a++) r[a] = So[r[a]];
    for (let a = 0; a < 16; a++) r[a] ^= t[i][a];
    if (i > 0)
      for (let a = 0; a < 4; a++) {
        const l = r[a * 4], u = r[a * 4 + 1], f = r[a * 4 + 2], h = r[a * 4 + 3];
        r[a * 4] = mt(l, 14) ^ mt(u, 11) ^ mt(f, 13) ^ mt(h, 9), r[a * 4 + 1] = mt(l, 9) ^ mt(u, 14) ^ mt(f, 11) ^ mt(h, 13), r[a * 4 + 2] = mt(l, 13) ^ mt(u, 9) ^ mt(f, 14) ^ mt(h, 11), r[a * 4 + 3] = mt(l, 11) ^ mt(u, 13) ^ mt(f, 9) ^ mt(h, 14);
      }
  }
  o.set(r, s);
}
function pn(t, e) {
  const n = To(t), o = new Uint8Array(e.length - e.length % 16);
  for (let s = 0; s + 16 <= e.length; s += 16) Co(n, e, s, o, s);
  return o;
}
function Ie(t, e, n) {
  const o = To(t), s = n.length - n.length % 16, r = new Uint8Array(s);
  let i = e.subarray(0, 16);
  for (let c = 0; c + 16 <= s; c += 16) {
    Co(o, n, c, r, c);
    for (let a = 0; a < 16; a++) r[c + a] ^= i[a];
    i = n.subarray(c, c + 16);
  }
  return r;
}
const oc = 5e4, rc = new Uint8Array([254, 167, 210, 118, 59, 75, 158, 121]), ic = new Uint8Array([215, 170, 15, 109, 48, 97, 52, 78]), ac = new Uint8Array([20, 110, 11, 231, 171, 172, 208, 214]);
class Xn extends Error {
  constructor() {
    super("密码错误"), this.name = "WrongPasswordError";
  }
}
function ce(...t) {
  const e = t.reduce((s, r) => s + r.length, 0), n = new Uint8Array(e);
  let o = 0;
  for (const s of t)
    n.set(s, o), o += s.length;
  return n;
}
function cc(t) {
  const e = new Uint8Array(t.length * 2), n = new DataView(e.buffer);
  for (let o = 0; o < t.length; o++) n.setUint16(o * 2, t.charCodeAt(o), !0);
  return e;
}
function Yn(t) {
  const e = new Uint8Array(4);
  return new DataView(e.buffer).setUint32(0, t >>> 0, !0), e;
}
function Lo(t, e, n) {
  if (t.length < n || e.length < n) return !1;
  let o = 0;
  for (let s = 0; s < n; s++) o |= t[s] ^ e[s];
  return o === 0;
}
function Ao(t, e, n, o) {
  let s = t(ce(e, cc(n)));
  for (let r = 0; r < o; r++) s = t(ce(Yn(r), s));
  return s;
}
function qn(t, e) {
  if (t.length >= e) return t.subarray(0, e);
  const n = new Uint8Array(e).fill(54);
  return n.set(t), n;
}
function lc(t) {
  const e = new DataView(t.buffer, t.byteOffset, t.byteLength), n = e.getUint32(8, !0);
  if (n < 32 || 12 + n + 8 > t.length) return null;
  const o = e.getUint32(28, !0), s = o >= 8 ? o / 8 : 16;
  let r = 12 + n;
  const i = e.getUint32(r, !0);
  if (r += 4, i !== 16) return null;
  const c = t.subarray(r, r + 16);
  r += 16;
  const a = t.subarray(r, r + 16);
  r += 16;
  const l = e.getUint32(r, !0);
  if (r += 4, l < 20) return null;
  const u = t.subarray(r, r + 32);
  return { keyBytes: s, salt: c, encryptedVerifier: a, encryptedVerifierHash: u };
}
function uc(t, e) {
  const n = Ao(zt, t.salt, e, oc), o = zt(ce(n, Yn(0))), s = zt(new Uint8Array(64).map((i, c) => (c < o.length ? o[c] : 0) ^ 54)), r = zt(new Uint8Array(64).map((i, c) => (c < o.length ? o[c] : 0) ^ 92));
  return qn(ce(s, r), t.keyBytes);
}
function fc(t, e, n) {
  const o = lc(t);
  if (!o) throw new Error("无法解析标准加密的 EncryptionInfo");
  const s = uc(o, n), r = pn(s, o.encryptedVerifier), i = pn(s, o.encryptedVerifierHash);
  if (!Lo(zt(r), i, 20)) throw new Xn();
  const c = Number(new DataView(e.buffer, e.byteOffset, e.byteLength).getBigUint64(0, !0)), a = pn(s, e.subarray(8));
  return a.subarray(0, Math.min(c, a.length));
}
function he(t) {
  const e = typeof atob == "function" ? atob(t) : globalThis.Buffer.from(t, "base64").toString("binary"), n = new Uint8Array(e.length);
  for (let o = 0; o < e.length; o++) n[o] = e.charCodeAt(o);
  return n;
}
function hc(t) {
  var a, l;
  const e = new TextDecoder().decode(t.subarray(8)), n = ((a = /<[^>]*keyData\b[^>]*>/.exec(e)) == null ? void 0 : a[0]) ?? "", o = ((l = /<[^>]*encryptedKey\b[^>]*>/.exec(e)) == null ? void 0 : l[0]) ?? "";
  if (!n || !o) return null;
  const s = (u, f) => {
    const h = new RegExp(`\\b${f}="([^"]*)"`).exec(u);
    return h ? h[1] : null;
  }, r = Es(s(n, "hashAlgorithm") ?? ""), i = Es(s(o, "hashAlgorithm") ?? "");
  if (!r || !i || (s(n, "cipherAlgorithm") ?? "AES") !== "AES") return null;
  const c = (u, f, h) => {
    const m = Number(s(u, f));
    return Number.isFinite(m) && m > 0 ? m : h;
  };
  return {
    hash: r,
    hashSize: c(n, "hashSize", 64),
    blockSize: c(n, "blockSize", 16),
    keyBytes: c(n, "keyBits", 256) / 8,
    keySalt: he(s(n, "saltValue") ?? ""),
    spinCount: c(o, "spinCount", 1e5),
    pwSalt: he(s(o, "saltValue") ?? ""),
    pwKeyBytes: c(o, "keyBits", 256) / 8,
    pwHash: i,
    encryptedKeyValue: he(s(o, "encryptedKeyValue") ?? ""),
    encryptedVerifierHashInput: he(s(o, "encryptedVerifierHashInput") ?? ""),
    encryptedVerifierHashValue: he(s(o, "encryptedVerifierHashValue") ?? "")
  };
}
function mn(t, e, n) {
  return qn(t.pwHash(ce(e, n)), t.pwKeyBytes);
}
function dc(t, e, n) {
  const o = hc(t);
  if (!o) throw new Error("无法解析敏捷加密的 EncryptionInfo");
  const s = Ao(o.pwHash, o.pwSalt, n, o.spinCount), r = Ie(mn(o, s, rc), o.pwSalt, o.encryptedVerifierHashInput), i = Ie(mn(o, s, ic), o.pwSalt, o.encryptedVerifierHashValue);
  if (!Lo(o.pwHash(r.subarray(0, 16)), i, Math.min(o.hashSize, i.length))) throw new Xn();
  const c = Ie(mn(o, s, ac), o.pwSalt, o.encryptedKeyValue).subarray(0, o.keyBytes), a = Number(new DataView(e.buffer, e.byteOffset, e.byteLength).getBigUint64(0, !0)), l = e.subarray(8), u = 4096, f = new Uint8Array(l.length);
  for (let h = 0, m = 0; m < l.length; h++, m += u) {
    const d = qn(o.hash(ce(o.keySalt, Yn(h))), o.blockSize), p = l.subarray(m, Math.min(m + u, l.length));
    f.set(Ie(c, d, p), m);
  }
  return f.subarray(0, Math.min(a, f.length));
}
function pc(t, e, n) {
  if (t.length < 16 || e.length < 16) throw new Error("加密流不完整");
  const o = new DataView(t.buffer, t.byteOffset, t.byteLength), s = o.getUint16(0, !0), r = o.getUint16(2, !0);
  if (s === 4 && r === 4) return dc(t, e, n);
  if (s === 4 && r === 3) throw new Error("不支持扩展加密（自定义加密提供程序）");
  return fc(t, e, n);
}
function Vu(t) {
  const e = new DataView(t.buffer, t.byteOffset, t.byteLength), n = e.getUint16(0, !0), o = e.getUint16(2, !0);
  return n === 4 && o === 4 ? "agile" : n === 4 && o === 3 ? "extensible" : "standard";
}
const mc = 4090610911, gc = 4085, bc = 6002, wc = 12052;
function gn(t, e) {
  const n = new Uint8Array(256);
  for (let i = 0; i < 256; i++) n[i] = i;
  let o = 0;
  for (let i = 0; i < 256; i++) {
    o = o + n[i] + t[i % t.length] & 255;
    const c = n[i];
    n[i] = n[o], n[o] = c;
  }
  const s = new Uint8Array(e.length);
  let r = 0;
  o = 0;
  for (let i = 0; i < e.length; i++) {
    r = r + 1 & 255, o = o + n[r] & 255;
    const c = n[r];
    n[r] = n[o], n[o] = c, s[i] = e[i] ^ n[n[r] + n[o] & 255];
  }
  return s;
}
function yc(t) {
  const e = new Uint8Array(t.length * 2), n = new DataView(e.buffer);
  for (let o = 0; o < t.length; o++) n.setUint16(o * 2, t.charCodeAt(o), !0);
  return e;
}
function xc(t) {
  const e = new Uint8Array(4);
  return new DataView(e.buffer).setUint32(0, t >>> 0, !0), e;
}
function An(t, e) {
  const n = new Uint8Array(t.length + e.length);
  return n.set(t), n.set(e, t.length), n;
}
function $c(t) {
  return !t || t.length < 16 ? !1 : new DataView(t.buffer, t.byteOffset, t.byteLength).getUint32(12, !0) === mc;
}
function Mc(t) {
  if (t.length < 40) return null;
  const e = new DataView(t.buffer, t.byteOffset, t.byteLength), n = e.getUint32(8, !0);
  if (n < 20 || 12 + n + 40 > t.length) return null;
  const o = e.getUint32(28, !0) || 40;
  let s = 12 + n;
  const r = e.getUint32(s, !0);
  if (s += 4, r !== 16) return null;
  const i = t.subarray(s, s + 16);
  s += 16;
  const c = t.subarray(s, s + 16);
  s += 16;
  const a = e.getUint32(s, !0);
  return s += 4, a < 20 ? null : { keyBytes: Math.max(1, Math.floor(o / 8)), salt: i, encVerifier: c, encVerifierHash: t.subarray(s, s + 20) };
}
function bn(t, e, n) {
  const s = zt(An(e, xc(n))).subarray(0, t.keyBytes);
  if (t.keyBytes !== 5) return s;
  const r = new Uint8Array(16);
  return r.set(s), r;
}
function Ec(t, e) {
  const n = new DataView(e.buffer, e.byteOffset, e.byteLength), o = new DataView(t.buffer, t.byteOffset, t.byteLength), s = (d) => o.getUint32(d + 4, !0), r = (d) => o.getUint16(d + 2, !0), i = [], c = /* @__PURE__ */ new Map();
  let a = -1, l = n.getUint32(16, !0), u = 0;
  for (; l > 0 && l + 8 <= t.length && u++ < 64; ) {
    if (r(l) !== gc) return null;
    const d = s(l);
    i.push([l, 8 + d]);
    const p = l + 8, w = o.getUint32(p + 8, !0), b = o.getUint32(p + 12, !0);
    if (d >= 32 && a < 0 && (a = o.getUint32(p + 28, !0)), b > 0 && b + 8 <= t.length && r(b) === bc) {
      const g = s(b);
      i.push([b, 8 + g]);
      let y = b + 8;
      const $ = Math.min(y + g, t.length);
      for (; y + 4 <= $; ) {
        const x = o.getUint32(y, !0);
        y += 4;
        const M = x & 1048575, k = x >>> 20;
        for (let T = 0; T < k && y + 4 <= $; T++)
          c.has(M + T) || c.set(M + T, o.getUint32(y, !0)), y += 4;
      }
    }
    l = w;
  }
  const f = a >= 0 ? c.get(a) : void 0;
  if (f === void 0 || f + 8 > t.length || r(f) !== wc) return null;
  const h = s(f);
  i.push([f, 8 + h]);
  const m = Mc(t.subarray(f + 8, f + 8 + h));
  return m ? {
    info: m,
    persists: [...c.entries()].filter(([d]) => d !== a).map(([d, p]) => ({ id: d, offset: p })),
    plain: i
  } : null;
}
function kc(t, e, n) {
  const o = Ec(t, e);
  if (!o) return null;
  const { info: s, persists: r, plain: i } = o, c = zt(An(s.salt, yc(n))), a = bn(s, c, 0), l = gn(a, An(s.encVerifier, s.encVerifierHash)), u = zt(l.subarray(0, 16));
  let f = 0;
  for (let d = 0; d < 20; d++) f |= u[d] ^ l[16 + d];
  if (f !== 0) throw new Xn();
  const h = new Uint8Array(t);
  new DataView(t.buffer, t.byteOffset, t.byteLength);
  const m = [];
  for (const { id: d, offset: p } of r) {
    if (p + 8 > t.length) continue;
    const w = gn(bn(s, c, d), t.subarray(p, p + 8)), b = new DataView(w.buffer).getUint32(4, !0), g = Math.min(8 + b, t.length - p);
    !(g > 8) || g > t.length || (h.set(gn(bn(s, c, d), t.subarray(p, p + g)), p), m.push([p, g]));
  }
  if (!m.length) return null;
  for (const [d, p] of i)
    d >= 0 && d + p <= t.length && h.set(t.subarray(d, d + p), d);
  return h;
}
function* wt(t, e, n) {
  let o = e;
  for (; o + 8 <= n; ) {
    const s = t.getUint16(o, !0), r = t.getUint16(o + 2, !0), i = t.getUint32(o + 4, !0), c = o + 8;
    if (i < 0 || c + i > n) return;
    const a = s & 15;
    yield { type: r, instance: s >> 4, version: a, isContainer: a === 15, start: c, len: i }, o = c + i;
  }
}
function Q(t, e, n, o) {
  for (const s of wt(t, e, n)) if (s.type === o) return s;
  return null;
}
function Lt(t, e, n, o) {
  const s = [];
  for (const r of wt(t, e, n)) r.type === o && s.push(r);
  return s;
}
function Gt(t, e, n) {
  let o = "";
  for (let s = 0; s + 2 <= n; s += 2) o += String.fromCharCode(t.getUint16(e + s, !0));
  return o;
}
function Qe(t, e, n) {
  let o = "";
  for (let s = 0; s < n; s++) o += String.fromCharCode(t.getUint8(e + s));
  return o;
}
function Po(t, e, n) {
  const o = [], s = (r, i, c) => {
    for (const a of wt(t, r, i)) {
      if (a.type === V.ProgBinaryTag) {
        let l = "";
        for (const u of wt(t, a.start, a.start + a.len))
          u.type === V.CString ? l = Gt(t, u.start, u.len).replace(/\0+$/, "") : u.type === V.BinaryTagDataBlob && l === n && o.push(u);
        continue;
      }
      a.isContainer && c > 0 && s(a.start, a.start + a.len, c - 1);
    }
  };
  return s(e.start, e.start + e.len, 6), o;
}
const V = {
  Document: 1e3,
  DocumentAtom: 1001,
  Slide: 1006,
  SlideAtom: 1007,
  Notes: 1008,
  NotesAtom: 1009,
  MainMaster: 1016,
  /** 放映设置：切换效果、隐藏标记、自动换片 */
  SSSlideInfoAtom: 1017,
  SlidePersistAtom: 1011,
  ExObjList: 1033,
  PPDrawing: 1036,
  ColorSchemeAtom: 2032,
  SlideListWithText: 4080,
  TextHeaderAtom: 3999,
  TextCharsAtom: 4e3,
  TextBytesAtom: 4008,
  StyleTextPropAtom: 4001,
  TxMasterStyleAtom: 4003,
  /** 母版 / 环境里的字体表条目；recInstance 即字体索引 */
  FontEntityAtom: 4023,
  OEPlaceholderAtom: 3011,
  ExHyperlinkAtom: 4051,
  ExHyperlink: 4055,
  CString: 4026,
  /** 超链接作用的文本范围 */
  TextInteractiveInfoAtom: 4063,
  InteractiveInfo: 4082,
  InteractiveInfoAtom: 4083,
  PersistDirectoryAtom: 6002,
  ProgBinaryTag: 5002,
  BinaryTagDataBlob: 5003,
  /** ___PPT9 扩展块：自动编号等 PowerPoint 2000 新增的段落属性 */
  StyleTextProp9Atom: 4012
}, St = {
  ExtTimeNodeContainer: 61764,
  TimeNodeAtom: 61735,
  TimeConditionContainer: 61733,
  TimeConditionAtom: 61736,
  ClientVisualElement: 61756,
  TimePropertyList: 61757,
  TimeVariant: 61762,
  /** ClientVisualElement 里指向形状的原子 */
  VisualShapeAtom: 11003
}, rt = {
  DgContainer: 61442,
  SpgrContainer: 61443,
  SpContainer: 61444,
  Spgr: 61449,
  Sp: 61450,
  Opt: 61451,
  ClientTextbox: 61453,
  ChildAnchor: 61455,
  ClientAnchor: 61456,
  ClientData: 61457
}, Sc = 8388608, Tc = 16777216, Cc = 33554432, Lc = 1048576, Ac = [
  [1, 2],
  // spell
  [2, 2],
  // lang
  [4, 2],
  // altLang
  [32, 2],
  // bidi
  [64, 4],
  // pp10ext
  [128, 4]
  // pp11ext
], Pc = 256;
function Ic(t, e) {
  const n = [], o = e.start + e.len;
  let s = e.start;
  for (; s + 4 <= o; ) {
    const r = t.getUint32(s, !0);
    s += 4, r & Sc && (s += 2);
    let i = null;
    if (r & Cc) {
      if (s + 2 > o) return [];
      i = t.getUint16(s, !0) !== 0, s += 2;
    }
    let c = null;
    if (r & Tc) {
      if (s + 4 > o) return [];
      c = { scheme: t.getUint16(s, !0), startNum: t.getUint16(s + 2, !0) || 1 }, s += 4;
    }
    if (s + 4 > o) return [];
    const a = t.getUint32(s, !0);
    if (s += 4, a & Lc && (s += 4), s + 4 > o) return [];
    const l = t.getUint32(s, !0);
    s += 4;
    for (const [u, f] of Ac) l & u && (s += f);
    if (l & Pc) {
      if (s + 4 > o) return [];
      s += 4 + t.getUint32(s, !0) * 4;
    }
    if (s > o) return [];
    n.push(i === !1 ? null : c);
  }
  return s === o ? n : [];
}
function Io(t, e) {
  const n = [];
  for (const o of Po(t, e, "___PPT9"))
    for (const s of Lt(t, o.start, o.start + o.len, V.StyleTextProp9Atom))
      n.push(...Ic(t, s));
  return n;
}
function Oc(t, e) {
  const n = vc[t] ?? "arabic", o = n === "alphaLc" ? ks(e).toLowerCase() : n === "alphaUc" ? ks(e) : n === "romanLc" ? Ss(e).toLowerCase() : n === "romanUc" ? Ss(e) : n === "circle" ? Rc(e) : String(e), s = zc[t] ?? "";
  return s === "both" ? `(${o})` : s === "right" ? `${o})` : s === "period" ? `${o}.` : s === "minus" ? `-${o}-` : o;
}
const vc = {
  0: "alphaLc",
  1: "alphaUc",
  2: "arabic",
  3: "arabic",
  4: "romanLc",
  5: "romanLc",
  6: "romanLc",
  7: "romanUc",
  8: "alphaLc",
  9: "alphaLc",
  10: "alphaUc",
  11: "alphaUc",
  12: "arabic",
  13: "arabic",
  14: "romanUc",
  15: "romanUc",
  16: "arabic",
  17: "arabic",
  18: "circle",
  19: "circle",
  20: "circle",
  21: "arabic",
  22: "arabic",
  23: "arabic",
  24: "arabic",
  25: "arabic",
  26: "arabic",
  27: "arabic",
  28: "arabic",
  29: "arabic",
  30: "arabic",
  31: "arabic",
  32: "arabic"
}, zc = {
  0: "period",
  1: "period",
  2: "right",
  3: "period",
  4: "both",
  5: "right",
  6: "period",
  7: "period",
  8: "both",
  9: "right",
  10: "both",
  11: "right",
  12: "both",
  14: "both",
  15: "right",
  17: "period",
  21: "period",
  23: "period",
  25: "period",
  27: "period",
  29: "period",
  30: "minus",
  31: "minus",
  32: "minus"
};
function ks(t) {
  let e = "", n = t;
  for (; n > 0; )
    e = String.fromCharCode(65 + (n - 1) % 26) + e, n = Math.floor((n - 1) / 26);
  return e || "A";
}
function Ss(t) {
  const e = [
    [1e3, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"]
  ];
  let n = "", o = t;
  for (const [s, r] of e) for (; o >= s; )
    n += r, o -= s;
  return n || "I";
}
const Rc = (t) => t >= 1 && t <= 20 ? String.fromCharCode(9312 + t - 1) : String(t);
function Kn(t, e) {
  const n = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map(), s = e.instance;
  let r = e.start;
  const i = e.start + Math.min(s * 6, e.len), c = [];
  for (let l = 0; l < s && r + 6 <= e.start + e.len; l++, r += 6) {
    const u = t.getUint16(r, !0), f = u & 16383, h = (u & 32768) !== 0, m = t.getUint32(r + 2, !0);
    h ? c.push({ id: f, len: m }) : n.set(f, m);
  }
  let a = i;
  for (const l of c) {
    if (a + l.len > e.start + e.len) break;
    o.set(l.id, { start: a, len: l.len }), a += l.len;
  }
  return { simple: n, complex: o };
}
const q = {
  rotation: 4,
  tableProperties: 927,
  tableRowProperties: 928,
  lTxid: 128,
  anchorText: 135,
  pib: 260,
  geoLeft: 320,
  geoTop: 321,
  geoRight: 322,
  geoBottom: 323,
  pVertices: 325,
  pSegmentInfo: 326,
  adjustValue: 327,
  adjust2Value: 328,
  adjust3Value: 329,
  adjust4Value: 330,
  fillType: 384,
  fillColor: 385,
  fillOpacity: 386,
  fillBackColor: 387,
  fillBlip: 390,
  fillStyleBooleans: 447,
  lineColor: 448,
  lineOpacity: 449,
  lineWidth: 459,
  lineDashing: 462,
  lineStartArrow: 464,
  lineEndArrow: 465,
  lineStyleBooleans: 511,
  shadowColor: 513,
  shadowOpacity: 516,
  shadowOffsetX: 517,
  shadowOffsetY: 518,
  shadowStyleBooleans: 575
}, Ts = (t) => t > 2147483647 ? t - 4294967296 : t;
function Ht(t, e, n = 1) {
  const o = t >> 24 & 255;
  let s, r, i;
  if (o === 8 || o === 1) {
    const c = t & 255, a = e[c] ?? "000000";
    s = parseInt(a.slice(0, 2), 16), r = parseInt(a.slice(2, 4), 16), i = parseInt(a.slice(4, 6), 16);
  } else
    s = t & 255, r = t >> 8 & 255, i = t >> 16 & 255;
  return n >= 1 ? `rgb(${s},${r},${i})` : `rgba(${s},${r},${i},${Math.round(n * 1e3) / 1e3})`;
}
const Zn = (t, e) => t === void 0 || !(t & e << 16) ? null : (t & e) !== 0;
function Oo(t, e, n) {
  const o = Zn(t.simple.get(q.fillStyleBooleans), 16);
  if (o === !1) return { type: "none" };
  const s = t.simple.get(q.fillType) ?? 0, r = (t.simple.get(q.fillOpacity) ?? 65536) / 65536;
  if (s === 3 || s === 2) {
    const c = t.simple.get(q.fillBlip) ?? t.simple.get(q.pib), a = c !== void 0 ? n(c) : null;
    if (a) return { type: "image", src: a, alpha: r < 1 ? r : void 0 };
  }
  if (s === 4 || s === 5 || s === 6 || s === 7) {
    const c = t.simple.get(q.fillColor), a = t.simple.get(q.fillBackColor);
    if (c !== void 0 || a !== void 0)
      return {
        type: "gradient",
        angle: 90,
        stops: [
          { pos: 0, color: Ht(c ?? 16777215, e, r) },
          { pos: 1, color: Ht(a ?? 16777215, e, r) }
        ]
      };
  }
  const i = t.simple.get(q.fillColor);
  return i === void 0 ? o === !0 ? { type: "solid", color: Ht(16777215, e) } : null : { type: "solid", color: Ht(i, e, r) };
}
const Dc = {
  1: [4, 3],
  2: [1, 3],
  3: [4, 3, 1, 3],
  4: [4, 3, 1, 3, 1, 3],
  5: [8, 3],
  6: [8, 3, 1, 3],
  7: [8, 3, 1, 3, 1, 3],
  8: [1, 1],
  9: [3, 3],
  10: [3, 3, 1, 3]
}, Oe = {
  1: "triangle",
  2: "stealth",
  3: "diamond",
  4: "oval",
  5: "arrow"
};
function Cs(t, e) {
  const n = Zn(t.simple.get(q.lineStyleBooleans), 8);
  if (n === !1) return null;
  const o = t.simple.get(q.lineColor);
  if (o === void 0 && n !== !0) return null;
  const r = (t.simple.get(q.lineWidth) ?? 9525) / 9525, i = t.simple.get(q.lineDashing), c = (t.simple.get(q.lineOpacity) ?? 65536) / 65536, a = t.simple.get(q.lineStartArrow), l = t.simple.get(q.lineEndArrow);
  return {
    color: Ht(o ?? 0, e, c),
    width: r,
    dash: i ? (Dc[i] ?? [4, 3]).map((u) => u * Math.max(r, 1)) : null,
    head: a && Oe[a] ? { type: Oe[a], w: 3, h: 3 } : void 0,
    tail: l && Oe[l] ? { type: Oe[l], w: 3, h: 3 } : void 0
  };
}
function Uc(t, e) {
  if (Zn(t.simple.get(q.shadowStyleBooleans), 2) !== !0) return;
  const n = Ts(t.simple.get(q.shadowOffsetX) ?? 25400) / 9525, o = Ts(t.simple.get(q.shadowOffsetY) ?? 25400) / 9525, s = Math.max(0, Math.min(1, (t.simple.get(q.shadowOpacity) ?? 65536) / 65536)), r = t.simple.get(q.shadowColor) ?? 8421504;
  if (!(s <= 0 || n === 0 && o === 0))
    return { dx: n, dy: o, blur: 4, color: Ht(r, e, s) };
}
const Nc = {
  1: "rect",
  2: "roundRect",
  3: "ellipse",
  4: "diamond",
  5: "triangle",
  6: "rtTriangle",
  7: "parallelogram",
  8: "trapezoid",
  9: "hexagon",
  10: "octagon",
  11: "plus",
  12: "star5",
  13: "rightArrow",
  14: "rightArrow",
  15: "homePlate",
  16: "cube",
  17: "wedgeRoundRectCallout",
  18: "star8",
  19: "arc",
  20: "line",
  21: "plaque",
  22: "can",
  23: "donut",
  // 24-31 为文本形状，统一按矩形文本框处理
  24: "rect",
  25: "octagon",
  26: "hexagon",
  27: "rect",
  28: "wave",
  29: "donut",
  30: "rect",
  31: "donut",
  32: "straightConnector1",
  33: "bentConnector2",
  34: "bentConnector3",
  35: "bentConnector4",
  36: "bentConnector5",
  37: "curvedConnector2",
  38: "curvedConnector3",
  39: "curvedConnector4",
  40: "curvedConnector5",
  41: "callout1",
  42: "callout2",
  43: "callout2",
  44: "callout1",
  45: "callout2",
  46: "callout2",
  47: "borderCallout1",
  48: "borderCallout2",
  49: "borderCallout2",
  50: "borderCallout1",
  51: "borderCallout2",
  52: "borderCallout2",
  53: "ribbon",
  54: "ribbon2",
  55: "chevron",
  56: "pentagon",
  57: "noSmoking",
  58: "star8",
  59: "star16",
  60: "star32",
  61: "wedgeRectCallout",
  62: "wedgeRoundRectCallout",
  63: "wedgeEllipseCallout",
  64: "wave",
  65: "foldedCorner",
  66: "leftArrow",
  67: "downArrow",
  68: "upArrow",
  69: "leftRightArrow",
  70: "upDownArrow",
  71: "irregularSeal1",
  72: "irregularSeal2",
  73: "lightningBolt",
  74: "heart",
  75: "rect",
  // pictureFrame：按图片处理，几何退化为矩形
  76: "quadArrow",
  77: "leftArrowCallout",
  78: "rightArrowCallout",
  79: "upArrowCallout",
  80: "downArrowCallout",
  81: "leftRightArrowCallout",
  82: "upArrowCallout",
  83: "quadArrow",
  84: "bevel",
  85: "leftBracket",
  86: "rightBracket",
  87: "leftBrace",
  88: "rightBrace",
  89: "leftRightUpArrow",
  90: "bentArrow",
  91: "bentArrow",
  92: "star24",
  93: "stripedRightArrow",
  94: "notchedRightArrow",
  95: "blockArc",
  96: "smileyFace",
  97: "verticalScroll",
  98: "horizontalScroll",
  99: "circularArrow",
  100: "circularArrow",
  101: "uturnArrow",
  102: "curvedRightArrow",
  103: "curvedLeftArrow",
  104: "curvedUpArrow",
  105: "curvedDownArrow",
  106: "cloudCallout",
  107: "ribbon",
  108: "ribbon2",
  109: "flowChartProcess",
  110: "flowChartDecision",
  111: "flowChartInputOutput",
  112: "flowChartPredefinedProcess",
  113: "flowChartInternalStorage",
  114: "flowChartDocument",
  115: "flowChartMultidocument",
  116: "flowChartTerminator",
  117: "flowChartPreparation",
  118: "flowChartManualInput",
  119: "flowChartManualOperation",
  120: "flowChartConnector",
  121: "flowChartPunchedCard",
  122: "flowChartPunchedTape",
  123: "flowChartSummingJunction",
  124: "flowChartOr",
  125: "flowChartCollate",
  126: "flowChartSort",
  127: "flowChartExtract",
  128: "flowChartMerge",
  129: "flowChartOnlineStorage",
  130: "flowChartOnlineStorage",
  131: "flowChartMagneticTape",
  132: "flowChartMagneticDisk",
  133: "flowChartMagneticDrum",
  134: "flowChartDisplay",
  135: "flowChartDelay",
  176: "flowChartAlternateProcess",
  177: "flowChartOffpageConnector",
  178: "callout1",
  179: "callout1",
  180: "borderCallout1",
  181: "borderCallout1",
  182: "leftRightUpArrow",
  183: "sun",
  184: "moon",
  185: "bracketPair",
  186: "bracePair",
  187: "star4",
  188: "doubleWave",
  189: "actionButtonBlank",
  190: "actionButtonHome",
  191: "actionButtonHelp",
  192: "actionButtonInformation",
  193: "actionButtonForwardNext",
  194: "actionButtonBackPrevious",
  195: "actionButtonEnd",
  196: "actionButtonBeginning",
  197: "actionButtonReturn",
  198: "actionButtonDocument",
  199: "actionButtonSound",
  200: "actionButtonMovie",
  202: "rect"
  // textBox
}, Bc = 75;
function Fc(t) {
  const e = [];
  if (!t.length) return e;
  const n = new DataView(t.buffer, t.byteOffset, t.byteLength), o = {
    61469: "image/jpeg",
    61470: "image/png",
    61471: "image/bmp",
    61481: "image/tiff",
    61482: "image/jpeg"
  }, s = {
    61466: "image/emf",
    61467: "image/wmf",
    61468: "image/pict"
  };
  for (const r of wt(n, 0, t.length)) {
    const i = r.type in s, c = i ? s[r.type] : o[r.type];
    if (!c) continue;
    let a = r.start + ((r.instance & 1) === 1 ? 32 : 16);
    const l = r.start + r.len;
    if (a >= l) continue;
    if (!i) {
      e.push({ mime: c, data: t.subarray(a + 1, l) });
      continue;
    }
    if (a + 34 > l) continue;
    const u = n.getUint32(a, !0), f = n.getUint8(a + 32), h = t.subarray(a + 34, l);
    if (f === 0)
      try {
        const m = mr(h, u ? { out: new Uint8Array(u) } : void 0);
        e.push({ mime: c, data: m });
      } catch {
        try {
          e.push({ mime: c, data: gr(h) });
        } catch {
        }
      }
    else
      e.push({ mime: c, data: h });
  }
  return e;
}
function Hc(t, e) {
  if (e.len < 8) return null;
  const n = t.getInt16(e.start, !0), o = t.getInt16(e.start + 2, !0), s = t.getInt16(e.start + 4, !0), r = t.getInt16(e.start + 6, !0);
  return { x: o, y: n, w: s - o, h: r - n };
}
function _c(t, e) {
  if (e.len < 16) return null;
  const n = t.getInt32(e.start, !0), o = t.getInt32(e.start + 4, !0), s = t.getInt32(e.start + 8, !0), r = t.getInt32(e.start + 12, !0);
  return { x: n, y: o, w: s - n, h: r - o };
}
function jc(t, e) {
  if (e.len < 16) return null;
  const n = t.getInt32(e.start, !0), o = t.getInt32(e.start + 4, !0), s = t.getInt32(e.start + 8, !0), r = t.getInt32(e.start + 12, !0);
  return { x: n, y: o, w: s - n, h: r - o };
}
function Jn(t, e) {
  return { id: t.getUint32(e.start, !0), flags: t.getUint32(e.start + 4, !0) };
}
const Rt = {
  GROUP: 1,
  PATRIARCH: 4,
  DELETED: 8,
  FLIPH: 64,
  FLIPV: 128,
  BACKGROUND: 1024
};
function Vc(t, e) {
  const n = e.complex.get(q.tableRowProperties);
  if (!n || n.len < 6) return [];
  const o = t.getUint16(n.start, !0), s = t.getInt16(n.start + 4, !0), r = s > 0 ? s : 4, i = [];
  for (let c = 0; c < o; c++) {
    const a = n.start + 6 + c * r;
    if (a + 4 > n.start + n.len) break;
    i.push(t.getInt32(a, !0));
  }
  return i;
}
function Wc(t) {
  return t.simple.has(q.tableProperties) || t.complex.has(q.tableRowProperties);
}
const Gc = {
  1: "dissolve",
  2: "blinds",
  3: "checker",
  4: "cover",
  5: "dissolve",
  6: "fade",
  7: "pull",
  8: "randomBar",
  9: "strips",
  10: "wipe",
  11: "zoom",
  12: "zoom",
  13: "split",
  17: "zoom",
  18: "blinds",
  19: "blinds",
  20: "push",
  21: "comb",
  22: "newsflash",
  23: "fade",
  26: "wedge",
  27: "wheel",
  28: "circle",
  29: "diamond",
  30: "plus"
}, Xc = { 0: "l", 1: "u", 2: "r", 3: "d" }, Yc = { 0: "horz-out", 1: "horz-in", 2: "vert-out", 3: "vert-in" }, qc = { 0: "out", 1: "in" };
function Kc(t, e) {
  if (t === "split") return Yc[e];
  if (t === "zoom" || t === "circle" || t === "diamond" || t === "plus" || t === "wedge")
    return qc[e];
  if (t === "push" || t === "pull" || t === "cover" || t === "wipe" || t === "strips" || t === "blinds" || t === "comb" || t === "wheel" || t === "randomBar")
    return Xc[e];
}
const Zc = { 0: 1e3, 1: 750, 2: 500 }, Jc = 4, Qc = 1024;
function tl(t, e) {
  const n = Q(t, e.start, e.start + e.len, V.SSSlideInfoAtom);
  if (!n || n.len < 13) return null;
  const o = t.getInt32(n.start, !0), s = t.getUint8(n.start + 8), r = t.getUint8(n.start + 9), i = t.getUint16(n.start + 10, !0), c = t.getUint8(n.start + 12), a = Gc[r], l = a === void 0 ? void 0 : {
    type: a,
    dir: Kc(a, s),
    durationMs: Zc[c] ?? 750,
    advanceAfterMs: i & Qc && o > 0 ? o : void 0
  };
  return { hidden: (i & Jc) !== 0, transition: l };
}
const re = { effectId: 9, effectDir: 10, effectClass: 11, nodeType: 20 }, el = 1, nl = 2, sl = 3, ol = {
  1: "appear",
  2: "fly",
  3: "blinds",
  4: "wipe",
  5: "dissolve",
  6: "zoom",
  7: "fly",
  8: "zoom",
  9: "dissolve",
  10: "fade",
  11: "appear",
  12: "fly",
  13: "zoom",
  14: "blinds",
  15: "spin",
  16: "split",
  17: "stretch",
  18: "blinds",
  19: "wheel",
  20: "wheel",
  21: "wipe",
  22: "zoom",
  23: "random",
  24: "spin",
  25: "bounce",
  28: "fade",
  29: "float",
  30: "grow",
  31: "fly",
  32: "spin",
  33: "float",
  34: "swivel",
  35: "fly",
  36: "stretch",
  37: "stretch",
  38: "fly",
  39: "float",
  40: "spin",
  41: "swivel",
  42: "float",
  43: "fly",
  44: "spin",
  45: "stretch",
  46: "stretch",
  47: "float",
  48: "zoom",
  49: "fly",
  50: "stretch",
  51: "swivel",
  52: "stretch",
  53: "grow"
}, rl = {
  1: "u",
  2: "r",
  4: "d",
  8: "l",
  3: "rd",
  6: "ru",
  9: "lu",
  12: "ld",
  5: "horz",
  10: "vert",
  16: "in",
  32: "out"
}, il = {
  1: "entrance",
  2: "exit",
  3: "emphasis",
  4: "motion",
  5: "emphasis",
  6: "emphasis"
}, al = {
  fade: "fade",
  wipe: "wipe",
  barn: "split",
  blinds: "blinds",
  box: "zoom",
  checkerboard: "blinds",
  circle: "zoom",
  diamond: "zoom",
  dissolve: "dissolve",
  plus: "zoom",
  randombar: "blinds",
  slide: "fly",
  strips: "blinds",
  wedge: "wheel",
  wheel: "wheel",
  image: "fade"
};
function cl(t) {
  const e = /^([a-zA-Z]+)(?:\(([^)]*)\))?/.exec(t);
  if (!e) return null;
  const n = al[e[1].toLowerCase()];
  if (!n) return null;
  const o = (e[2] ?? "").toLowerCase(), s = o.startsWith("from"), r = o.includes("left") ? "l" : o.includes("right") ? "r" : o.includes("top") || o.includes("up") ? "u" : o.includes("bottom") || o.includes("down") ? "d" : null, c = r ? s ? r : { l: "r", r: "l", u: "d", d: "u" }[r] : o.includes("vertical") ? "vert" : o.includes("horizontal") ? "horz" : o.includes("in") ? "in" : o.includes("out") ? "out" : void 0;
  return { effect: n, dir: c };
}
function ll(t, e) {
  if (e.len < 5) return null;
  const n = t.getUint8(e.start);
  return n !== 1 && n !== 0 ? null : n === 1 ? t.getInt32(e.start + 1, !0) : t.getUint8(e.start + 1);
}
function ul(t, e) {
  return e.len < 3 || t.getUint8(e.start) !== 3 ? null : Gt(t, e.start + 1, e.len - 1).replace(/\0+$/, "");
}
function vo(t, e) {
  const n = /* @__PURE__ */ new Map(), o = Q(t, e.start, e.start + e.len, St.TimePropertyList);
  if (!o) return n;
  for (const s of Lt(t, o.start, o.start + o.len, St.TimeVariant)) {
    const r = ll(t, s);
    r !== null && n.set(s.instance, r);
  }
  return n;
}
function fl(t, e) {
  for (const n of Lt(t, e.start, e.start + e.len, St.TimeConditionContainer)) {
    if (n.instance !== 1) continue;
    const o = Q(t, n.start, n.start + n.len, St.TimeConditionAtom);
    if (!o || o.len < 16) continue;
    const s = t.getInt32(o.start + 12, !0);
    return s > 0 ? s : 0;
  }
  return 0;
}
function hl(t, e) {
  const n = Q(t, e.start, e.start + e.len, St.TimeNodeAtom);
  if (!n || n.len < 32) return null;
  const o = t.getInt32(n.start + 24, !0);
  return o > 1 ? o : null;
}
function zo(t, e, n, o, s = 12) {
  for (const r of wt(t, e, n)) {
    if (r.type === St.ClientVisualElement) {
      const i = Q(t, r.start, r.start + r.len, St.VisualShapeAtom);
      i && i.len >= 12 && o.target === void 0 && (o.target = t.getUint32(i.start + 8, !0));
      continue;
    }
    if (r.type === St.TimeVariant && o.filter === void 0) {
      const i = ul(t, r);
      i && (o.filter = i);
      continue;
    }
    if (r.type === St.TimeNodeAtom && r.len >= 32 && o.duration === void 0) {
      const i = t.getInt32(r.start + 24, !0);
      i > 1 && (o.duration = i);
      continue;
    }
    r.type === St.ExtTimeNodeContainer && vo(t, r).has(re.effectId) || r.isContainer && s > 0 && zo(t, r.start, r.start + r.len, o, s - 1);
  }
}
function dl(t, e) {
  const n = [], o = (r, i, c) => {
    for (const a of Lt(t, r, i, St.ExtTimeNodeContainer)) {
      const l = vo(t, a);
      if (l.has(re.effectId)) {
        const u = pl(t, a, l);
        u && n.push(u);
        continue;
      }
      c > 0 && o(a.start, a.start + a.len, c - 1);
    }
  };
  for (const r of Po(t, e, "___PPT10"))
    o(r.start, r.start + r.len, 16);
  if (!n.length) return;
  let s = -1;
  for (const r of n)
    (r.trigger === "click" || s < 0) && s++, r.clickGroup = s;
  return n;
}
function pl(t, e, n) {
  const o = {};
  if (zo(t, e.start, e.start + e.len, o), o.target === void 0) return null;
  const s = o.filter ? cl(o.filter) : null, r = (s == null ? void 0 : s.effect) ?? ol[n.get(re.effectId) ?? 10] ?? "fade", i = (s == null ? void 0 : s.dir) ?? rl[n.get(re.effectDir) ?? 0], c = n.get(re.nodeType) ?? el, a = o.duration ?? hl(t, e) ?? 500;
  return {
    target: o.target,
    effect: r,
    dir: i,
    delayMs: fl(t, e),
    durationMs: Math.max(60, Math.min(1e4, a)),
    trigger: c === nl ? "withPrev" : c === sl ? "afterPrev" : "click",
    kind: il[n.get(re.effectClass) ?? 1] ?? "entrance"
  };
}
const Be = 96 / 576, Ro = ["FFFFFF", "000000", "808080", "000000", "CCFFFF", "B2B2B2", "3333CC", "009999"], Do = 15, Uo = 1048576, ml = [
  [Do, 2],
  // bulletFlags：fHasBullet / fBulletHasFont / …
  [128, 2],
  // bullet.char
  [16, 2],
  // bullet.font
  [64, 2],
  // bullet.size
  [32, 4],
  // bullet.color
  [2048, 2],
  // alignment
  [4096, 2],
  // lineSpacing
  [8192, 2],
  // spaceBefore
  [16384, 2],
  // spaceAfter
  [256, 2],
  // leftMargin
  [1024, 2],
  // indent
  [32768, 2],
  // defaultTabSize
  [Uo, -1],
  // tabStops：u16 count + count×4，长度可变
  [65536, 2],
  // fontAlign
  [917504, 2],
  // wrapFlags
  [2097152, 2]
  // textDirection
], gl = [
  [65535, 2],
  // 样式位（粗 / 斜 / 下划线 …）
  [65536, 2],
  // font.index
  [2097152, 2],
  // asian.font.index
  [4194304, 2],
  // ansi.font.index
  [8388608, 2],
  // symbol.font.index
  [131072, 2],
  // font.size
  [262144, 4],
  // font.color
  [524288, 2]
  // superscript
];
function No(t, e, n, o, s) {
  let r = e;
  for (const [i, c] of ml) {
    if (!(o & i)) continue;
    if (i === Uo) {
      if (r + 2 > n || (r += 2 + t.getUint16(r, !0) * 4, r > n)) return -1;
      continue;
    }
    if (r + c > n) return -1;
    const a = c === 2 ? t.getUint16(r, !0) : t.getUint32(r, !0);
    i === Do ? s.hasBullet = (a & 1) !== 0 : i === 128 ? s.bulletChar = String.fromCharCode(a) : i === 256 ? s.leftMargin = a : i === 1024 ? s.indent = a : i === 2048 && (s.align = a), r += c;
  }
  return s.hasBullet === void 0 && o & 128 && (s.hasBullet = !0), r;
}
function Bo(t, e, n, o, s) {
  let r = e;
  for (const [i, c] of gl) {
    if (!(o & i)) continue;
    if (r + c > n) return -1;
    const a = c === 2 ? t.getUint16(r, !0) : t.getUint32(r, !0);
    i === 65535 ? (o & 1 && (s.bold = (a & 1) !== 0), o & 2 && (s.italic = (a & 2) !== 0), o & 4 && (s.underline = (a & 4) !== 0)) : i === 65536 ? s.fontIdx = a : i === 2097152 ? s.asianFontIdx = a : i === 131072 ? s.size = a : i === 262144 && (s.color = a), r += c;
  }
  return r;
}
function Fo(t, e, n) {
  const o = [], s = [];
  let r = e.start;
  const i = e.start + e.len, c = n + 1;
  let a = 0;
  for (; r + 10 <= i && a < c; ) {
    const l = t.getUint32(r, !0), u = t.getUint16(r + 4, !0), f = t.getUint32(r + 6, !0), h = { indentLevel: u }, m = No(t, r + 10, i, f, h);
    if (m < 0 || (r = m, o.push({ chars: l, props: h }), a += l, l === 0)) break;
  }
  for (a = 0; r + 8 <= i && a < c; ) {
    const l = t.getUint32(r, !0);
    if (l > c) break;
    const u = t.getUint32(r + 4, !0), f = {}, h = Bo(t, r + 8, i, u, f);
    if (h < 0 || (r = h, s.push({ chars: l, props: f }), a += l, l === 0)) break;
  }
  return { para: o, char: s };
}
const ft = { TITLE: 0, BODY: 1, NOTES: 2, OTHER: 4, CENTER_BODY: 5, CENTER_TITLE: 6 }, bl = {
  1: ft.TITLE,
  2: ft.BODY,
  3: ft.CENTER_TITLE,
  4: ft.CENTER_BODY,
  6: ft.NOTES,
  12: ft.NOTES,
  13: ft.TITLE,
  14: ft.BODY,
  15: ft.CENTER_TITLE,
  16: ft.CENTER_BODY,
  17: ft.TITLE,
  18: ft.BODY,
  19: ft.BODY
};
function Ho(t, e, n) {
  const o = e.start + e.len;
  let s = e.start;
  if (s + 2 > o) return;
  const r = t.getUint16(s, !0);
  s += 2;
  const i = [];
  for (let c = 0; c < r && (e.instance >= 5 && (s += 2), !(s + 4 > o)); c++) {
    const a = t.getUint32(s, !0), l = {};
    let u = No(t, s + 4, o, a, l);
    if (u < 0 || u + 4 > o) break;
    const f = t.getUint32(u, !0), h = {};
    if (u = Bo(t, u + 4, o, f, h), u < 0) break;
    s = u, i.push({ para: l, char: h });
  }
  i.length && n.set(e.instance, i);
}
const wl = { 0: "left", 1: "center", 2: "right", 3: "justify", 4: "justify" };
function yl(t, e, n) {
  const o = t.text.replace(/\r\n?/g, `
`).replace(/\v/g, `
`);
  if (!o.trim()) return null;
  const s = [];
  let r = 0, i = 0, c = 0;
  const a = (w) => {
    for (; i < t.charProps.length && c >= t.charProps[i].chars; )
      c = 0, i++;
    const b = t.charProps[i];
    if (!b) return { props: {}, take: w };
    const g = Math.max(1, b.chars - c);
    return { props: b.props, take: Math.min(w, g) };
  }, l = t.links ?? [], u = (w) => {
    var b;
    return (b = l.find((g) => w >= g.begin && w < g.end)) == null ? void 0 : b.link;
  }, f = (w, b) => {
    let g = b;
    for (const y of l)
      y.begin > w && y.begin - w < g && (g = y.begin - w), y.end > w && y.end - w < g && (g = y.end - w);
    return Math.max(1, g);
  }, h = t.paraProps.length ? t.paraProps : [{ chars: o.length + 1, props: {} }], m = e.claimAutoNums(h.length), d = [];
  return h.forEach((w, b) => {
    const g = o.slice(r, r + w.chars), y = r;
    r += w.chars;
    const $ = g.split(`
`), x = $.length > 1 && $[$.length - 1] === "", M = x ? $.slice(0, -1) : $, k = w.props, T = e.levelStyle(k.indentLevel ?? 0), S = k.indentLevel ?? 0, A = (m == null ? void 0 : m[b]) ?? null;
    let P = null;
    A && (d.length = S + 1, d[S] = (d[S] ?? A.startNum - 1) + 1, P = Oc(A.scheme, d[S]));
    let L = y;
    M.forEach((C, R) => {
      const z = [];
      let D = 0;
      for (; D < C.length; ) {
        const { props: B, take: X } = a(C.length - D), Y = L + D, Z = f(Y, X), K = C.slice(D, D + Z);
        c += Z, D += Z, z.push(Ls(K, B, T.char, e, u(Y)));
      }
      if ((R < M.length - 1 || x) && (c += 1), !z.length) {
        const { props: B } = a(1);
        z.push(Ls("", B, T.char, e, void 0));
      }
      L += C.length + 1;
      const I = R === 0 ? P : null, O = I !== null || (k.hasBullet ?? T.para.hasBullet ?? !1), _ = k.leftMargin ?? T.para.leftMargin, U = _ !== void 0 ? _ * Be : O ? 24 : 0;
      s.push({
        align: wl[k.align ?? T.para.align ?? 0] ?? "left",
        lvl: S,
        marL: U,
        indent: O ? -Math.min(U, 24) : 0,
        bullet: I ?? (O ? $l(k.bulletChar ?? T.para.bulletChar) : null),
        lineHeight: null,
        spaceBefore: 0,
        spaceAfter: 2,
        runs: z
      });
    });
  }), s.length ? { anchor: n === 1 || n === 5 ? "middle" : n === 2 || n === 6 ? "bottom" : "top", insets: [3.6, 7.2, 3.6, 7.2], wrap: !0, fontScale: 1, paragraphs: s } : null;
}
function Ls(t, e, n, o, s) {
  const r = e.color ?? n.color, i = [];
  for (const c of [e.fontIdx ?? n.fontIdx, e.asianFontIdx ?? n.asianFontIdx]) {
    const a = c !== void 0 ? o.fonts[c] : void 0;
    a && !i.includes(a) && i.push(a);
  }
  return {
    text: t,
    b: e.bold ?? n.bold ?? !1,
    i: e.italic ?? n.italic ?? !1,
    u: e.underline ?? n.underline ?? !1,
    strike: !1,
    size: (e.size ?? n.size ?? 18) * (96 / 72),
    color: r !== void 0 ? Ht(r, o.scheme) : "rgb(0,0,0)",
    fonts: i,
    link: s
  };
}
const xl = {
  108: "●",
  110: "■",
  109: "❑",
  113: "❑",
  117: "◆",
  118: "❖",
  167: "▪",
  168: "◻",
  183: "•",
  216: "➢",
  252: "✓",
  254: "☑"
};
function $l(t) {
  if (!t) return "•";
  const e = t.charCodeAt(0), n = e >= 61440 && e <= 61695 ? e - 61440 : e, o = xl[n];
  return o && (e >= 61440 || e > 127) ? o : e >= 61440 || e < 32 || e === 65533 ? "•" : t;
}
function Ml(t, e) {
  const n = t.autoNumCursor;
  if (e <= 0 || n + e > t.autoNums.length) return;
  const o = t.autoNums.slice(n, n + e);
  if (o.some((s) => s !== null))
    return t.autoNumCursor = n + e, o;
}
function El(t, e, n) {
  const o = `${e}:${n}`, s = t.levelCache.get(o);
  if (s) return s;
  const r = (a, l) => {
    const u = a.get(l);
    if (!(!u || !u.length))
      return u[Math.min(n, u.length - 1)];
  }, i = [
    r(t.envStyles, ft.OTHER),
    r(t.styles, ft.OTHER),
    r(t.styles, e)
  ], c = {
    para: Object.assign({}, ...i.map((a) => (a == null ? void 0 : a.para) ?? {})),
    char: Object.assign({}, ...i.map((a) => (a == null ? void 0 : a.char) ?? {}))
  };
  return t.levelCache.set(o, c), c;
}
function kl(t, e) {
  return {
    fonts: t.fonts,
    scheme: t.scheme,
    levelStyle: (n) => El(t, e, n),
    claimAutoNums: (n) => Ml(t, n)
  };
}
function Sl(t, e) {
  const { dv: n } = t;
  let o = null, s = null, r;
  const i = [];
  let c;
  for (const l of wt(n, e.start, e.start + e.len))
    if (l.type === V.TextCharsAtom) o = Gt(n, l.start, l.len);
    else if (l.type === V.TextBytesAtom) o = Qe(n, l.start, l.len);
    else if (l.type === V.StyleTextPropAtom) s = l;
    else if (l.type === V.TextHeaderAtom && l.len >= 4) r = n.getUint32(l.start, !0);
    else if (l.type === V.InteractiveInfo) c = _o(t, l);
    else if (l.type === V.TextInteractiveInfoAtom && l.len >= 8) {
      const u = n.getUint32(l.start, !0), f = n.getUint32(l.start + 4, !0);
      c && f > u && i.push({ begin: u, end: f, link: c }), c = void 0;
    }
  if (o === null) return null;
  const a = s ? Fo(n, s, o.length) : { para: [], char: [] };
  return { text: o, paraProps: a.para, charProps: a.char, textType: r, links: i.length ? i : void 0 };
}
function Tl(t, e) {
  const { dv: n } = t, o = Q(n, e.start, e.start + e.len, rt.ClientData);
  if (!o) return null;
  const s = Q(n, o.start, o.start + o.len, V.OEPlaceholderAtom);
  return s && s.len >= 6 ? n.getUint8(s.start + 4) : null;
}
const Cl = {
  1: (t, e) => Math.min(t + 1, e),
  2: (t) => Math.max(t - 1, 1),
  3: () => 1,
  4: (t, e) => e
};
function _o(t, e) {
  const { dv: n } = t, o = Q(n, e.start, e.start + e.len, V.InteractiveInfoAtom);
  if (!o || o.len < 16) return;
  const s = n.getUint32(o.start + 4, !0), r = t.links.get(s);
  if (r) return r;
  const i = Cl[n.getUint8(o.start + 10)];
  return i ? `slide:${i(t.slideIndex, t.slideCount)}` : void 0;
}
function Ll(t, e) {
  const { dv: n } = t, o = Q(n, e.start, e.start + e.len, rt.ClientData);
  if (!o) return;
  const s = Q(n, o.start, o.start + o.len, V.InteractiveInfo);
  return s ? _o(t, s) : void 0;
}
function Al(t, e) {
  const n = /* @__PURE__ */ new Map(), o = Q(t, e.start, e.start + e.len, V.ExObjList);
  if (!o) return n;
  for (const s of Lt(t, o.start, o.start + o.len, V.ExHyperlink)) {
    let r = null, i = null, c = null;
    for (const l of wt(t, s.start, s.start + s.len))
      if (l.type === V.ExHyperlinkAtom && l.len >= 4) r = t.getUint32(l.start, !0);
      else if (l.type === V.CString) {
        const u = Gt(t, l.start, l.len).replace(/\0+$/, "");
        l.instance === 1 ? i = u : l.instance === 0 && (c = u);
      }
    const a = i ?? c;
    r !== null && a && n.set(r, a);
  }
  return n;
}
function Pl(t, e, n) {
  const o = t.trim();
  if (!o) return null;
  const s = o.toLowerCase(), r = /^#?action\?jump=(.+)$/.exec(s) ?? /^#action\?jump=(.+)$/.exec(s);
  if (r) {
    const c = r[1];
    if (c === "firstslide") return "slide:1";
    if (c === "lastslide") return `slide:${n}`;
    if (c === "nextslide") return `slide:${Math.min(e + 1, n)}`;
    if (c === "previousslide") return `slide:${Math.max(e - 1, 1)}`;
    const a = /(\d+)/.exec(c);
    return a ? `slide:${a[1]}` : null;
  }
  const i = /^\s*\d+\s*,\s*(\d+)\s*,/.exec(o);
  if (i) return `slide:${i[1]}`;
  if (o.startsWith("#")) {
    const c = /(\d+)\s*$/.exec(o);
    return c ? `slide:${c[1]}` : null;
  }
  return /^[a-z][a-z0-9+.-]*:/.test(s) ? o : /^www\./.test(s) ? `https://${o}` : o;
}
function jo(t, e, n) {
  const { dv: o } = t, s = Q(o, e.start, e.start + e.len, rt.ClientAnchor);
  if (s) {
    const i = Hc(o, s);
    if (i) return { x: i.x * t.scale, y: i.y * t.scale, w: i.w * t.scale, h: i.h * t.scale };
  }
  const r = Q(o, e.start, e.start + e.len, rt.ChildAnchor);
  if (r) {
    const i = _c(o, r);
    if (i) return { x: n.x + i.x * n.sx, y: n.y + i.y * n.sy, w: i.w * n.sx, h: i.h * n.sy };
  }
  return null;
}
function Vo(t, e, n, o) {
  const s = n.simple.get(q.rotation), r = {
    x: t.x,
    y: t.y,
    w: t.w,
    h: t.h,
    rot: s !== void 0 ? s / 65536 % 360 : 0,
    // 翻转标志在 Sp 记录的 flags 里，不在属性表
    flipH: (e.flags & Rt.FLIPH) !== 0,
    flipV: (e.flags & Rt.FLIPV) !== 0,
    // 动画按 Escher 形状 id 定位目标
    id: e.id
  }, i = Uc(n, o);
  return i && (r.effects = { shadow: i }), r;
}
function As(t, e, n) {
  const { dv: o } = t, s = Q(o, e.start, e.start + e.len, rt.Sp);
  if (!s) return null;
  const r = Jn(o, s);
  if (r.flags & Rt.DELETED || r.flags & (Rt.PATRIARCH | Rt.GROUP) || r.flags & Rt.BACKGROUND) return null;
  const i = Tl(t, e);
  if (t.masterPass && i !== null && i !== 0) return null;
  const c = s.instance, a = Q(o, e.start, e.start + e.len, rt.Opt), l = a ? Kn(o, a) : { simple: /* @__PURE__ */ new Map(), complex: /* @__PURE__ */ new Map() }, u = jo(t, e, n);
  if (!u || u.w <= 0 || u.h <= 0) return null;
  const f = Vo(u, r, l, t.scheme), h = Ll(t, e);
  h && (f.link = h);
  const m = (T) => t.blobs[T - 1] ?? null, d = l.simple.get(q.pib);
  if (d !== void 0 && (c === Bc || d > 0)) {
    const T = m(d);
    if (T)
      return { kind: "image", ...f, src: T, crop: null, stroke: Cs(l, t.scheme) };
  }
  const p = Oo(l, t.scheme, m), w = Cs(l, t.scheme);
  let b = null, g = !1;
  if (c === 0 && l.complex.has(q.pVertices) && (b = vl(t, l, u.w, u.h)), !b) {
    const T = Nc[c] ?? "rect", S = xr(T, u.w, u.h, Ol(l, c));
    b = S.d, g = S.open;
  }
  const y = Q(o, e.start, e.start + e.len, rt.ClientTextbox);
  let $ = y ? Sl(t, y) : null;
  if (!$) {
    const T = l.simple.get(q.lTxid);
    T !== void 0 && t.listText[T] && ($ = t.listText[T]);
  }
  const x = ($ == null ? void 0 : $.textType) ?? (i !== null ? bl[i] : void 0) ?? ft.OTHER, M = $ ? yl($, kl(t, x), l.simple.get(q.anchorText)) : null;
  return !M && (!p || p.type === "none") && !w ? null : {
    kind: "shape",
    ...f,
    path: b,
    fill: g ? { type: "none" } : p,
    stroke: w,
    text: M,
    openGeom: g || void 0
  };
}
const Il = /* @__PURE__ */ new Set([19, 98, 102, 103]);
function Ol(t, e) {
  const n = Il.has(e), o = {}, s = [
    [q.adjustValue, "adj1"],
    [q.adjust2Value, "adj2"],
    [q.adjust3Value, "adj3"],
    [q.adjust4Value, "adj4"]
  ];
  for (const [r, i] of s) {
    const c = t.simple.get(r);
    if (c === void 0) continue;
    const a = c > 2147483647 ? c - 4294967296 : c;
    if (n) {
      o[i] = a / 65536 * 6e4;
      continue;
    }
    Math.abs(a) > 21600 * 4 || (o[i] = a / 21600 * 1e5);
  }
  return o.adj1 !== void 0 && (o.adj = o.adj1), o;
}
function vl(t, e, n, o) {
  const { dv: s } = t, r = e.complex.get(q.pVertices), i = e.complex.get(q.pSegmentInfo);
  if (!r) return null;
  const c = ($, x) => {
    const M = s.getUint16($.start, !0), k = s.getInt16($.start + 4, !0), T = k === -4 ? 8 : k, S = [];
    for (let A = 0; A < M; A++) {
      const P = $.start + 6 + A * T;
      if (P + T > $.start + $.len) break;
      S.push(x(P));
    }
    return S;
  }, a = s.getInt16(r.start + 4, !0), l = c(
    r,
    ($) => a === 4 ? [s.getInt16($, !0), s.getInt16($ + 2, !0)] : [s.getInt32($, !0), s.getInt32($ + 4, !0)]
  );
  if (!l.length) return null;
  const u = e.simple.get(q.geoLeft) ?? 0, f = e.simple.get(q.geoTop) ?? 0, h = e.simple.get(q.geoRight) ?? 21600, m = e.simple.get(q.geoBottom) ?? 21600, d = n / Math.max(1, h - u), p = o / Math.max(1, m - f), w = ($) => `${(($[0] - u) * d).toFixed(2)} ${(($[1] - f) * p).toFixed(2)}`;
  if (!i) return `M ${l.map(w).join(" L ")} Z`;
  const b = c(i, ($) => [s.getUint16($, !0)]), g = [];
  let y = 0;
  for (const [$] of b) {
    const x = $ >> 13;
    if ($ === 16384) g.push(`M ${w(l[y++] ?? [0, 0])}`);
    else if ($ === 24577) g.push("Z");
    else {
      if ($ === 32768) break;
      if (x === 2 || $ === 45824) {
        const M = l[y++], k = l[y++], T = l[y++];
        M && k && T && g.push(`C ${w(M)} ${w(k)} ${w(T)}`);
      } else if ($ < 16384) {
        const M = $ & 4095;
        for (let k = 0; k < Math.max(1, M) && l[y]; k++) g.push(`L ${w(l[y++])}`);
      }
    }
  }
  return g.length ? g.join(" ") : `M ${l.map(w).join(" L ")} Z`;
}
const zl = (t) => ({ x: 0, y: 0, sx: t.scale, sy: t.scale });
function Wo(t, e, n, o = 0) {
  const { dv: s } = t, r = [], i = [...wt(s, e.start, e.start + e.len)], c = i.find((m) => m.type === rt.SpContainer), a = c ? Rl(t, c, n) : null, l = (a == null ? void 0 : a.rec) ?? null;
  let u = n;
  if (a) {
    const m = a.box.w / a.space.w, d = a.box.h / a.space.h;
    u = { x: a.box.x - a.space.x * m, y: a.box.y - a.space.y * d, sx: m, sy: d };
  }
  const f = (m) => {
    const d = [];
    for (const p of i) {
      if (p === l || p.type !== rt.SpContainer) continue;
      const w = As(t, p, m);
      w && d.push(w);
    }
    return d;
  };
  if (a && Wc(a.props)) {
    const m = f(u), d = Ps(m, Vc(s, a.props).map((p) => p * t.scale));
    return d ? [d] : m;
  }
  if (a && i.filter((m) => m.type === rt.SpContainer).length >= 4) {
    const m = Dl(f(u));
    if (Ul(m)) {
      const d = Ps(m, []);
      if (d) return [d];
    }
  }
  const h = (m, d) => {
    for (const p of i)
      if (p !== l)
        if (p.type === rt.SpContainer) {
          const w = As(t, p, m);
          w && d.push(w);
        } else p.type === rt.SpgrContainer && o < 8 && d.push(...Wo(t, p, m, o + 1));
  };
  if (a) {
    const m = [];
    if (h(zl(t), m), !m.length) return [];
    const d = a.space.w * t.scale, p = a.space.h * t.scale;
    return [{
      kind: "group",
      ...Vo(a.box, a.sp, a.props, t.scheme),
      childX: a.space.x * t.scale,
      childY: a.space.y * t.scale,
      scaleX: a.box.w / d,
      scaleY: a.box.h / p,
      children: m
    }];
  }
  return h(u, r), r;
}
function Rl(t, e, n) {
  const { dv: o } = t, s = Q(o, e.start, e.start + e.len, rt.Spgr), r = Q(o, e.start, e.start + e.len, rt.Sp);
  if (!s || !r) return null;
  const i = Jn(o, r);
  if (!(i.flags & Rt.GROUP) || i.flags & Rt.PATRIARCH) return null;
  const c = jc(o, s), a = jo(t, e, n);
  if (!c || !a || c.w <= 0 || c.h <= 0 || a.w <= 0 || a.h <= 0) return null;
  const l = Q(o, e.start, e.start + e.len, rt.Opt), u = l ? Kn(o, l) : { simple: /* @__PURE__ */ new Map(), complex: /* @__PURE__ */ new Map() };
  return { rec: e, sp: i, props: u, box: a, space: c };
}
function Dl(t) {
  const e = t.filter((s) => s.kind === "shape");
  if (e.length !== t.length) return t;
  const n = 3, o = [];
  for (const s of e) {
    const r = o.find(
      (i) => Math.abs(i.x - s.x) <= n && Math.abs(i.y - s.y) <= n && Math.abs(i.w - s.w) <= n * 2 && Math.abs(i.h - s.h) <= n * 2
    );
    if (!r) {
      o.push({ ...s });
      continue;
    }
    !r.text && s.text && (r.text = s.text), (!r.fill || r.fill.type === "none") && s.fill && s.fill.type !== "none" && (r.fill = s.fill), !r.stroke && s.stroke && (r.stroke = s.stroke);
  }
  return o;
}
function Ul(t) {
  const e = t.filter((l) => l.kind === "shape" && l.path !== null);
  if (e.length < 4 || e.length !== t.length) return !1;
  const n = 2.5, o = (l) => {
    const u = [...l].sort((h, m) => h - m), f = [];
    for (const h of u) (!f.length || h - f[f.length - 1] > n) && f.push(h);
    return f;
  }, s = o(e.map((l) => l.x)), r = o(e.map((l) => l.y));
  if (s.length < 2 || r.length < 2 || e.length > s.length * r.length || e.length < s.length * r.length * 0.5) return !1;
  const i = (l, u, f) => {
    for (let h = 0; h + 1 < l.length; h++)
      if (!u.some((d, p) => Math.abs(d - l[h]) <= n && Math.abs(f[p] - l[h + 1]) <= n * 2)) return !1;
    return !0;
  }, c = i(s, e.map((l) => l.x), e.map((l) => l.x + l.w)), a = i(r, e.map((l) => l.y), e.map((l) => l.y + l.h));
  return c && a;
}
function Ps(t, e) {
  var g, y, $;
  const n = t.filter((x) => x.kind === "shape");
  if (n.length < 2) return null;
  const o = 2, s = (x) => {
    const M = [...x].sort((T, S) => T - S), k = [];
    for (const T of M) (!k.length || T - k[k.length - 1] > o) && k.push(T);
    return k;
  }, r = s(n.map((x) => x.x)), i = s(n.map((x) => x.y));
  if (r.length < 1 || i.length < 1) return null;
  const c = r[0], a = i[0], l = Math.max(...n.map((x) => x.x + x.w)), u = Math.max(...n.map((x) => x.y + x.h)), f = r.map((x, M) => (M + 1 < r.length ? r[M + 1] : l) - x), h = i.map((x, M) => (M + 1 < i.length ? i[M + 1] : u) - x), m = e.length === i.length ? e : h, d = (x) => {
    let M = 0;
    for (let k = 0; k < r.length; k++) x >= r[k] - o && (M = k);
    return M;
  }, p = (x) => {
    let M = 0;
    for (let k = 0; k < i.length; k++) x >= i[k] - o && (M = k);
    return M;
  }, w = i.map(() => r.map(() => null));
  for (const x of n) {
    const M = p(x.y), k = d(x.x);
    if (w[M][k]) continue;
    let T = 0;
    for (let A = k; A < r.length && r[A] < x.x + x.w - o; A++) T++;
    let S = 0;
    for (let A = M; A < i.length && i[A] < x.y + x.h - o; A++) S++;
    w[M][k] = {
      colSpan: Math.max(1, T),
      rowSpan: Math.max(1, S),
      merged: !1,
      fill: x.fill,
      text: x.text,
      borders: { l: x.stroke, r: x.stroke, t: x.stroke, b: x.stroke },
      vAlign: ((g = x.text) == null ? void 0 : g.anchor) === "middle" ? "middle" : ((y = x.text) == null ? void 0 : y.anchor) === "bottom" ? "bottom" : "top"
    };
    for (let A = M; A < M + Math.max(1, S); A++)
      for (let P = k; P < k + Math.max(1, T); P++)
        A === M && P === k || (($ = w[A]) == null ? void 0 : $[P]) === null && (w[A][P] = { colSpan: 1, rowSpan: 1, merged: !0, fill: null, text: null });
  }
  const b = w.map((x, M) => ({
    height: m[M] ?? 0,
    cells: x.map((k) => k ?? { colSpan: 1, rowSpan: 1, merged: !1, fill: null, text: null })
  }));
  return {
    kind: "table",
    x: c,
    y: a,
    w: l - c,
    h: u - a,
    rot: 0,
    flipH: !1,
    flipV: !1,
    colWidths: f,
    rows: b,
    name: "表格"
  };
}
function Nl(t, e) {
  const n = /* @__PURE__ */ new Map();
  for (const o of wt(t, 0, e)) {
    if (o.type !== V.PersistDirectoryAtom) continue;
    const s = o.start + o.len;
    let r = o.start;
    for (; r + 4 <= s; ) {
      const i = t.getUint32(r, !0);
      r += 4;
      const c = i & 1048575, a = i >>> 20;
      for (let l = 0; l < a && r + 4 <= s; l++, r += 4)
        n.set(c + l, t.getUint32(r, !0));
    }
  }
  return n;
}
function wn(t, e, n, o, s, r) {
  const i = [];
  for (const c of Lt(t, e.start, e.start + e.len, V.SlideListWithText))
    if (c.instance === n)
      for (const a of Lt(t, c.start, c.start + c.len, V.SlidePersistAtom)) {
        if (a.len < 16) continue;
        const l = o.get(t.getUint32(a.start, !0)), u = l !== void 0 ? s.get(l) : void 0;
        u && r.includes(u.type) && i.push({ rec: u, slideId: t.getUint32(a.start + 12, !0) });
      }
  return i;
}
function Pn(t, e, n) {
  for (const o of Lt(t, e.start, e.start + e.len, V.ColorSchemeAtom)) {
    if (o.instance !== n || o.len < 32) continue;
    const s = [];
    for (let r = 0; r < 8; r++) {
      const i = t.getUint32(o.start + r * 4, !0), c = [i & 255, i >> 8 & 255, i >> 16 & 255];
      s.push(c.map((a) => a.toString(16).padStart(2, "0")).join(""));
    }
    return s;
  }
  return null;
}
function Go(t, e, n, o) {
  const s = Q(t, e.start, e.start + e.len, rt.DgContainer);
  if (!s) return null;
  for (const r of Lt(t, s.start, s.start + s.len, rt.SpContainer)) {
    const i = Q(t, r.start, r.start + r.len, rt.Sp);
    if (!i || !(Jn(t, i).flags & Rt.BACKGROUND)) continue;
    const c = Q(t, r.start, r.start + r.len, rt.Opt);
    if (!c) continue;
    const a = Kn(t, c);
    if (!a.simple.has(q.fillColor) && !a.simple.has(q.fillType) && !a.simple.has(q.fillBlip)) continue;
    const l = Oo(a, n, o);
    if (l && l.type !== "none") return l;
  }
  return null;
}
function Xo(t, e) {
  const n = [], o = Q(t.dv, e.start, e.start + e.len, rt.DgContainer);
  if (!o) return n;
  for (const s of Lt(t.dv, o.start, o.start + o.len, rt.SpgrContainer))
    n.push(...Wo(t, s, { x: 0, y: 0, sx: t.scale, sy: t.scale }));
  return n;
}
function Bl(t, e, n) {
  const o = Pn(t, e, 1) ?? Pn(t, e, 6) ?? Ro, s = /* @__PURE__ */ new Map();
  for (const u of Lt(t, e.start, e.start + e.len, V.TxMasterStyleAtom))
    Ho(t, u, s);
  const r = Q(t, e.start, e.start + e.len, V.PPDrawing), c = r ? Go(t, r, o, (u) => n.blobs[u - 1] ?? null) : null, a = {
    dv: t,
    scheme: o,
    fonts: n.fonts,
    blobs: n.blobs,
    listText: [],
    scale: n.scale,
    styles: s,
    envStyles: n.envStyles,
    links: /* @__PURE__ */ new Map(),
    masterPass: !0,
    levelCache: /* @__PURE__ */ new Map(),
    slideIndex: 1,
    slideCount: 1,
    autoNums: Io(t, e),
    autoNumCursor: 0
  }, l = r ? Xo(a, r) : [];
  return { scheme: o, styles: s, background: c, elements: l };
}
function Fl(t, e) {
  const n = [];
  let o = -1;
  const s = (r, i, c) => {
    for (const a of wt(t, r, i))
      if (a.type === V.TextHeaderAtom && a.len >= 4) o = t.getUint32(a.start, !0);
      else if (a.type === V.TextCharsAtom || a.type === V.TextBytesAtom) {
        if (o === ft.NOTES) {
          const u = (a.type === V.TextCharsAtom ? Gt(t, a.start, a.len) : Qe(t, a.start, a.len)).replace(/\r\n?/g, `
`).replace(/\v/g, `
`).replace(/\0/g, "").trim();
          u && n.push(u);
        }
        o = -1;
      } else a.isContainer && c < 8 && s(a.start, a.start + a.len, c + 1);
  };
  return s(e.start, e.start + e.len, 0), n.join(`
`);
}
function Hl(t, e) {
  var D;
  const n = new Mo(t);
  if (n.stream("EncryptedPackage") || n.stream("EncryptionInfo"))
    throw new Error("该文件是加密的 OOXML 容器，请用 parse(input, { password })");
  let o = n.stream("PowerPoint Document");
  if (!o) throw new Error("无效的 .ppt：找不到 PowerPoint Document 流");
  const s = n.stream("Current User");
  if ($c(s) && s) {
    const I = Wa();
    if (!I) throw new Error("该 .ppt 已加密，但未注入解密器（setPptDecryptor）");
    if (e === void 0) throw new Error("该 .ppt 已加密，请通过 parse(input, { password }) 提供打开密码");
    const O = I(o, s, e);
    if (!O) throw new Error("该 .ppt 已加密，但加密结构无法识别");
    o = O;
  }
  const r = new DataView(o.buffer, o.byteOffset, o.byteLength);
  let i = 720 * (96 / 72), c = 540 * (96 / 72);
  const a = n.stream("Pictures"), u = (a ? Fc(a) : []).map((I) => {
    try {
      return I.mime === "image/emf" || I.mime === "image/wmf" || I.mime === "image/pict" ? br(I.data) : URL.createObjectURL(new Blob([I.data.slice().buffer], { type: I.mime }));
    } catch {
      return null;
    }
  }), f = /* @__PURE__ */ new Map(), h = [];
  for (const I of wt(r, 0, o.length))
    f.set(I.start - 8, I), h.push(I);
  const m = [], d = /* @__PURE__ */ new Map(), p = Q(r, 0, o.length, V.Document), w = (I, O, _) => {
    for (const U of wt(r, I, O)) {
      if (U.type === V.DocumentAtom && U.len >= 8)
        i = r.getInt32(U.start, !0) * Be, c = r.getInt32(U.start + 4, !0) * Be;
      else if (U.type === V.FontEntityAtom) {
        const B = Gt(r, U.start, Math.min(U.len, 64)).replace(/\0.*$/, "");
        B && (m[U.instance < 512 ? U.instance : m.length] = B);
      } else U.type === V.TxMasterStyleAtom && Ho(r, U, d);
      U.isContainer && _ < 4 && w(U.start, U.start + U.len, _ + 1);
    }
  };
  p && w(p.start, p.start + p.len, 0);
  const b = { fonts: m, blobs: u, scale: Be, envStyles: d }, g = Nl(r, o.length), y = (I) => h.filter((O) => O.type === I);
  let $ = p ? wn(r, p, 0, g, f, [V.Slide]) : [];
  $.length || ($ = y(V.Slide).map((I) => ({ rec: I, slideId: 0 })));
  const x = p ? wn(r, p, 1, g, f, [V.MainMaster, V.Slide]) : [], M = p ? wn(r, p, 2, g, f, [V.Notes]) : [], k = /* @__PURE__ */ new Map(), T = /* @__PURE__ */ new Map();
  for (const I of x) T.set(I.slideId, I.rec);
  const S = ((D = x[0]) == null ? void 0 : D.rec) ?? y(V.MainMaster)[0] ?? null, A = (I) => {
    const O = T.get(I) ?? S;
    if (!O) return null;
    const _ = O.start;
    let U = k.get(_);
    return U || (U = Bl(r, O, b), k.set(_, U)), U;
  }, P = /* @__PURE__ */ new Map();
  for (const I of M) P.set(I.slideId, I.rec);
  const L = /* @__PURE__ */ new Map();
  for (const I of y(V.Notes)) {
    const O = Q(r, I.start, I.start + I.len, V.NotesAtom);
    O && O.len >= 4 && L.set(r.getUint32(O.start, !0), I);
  }
  const C = p ? Al(r, p) : /* @__PURE__ */ new Map(), R = $.length;
  let z = $.map((I, O) => {
    const _ = Q(r, I.rec.start, I.rec.start + I.rec.len, V.SlideAtom), U = _ && _.len >= 24 ? r.getUint32(_.start + 12, !0) : 0, B = _ && _.len >= 24 ? r.getUint32(_.start + 16, !0) : 0, X = _ && _.len >= 24 ? r.getUint16(_.start + 20, !0) : 7, Y = P.get(B) ?? L.get(I.slideId) ?? null;
    return jl(r, I.rec, b, {
      master: A(U),
      followMasterObjects: (X & 1) !== 0,
      followMasterBackground: (X & 4) !== 0,
      notes: Y ? Fl(r, Y) : "",
      hyperlinks: C,
      index: O + 1,
      count: R
    });
  });
  if (!z.length || z.every((I) => !I.elements.length)) {
    const I = _l(r, o.length, i, c);
    I.length && (z = I);
  }
  if (!z.length) throw new Error(".ppt 中未找到幻灯片");
  return { width: i, height: c, slides: z, source: "ppt" };
}
function _l(t, e, n, o) {
  const s = function f(h, m, d) {
    for (const p of wt(t, h, m)) {
      if (p.type === V.SlideListWithText && p.instance === 0) return p;
      if (p.isContainer && d < 4) {
        const w = f(p.start, p.start + p.len, d + 1);
        if (w) return w;
      }
    }
    return null;
  }(0, e, 0);
  if (!s) return [];
  const r = [];
  let i = null, c = 4;
  for (const f of wt(t, s.start, s.start + s.len))
    if (f.type === V.SlidePersistAtom)
      i = { titles: [], bodies: [] }, r.push(i);
    else if (f.type === V.TextHeaderAtom && f.len >= 4)
      c = t.getUint32(f.start, !0);
    else if (i && (f.type === V.TextCharsAtom || f.type === V.TextBytesAtom)) {
      const h = f.type === V.TextCharsAtom ? Gt(t, f.start, f.len) : Qe(t, f.start, f.len);
      (c === 0 || c === 6 ? i.titles : i.bodies).push(h);
    }
  const a = (f, h, m, d) => ({
    text: f,
    b: m,
    i: !1,
    u: !1,
    strike: !1,
    size: h,
    color: d,
    fonts: []
  }), l = (f, h) => ({
    align: "left",
    lvl: 0,
    marL: h ? 24 : 0,
    indent: h ? -24 : 0,
    bullet: h,
    lineHeight: null,
    spaceBefore: 0,
    spaceAfter: 6,
    runs: f
  }), u = (f) => f.split(/[\r\n\v]/).map((h) => h.trim()).filter(Boolean);
  return r.filter((f) => f.titles.length || f.bodies.length).map((f) => {
    const h = [];
    return f.titles.length && h.push({
      kind: "shape",
      x: n * 0.06,
      y: o * 0.05,
      w: n * 0.88,
      h: o * 0.16,
      rot: 0,
      flipH: !1,
      flipV: !1,
      path: null,
      fill: null,
      stroke: null,
      text: {
        anchor: "middle",
        insets: [4, 8, 4, 8],
        wrap: !0,
        fontScale: 1,
        paragraphs: f.titles.flatMap((m) => u(m).map((d) => l([a(d, 34, !0, "rgb(30,30,30)")], null)))
      }
    }), f.bodies.length && h.push({
      kind: "shape",
      x: n * 0.06,
      y: o * 0.24,
      w: n * 0.88,
      h: o * 0.68,
      rot: 0,
      flipH: !1,
      flipV: !1,
      path: null,
      fill: null,
      stroke: null,
      text: {
        anchor: "top",
        insets: [4, 8, 4, 8],
        wrap: !0,
        fontScale: 1,
        paragraphs: f.bodies.flatMap((m) => u(m).map((d) => l([a(d, 20, !1, "rgb(50,50,50)")], "•")))
      }
    }), { background: { type: "solid", color: "rgb(255,255,255)" }, elements: h };
  });
}
function jl(t, e, n, o) {
  var M, k, T;
  const s = e.start + e.len, r = Pn(t, e, 1) ?? ((M = o.master) == null ? void 0 : M.scheme) ?? Ro, i = [];
  let c = null, a = null, l;
  const u = () => {
    if (a === null) return;
    const S = c ? Fo(t, c, a.length) : { para: [], char: [] };
    i.push({ text: a, paraProps: S.para, charProps: S.char, textType: l }), a = null, c = null, l = void 0;
  };
  for (const S of wt(t, e.start, s))
    S.type === V.TextHeaderAtom ? (u(), S.len >= 4 && (l = t.getUint32(S.start, !0))) : S.type === V.TextCharsAtom ? a = Gt(t, S.start, S.len) : S.type === V.TextBytesAtom ? a = Qe(t, S.start, S.len) : S.type === V.StyleTextPropAtom && (c = S);
  u();
  const f = /* @__PURE__ */ new Map();
  for (const [S, A] of o.hyperlinks) {
    const P = Pl(A, o.index, o.count);
    P && f.set(S, P);
  }
  const h = {
    dv: t,
    scheme: r,
    fonts: n.fonts,
    blobs: n.blobs,
    listText: i,
    scale: n.scale,
    styles: ((k = o.master) == null ? void 0 : k.styles) ?? /* @__PURE__ */ new Map(),
    envStyles: n.envStyles,
    links: f,
    masterPass: !1,
    levelCache: /* @__PURE__ */ new Map(),
    slideIndex: o.index,
    slideCount: o.count,
    autoNums: Io(t, e),
    autoNumCursor: 0
  }, m = [];
  o.master && o.followMasterObjects && m.push(...o.master.elements);
  const d = Q(t, e.start, s, V.PPDrawing);
  d && m.push(...Xo(h, d));
  const w = d ? Go(t, d, r, (S) => n.blobs[S - 1] ?? null) : null, g = (o.followMasterBackground ? ((T = o.master) == null ? void 0 : T.background) ?? null : null) ?? w ?? { type: "solid", color: Ht(134217728, r) }, y = tl(t, e), $ = y == null ? void 0 : y.transition, x = dl(t, e);
  return {
    background: g,
    elements: m,
    notes: o.notes || void 0,
    hidden: y != null && y.hidden ? !0 : void 0,
    transition: $,
    animations: x
  };
}
const Vl = /[、。，．：；！？」』】〕）》〉｝］”’]/, Yo = /[「『【〔（《〈｛［“‘]/, qo = (t) => Yo.test(t);
function Qn(t) {
  return Vl.test(t) || Yo.test(t) ? 0.5 : 0;
}
function je(t) {
  let e = 0;
  for (const n of t) e += Qn(n);
  return e;
}
function Wl(t) {
  const e = t.codePointAt(0) ?? 0;
  return e >= 4352 && e <= 4447 || e >= 11904 && e <= 12350 || e >= 12353 && e <= 13311 || e >= 13312 && e <= 19903 || e >= 19968 && e <= 40959 || e >= 40960 && e <= 42191 || e >= 44032 && e <= 55203 || e >= 63744 && e <= 64255 || e >= 65072 && e <= 65135 || e >= 65280 && e <= 65376 || e >= 65504 && e <= 65510 || e >= 131072 && e <= 262141;
}
const Gl = "'Cambria Math','Latin Modern Math','STIX Two Math','Times New Roman',serif", J = (t) => String(Math.round(t * 100) / 100), Is = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"), Os = {
  "̀": "ˋ",
  "́": "ˊ",
  "̂": "ˆ",
  "̃": "˜",
  "̆": "˘",
  "̇": "˙",
  "̈": "¨",
  "̊": "˚",
  "̌": "ˇ",
  "⃖": "←",
  "⃗": "→",
  "⃡": "↔",
  "⃛": "⋯",
  "⃜": "⋯"
}, ve = /* @__PURE__ */ new Set(["̅", "̄", "‾", "¯", "̲", "̳", "_"]), Xl = /* @__PURE__ */ new Set(["⏞", "⏟", "⎴", "⎵", "⏜", "⏝"]), yn = 0.72, Yl = 0.5, se = (t, e) => ({ ...t, size: Math.max(t.size * e, t.size * Yl) });
function be() {
  return { w: 0, h: 0, d: 0, draw: () => "" };
}
const Ve = 0.72, We = 0.22;
function Ko(t, e, n, o, s, r, i = "") {
  const c = `font-family:${Gl};font-size:${J(e.size)}px;` + (n ? "font-style:italic;" : "") + (o ? "font-weight:700;" : "");
  return i ? `<text x="0" y="0" style="${c}" fill="${e.color}" xml:space="preserve" transform="${i}">${Is(t)}</text>` : `<text x="${J(s)}" y="${J(r)}" style="${c}" fill="${e.color}" xml:space="preserve">${Is(t)}</text>`;
}
function Bt(t, e, n, o) {
  return {
    w: e.measure(t, e.size, n, o),
    h: e.size * Ve,
    d: e.size * We,
    draw: (s, r) => Ko(t, e, n, o, s, r)
  };
}
function vs(t, e, n, o) {
  const s = Bt(t, e, !1, !1), r = e.size * (Ve + We), i = n + o;
  if (i <= r * 1.02) return s;
  const c = i / r, a = (o - n) / 2 + (Ve - We) / 2 * e.size * c;
  return {
    w: s.w,
    h: n,
    d: o,
    draw: (l, u) => Ko(
      t,
      e,
      !1,
      !1,
      0,
      0,
      `translate(${J(l)} ${J(u + a)}) scale(1 ${J(c)})`
    )
  };
}
function ql(t, e, n) {
  return {
    w: t,
    h: e,
    d: 0,
    draw: (o, s) => `<rect x="${J(o)}" y="${J(s - e)}" width="${J(t)}" height="${J(e)}" fill="${n}"/>`
  };
}
function oe(t) {
  if (!t.length) return be();
  const e = t.reduce((s, r) => s + r.w, 0), n = Math.max(...t.map((s) => s.h)), o = Math.max(...t.map((s) => s.d));
  return {
    w: e,
    h: n,
    d: o,
    draw: (s, r) => {
      let i = s;
      const c = [];
      for (const a of t)
        c.push(a.draw(i, r)), i += a.w;
      return c.join("");
    }
  };
}
function ze(t, e, n) {
  if (!t.length) return be();
  const o = Math.max(...t.map((i) => i.w));
  let s = 0, r = 0;
  return t.forEach((i, c) => {
    c < n ? s += i.h + i.d + e : c === n ? (s += i.h, r += i.d) : r += i.h + i.d + e;
  }), {
    w: o,
    h: s,
    d: r,
    draw: (i, c) => {
      let a = c - s;
      const l = [];
      for (const u of t)
        a += u.h, l.push(u.draw(i + (o - u.w) / 2, a)), a += u.d + e;
      return l.join("");
    }
  };
}
function ot(t, e) {
  return oe(t.map((n) => Kl(n, e)));
}
function Kl(t, e) {
  var n, o;
  switch (t.kind) {
    case "run": {
      const s = t.sty ?? "i", r = /^[\d\s.,+\-=<>()[\]{}|/*]+$/.test(t.text);
      return Bt(t.text, e, (s === "i" || s === "bi") && !r, s === "b" || s === "bi");
    }
    case "frac": {
      if (t.type === "lin")
        return oe([ot(t.num, e), Bt("/", e, !1, !1), ot(t.den, e)]);
      if (t.type === "skw") {
        const d = se(e, 0.85);
        return oe([ot(t.num, d), Bt("⁄", e, !1, !1), ot(t.den, d)]);
      }
      const s = se(e, 0.9), r = ot(t.num, s), i = ot(t.den, s), c = e.size * 0.22, a = Math.max(r.w, i.w) + c * 2, l = Math.max(0.6, e.size * 0.055), u = e.size * 0.28, f = e.size * 0.18, h = u + l + f + r.h + r.d, m = -u + l + f + i.h + i.d;
      return {
        w: a,
        h,
        d: m,
        draw: (d, p) => {
          const w = p - u, b = [
            r.draw(d + (a - r.w) / 2, w - f - r.d),
            i.draw(d + (a - i.w) / 2, w + l + f + i.h)
          ];
          return t.type !== "noBar" && b.push(`<rect x="${J(d + c * 0.4)}" y="${J(w)}" width="${J(a - c * 0.8)}" height="${J(l)}" fill="${e.color}"/>`), b.join("");
        }
      };
    }
    case "rad": {
      const s = ot(t.base, e), r = Math.max(0.6, e.size * 0.05), i = e.size * 0.12, c = e.size * 0.55, a = t.deg.length ? ot(t.deg, se(e, 0.55)) : null, l = a ? Math.max(0, a.w - c * 0.35) : 0, u = s.h + i + r, f = s.d, h = l + c + s.w + e.size * 0.12;
      return {
        w: h,
        h: Math.max(u, a ? u + a.h * 0.3 : u),
        d: f,
        draw: (m, d) => {
          const p = m + l, w = d - u, b = d + f, y = [
            `<path d="${`M ${J(p)} ${J(b - (b - w) * 0.45)} L ${J(p + c * 0.3)} ${J(b - (b - w) * 0.3)} L ${J(p + c * 0.62)} ${J(b)} L ${J(p + c)} ${J(w)} L ${J(m + h)} ${J(w)}`}" fill="none" stroke="${e.color}" stroke-width="${J(r)}" stroke-linejoin="miter"/>`,
            s.draw(p + c + e.size * 0.06, d)
          ];
          return a && y.push(a.draw(m, d - (b - w) * 0.42)), y.join("");
        }
      };
    }
    case "script": {
      const s = t.base.length ? ot(t.base, e) : be(), r = se(e, yn), i = (n = t.sup) != null && n.length ? ot(t.sup, r) : null, c = (o = t.sub) != null && o.length ? ot(t.sub, r) : null, a = e.size * 0.42, l = e.size * 0.22;
      return {
        w: s.w + Math.max((i == null ? void 0 : i.w) ?? 0, (c == null ? void 0 : c.w) ?? 0) + e.size * 0.04,
        h: Math.max(s.h, i ? a + i.h : 0),
        d: Math.max(s.d, c ? l + c.d : 0),
        draw: (f, h) => {
          const m = [s.draw(f, h)], d = f + s.w + e.size * 0.02;
          return i && m.push(i.draw(d, h - a)), c && m.push(c.draw(d, h + l)), m.join("");
        }
      };
    }
    case "nary": {
      const s = { ...e, size: e.size * 1.45 }, r = Bt(t.chr, s, !1, !1), i = se(e, yn), c = t.sup.length ? ot(t.sup, i) : null, a = t.sub.length ? ot(t.sub, i) : null, l = ot(t.base, e);
      if (t.underOver) {
        const d = [];
        c && d.push(c), d.push(r), a && d.push(a);
        const p = ze(d, e.size * 0.08, c ? 1 : 0);
        return oe([p, { ...be(), w: e.size * 0.12 }, l]);
      }
      const u = e.size * 0.55, f = e.size * 0.45, h = Math.max((c == null ? void 0 : c.w) ?? 0, (a == null ? void 0 : a.w) ?? 0), m = {
        w: r.w + h + e.size * 0.06,
        h: Math.max(r.h, c ? u + c.h : 0),
        d: Math.max(r.d, a ? f + a.d : 0),
        draw: (d, p) => {
          const w = [r.draw(d, p)];
          return c && w.push(c.draw(d + r.w + e.size * 0.04, p - u)), a && w.push(a.draw(d + r.w + e.size * 0.04, p + f)), w.join("");
        }
      };
      return oe([m, { ...be(), w: e.size * 0.1 }, l]);
    }
    case "delim": {
      const s = [];
      t.items.forEach((m, d) => {
        d > 0 && t.sep && s.push(Bt(t.sep, e, !1, !1)), s.push(ot(m, e));
      });
      const r = oe(s), i = e.size * 0.06, c = Math.max(r.h + i, e.size * Ve), a = Math.max(r.d + i, e.size * We), l = t.beg && t.beg !== " " ? vs(t.beg, e, c, a) : null, u = t.end && t.end !== " " ? vs(t.end, e, c, a) : null, f = [l, r, u].filter((m) => m !== null);
      return {
        w: f.reduce((m, d) => m + d.w, 0),
        h: Math.max(r.h, l ? l.h : 0),
        d: Math.max(r.d, l ? l.d : 0),
        draw: (m, d) => {
          let p = m;
          const w = [];
          for (const b of f)
            w.push(b.draw(p, d)), p += b.w;
          return w.join("");
        }
      };
    }
    case "matrix": {
      const s = t.rows.map((d) => d.map((p) => ot(p, e))), r = Math.max(0, ...s.map((d) => d.length)), i = [];
      for (let d = 0; d < r; d++) i.push(Math.max(0, ...s.map((p) => {
        var w;
        return ((w = p[d]) == null ? void 0 : w.w) ?? 0;
      })));
      const c = e.size * 0.5, a = e.size * 0.35, l = s.map((d) => Math.max(e.size * 0.72, ...d.map((p) => p.h))), u = s.map((d) => Math.max(e.size * 0.22, ...d.map((p) => p.d))), f = i.reduce((d, p) => d + p, 0) + c * Math.max(0, r - 1), h = l.reduce((d, p, w) => d + p + u[w], 0) + a * Math.max(0, s.length - 1), m = e.size * 0.28;
      return {
        w: f,
        h: h / 2 + m,
        d: h / 2 - m,
        draw: (d, p) => {
          const w = [];
          let b = p - (h / 2 + m);
          return s.forEach((g, y) => {
            b += l[y];
            let $ = d;
            g.forEach((x, M) => {
              w.push(x.draw($ + (i[M] - x.w) / 2, b)), $ += i[M] + c;
            }), b += u[y] + a;
          }), w.join("");
        }
      };
    }
    case "acc": {
      const s = ot(t.base, e), r = e.size * 0.9, i = t.chr.trim(), c = Math.max(0.6, e.size * 0.05), a = e.size * (ve.has(t.chr) || ve.has(t.chr.trim()) ? 0.06 : 0.02);
      let l;
      if (ve.has(t.chr) || ve.has(i))
        l = ql(s.w, c, e.color);
      else if (Xl.has(i)) {
        const u = Bt(i, { ...e, size: r }, !1, !1), f = u.w > 0 ? s.w / u.w : 1;
        l = {
          w: s.w,
          h: u.h,
          d: u.d,
          draw: (h, m) => `<g transform="translate(${J(h)} ${J(m)}) scale(${J(f)} 1)">${u.draw(0, 0)}</g>`
        };
      } else {
        const u = Os[i] ?? Os[t.chr] ?? (i || "^"), f = Bt(u, { ...e, size: r }, !1, !1), h = f.w > s.w * 1.1 && s.w > 0 ? s.w * 1.1 / f.w : 1;
        l = h === 1 ? f : {
          w: f.w * h,
          h: f.h,
          d: f.d,
          draw: (m, d) => `<g transform="translate(${J(m)} ${J(d)}) scale(${J(h)} 1)">${f.draw(0, 0)}</g>`
        };
      }
      return t.below ? {
        w: Math.max(s.w, l.w),
        h: s.h,
        d: s.d + a + l.h + l.d,
        draw: (u, f) => s.draw(u + (Math.max(s.w, l.w) - s.w) / 2, f) + l.draw(u + (Math.max(s.w, l.w) - l.w) / 2, f + s.d + a + l.h)
      } : {
        w: Math.max(s.w, l.w),
        h: s.h + a + l.h,
        d: s.d,
        draw: (u, f) => s.draw(u + (Math.max(s.w, l.w) - s.w) / 2, f) + l.draw(u + (Math.max(s.w, l.w) - l.w) / 2, f - s.h - a)
      };
    }
    case "lim": {
      const s = ot(t.base, e), r = ot(t.limit, se(e, yn));
      return t.below ? ze([s, r], e.size * 0.08, 0) : ze([r, s], e.size * 0.08, 1);
    }
    case "stack": {
      const s = t.rows.map((r) => ot(r, e));
      return ze(s, e.size * 0.3, Math.floor((s.length - 1) / 2));
    }
  }
}
function Zl(t, e, n, o) {
  const s = ot(t, { size: e, measure: o, color: n });
  return { w: s.w, h: s.h, d: s.d, svg: s.draw(0, 0) };
}
const Jl = "'Cambria Math','Latin Modern Math','STIX Two Math','Times New Roman',serif", W = (t) => Number.isFinite(t) ? String(Math.round(t * 100) / 100) : "0", zs = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"), Rs = ["'PingFang SC'", "'Hiragino Sans GB'", "'Microsoft YaHei'", "sans-serif"];
let Re = null, Ds = !1;
function Zo() {
  if (Ds) return Re;
  Ds = !0;
  try {
    const t = document.createElement("canvas").getContext("2d");
    Re = t && typeof t.measureText == "function" ? t : null;
  } catch {
    Re = null;
  }
  return Re;
}
function Us(t, e) {
  const n = [], o = /* @__PURE__ */ new Set();
  for (const s of t) {
    const r = s.toLowerCase();
    s && !o.has(r) && (o.add(r), n.push(`'${s}'`));
  }
  for (const s of e) {
    const r = s.replace(/'/g, "").toLowerCase();
    o.has(r) || (o.add(r), n.push(s));
  }
  return n.join(",");
}
function Jo(t) {
  return t.fonts.length ? Us(t.fonts, Rs) : Us(["Helvetica", "Arial"], Rs);
}
function Jt(t, e) {
  const n = t.size * e;
  return t.baseline ? n * 0.65 : n;
}
function Ql(t, e, n, o) {
  const s = Zo();
  return s ? (s.font = `${n ? "italic " : ""}${o ? "700 " : "400 "}${e}px ${Jl}`, s.measureText(t).width) : t.length * e * 0.55;
}
const De = /* @__PURE__ */ new Map();
function tn(t, e) {
  var r;
  if (!((r = t.math) != null && r.length)) return null;
  const n = t.size * e, o = `${n}|${t.color}|${JSON.stringify(t.math)}`;
  let s = De.get(o);
  return s || (s = Zl(t.math, n, t.color, Ql), De.size > 512 && De.clear(), De.set(o, s)), s;
}
function In(t, e, n) {
  var i, c;
  if ((i = e.math) != null && i.length) return ((c = tn(e, n)) == null ? void 0 : c.w) ?? 0;
  if (!t) return 0;
  const o = Zo(), s = Jt(e, n);
  if (!o) {
    let a = 0;
    for (const l of t) a += Wl(l) ? s : s * 0.55;
    return a;
  }
  return o.font = `${e.i ? "italic " : ""}${e.b ? "700 " : "400 "}${s}px ${Jo(e)}`, o.measureText(t).width + (e.spacing ?? 0) * t.length;
}
function Qo(t, e) {
  return e.caps === "all" ? t.toUpperCase() : t;
}
function tr(t, e) {
  var o;
  const n = [];
  for (const s of t) {
    if ((o = s.math) != null && o.length) {
      n.push({ text: s.text, run: s, width: In(s.text, s, e), br: !1, space: !1, squeeze: 0 });
      continue;
    }
    const r = Qo(s.text, s);
    if (!r) continue;
    const i = r.match(/\n|[^\S\n]+|[⺀-鿿가-퟿＀-｠　-〿]|[^\s⺀-鿿가-퟿＀-｠　-〿]+/g) ?? [];
    for (const c of i)
      n.push({
        text: c,
        run: s,
        width: c === `
` ? 0 : In(c, s, e),
        br: c === `
`,
        space: /^[^\S\n]+$/.test(c),
        squeeze: je(c) * Jt(s, e)
      });
  }
  return n;
}
const tu = (t) => t.squeezed ? t.width - t.squeeze : t.width;
function eu(t, e) {
  var s;
  const n = t.segs[t.segs.length - 1];
  n && n.run === e.run ? (n.text += e.text, n.width += e.width) : t.segs.push({ text: e.text, run: e.run, width: e.width }), t.width += e.width, t.squeeze += e.squeeze;
  const o = (s = e.run.math) != null && s.length ? tn(e.run, 1) : null;
  t.size = Math.max(t.size, o ? (o.h + o.d) / 1.2 : e.run.size);
}
function er(t, e, n, o) {
  const s = [], r = () => ({ segs: [], width: 0, size: 0, squeeze: 0, squeezed: !1 });
  let i = r(), c = Math.max(1, e - Math.max(0, o));
  const a = () => {
    i.squeezed = i.width > c && i.width - i.squeeze <= c, s.push(i), i = r(), c = Math.max(1, e);
  };
  for (const l of t) {
    if (l.br) {
      a();
      continue;
    }
    const u = i.width + l.width - (i.squeeze + l.squeeze) <= c;
    if (n && i.width > 0 && !u) {
      if (l.space) continue;
      a();
    }
    eu(i, l);
  }
  return a(), s;
}
function nu(t, e, n, o) {
  return e <= 0 || !t.runs.some((s) => je(s.text) > 0) ? !1 : er(tr(t.runs, n), e, o, t.indent).some((s) => s.squeezed);
}
const nr = {
  left: "start",
  center: "middle",
  right: "end",
  justify: "start"
}, sr = (t) => t === "start" ? "end" : t === "end" ? "start" : t;
function On(t, e, n) {
  return t.paragraphs.map((o) => {
    const s = o.runs[0], r = o.bullet && s ? { ...s, text: `${o.bullet} `, size: s.size * (o.bulletSize ?? 1), color: o.bulletColor ?? s.color, u: !1, strike: !1 } : null, i = r ? [r, ...o.runs] : o.runs, c = Math.max(1, e - Math.max(0, o.marL)), a = er(tr(i, n), c, t.wrap, o.indent), l = a.map((u) => (u.size || (s == null ? void 0 : s.size) || 18) * n * (o.lineHeight ?? 1.2));
    return { lines: a, para: o, before: o.spaceBefore, after: o.spaceAfter, lineHeights: l };
  });
}
function Ns(t, e, n) {
  return On(t, e, n).reduce(
    (o, s) => o + s.before + s.after + s.lineHeights.reduce((r, i) => r + i, 0),
    0
  );
}
function su(t, e, n) {
  const [o, s, r, i] = t.insets, c = Math.max(1, e - i - s), a = Math.max(1, n - o - r);
  if (Ns(t, c, 1) <= a) return 1;
  let l = ou, u = 1;
  for (let f = 0; f < 12; f++) {
    const h = (l + u) / 2;
    Ns(t, c, h) <= a ? l = h : u = h;
  }
  return l;
}
const ou = 0.25;
function vn(t, e, n, o, s, r) {
  if (t.vert === "vert" || t.vert === "wordArtVert") {
    const S = vn({ ...t, vert: void 0 }, n, e, o, s, r);
    return `<g transform="translate(${W(e)} 0) rotate(90)">${S}</g>`;
  }
  if (t.vert === "vert270") {
    const S = vn({ ...t, vert: void 0 }, n, e, o, s, r);
    return `<g transform="translate(0 ${W(n)}) rotate(-90)">${S}</g>`;
  }
  const [i, c, a, l] = s ?? t.insets, u = t.fontScale, f = Math.max(1, e - l - c), h = fu(t, e, n, o, [i, c, a, l], r ?? t.anchor);
  if (h) return h;
  const m = On(t, f, u), d = r ?? t.anchor, p = (S) => {
    const A = [];
    return S.forEach((P) => {
      P.lines.forEach((L, C) => {
        A.push({
          lp: P,
          line: L,
          li: C,
          h: P.lineHeights[C] + (C === 0 ? P.before : 0) + (C === P.lines.length - 1 ? P.after : 0),
          padTop: C === 0 ? P.before : 0
        });
      });
    }), A;
  }, w = (S) => S.reduce((A, P) => A + P.h, 0), b = (S, A, P) => {
    var z;
    const L = w(S);
    let C = i;
    d === "middle" ? C = i + Math.max(0, (n - i - a - L) / 2) : d === "bottom" && (C = Math.max(i, n - a - L));
    const R = [];
    for (const { lp: D, line: I, li: O, padTop: _ } of S) {
      C += _;
      const U = D.lineHeights[O], B = C + U * 0.78, X = O === 0 ? D.para.indent : 0, Y = A + Math.max(0, D.para.marL) + X;
      let Z;
      const K = nr[D.para.align], kt = D.para.rtl === !0;
      if (K === "middle" ? Z = A + P / 2 : K === "end" ? Z = A + P : Z = Y, I.segs.length) {
        const Ot = tu(I), Xt = K === "middle" ? Z - Ot / 2 : K === "end" ? Z - Ot : Z;
        let Yt = Xt;
        for (const ut of I.segs) {
          if (ut.run.highlight) {
            const at = Jt(ut.run, u);
            R.push(
              `<rect x="${W(Yt)}" y="${W(B - at * 0.82)}" width="${W(ut.width)}" height="${W(at * 1.12)}" fill="${ut.run.highlight}"/>`
            );
          }
          Yt += ut.width - (I.squeezed ? je(ut.text) * Jt(ut.run, u) : 0);
        }
        if (I.segs.some((ut) => {
          var at;
          return (at = ut.run.math) == null ? void 0 : at.length;
        })) {
          let ut = Xt;
          for (const at of I.segs) {
            const ss = (z = at.run.math) != null && z.length ? tn(at.run, u) : null;
            ss ? R.push(`<g transform="translate(${W(ut)} ${W(B)})">${ss.svg}</g>`) : R.push(
              `<text x="${W(ut)}" y="${W(B)}" text-anchor="start"` + (kt ? ' direction="rtl" unicode-bidi="embed"' : "") + ` xml:space="preserve">${Ge(at, u, o)}</text>`
            ), ut += at.width - (I.squeezed ? je(at.text) * Jt(at.run, u) : 0);
          }
        } else {
          const ut = I.squeezed ? iu(I, u, o) : I.segs.map((at) => Ge(at, u, o)).join("");
          R.push(
            `<text x="${W(Z)}" y="${W(B)}" text-anchor="${kt ? sr(K) : K}"` + (kt ? ' direction="rtl" unicode-bidi="embed"' : "") + ` xml:space="preserve">${ut}</text>`
          );
        }
      }
      C += U + (O === D.lines.length - 1 ? D.after : 0);
    }
    return R.join("");
  }, g = Math.max(1, Math.min(Math.floor(t.columns ?? 1), 16));
  if (g === 1) return b(p(m), l, f);
  const y = t.columnGap ?? 0, $ = Math.max(1, (f - y * (g - 1)) / g), x = p(On(t, $, u)), M = Math.max(1, n - i - a), k = [[]];
  let T = 0;
  for (const S of x)
    T > 0 && T + S.h > M && k.length < g && (k.push([]), T = 0), k[k.length - 1].push(S), T += S.h;
  return k.map((S, A) => b(S, l + A * ($ + y), $)).join("");
}
function ru(t, e) {
  var h;
  const n = (h = t.match(/linear-gradient\(([^]*)\)$/)) == null ? void 0 : h[1];
  if (!n) return null;
  const o = n.split(/,(?![^(]*\))/).map((m) => m.trim()), s = o[0].match(/^(-?[\d.]+)deg$/), r = s ? Number(s[1]) : 180, c = (s ? o.slice(1) : o).map((m) => {
    const d = m.match(/^(.*?)\s+([\d.]+)%$/);
    return d ? { color: d[1].trim(), pos: Number(d[2]) } : { color: m, pos: null };
  }).map((m, d, p) => ({ color: m.color, pos: m.pos ?? (p.length > 1 ? d / (p.length - 1) * 100 : 0) }));
  if (!c.length) return null;
  const a = (r - 90) * Math.PI / 180, l = Math.cos(a) / 2, u = Math.sin(a) / 2;
  return `url(#${e(
    `<linearGradient id="__ID__" x1="${W(0.5 - l)}" y1="${W(0.5 - u)}" x2="${W(0.5 + l)}" y2="${W(0.5 + u)}">` + c.map((m) => `<stop offset="${W(m.pos)}%" stop-color="${m.color}"/>`).join("") + "</linearGradient>"
  )})`;
}
function iu(t, e, n) {
  let o = 0;
  return t.segs.map((s) => {
    const r = Jt(s.run, e), i = [...s.text], c = i.map(() => 0);
    let a = o !== 0;
    i.length && (c[0] = o), o = 0;
    for (let l = 0; l < i.length; l++) {
      const u = Qn(i[l]) * r;
      u && (a = !0, qo(i[l]) ? c[l] -= u : l + 1 < i.length ? c[l + 1] -= u : o -= u);
    }
    return Ge(s, e, n, a ? c : void 0);
  }).join("");
}
function Ge(t, e, n, o) {
  const s = t.run, r = Jt(s, e), i = s.gradient ? ru(s.gradient, n) : null, c = [
    `font-size="${W(r)}"`,
    `font-family="${zs(Jo(s))}"`,
    `fill="${i ?? s.color}"`
  ];
  s.b && c.push('font-weight="700"'), s.i && c.push('font-style="italic"'), s.spacing && c.push(`letter-spacing="${W(s.spacing)}"`);
  const a = [];
  s.u && a.push("underline"), s.strike && a.push("line-through"), a.length && c.push(`text-decoration="${a.join(" ")}"`), s.baseline && c.push(`dy="${W(s.baseline > 0 ? -r * 0.45 : r * 0.25)}"`), s.outline && c.push(`stroke="${s.outline.color}" stroke-width="${W(s.outline.width)}" paint-order="stroke"`), o != null && o.some((u) => u !== 0) && c.push(`dx="${o.map((u) => W(u)).join(" ")}"`);
  const l = `<tspan ${c.join(" ")}>${zs(t.text)}</tspan>`;
  return s.baseline ? `${l}<tspan dy="${W(s.baseline > 0 ? r * 0.45 : -r * 0.25)}"></tspan>` : l;
}
const au = /* @__PURE__ */ new Set([
  "textArchUp",
  "textArchDown",
  "textArchUpPour",
  "textArchDownPour",
  "textCircle",
  "textWave1",
  "textWave2",
  "textCurveUp",
  "textCurveDown",
  "textCanUp",
  "textCanDown",
  "textTriangle",
  "textChevron",
  "textInflate",
  "textDeflate"
]), or = (t) => !!t && au.has(t), zn = (t, e, n) => Math.min(n, Math.max(e, t));
function Bs(t, e, n, o, s, r) {
  const i = (h) => {
    const m = h * Math.PI / 180;
    return [t + n * Math.cos(m), e + o * Math.sin(m)];
  }, [c, a] = i(s), [l, u] = i(r), f = Math.abs(r - s);
  return {
    d: `M${W(c)} ${W(a)}A${W(n)} ${W(o)} 0 ${f > 180 ? 1 : 0} ${r > s ? 1 : 0} ${W(l)} ${W(u)}`,
    len: f * Math.PI / 180 * ((n + o) / 2),
    fill: !0
  };
}
function Fs(t, e, n = 28) {
  const o = [];
  for (let i = 0; i <= n; i++) o.push([e * i / n, t(i / n)]);
  let s = `M${W(o[0][0])} ${W(o[0][1])}`, r = 0;
  for (let i = 0; i < n; i++) {
    const c = o[Math.max(0, i - 1)], a = o[i], l = o[i + 1], u = o[Math.min(n, i + 2)];
    s += `C${W(a[0] + (l[0] - c[0]) / 6)} ${W(a[1] + (l[1] - c[1]) / 6)} ${W(l[0] - (u[0] - a[0]) / 6)} ${W(l[1] - (u[1] - a[1]) / 6)} ${W(l[0])} ${W(l[1])}`, r += Math.hypot(l[0] - a[0], l[1] - a[1]);
  }
  return { d: s, len: r };
}
const cu = {
  textCurveUp: 0.3,
  textCurveDown: -0.3,
  textCanUp: 0.16,
  textCanDown: -0.16,
  textDeflate: 0.22,
  textInflate: -0.22,
  textTriangle: 0.2,
  textChevron: 0.34
}, lu = /* @__PURE__ */ new Set(["textTriangle", "textChevron"]);
function uu(t, e, n, o, s, r) {
  const i = n / 2, c = o / 2, a = zn((e.adj ?? e.adj1 ?? 108e5) / 6e4, 20, 350);
  if (t === "textCircle") {
    const d = Math.max(1, i - s * 0.3), p = Math.max(1, c - s * 0.3);
    return {
      d: `M${W(i)} ${W(c + p)}A${W(d)} ${W(p)} 0 1 1 ${W(i)} ${W(c - p)}A${W(d)} ${W(p)} 0 1 1 ${W(i)} ${W(c + p)}`,
      len: Math.PI * (d + p),
      fill: !0
    };
  }
  if (t.startsWith("textArch")) {
    const d = t.startsWith("textArchDown"), p = t.endsWith("Pour"), w = s * 0.4, b = Math.max(1, (i - s * 0.1) * (p ? 0.72 : 1)), g = Math.max(1, (c - w) * (p ? 0.72 : 1));
    return d ? Bs(i, c - w, b, g, 90 + a / 2, 90 - a / 2) : Bs(i, c + w, b, g, -90 - a / 2, -90 + a / 2);
  }
  const l = t === "textWave1" ? 1 : t === "textWave2" ? -1 : 0, u = r === "top" ? s * 0.85 : r === "bottom" ? o - s * 0.2 : c + s * 0.32;
  if (l) {
    const d = o * 0.16 * zn((e.adj1 ?? 6250) / 6250, 0.25, 3);
    return Fs((p) => u - l * d * Math.sin(2 * Math.PI * p), n);
  }
  const f = cu[t];
  if (f === void 0) return null;
  const h = f * o, m = lu.has(t) ? (d) => 1 - Math.abs(2 * d - 1) : (d) => Math.sin(Math.PI * d);
  return Fs((d) => u + h / 2 - h * m(d), n);
}
function fu(t, e, n, o, s, r) {
  const i = t.warp;
  if (!i || !or(i.preset)) return null;
  const [c, a, l, u] = s, f = Math.max(1, e - u - a), h = Math.max(1, n - c - l), m = t.fontScale, d = t.paragraphs.filter((b) => b.runs.some((g) => g.text.trim()));
  if (!d.length) return null;
  const p = h / d.length, w = [];
  return d.forEach((b, g) => {
    const y = b.runs.filter((I) => I.text);
    if (!y.length) return;
    const $ = Math.max(...y.map((I) => I.size), 1) * m, x = uu(i.preset, i.adj, f, p, $, d.length > 1 ? "middle" : r);
    if (!x) return;
    const M = y.map((I) => ({
      text: Qo(I.text, I).replace(/\n/g, " "),
      run: I,
      width: In(I.text, I, m)
    })), k = M.reduce((I, O) => I + O.width, 0), T = k > x.len ? Math.max(0.25, x.len / k) : 1, S = k * T, A = M.reduce((I, O) => I + O.text.length, 0), P = x.fill && A > 1 && S > 0 ? (S * zn(x.len / S, 1, 2.2) - S) / A : 0, L = o(`<path id="__ID__" fill="none" d="${x.d}"/>`), C = nr[b.align], R = b.rtl === !0, z = C === "end" ? "100%" : C === "middle" ? "50%" : "0%", D = M.map((I) => Ge(I, m * T, o)).join("");
    w.push(
      `<g transform="translate(${W(u)} ${W(c + p * g)})"><text text-anchor="${R ? sr(C) : C}"` + (P > 0.05 ? ` letter-spacing="${W(P)}"` : "") + (R ? ' direction="rtl" unicode-bidi="embed"' : "") + ` xml:space="preserve"><textPath href="#${L}" xlink:href="#${L}" startOffset="${z}">${D}</textPath></text></g>`
    );
  }), w.length ? w.join("") : null;
}
let hu = 0;
const Et = (t) => `${t}${++hu}`, E = (t) => Number.isFinite(t) ? String(Math.round(t * 100) / 100) : "0", et = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function rr(t, e, n = {}) {
  var f;
  const o = n.textMode ?? "html", s = {
    defs: [],
    textMode: o,
    // 'svg' 文本模式是给「交出去的文件」用的，里面不该出现只有浏览器认的 foreignObject
    media: n.media === "player" && o === "html" ? "player" : "badge",
    hidden: (f = n.hiddenElements) != null && f.length ? new Set(n.hiddenElements) : null
  };
  let r = "#fff";
  try {
    e.background && (r = ts(e.background, s, t.width, t.height));
  } catch {
  }
  const i = `<rect width="${E(t.width)}" height="${E(t.height)}" fill="${r}"/>`, c = e.elements.map((h) => ir(h, s)).join("") + (n.showComments ? Lu(e.comments, t.width, t.height) : ""), a = (t.embeddedFonts ?? []).map((h) => `@font-face{font-family:'${h.family}';src:url(${h.src});font-weight:${h.bold ? 700 : 400};font-style:${h.italic ? "italic" : "normal"};}`).join(""), l = a ? `<style>${a}</style>` : "", u = n.includeNotes && e.notes ? `<desc>${et(e.notes)}</desc>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${E(t.width)} ${E(t.height)}" font-family="Helvetica, Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif">` + u + `<defs>${l}${s.defs.join("")}</defs>` + i + c + "</svg>";
}
const Hs = {
  pct5: "M0 0h1v1H0z",
  pct10: "M0 0h1v1H0z",
  pct20: "M0 0h2v2H0z",
  pct25: "M0 0h2v2H0z",
  pct30: "M0 0h2v2H0zM2 2h2v2H2z",
  pct40: "M0 0h2v2H0zM2 2h2v2H2z",
  pct50: "M0 0h2v2H0zM2 2h2v2H2z",
  pct60: "M0 0h3v3H0z",
  pct70: "M0 0h3v3H0z",
  pct75: "M0 0h3v3H0z",
  pct80: "M0 0h4v4H0z",
  pct90: "M0 0h4v4H0z",
  ltHorz: "M0 2h8v1H0z",
  horz: "M0 2h8v2H0z",
  dkHorz: "M0 1h8v3H0z",
  ltVert: "M2 0h1v8H0z",
  vert: "M2 0h2v8H2z",
  dkVert: "M1 0h3v8H1z",
  ltUpDiag: "M0 8L8 0M-2 2L2 -2M6 10L10 6",
  upDiag: "M0 8L8 0M-2 2L2 -2M6 10L10 6",
  ltDnDiag: "M0 0L8 8M-2 6L2 10M6 -2L10 2",
  dnDiag: "M0 0L8 8M-2 6L2 10M6 -2L10 2",
  smGrid: "M0 0h8v1H0zM0 0h1v8H0z",
  lgGrid: "M0 0h8v1H0zM0 0h1v8H0z",
  cross: "M0 3h8v2H0zM3 0h2v8H3z",
  diagCross: "M0 0L8 8M8 0L0 8",
  trellis: "M0 0L8 8M8 0L0 8",
  wave: "M0 4Q2 2 4 4T8 4"
}, du = { pct5: 8, pct10: 6, pct20: 5, pct25: 4, pct30: 4, pct40: 4, pct50: 4, pct60: 4, pct70: 4, pct75: 4, pct80: 5, pct90: 5 };
function ts(t, e, n, o) {
  switch (t.type) {
    case "none":
      return "none";
    case "solid":
      return t.color;
    case "gradient": {
      const s = Et("g"), r = t.stops.map((i) => `<stop offset="${E(Math.max(0, Math.min(1, i.pos)) * 100)}%" stop-color="${i.color}"/>`).join("");
      if (t.radial)
        e.defs.push(`<radialGradient id="${s}" cx="50%" cy="50%" r="70%">${r}</radialGradient>`);
      else {
        const i = t.angle * Math.PI / 180, c = Math.cos(i) / 2, a = Math.sin(i) / 2;
        e.defs.push(
          `<linearGradient id="${s}" x1="${E(0.5 - c)}" y1="${E(0.5 - a)}" x2="${E(0.5 + c)}" y2="${E(0.5 + a)}">${r}</linearGradient>`
        );
      }
      return `url(#${s})`;
    }
    case "image": {
      const s = Et("p");
      if (t.tile) {
        const r = Math.max(4, n * 0.25 * t.tile.sx), i = Math.max(4, o * 0.25 * t.tile.sy);
        e.defs.push(
          `<pattern id="${s}" patternUnits="userSpaceOnUse" width="${E(r)}" height="${E(i)}"><image href="${et(t.src)}" width="${E(r)}" height="${E(i)}" preserveAspectRatio="none"` + (t.alpha !== void 0 ? ` opacity="${E(t.alpha)}"` : "") + "/></pattern>"
        );
      } else if (t.crop && (t.crop.l || t.crop.t || t.crop.r || t.crop.b)) {
        const r = t.crop, i = n / Math.max(1 - r.l - r.r, 0.01), c = o / Math.max(1 - r.t - r.b, 0.01);
        e.defs.push(
          `<pattern id="${s}" patternUnits="userSpaceOnUse" width="${E(n)}" height="${E(o)}"><image href="${et(t.src)}" x="${E(-r.l * i)}" y="${E(-r.t * c)}" width="${E(i)}" height="${E(c)}" preserveAspectRatio="none"` + (t.alpha !== void 0 ? ` opacity="${E(t.alpha)}"` : "") + "/></pattern>"
        );
      } else
        e.defs.push(
          `<pattern id="${s}" patternUnits="userSpaceOnUse" width="${E(n)}" height="${E(o)}"><image href="${et(t.src)}" width="${E(n)}" height="${E(o)}" preserveAspectRatio="xMidYMid slice"` + (t.alpha !== void 0 ? ` opacity="${E(t.alpha)}"` : "") + "/></pattern>"
        );
      return `url(#${s})`;
    }
    case "pattern": {
      const s = Et("pt"), r = du[t.preset] ?? 8, i = Hs[t.preset] ?? Hs.pct50, c = /^[MLQT].*[ML]/.test(i) && !i.includes("h") && !i.includes("v");
      return e.defs.push(
        `<pattern id="${s}" patternUnits="userSpaceOnUse" width="${r}" height="${r}"><rect width="${r}" height="${r}" fill="${t.bg}"/><path d="${i}" ${c ? `stroke="${t.fg}" stroke-width="1" fill="none"` : `fill="${t.fg}"`}/></pattern>`
      ), `url(#${s})`;
    }
  }
}
function pu(t, e) {
  if (!t) return "";
  const n = [];
  let o = "SourceGraphic", s = 0;
  const r = (a) => {
    const l = `e${++s}`;
    n.push(a.replace(/__IN__/g, o).replace(/__OUT__/g, l)), o = l;
  };
  t.glow && r(
    `<feDropShadow in="__IN__" dx="0" dy="0" stdDeviation="${E(t.glow.radius / 2)}" flood-color="${t.glow.color}" flood-opacity="1" result="__OUT__"/>`
  );
  const i = t.shadow;
  if (i && !i.inner && r(`<feDropShadow in="__IN__" dx="${E(i.dx)}" dy="${E(i.dy)}" stdDeviation="${E(i.blur / 2)}" flood-color="${i.color}" result="__OUT__"/>`), i && i.inner) {
    const a = `is${s}`;
    n.push(
      `<feComponentTransfer in="SourceAlpha" result="${a}a"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer><feGaussianBlur in="${a}a" stdDeviation="${E(i.blur / 2)}" result="${a}b"/><feOffset in="${a}b" dx="${E(i.dx)}" dy="${E(i.dy)}" result="${a}c"/><feComposite in="${a}c" in2="SourceAlpha" operator="in" result="${a}d"/><feFlood flood-color="${i.color}" result="${a}e"/><feComposite in="${a}e" in2="${a}d" operator="in" result="${a}f"/>`
    ), r(`<feComposite in="${a}f" in2="__IN__" operator="over" result="__OUT__"/>`);
  }
  if (t.softEdge && (n.push(
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${E(t.softEdge / 2)}" result="se"/><feComponentTransfer in="se" result="seMask"><feFuncA type="linear" slope="2.2" intercept="-0.6"/></feComponentTransfer>`
  ), r('<feComposite in="__IN__" in2="seMask" operator="in" result="__OUT__"/>')), !n.length) return "";
  const c = Et("f");
  return e.defs.push(`<filter id="${c}" x="-30%" y="-30%" width="160%" height="160%">${n.join("")}</filter>`), ` filter="url(#${c})"`;
}
function mu(t, e, n) {
  var h;
  const o = (h = t.effects) == null ? void 0 : h.reflection;
  if (!o) return "";
  const s = Math.max(0, Math.min(1, o.alpha));
  if (s <= 0 || t.h <= 0) return "";
  const r = Math.max(0, o.distance), i = t.h + r, c = Math.max(1, t.h * Math.max(0.02, Math.min(1, o.size))), a = -t.w * 0.25, l = t.w * 1.5, u = Et("rg"), f = Et("rm");
  return n.defs.push(
    `<linearGradient id="${u}" gradientUnits="userSpaceOnUse" x1="0" y1="${E(i)}" x2="0" y2="${E(i + c)}"><stop offset="0" stop-color="#fff" stop-opacity="${E(s)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
  ), n.defs.push(
    `<mask id="${f}" maskUnits="userSpaceOnUse" x="${E(a)}" y="${E(i)}" width="${E(l)}" height="${E(c)}"><rect x="${E(a)}" y="${E(i)}" width="${E(l)}" height="${E(c)}" fill="url(#${u})"/></mask>`
  ), `<g mask="url(#${f})" aria-hidden="true"><use href="#${e}" xlink:href="#${e}" transform="translate(0 ${E(2 * t.h + r)}) scale(1 -1)"/></g>`;
}
function en(t, e, n) {
  var i;
  const o = pu(t.effects, n);
  if (!((i = t.effects) != null && i.reflection)) return `<g transform="${Xe(t)}"${o}>${e}</g>`;
  const s = Et("rc"), r = `<g id="${s}">${e}</g>`;
  return `<g transform="${Xe(t)}">` + mu(t, s, n) + (o ? `<g${o}>${r}</g>` : r) + "</g>";
}
const gu = {
  none: { d: "", fill: !1 },
  triangle: { d: "M0 0 L10 5 L0 10 z", fill: !0 },
  stealth: { d: "M0 0 L10 5 L0 10 L3 5 z", fill: !0 },
  diamond: { d: "M0 5 L5 0 L10 5 L5 10 z", fill: !0 },
  oval: { d: "M0 5 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0", fill: !0 },
  arrow: { d: "M0 0 L10 5 L0 10", fill: !1 }
};
function _s(t, e, n, o) {
  const s = gu[t.type];
  if (!s.d) return "";
  const r = Et("m"), i = Math.max(1, t.h), c = Math.max(1, t.w);
  return n.defs.push(
    `<marker id="${r}" viewBox="0 0 10 10" refX="${o ? 0 : 10}" refY="5" markerWidth="${E(i)}" markerHeight="${E(c)}" markerUnits="strokeWidth" orient="${o ? "auto-start-reverse" : "auto"}"><path d="${s.d}" ${s.fill ? `fill="${e}"` : `fill="none" stroke="${e}" stroke-width="1.6"`}/></marker>`
  ), `url(#${r})`;
}
function es(t, e) {
  if (!t) return "";
  let n = ` stroke="${t.color}" stroke-width="${E(t.width)}"`;
  if (t.dash && (n += ` stroke-dasharray="${t.dash.map(E).join(" ")}"`), t.cap && (n += ` stroke-linecap="${t.cap}"`), t.join && (n += ` stroke-linejoin="${t.join}"`), t.head) {
    const o = _s(t.head, t.color, e, !0);
    o && (n += ` marker-start="${o}"`);
  }
  if (t.tail) {
    const o = _s(t.tail, t.color, e, !1);
    o && (n += ` marker-end="${o}"`);
  }
  return n;
}
function Xe(t) {
  const e = [];
  return t.rot && e.push(`rotate(${E(t.rot)} ${E(t.x + t.w / 2)} ${E(t.y + t.h / 2)})`), e.push(`translate(${E(t.x)} ${E(t.y)})`), e.join(" ");
}
function ns(t) {
  return !t.flipH && !t.flipV ? "" : `translate(${E(t.w / 2)} ${E(t.h / 2)}) scale(${t.flipH ? -1 : 1} ${t.flipV ? -1 : 1}) translate(${E(-t.w / 2)} ${E(-t.h / 2)})`;
}
function bu(t, e) {
  return e ? e.startsWith("slide:") ? `<a data-slide="${et(e.slice(6))}" style="cursor:pointer">${t}</a>` : `<a href="${et(e)}" target="_blank" rel="noopener noreferrer">${t}</a>` : t;
}
function wu(t, e) {
  try {
    const n = e instanceof Error ? e.message : String(e), o = t.name ? `${t.kind} · ${t.name}` : t.kind;
    return `<g transform="${Xe(t)}" data-render-error="1"><title>${et(o)} 渲染失败：${et(n.slice(0, 200))}</title><rect width="${E(t.w)}" height="${E(t.h)}" fill="rgba(220,38,38,0.06)" stroke="#dc2626" stroke-width="1" stroke-dasharray="5 4"/></g>`;
  } catch {
    return "";
  }
}
function ir(t, e) {
  var o;
  let n;
  try {
    switch (t.kind) {
      case "shape":
        n = $u(t, e);
        break;
      case "image":
        n = ku(t, e);
        break;
      case "group":
        n = Su(t, e);
        break;
      case "table":
        n = Cu(t, e);
        break;
      case "unsupported":
        n = Au(t);
        break;
    }
  } catch (s) {
    n = wu(t, s);
  }
  if (t.id !== void 0) {
    const s = (o = e.hidden) != null && o.has(t.id) ? "visibility:hidden;" : "";
    n = `<g data-el="${t.id}" style="${s}transform-box:fill-box;transform-origin:center">${n}</g>`;
  }
  return bu(n, t.link);
}
function yu(t, e, n) {
  const o = Math.min(e.extrusion ?? 0, Math.max(t.w, t.h));
  if (o <= 0.5) return "";
  const s = e.rotY ?? 0, r = e.rotX ?? 0, i = (s || 35) * Math.PI / 180, c = Math.cos(i) * o, a = Math.sin((r || 20) * Math.PI / 180) * o, l = e.extrusionColor ?? Ye(n, "#000", 0.32), u = Math.max(2, Math.min(14, Math.round(o))), f = [];
  for (let h = u; h >= 1; h--) {
    const m = h / u;
    f.push(
      `<g transform="translate(${E(c * m)} ${E(a * m)})"><path d="${t.path}" fill="${l}" fill-rule="nonzero"/></g>`
    );
  }
  return f.join("");
}
function xu(t, e, n, o) {
  const s = e.bevelTop ?? 0;
  if (s <= 0.3 || !t.path) return "";
  const r = Ye(n, "#fff", 0.5), i = Ye(n, "#000", 0.25), c = Math.min(s * 2, Math.min(t.w, t.h) / 3), a = Et("bv");
  return o.defs.push(`<clipPath id="${a}"><path d="${t.path}"/></clipPath>`), `<g clip-path="url(#${a})"><path d="${t.path}" fill="none" stroke="${r}" stroke-width="${E(c)}" stroke-linejoin="round" opacity="0.55"/><path d="${t.path}" fill="none" stroke="${i}" stroke-width="${E(c / 3)}" stroke-linejoin="round" opacity="0.35" transform="translate(0 ${E(c / 3)})"/></g>`;
}
function Ye(t, e, n) {
  const o = (c) => {
    const a = c.match(/rgba?\(([^)]+)\)/);
    if (a) {
      const u = a[1].split(",").map((f) => Number(f.trim()));
      return [u[0] || 0, u[1] || 0, u[2] || 0];
    }
    const l = c.replace("#", "");
    return l.length >= 6 ? [parseInt(l.slice(0, 2), 16), parseInt(l.slice(2, 4), 16), parseInt(l.slice(4, 6), 16)] : [128, 128, 128];
  }, s = o(t), r = o(e), i = s.map((c, a) => Math.round(c * (1 - n) + r[a] * n));
  return `rgb(${i[0]},${i[1]},${i[2]})`;
}
function $u(t, e) {
  var o, s;
  let n = "";
  if (t.path) {
    const r = t.openGeom ? "none" : t.fill ? ts(t.fill, e, t.w, t.h) : "none", i = ((o = t.fill) == null ? void 0 : o.type) === "solid" ? t.fill.color : ((s = t.fill) == null ? void 0 : s.type) === "gradient" && t.fill.stops.length ? t.fill.stops[0].color : "rgb(128,128,128)", c = t.scene3d;
    c && (n += yu(t, c, i));
    const a = c != null && c.contourWidth ? ` stroke="${c.contourColor ?? Ye(i, "#000", 0.45)}" stroke-width="${E(c.contourWidth)}"` : es(t.stroke, e), l = `<path d="${t.path}" fill="${r}" fill-rule="nonzero"${a}/>`, u = ns(t);
    n += u ? `<g transform="${u}">${l}</g>` : l, c && (n += xu(t, c, i, e));
  }
  return t.text && (n += lr(t.text, t.w, t.h, e)), en(t, n, e);
}
function Mu(t, e) {
  const n = Math.max(6, Math.min(Math.min(t.w, t.h) * 0.22, 34)), o = t.w / 2, s = t.h / 2, r = `<circle cx="${E(o)}" cy="${E(s)}" r="${E(n)}" fill="rgba(17,17,17,0.55)" stroke="rgba(255,255,255,0.92)" stroke-width="${E(Math.max(1, n * 0.09))}"/>`;
  let i;
  if (e.kind === "audio") {
    const l = n * 0.42, u = o - l * 1.15;
    i = `<path d="M${E(u)} ${E(s - l * 0.42)} H${E(u + l * 0.62)} L${E(u + l * 1.5)} ${E(s - l)} V${E(s + l)} L${E(u + l * 0.62)} ${E(s + l * 0.42)} H${E(u)} Z" fill="#fff"/><path d="M${E(o + l * 0.65)} ${E(s - l * 0.6)} A ${E(l * 0.75)} ${E(l * 0.75)} 0 0 1 ${E(o + l * 0.65)} ${E(s + l * 0.6)}" fill="none" stroke="#fff" stroke-width="${E(Math.max(1, l * 0.26))}" stroke-linecap="round"/><path d="M${E(o + l * 1.15)} ${E(s - l * 1.05)} A ${E(l * 1.35)} ${E(l * 1.35)} 0 0 1 ${E(o + l * 1.15)} ${E(s + l * 1.05)}" fill="none" stroke="#fff" stroke-width="${E(Math.max(1, l * 0.26))}" stroke-linecap="round" opacity="0.85"/>`;
  } else {
    const l = n * 0.46;
    i = `<path d="M${E(o - l * 0.62)} ${E(s - l)} L${E(o + l)} ${E(s)} L${E(o - l * 0.62)} ${E(s + l)} Z" fill="#fff"/>`;
  }
  const c = e.kind === "audio" ? "音频" : "视频", a = e.src ? e.external ? `${c}（外链）` : c : `${c}（源不可用）`;
  return `<g aria-hidden="true" pointer-events="none"><title>${et(a)}</title>${r}${i}</g>`;
}
function Eu(t, e) {
  const o = e.kind === "audio" ? `<audio controls preload="none" src="${et(e.src ?? "")}" style="width:100%;display:block"></audio>` : `<video controls preload="metadata" src="${et(e.src ?? "")}"` + (t.src ? ` poster="${et(t.src)}"` : "") + ' style="width:100%;height:100%;display:block;object-fit:contain;background:#000"></video>', s = e.kind === "audio" ? Math.min(t.h, 54) : t.h, r = e.kind === "audio" ? t.h - s : 0;
  return `<foreignObject x="0" y="${E(r)}" width="${E(t.w)}" height="${E(s)}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%">${o}</div></foreignObject>`;
}
function ku(t, e) {
  const n = (t.alpha !== void 0 && t.alpha < 1 ? ` opacity="${E(t.alpha)}"` : "") + (t.filter ? ` style="filter:${t.filter}"` : "");
  let o;
  if (!t.src)
    o = `<rect width="${E(t.w)}" height="${E(t.h)}" fill="rgb(38,42,48)"/>`;
  else if (t.crop && (t.crop.l || t.crop.t || t.crop.r || t.crop.b)) {
    const r = t.w / Math.max(1 - t.crop.l - t.crop.r, 0.01), i = t.h / Math.max(1 - t.crop.t - t.crop.b, 0.01), c = Et("c");
    e.defs.push(`<clipPath id="${c}"><rect width="${E(t.w)}" height="${E(t.h)}"/></clipPath>`), o = `<g clip-path="url(#${c})"><image href="${et(t.src)}" x="${E(-t.crop.l * r)}" y="${E(-t.crop.t * i)}" width="${E(r)}" height="${E(i)}" preserveAspectRatio="none"${n}/></g>`;
  } else
    o = `<image href="${et(t.src)}" width="${E(t.w)}" height="${E(t.h)}" preserveAspectRatio="none"${n}/>`;
  if (t.clipPath) {
    const r = Et("cs");
    e.defs.push(`<clipPath id="${r}"><path d="${t.clipPath}"/></clipPath>`), o = `<g clip-path="url(#${r})">${o}</g>`;
  }
  t.stroke && (o += `<path d="${t.clipPath ?? `M0 0 H${E(t.w)} V${E(t.h)} H0 Z`}" fill="none"${es(t.stroke, e)}/>`);
  const s = ns(t);
  return s && (o = `<g transform="${s}">${o}</g>`), t.media && (o += e.media === "player" && t.media.src ? Eu(t, t.media) : Mu(t, t.media)), en(t, o, e);
}
function Su(t, e) {
  const n = `scale(${E(t.scaleX || 1)} ${E(t.scaleY || 1)}) translate(${E(-t.childX)} ${E(-t.childY)})`, o = t.children.map((s) => ir(s, e)).join("");
  return en(t, `<g transform="${ns(t)} ${n}">${o}</g>`, e);
}
const Tu = { color: "rgba(0,0,0,0.25)", width: 1, dash: null };
function Ue(t, e, n, o, s, r) {
  if (t === null) return "";
  const i = t ?? Tu;
  return `<line x1="${E(e)}" y1="${E(n)}" x2="${E(o)}" y2="${E(s)}"${es(i, r)}/>`;
}
function Cu(t, e) {
  const n = [], o = [];
  let s = 0;
  return t.rows.forEach((r, i) => {
    let c = 0;
    r.cells.forEach((a, l) => {
      const u = t.colWidths.slice(l, l + a.colSpan).reduce((d, p) => d + p, 0) || t.colWidths[l] || 0;
      if (a.merged) {
        c += t.colWidths[l] ?? 0;
        return;
      }
      const f = t.rows.slice(i, i + a.rowSpan).reduce((d, p) => d + p.height, 0) || r.height, h = a.fill ? ts(a.fill, e, u, f) : "none", m = a.borders ?? {};
      n.push(
        `<g transform="translate(${E(c)} ${E(s)})"><rect width="${E(u)}" height="${E(f)}" fill="${h}"/>` + (a.text ? lr(a.text, u, f, e, a.margins, a.vAlign, a.vert) : "") + "</g>"
      ), o.push(
        `<g transform="translate(${E(c)} ${E(s)})">` + Ue(m.t, 0, 0, u, 0, e) + Ue(m.b, 0, f, u, f, e) + Ue(m.l, 0, 0, 0, f, e) + Ue(m.r, u, 0, u, f, e) + "</g>"
      ), c += t.colWidths[l] ?? 0;
    }), s += r.height;
  }), en(t, n.join("") + o.join(""), e);
}
function Lu(t, e, n) {
  if (!(t != null && t.length)) return "";
  const o = Math.max(14, Math.min(e, n) * 0.036), s = [];
  return t.forEach((r, i) => {
    const c = Math.max(0, Math.min(Number.isFinite(r.x) ? r.x : 0, e - o)), a = Math.max(0, Math.min(Number.isFinite(r.y) ? r.y : 0, n - o)), l = String(r.idx ?? i + 1), u = [r.author, r.date, r.text].filter(Boolean).join(" · ");
    s.push(
      `<g class="ppt-comment" data-comment="${et(l)}" transform="translate(${E(c)} ${E(a)})"><title>${et(u)}</title><path d="M${E(o * 0.16)} 0 H${E(o * 0.84)} A ${E(o * 0.16)} ${E(o * 0.16)} 0 0 1 ${E(o)} ${E(o * 0.16)} V${E(o * 0.62)} A ${E(o * 0.16)} ${E(o * 0.16)} 0 0 1 ${E(o * 0.84)} ${E(o * 0.78)} H${E(o * 0.42)} L${E(o * 0.16)} ${E(o)} V${E(o * 0.78)} A ${E(o * 0.16)} ${E(o * 0.16)} 0 0 1 0 ${E(o * 0.62)} V${E(o * 0.16)} A ${E(o * 0.16)} ${E(o * 0.16)} 0 0 1 ${E(o * 0.16)} 0 Z" fill="rgb(255,196,60)" stroke="rgba(120,80,0,0.55)" stroke-width="${E(Math.max(0.6, o * 0.045))}"/><text x="${E(o * 0.5)}" y="${E(o * 0.42)}" text-anchor="middle" dominant-baseline="central" fill="rgb(60,40,0)" font-size="${E(o * 0.52)}" font-weight="700">${et(l)}</text></g>`
    );
  }), s.join("");
}
function Au(t) {
  const e = Math.max(10, Math.min(16, t.h / 6));
  return `<g transform="${Xe(t)}"><rect width="${E(t.w)}" height="${E(t.h)}" fill="rgba(127,127,127,0.07)" stroke="#aaa" stroke-dasharray="6 4"/><text x="${E(t.w / 2)}" y="${E(t.h / 2)}" text-anchor="middle" dominant-baseline="middle" fill="#888" font-size="${E(e)}">${et(t.label)}</text></g>`;
}
const Pu = { top: "flex-start", middle: "center", bottom: "flex-end" }, ar = ["'PingFang SC'", "'Hiragino Sans GB'", "'Microsoft YaHei'", "sans-serif"];
function cr(t, e) {
  const n = [], o = /* @__PURE__ */ new Set();
  for (const s of t) {
    const r = s.toLowerCase();
    s && !o.has(r) && (o.add(r), n.push(`'${s}'`));
  }
  for (const s of e) {
    const r = s.replace(/'/g, "").toLowerCase();
    o.has(r) || (o.add(r), n.push(s));
  }
  return n.join(",");
}
function Iu(t, e) {
  const n = t.size * e;
  let o = `font-size:${E(n)}px;`;
  o += t.gradient ? `background-image:${t.gradient};-webkit-background-clip:text;background-clip:text;color:transparent;` : `color:${t.color};`, t.b && (o += "font-weight:700;"), t.i && (o += "font-style:italic;");
  const s = [];
  return t.u && s.push("underline"), t.strike && s.push("line-through"), s.length && (o += `text-decoration:${s.join(" ")};`, t.underlineColor && (o += `text-decoration-color:${t.underlineColor};`)), t.fonts.length && (o += `font-family:${cr(t.fonts, ar)};`), t.spacing && (o += `letter-spacing:${E(t.spacing)}px;`), t.caps === "all" ? o += "text-transform:uppercase;" : t.caps === "small" && (o += "font-variant:small-caps;"), t.highlight && (o += `background-color:${t.highlight};`), t.outline && (o += `-webkit-text-stroke:${E(t.outline.width)}px ${t.outline.color};`), t.shadow && (o += `text-shadow:${t.shadow};`), t.baseline && (o += `vertical-align:${t.baseline > 0 ? "super" : "sub"};font-size:${E(n * 0.65)}px;`), o;
}
function Ou(t) {
  let e = "";
  for (const n of t) {
    if (n === `
`) {
      e += "<br/>";
      continue;
    }
    const o = Qn(n);
    if (!o) {
      e += et(n);
      continue;
    }
    e += `<span style="margin-${qo(n) ? "left" : "right"}:-${o}em">${et(n)}</span>`;
  }
  return e;
}
function vu(t, e, n = !1) {
  var r;
  if ((r = t.math) != null && r.length) {
    const i = tn(t, e);
    if (i && i.w > 0)
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${E(i.w)}" height="${E(i.h + i.d)}" viewBox="0 ${E(-i.h)} ${E(i.w)} ${E(i.h + i.d)}" style="display:inline-block;vertical-align:${E(-i.d)}px;overflow:visible">${i.svg}</svg>`;
  }
  const o = t.text ? n ? Ou(t.text) : et(t.text).replace(/\n/g, "<br/>") : "&#160;", s = `<span style="${Iu(t, e)}">${o}</span>`;
  return t.link ? `<a ${t.link.startsWith("slide:") ? `data-slide="${et(t.link.slice(6))}" style="cursor:pointer;text-decoration:underline"` : `href="${et(t.link)}" target="_blank" rel="noopener noreferrer"`}>${s}</a>` : s;
}
const zu = {
  vert: "writing-mode:vertical-rl;",
  vert270: "writing-mode:vertical-rl;transform:rotate(180deg);",
  wordArtVert: "writing-mode:vertical-rl;text-orientation:upright;"
};
function lr(t, e, n, o, s, r, i) {
  var w;
  if (t.autoFitCompute && !t.autoFitShape) {
    const b = su(t, e, n);
    b < 1 && (t = { ...t, fontScale: t.fontScale * b });
  }
  if (o.textMode === "svg" || or((w = t.warp) == null ? void 0 : w.preset))
    return vn(t, e, n, (g) => {
      const y = Et("tg");
      return o.defs.push(g.replace("__ID__", y)), y;
    }, s, r);
  const [c, a, l, u] = s ?? t.insets, f = t.fontScale, h = t.paragraphs.map((b) => {
    const g = b.runs[0], y = ((g == null ? void 0 : g.size) ?? 18) * f, $ = t.wrap && nu(b, e - u - a - Math.max(0, b.marL), f, !0), x = b.runs.map((T) => vu(T, f, $)).join("");
    let M = "";
    if (b.bulletImage)
      M = `<img src="${et(b.bulletImage)}" style="height:${E(y * 0.8)}px;vertical-align:middle;margin-right:4px"/>`;
    else if (b.bullet) {
      const T = y * (b.bulletSize ?? 1), S = b.bulletColor ?? (g == null ? void 0 : g.color) ?? "#000", A = b.bulletFont && !/wingdings|webdings|symbol/i.test(b.bulletFont) ? `font-family:${cr([b.bulletFont], ar)};` : "";
      M = `<span style="font-size:${E(T)}px;color:${S};${A}">${et(b.bullet)}&#160;</span>`;
    }
    return `<div style="${`margin:${E(b.spaceBefore)}px 0 ${E(b.spaceAfter)}px 0;text-align:${b.align};padding-left:${E(Math.max(0, b.marL))}px;text-indent:${E(b.indent)}px;line-height:${b.lineHeight !== null ? E(b.lineHeight) : "1.2"};` + (b.rtl ? "direction:rtl;" : "") + `white-space:${t.wrap ? "pre-wrap" : "pre"};word-break:break-word;`}">${M}${x}</div>`;
  }).join(""), m = r ?? t.anchor, d = i ?? t.vert, p = `width:${E(e)}px;height:${E(n)}px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:${Pu[m]};` + (t.anchorCtr ? "align-items:center;" : "") + `padding:${E(c)}px ${E(a)}px ${E(l)}px ${E(u)}px;` + (t.columns ? `column-count:${t.columns};column-gap:${E(t.columnGap ?? 0)}px;display:block;` : "") + (d ? zu[d] ?? "" : "") + "overflow:visible;";
  return `<foreignObject width="${E(e)}" height="${E(n)}" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="${p}">${h}</div></foreignObject>`;
}
function js(t, e) {
  let n = t.get(e);
  return n || (n = { family: e, styles: /* @__PURE__ */ new Set(), chars: /* @__PURE__ */ new Set(), count: 0 }, t.set(e, n)), n;
}
function Ru(t, e) {
  for (const n of e.runs)
    if (!(!n.text || !n.fonts.length))
      for (const o of n.fonts) {
        const s = js(t, o);
        s.styles.add(`${n.b ? 1 : 0}${n.i ? 1 : 0}`);
        for (const r of n.text) s.chars.add(r);
        s.count += n.text.length;
      }
  if (e.bullet && e.bulletFont && !/wingdings|webdings|symbol/i.test(e.bulletFont)) {
    const n = js(t, e.bulletFont);
    n.styles.add("00");
    for (const o of e.bullet) n.chars.add(o);
    n.count += e.bullet.length;
  }
}
function Vs(t, e) {
  for (const n of (e == null ? void 0 : e.paragraphs) ?? []) Ru(t, n);
}
function ur(t, e) {
  for (const n of e)
    switch (n.kind) {
      case "shape":
        Vs(t, n.text);
        break;
      case "group":
        ur(t, n.children);
        break;
      case "table":
        for (const o of n.rows) for (const s of o.cells) Vs(t, s.text);
        break;
    }
}
function Wu(t) {
  const e = /* @__PURE__ */ new Map();
  for (const o of t) ur(e, o.elements);
  const n = [];
  for (const o of e.values())
    o.chars.size && n.push({
      family: o.family,
      styles: [...o.styles].sort().map((s) => ({ bold: s[0] === "1", italic: s[1] === "1" })),
      chars: [...o.chars].sort((s, r) => s.codePointAt(0) - r.codePointAt(0)).join(""),
      count: o.count
    });
  return n.sort((o, s) => s.count - o.count || o.family.localeCompare(s.family));
}
wr(yi);
yr(ja);
Ga(pc);
Va(kc);
function Du(t) {
  let e;
  try {
    e = new Mo(t);
  } catch {
    return null;
  }
  const n = e.stream("EncryptedPackage");
  return n ? { info: e.stream("EncryptionInfo"), pkg: n } : null;
}
async function Gu(t, e = {}) {
  let n;
  if (t instanceof Uint8Array ? n = t : t instanceof ArrayBuffer ? n = new Uint8Array(t) : n = new Uint8Array(await t.arrayBuffer()), n[0] === 80 && n[1] === 75) return os(n, e);
  if (n[0] === 208 && n[1] === 207) {
    const o = Du(n);
    if (o) {
      if (!o.info) throw new Error("该文件已加密，但 EncryptionInfo 流缺失，文件可能已损坏");
      const s = Xa();
      if (!s) throw new Error("该文件已加密，但未注入解密器（setDecryptor）");
      if (e.password === void 0) throw new Error("该文件已加密，请通过 parse(input, { password }) 提供打开密码");
      return os(s(o.info, o.pkg, e.password), e);
    }
    return Hl(n, e.password);
  }
  throw new Error("无法识别的文件格式：既不是 .pptx（Zip）也不是 .ppt（CFB）");
}
function Uu(t, e) {
  const n = (r) => {
    if (typeof r != "string" || !r.startsWith("asset:")) return r;
    const i = Number(r.slice(6));
    return Number.isInteger(i) ? e[i] ?? null : null;
  }, o = (r) => {
    const i = r;
    i && i.type === "image" && typeof i.src == "string" && (i.src = n(i.src) ?? "");
  }, s = (r) => {
    var i, c;
    for (const a of r)
      if (a.kind === "image")
        a.src = n(a.src) ?? "", (i = a.media) != null && i.src && (a.media.src = n(a.media.src) ?? null);
      else if (a.kind === "shape") {
        o(a.fill);
        for (const l of ((c = a.text) == null ? void 0 : c.paragraphs) ?? [])
          l.bulletImage && (l.bulletImage = n(l.bulletImage) ?? null);
      } else if (a.kind === "group")
        s(a.children);
      else if (a.kind === "table")
        for (const l of a.rows) for (const u of l.cells) o(u.fill);
  };
  for (const r of t.slides)
    o(r.background), s(r.elements);
  for (const r of t.embeddedFonts ?? []) r.src = n(r.src) ?? "";
}
let Nu = 0;
function Xu(t, e) {
  const n = e instanceof Uint8Array ? e.slice().buffer : e, o = ++Nu;
  return new Promise((s, r) => {
    const i = (c) => {
      if (c.data.id !== o) return;
      if (t.removeEventListener("message", i), !c.data.ok || !c.data.presentation) {
        r(new Error(c.data.error ?? "Worker 解析失败"));
        return;
      }
      const a = [];
      for (const u of c.data.assets ?? [])
        try {
          a.push(URL.createObjectURL(new Blob([u.data], { type: u.mime })));
        } catch {
          a.push(null);
        }
      const l = c.data.presentation;
      Uu(l, a), l.dispose = () => {
        for (const u of a) u && URL.revokeObjectURL(u);
        a.length = 0;
      }, s(l);
    };
    t.addEventListener("message", i), t.postMessage({ id: o, bytes: n }, [n]);
  });
}
function Ws(t) {
  return t ? t.paragraphs.map((e) => e.runs.map((n) => n.text).join("")).join(`
`) : "";
}
function fr(t, e) {
  for (const n of t)
    switch (n.kind) {
      case "shape":
        e.push(Ws(n.text));
        break;
      case "group":
        fr(n.children, e);
        break;
      case "table":
        for (const o of n.rows) for (const s of o.cells) e.push(Ws(s.text));
        break;
    }
}
function Yu(t) {
  const e = [];
  return fr(t.elements, e), t.notes && e.push(t.notes), e.filter(Boolean).join(`
`);
}
async function hr(t) {
  const e = Array.from(new Set(t.match(/blob:[^"')\s]+/g) ?? []));
  if (!e.length) return t;
  const n = await Promise.all(
    e.map(async (s) => {
      try {
        const r = await (await fetch(s)).blob(), i = await new Promise((c, a) => {
          const l = new FileReader();
          l.onload = () => c(String(l.result)), l.onerror = a, l.readAsDataURL(r);
        });
        return [s, i];
      } catch {
        return [s, s];
      }
    })
  );
  let o = t;
  for (const [s, r] of n) o = o.split(s).join(r);
  return o;
}
function Bu(t) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(t)}`;
}
async function Fu(t) {
  const e = new Image();
  return e.decoding = "sync", await new Promise((n, o) => {
    e.onload = () => n(), e.onerror = () => o(new Error("SVG 渲染失败")), e.src = Bu(t);
  }), e;
}
async function Gs(t, e, n, o) {
  const s = await hr(rr(t, e, { textMode: o })), r = await Fu(s), i = document.createElement("canvas");
  i.width = Math.round(t.width * n), i.height = Math.round(t.height * n);
  const c = i.getContext("2d");
  if (!c) throw new Error("无法获取 canvas 上下文");
  return c.fillStyle = "#fff", c.fillRect(0, 0, i.width, i.height), c.drawImage(r, 0, 0, i.width, i.height), await new Promise((a, l) => {
    i.toBlob((u) => u ? a(u) : l(new Error("导出失败")), "image/png");
  });
}
async function qu(t, e, n = 2) {
  try {
    return await Gs(t, e, n, "html");
  } catch (o) {
    if ((o == null ? void 0 : o.name) !== "SecurityError") throw o;
    return Gs(t, e, n, "svg");
  }
}
async function Xs(t, e, n) {
  return hr(rr(t, e, { textMode: "svg", hiddenElements: n }));
}
async function Ku(t, e = {}) {
  const n = [];
  for (const s of t.slides) {
    const r = e.animationSteps ? qs(s.animations) : [];
    if (!r.length) {
      n.push(Xs(t, s, [...$r(s)]));
      continue;
    }
    for (let i = 0; i <= r.length; i++)
      n.push(Xs(t, s, [...Ks(r, i)]));
  }
  const o = await Promise.all(n);
  return `<!doctype html><html><head><meta charset="utf-8"><title>slides</title><style>@page{size:${Math.round(t.width)}px ${Math.round(t.height)}px;margin:0}html,body{margin:0;padding:0}.pg{page-break-after:always;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center}.pg svg{width:100%;height:100%}</style></head><body>` + o.map((s) => `<div class="pg">${s}</div>`).join("") + "</body></html>";
}
export {
  Xn as WrongPasswordError,
  Wu as collectFonts,
  _a as detectMetafile,
  Vu as encryptionScheme,
  qs as groupSteps,
  ju as hasDecryptor,
  Qu as hasFontDecoder,
  tf as hasMetafileDecoder,
  Ks as hiddenBefore,
  ja as metafileToSvg,
  Gu as parse,
  Xu as parseInWorker,
  Ku as presentationToPrintableHtml,
  rr as renderSlideToSvg,
  wr as setChartParser,
  ef as setChartRenderer,
  Ga as setDecryptor,
  nf as setFontDecoder,
  yr as setMetafileDecoder,
  Va as setPptDecryptor,
  Yu as slideText,
  qu as slideToPng,
  Xs as slideToSvgFile,
  $r as staticHidden
};
