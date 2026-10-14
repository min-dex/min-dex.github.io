import { rad as It, ep as en, n as Q, presetGeom as Ot } from "./geometry.js";
class nn {
  constructor(e) {
    this.attributes = [], this.childNodes = [], this.nextElementSibling = null, this.tagName = e;
    const n = e.indexOf(":");
    this.localName = n < 0 ? e : e.slice(n + 1);
  }
  get firstElementChild() {
    for (const e of this.childNodes) if (typeof e != "string") return e;
    return null;
  }
  get children() {
    return this.childNodes.filter((e) => typeof e != "string");
  }
  getAttribute(e) {
    for (const n of this.attributes) if (n.name === e) return n.value;
    return null;
  }
  get textContent() {
    let e = "";
    for (const n of this.childNodes) e += typeof n == "string" ? n : n.textContent;
    return e;
  }
  /** 只支持 '*'，与解析器里的用法一致 */
  getElementsByTagName(e) {
    const n = [], r = (o) => {
      for (const s of o.children)
        (e === "*" || s.localName === e || s.tagName === e) && n.push(s), r(s);
    };
    return r(this), n;
  }
}
const rn = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'"
};
function pe(t) {
  return t.indexOf("&") < 0 ? t : t.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (e, n) => {
    if (n[0] === "#") {
      const r = n[1] === "x" || n[1] === "X" ? parseInt(n.slice(2), 16) : parseInt(n.slice(1), 10);
      return Number.isFinite(r) && r >= 0 ? String.fromCodePoint(r) : e;
    }
    return rn[n] ?? e;
  });
}
function on(t) {
  let e = 0;
  const n = t.length, r = [];
  let o = null;
  const s = (l, i) => {
    const c = l.children;
    c.length && (c[c.length - 1].nextElementSibling = i), l.childNodes.push(i);
  };
  for (; e < n; ) {
    const l = t.indexOf("<", e);
    if (l < 0) break;
    if (l > e) {
      const g = t.slice(e, l);
      r.length && g.trim() ? r[r.length - 1].childNodes.push(pe(g)) : r.length && g.includes(" ") && r[r.length - 1].childNodes.push(g);
    }
    if (t.startsWith("<!--", l)) {
      const g = t.indexOf("-->", l + 4);
      e = g < 0 ? n : g + 3;
      continue;
    }
    if (t.startsWith("<![CDATA[", l)) {
      const g = t.indexOf("]]>", l + 9), k = t.slice(l + 9, g < 0 ? n : g);
      r.length && r[r.length - 1].childNodes.push(k), e = g < 0 ? n : g + 3;
      continue;
    }
    if (t.startsWith("<?", l) || t.startsWith("<!", l)) {
      const g = t.indexOf(">", l);
      e = g < 0 ? n : g + 1;
      continue;
    }
    if (t[l + 1] === "/") {
      const g = t.indexOf(">", l);
      if (g < 0) break;
      r.pop(), e = g + 1;
      continue;
    }
    let i = l + 1, c = "";
    for (; i < n; ) {
      const g = t[i];
      if (c)
        g === c && (c = "");
      else if (g === '"' || g === "'") c = g;
      else if (g === ">") break;
      i++;
    }
    if (i >= n) break;
    const u = t[i - 1] === "/", a = t.slice(l + 1, u ? i - 1 : i);
    let d = 0;
    for (; d < a.length && !/[\s/]/.test(a[d]); ) d++;
    const m = new nn(a.slice(0, d)), p = /([^\s=/]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    p.lastIndex = d;
    let b;
    for (; (b = p.exec(a)) !== null; ) {
      const g = b[1], k = g.indexOf(":");
      m.attributes.push({
        name: g,
        localName: k < 0 ? g : g.slice(k + 1),
        value: pe(b[3] ?? b[4] ?? "")
      });
    }
    r.length ? s(r[r.length - 1], m) : o || (o = m), u || r.push(m), e = i + 1;
  }
  if (!o) throw new Error("XML 解析失败：未找到根元素");
  return o;
}
const ge = typeof DOMParser < "u" ? new DOMParser() : null;
function sn(t) {
  if (!ge)
    return on(t);
  const e = ge.parseFromString(t, "application/xml"), n = e.getElementsByTagName("parsererror")[0];
  if (n) throw new Error("XML 解析失败: " + (n.textContent ?? "").slice(0, 200));
  return e.documentElement;
}
function H(t, e) {
  const n = [];
  if (!t) return n;
  for (let r = t.firstElementChild; r; r = r.nextElementSibling)
    r.localName === e && n.push(r);
  return n;
}
function f(t, e) {
  if (!t) return null;
  for (let n = t.firstElementChild; n; n = n.nextElementSibling)
    if (n.localName === e) return n;
  return null;
}
function R(t, ...e) {
  let n = t;
  for (const r of e)
    if (n = f(n, r), !n) return null;
  return n;
}
function h(t, e) {
  if (!t) return null;
  if (e.includes(":")) {
    for (const o of Array.from(t.attributes)) if (o.name === e) return o.value;
    const r = e.split(":")[1];
    for (const o of Array.from(t.attributes)) if (o.localName === r) return o.value;
    return null;
  }
  const n = t.getAttribute(e);
  if (n !== null) return n;
  for (const r of Array.from(t.attributes)) if (r.localName === e) return r.value;
  return null;
}
function v(t, e) {
  const n = h(t, e);
  if (n === null || n === "") return null;
  const r = Number(n);
  return Number.isFinite(r) ? r : null;
}
function ot(t, e, n = !1) {
  const r = h(t, e);
  return r === null ? n : r === "1" || r === "true";
}
const j = (t) => (t ?? 0) / 9525, At = (t) => t / 100 * (96 / 72), ln = { window: "FFFFFF", windowText: "000000" }, cn = {
  black: "000000",
  white: "FFFFFF",
  red: "FF0000",
  green: "008000",
  lime: "00FF00",
  blue: "0000FF",
  yellow: "FFFF00",
  cyan: "00FFFF",
  magenta: "FF00FF",
  gray: "808080",
  ltGray: "C0C0C0",
  dkGray: "404040",
  orange: "FFA500",
  purple: "800080",
  brown: "A52A2A"
}, an = ["srgbClr", "schemeClr", "sysClr", "prstClr", "scrgbClr", "hslClr"];
function q(t, e) {
  if (!t) return null;
  for (const n of an) {
    const r = f(t, n);
    if (r) return un(r, e);
  }
  return null;
}
function un(t, e) {
  let n = fn(t, e), r = 1;
  for (let i = t.firstElementChild; i; i = i.nextElementSibling) {
    const c = (v(i, "val") ?? 0) / 1e5;
    switch (i.localName) {
      case "alpha":
        r = c;
        break;
      case "shade":
        n = be(n, (u) => u * c);
        break;
      case "tint":
        n = be(n, (u) => u * c + (1 - c));
        break;
      case "lumMod":
        n = Yt(n, (u, a, d) => [u, a, d * c]);
        break;
      case "lumOff":
        n = Yt(n, (u, a, d) => [u, a, d + c]);
        break;
      case "satMod":
        n = Yt(n, (u, a, d) => [u, a * c, d]);
        break;
    }
  }
  const [o, s, l] = n.map((i) => Math.round(zt(i, 0, 255)));
  return r >= 1 ? `rgb(${o},${s},${l})` : `rgba(${o},${s},${l},${Math.round(r * 1e3) / 1e3})`;
}
function fn(t, e) {
  switch (t.localName) {
    case "srgbClr":
      return Tt(h(t, "val") ?? "000000");
    case "sysClr":
      return Tt(h(t, "lastClr") ?? ln[h(t, "val") ?? ""] ?? "000000");
    case "prstClr":
      return Tt(cn[h(t, "val") ?? ""] ?? "808080");
    case "scrgbClr":
      return [
        (v(t, "r") ?? 0) / 1e5 * 255,
        (v(t, "g") ?? 0) / 1e5 * 255,
        (v(t, "b") ?? 0) / 1e5 * 255
      ];
    case "hslClr":
      return Te(
        (v(t, "hue") ?? 0) / 6e4 / 360,
        (v(t, "sat") ?? 0) / 1e5,
        (v(t, "lum") ?? 0) / 1e5
      );
    case "schemeClr": {
      const n = h(t, "val") ?? "tx1";
      if (n === "phClr") return e.phClr ? dn(e.phClr) : [128, 128, 128];
      const r = e.clrMap[n] ?? n;
      return Tt(e.theme[r] ?? e.theme[n] ?? "000000");
    }
  }
  return [0, 0, 0];
}
function dn(t) {
  const e = t.match(/rgba?\(([^)]+)\)/);
  if (e) {
    const n = e[1].split(",").map((r) => Number(r.trim()));
    return [n[0] || 0, n[1] || 0, n[2] || 0];
  }
  return Tt(t);
}
function Tt(t) {
  const e = t.replace("#", "").padStart(6, "0");
  return [parseInt(e.slice(0, 2), 16) || 0, parseInt(e.slice(2, 4), 16) || 0, parseInt(e.slice(4, 6), 16) || 0];
}
function zt(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
const hn = (t) => {
  const e = t / 255;
  return e <= 0.04045 ? e / 12.92 : ((e + 0.055) / 1.055) ** 2.4;
}, mn = (t) => {
  const e = zt(t, 0, 1);
  return (e <= 31308e-7 ? e * 12.92 : 1.055 * e ** (1 / 2.4) - 0.055) * 255;
};
function be(t, e) {
  return t.map((n) => mn(e(hn(n))));
}
function Yt(t, e) {
  const [n, r, o] = pn(t), [s, l, i] = e(n, r, o);
  return Te(s, zt(l, 0, 1), zt(i, 0, 1));
}
function pn([t, e, n]) {
  t /= 255, e /= 255, n /= 255;
  const r = Math.max(t, e, n), o = Math.min(t, e, n), s = (r + o) / 2;
  if (r === o) return [0, 0, s];
  const l = r - o, i = s > 0.5 ? l / (2 - r - o) : l / (r + o);
  let c;
  return r === t ? c = (e - n) / l + (e < n ? 6 : 0) : r === e ? c = (n - t) / l + 2 : c = (t - e) / l + 4, [c / 6, i, s];
}
function Te(t, e, n) {
  if (e === 0) return [n * 255, n * 255, n * 255];
  const r = n < 0.5 ? n * (1 + e) : n + e - n * e, o = 2 * n - r, s = (l) => (l < 0 && (l += 1), l > 1 && (l -= 1), l < 1 / 6 ? o + (r - o) * 6 * l : l < 1 / 2 ? r : l < 2 / 3 ? o + (r - o) * (2 / 3 - l) * 6 : o);
  return [s(t + 1 / 3) * 255, s(t) * 255, s(t - 1 / 3) * 255];
}
var K = Uint8Array, lt = Uint16Array, ue = Int32Array, Gt = new K([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]), Ht = new K([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]), te = new K([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]), Ie = function(t, e) {
  for (var n = new lt(31), r = 0; r < 31; ++r)
    n[r] = e += 1 << t[r - 1];
  for (var o = new ue(n[30]), r = 1; r < 30; ++r)
    for (var s = n[r]; s < n[r + 1]; ++s)
      o[s] = s - n[r] << 5 | r;
  return { b: n, r: o };
}, Ae = Ie(Gt, 2), Le = Ae.b, ee = Ae.r;
Le[28] = 258, ee[258] = 28;
var $e = Ie(Ht, 0), gn = $e.b, ve = $e.r, ne = new lt(32768);
for (var Y = 0; Y < 32768; ++Y) {
  var vt = (Y & 43690) >> 1 | (Y & 21845) << 1;
  vt = (vt & 52428) >> 2 | (vt & 13107) << 2, vt = (vt & 61680) >> 4 | (vt & 3855) << 4, ne[Y] = ((vt & 65280) >> 8 | (vt & 255) << 8) >> 1;
}
var ft = function(t, e, n) {
  for (var r = t.length, o = 0, s = new lt(e); o < r; ++o)
    t[o] && ++s[t[o] - 1];
  var l = new lt(e);
  for (o = 1; o < e; ++o)
    l[o] = l[o - 1] + s[o - 1] << 1;
  var i;
  if (n) {
    i = new lt(1 << e);
    var c = 15 - e;
    for (o = 0; o < r; ++o)
      if (t[o])
        for (var u = o << 4 | t[o], a = e - t[o], d = l[t[o] - 1]++ << a, m = d | (1 << a) - 1; d <= m; ++d)
          i[ne[d] >> c] = u;
  } else
    for (i = new lt(r), o = 0; o < r; ++o)
      t[o] && (i[o] = ne[l[t[o] - 1]++] >> 15 - t[o]);
  return i;
}, xt = new K(288);
for (var Y = 0; Y < 144; ++Y)
  xt[Y] = 8;
for (var Y = 144; Y < 256; ++Y)
  xt[Y] = 9;
for (var Y = 256; Y < 280; ++Y)
  xt[Y] = 7;
for (var Y = 280; Y < 288; ++Y)
  xt[Y] = 8;
var Lt = new K(32);
for (var Y = 0; Y < 32; ++Y)
  Lt[Y] = 5;
var bn = /* @__PURE__ */ ft(xt, 9, 0), vn = /* @__PURE__ */ ft(xt, 9, 1), yn = /* @__PURE__ */ ft(Lt, 5, 0), xn = /* @__PURE__ */ ft(Lt, 5, 1), Vt = function(t) {
  for (var e = t[0], n = 1; n < t.length; ++n)
    t[n] > e && (e = t[n]);
  return e;
}, ct = function(t, e, n) {
  var r = e / 8 | 0;
  return (t[r] | t[r + 1] << 8) >> (e & 7) & n;
}, _t = function(t, e) {
  var n = e / 8 | 0;
  return (t[n] | t[n + 1] << 8 | t[n + 2] << 16) >> (e & 7);
}, fe = function(t) {
  return (t + 7) / 8 | 0;
}, Ut = function(t, e, n) {
  return (e == null || e < 0) && (e = 0), (n == null || n > t.length) && (n = t.length), new K(t.subarray(e, n));
}, wn = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
], nt = function(t, e, n) {
  var r = new Error(e || wn[t]);
  if (r.code = t, Error.captureStackTrace && Error.captureStackTrace(r, nt), !n)
    throw r;
  return r;
}, Re = function(t, e, n, r) {
  var o = t.length, s = r ? r.length : 0;
  if (!o || e.f && !e.l)
    return n || new K(0);
  var l = !n, i = l || e.i != 2, c = e.i;
  l && (n = new K(o * 3));
  var u = function(Ct) {
    var mt = n.length;
    if (Ct > mt) {
      var pt = new K(Math.max(mt * 2, Ct));
      pt.set(n), n = pt;
    }
  }, a = e.f || 0, d = e.p || 0, m = e.b || 0, p = e.l, b = e.d, g = e.m, k = e.n, C = o * 8;
  do {
    if (!p) {
      a = ct(t, d, 1);
      var x = ct(t, d + 1, 3);
      if (d += 3, x)
        if (x == 1)
          p = vn, b = xn, g = 9, k = 5;
        else if (x == 2) {
          var w = ct(t, d, 31) + 257, F = ct(t, d + 10, 15) + 4, y = w + ct(t, d + 5, 31) + 1;
          d += 14;
          for (var M = new K(y), T = new K(19), N = 0; N < F; ++N)
            T[te[N]] = ct(t, d + N * 3, 7);
          d += F * 3;
          for (var I = Vt(T), O = (1 << I) - 1, z = ft(T, I, 1), N = 0; N < y; ) {
            var A = z[ct(t, d, O)];
            d += A & 15;
            var P = A >> 4;
            if (P < 16)
              M[N++] = P;
            else {
              var U = 0, D = 0;
              for (P == 16 ? (D = 3 + ct(t, d, 3), d += 2, U = M[N - 1]) : P == 17 ? (D = 3 + ct(t, d, 7), d += 3) : P == 18 && (D = 11 + ct(t, d, 127), d += 7); D--; )
                M[N++] = U;
            }
          }
          var W = M.subarray(0, w), G = M.subarray(w);
          g = Vt(W), k = Vt(G), p = ft(W, g, 1), b = ft(G, k, 1);
        } else
          nt(1);
      else {
        var P = fe(d) + 4, E = t[P - 4] | t[P - 3] << 8, S = P + E;
        if (S > o) {
          c && nt(0);
          break;
        }
        i && u(m + E), n.set(t.subarray(P, S), m), e.b = m += E, e.p = d = S * 8, e.f = a;
        continue;
      }
      if (d > C) {
        c && nt(0);
        break;
      }
    }
    i && u(m + 131072);
    for (var L = (1 << g) - 1, B = (1 << k) - 1, Z = d; ; Z = d) {
      var U = p[_t(t, d) & L], V = U >> 4;
      if (d += U & 15, d > C) {
        c && nt(0);
        break;
      }
      if (U || nt(2), V < 256)
        n[m++] = V;
      else if (V == 256) {
        Z = d, p = null;
        break;
      } else {
        var _ = V - 254;
        if (V > 264) {
          var N = V - 257, $ = Gt[N];
          _ = ct(t, d, (1 << $) - 1) + Le[N], d += $;
        }
        var J = b[_t(t, d) & B], at = J >> 4;
        J || nt(3), d += J & 15;
        var G = gn[at];
        if (at > 3) {
          var $ = Ht[at];
          G += _t(t, d) & (1 << $) - 1, d += $;
        }
        if (d > C) {
          c && nt(0);
          break;
        }
        i && u(m + 131072);
        var ht = m + _;
        if (m < G) {
          var wt = s - G, bt = Math.min(G, ht);
          for (wt + m < 0 && nt(3); m < bt; ++m)
            n[m] = r[wt + m];
        }
        for (; m < ht; ++m)
          n[m] = n[m - G];
      }
    }
    e.l = p, e.p = Z, e.b = m, e.f = a, p && (a = 1, e.m = g, e.d = b, e.n = k);
  } while (!a);
  return m != n.length && l ? Ut(n, 0, m) : n.subarray(0, m);
}, gt = function(t, e, n) {
  n <<= e & 7;
  var r = e / 8 | 0;
  t[r] |= n, t[r + 1] |= n >> 8;
}, Nt = function(t, e, n) {
  n <<= e & 7;
  var r = e / 8 | 0;
  t[r] |= n, t[r + 1] |= n >> 8, t[r + 2] |= n >> 16;
}, qt = function(t, e) {
  for (var n = [], r = 0; r < t.length; ++r)
    t[r] && n.push({ s: r, f: t[r] });
  var o = n.length, s = n.slice();
  if (!o)
    return { t: ze, l: 0 };
  if (o == 1) {
    var l = new K(n[0].s + 1);
    return l[n[0].s] = 1, { t: l, l: 1 };
  }
  n.sort(function(S, w) {
    return S.f - w.f;
  }), n.push({ s: -1, f: 25001 });
  var i = n[0], c = n[1], u = 0, a = 1, d = 2;
  for (n[0] = { s: -1, f: i.f + c.f, l: i, r: c }; a != o - 1; )
    i = n[n[u].f < n[d].f ? u++ : d++], c = n[u != a && n[u].f < n[d].f ? u++ : d++], n[a++] = { s: -1, f: i.f + c.f, l: i, r: c };
  for (var m = s[0].s, r = 1; r < o; ++r)
    s[r].s > m && (m = s[r].s);
  var p = new lt(m + 1), b = re(n[a - 1], p, 0);
  if (b > e) {
    var r = 0, g = 0, k = b - e, C = 1 << k;
    for (s.sort(function(w, F) {
      return p[F.s] - p[w.s] || w.f - F.f;
    }); r < o; ++r) {
      var x = s[r].s;
      if (p[x] > e)
        g += C - (1 << b - p[x]), p[x] = e;
      else
        break;
    }
    for (g >>= k; g > 0; ) {
      var P = s[r].s;
      p[P] < e ? g -= 1 << e - p[P]++ - 1 : ++r;
    }
    for (; r >= 0 && g; --r) {
      var E = s[r].s;
      p[E] == e && (--p[E], ++g);
    }
    b = e;
  }
  return { t: new K(p), l: b };
}, re = function(t, e, n) {
  return t.s == -1 ? Math.max(re(t.l, e, n + 1), re(t.r, e, n + 1)) : e[t.s] = n;
}, ye = function(t) {
  for (var e = t.length; e && !t[--e]; )
    ;
  for (var n = new lt(++e), r = 0, o = t[0], s = 1, l = function(c) {
    n[r++] = c;
  }, i = 1; i <= e; ++i)
    if (t[i] == o && i != e)
      ++s;
    else {
      if (!o && s > 2) {
        for (; s > 138; s -= 138)
          l(32754);
        s > 2 && (l(s > 10 ? s - 11 << 5 | 28690 : s - 3 << 5 | 12305), s = 0);
      } else if (s > 3) {
        for (l(o), --s; s > 6; s -= 6)
          l(8304);
        s > 2 && (l(s - 3 << 5 | 8208), s = 0);
      }
      for (; s--; )
        l(o);
      s = 1, o = t[i];
    }
  return { c: n.subarray(0, r), n: e };
}, Et = function(t, e) {
  for (var n = 0, r = 0; r < e.length; ++r)
    n += t[r] * e[r];
  return n;
}, Oe = function(t, e, n) {
  var r = n.length, o = fe(e + 2);
  t[o] = r & 255, t[o + 1] = r >> 8, t[o + 2] = t[o] ^ 255, t[o + 3] = t[o + 1] ^ 255;
  for (var s = 0; s < r; ++s)
    t[o + s + 4] = n[s];
  return (o + 4 + r) * 8;
}, xe = function(t, e, n, r, o, s, l, i, c, u, a) {
  gt(e, a++, n), ++o[256];
  for (var d = qt(o, 15), m = d.t, p = d.l, b = qt(s, 15), g = b.t, k = b.l, C = ye(m), x = C.c, P = C.n, E = ye(g), S = E.c, w = E.n, F = new lt(19), y = 0; y < x.length; ++y)
    ++F[x[y] & 31];
  for (var y = 0; y < S.length; ++y)
    ++F[S[y] & 31];
  for (var M = qt(F, 7), T = M.t, N = M.l, I = 19; I > 4 && !T[te[I - 1]]; --I)
    ;
  var O = u + 5 << 3, z = Et(o, xt) + Et(s, Lt) + l, A = Et(o, m) + Et(s, g) + l + 14 + 3 * I + Et(F, T) + 2 * F[16] + 3 * F[17] + 7 * F[18];
  if (c >= 0 && O <= z && O <= A)
    return Oe(e, a, t.subarray(c, c + u));
  var U, D, W, G;
  if (gt(e, a, 1 + (A < z)), a += 2, A < z) {
    U = ft(m, p, 0), D = m, W = ft(g, k, 0), G = g;
    var L = ft(T, N, 0);
    gt(e, a, P - 257), gt(e, a + 5, w - 1), gt(e, a + 10, I - 4), a += 14;
    for (var y = 0; y < I; ++y)
      gt(e, a + 3 * y, T[te[y]]);
    a += 3 * I;
    for (var B = [x, S], Z = 0; Z < 2; ++Z)
      for (var V = B[Z], y = 0; y < V.length; ++y) {
        var _ = V[y] & 31;
        gt(e, a, L[_]), a += T[_], _ > 15 && (gt(e, a, V[y] >> 5 & 127), a += V[y] >> 12);
      }
  } else
    U = bn, D = xt, W = yn, G = Lt;
  for (var y = 0; y < i; ++y) {
    var $ = r[y];
    if ($ > 255) {
      var _ = $ >> 18 & 31;
      Nt(e, a, U[_ + 257]), a += D[_ + 257], _ > 7 && (gt(e, a, $ >> 23 & 31), a += Gt[_]);
      var J = $ & 31;
      Nt(e, a, W[J]), a += G[J], J > 3 && (Nt(e, a, $ >> 5 & 8191), a += Ht[J]);
    } else
      Nt(e, a, U[$]), a += D[$];
  }
  return Nt(e, a, U[256]), a + D[256];
}, Cn = /* @__PURE__ */ new ue([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]), ze = /* @__PURE__ */ new K(0), Sn = function(t, e, n, r, o, s) {
  var l = s.z || t.length, i = new K(r + l + 5 * (1 + Math.ceil(l / 7e3)) + o), c = i.subarray(r, i.length - o), u = s.l, a = (s.r || 0) & 7;
  if (e) {
    a && (c[0] = s.r >> 3);
    for (var d = Cn[e - 1], m = d >> 13, p = d & 8191, b = (1 << n) - 1, g = s.p || new lt(32768), k = s.h || new lt(b + 1), C = Math.ceil(n / 3), x = 2 * C, P = function(Xt) {
      return (t[Xt] ^ t[Xt + 1] << C ^ t[Xt + 2] << x) & b;
    }, E = new ue(25e3), S = new lt(288), w = new lt(32), F = 0, y = 0, M = s.i || 0, T = 0, N = s.w || 0, I = 0; M + 2 < l; ++M) {
      var O = P(M), z = M & 32767, A = k[O];
      if (g[z] = A, k[O] = z, N <= M) {
        var U = l - M;
        if ((F > 7e3 || T > 24576) && (U > 423 || !u)) {
          a = xe(t, c, 0, E, S, w, y, T, I, M - I, a), T = F = y = 0, I = M;
          for (var D = 0; D < 286; ++D)
            S[D] = 0;
          for (var D = 0; D < 30; ++D)
            w[D] = 0;
        }
        var W = 2, G = 0, L = p, B = z - A & 32767;
        if (U > 2 && O == P(M - B))
          for (var Z = Math.min(m, U) - 1, V = Math.min(32767, M), _ = Math.min(258, U); B <= V && --L && z != A; ) {
            if (t[M + W] == t[M + W - B]) {
              for (var $ = 0; $ < _ && t[M + $] == t[M + $ - B]; ++$)
                ;
              if ($ > W) {
                if (W = $, G = B, $ > Z)
                  break;
                for (var J = Math.min(B, $ - 2), at = 0, D = 0; D < J; ++D) {
                  var ht = M - B + D & 32767, wt = g[ht], bt = ht - wt & 32767;
                  bt > at && (at = bt, A = ht);
                }
              }
            }
            z = A, A = g[z], B += z - A & 32767;
          }
        if (G) {
          E[T++] = 268435456 | ee[W] << 18 | ve[G];
          var Ct = ee[W] & 31, mt = ve[G] & 31;
          y += Gt[Ct] + Ht[mt], ++S[257 + Ct], ++w[mt], N = M + W, ++F;
        } else
          E[T++] = t[M], ++S[t[M]];
      }
    }
    for (M = Math.max(M, N); M < l; ++M)
      E[T++] = t[M], ++S[t[M]];
    a = xe(t, c, u, E, S, w, y, T, I, M - I, a), u || (s.r = a & 7 | c[a / 8 | 0] << 3, a -= 7, s.h = k, s.p = g, s.i = M, s.w = N);
  } else {
    for (var M = s.w || 0; M < l + u; M += 65535) {
      var pt = M + 65535;
      pt >= l && (c[a / 8 | 0] = u, pt = l), a = Oe(c, a + 1, t.subarray(M, pt));
    }
    s.i = l;
  }
  return Ut(i, 0, r + fe(a) + o);
}, De = function() {
  var t = 1, e = 0;
  return {
    p: function(n) {
      for (var r = t, o = e, s = n.length | 0, l = 0; l != s; ) {
        for (var i = Math.min(l + 2655, s); l < i; ++l)
          o += r += n[l];
        r = (r & 65535) + 15 * (r >> 16), o = (o & 65535) + 15 * (o >> 16);
      }
      t = r, e = o;
    },
    d: function() {
      return t %= 65521, e %= 65521, (t & 255) << 24 | (t & 65280) << 8 | (e & 255) << 8 | e >> 8;
    }
  };
}, kn = function(t, e, n, r, o) {
  if (!o && (o = { l: 1 }, e.dictionary)) {
    var s = e.dictionary.subarray(-32768), l = new K(s.length + t.length);
    l.set(s), l.set(t, s.length), t = l, o.w = s.length;
  }
  return Sn(t, e.level == null ? 6 : e.level, e.mem == null ? o.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(t.length))) * 1.5) : 20 : 12 + e.mem, n, r, o);
}, ut = function(t, e) {
  return t[e] | t[e + 1] << 8;
}, it = function(t, e) {
  return (t[e] | t[e + 1] << 8 | t[e + 2] << 16 | t[e + 3] << 24) >>> 0;
}, Zt = function(t, e) {
  return it(t, e) + it(t, e + 4) * 4294967296;
}, Be = function(t, e, n) {
  for (; n; ++e)
    t[e] = n, n >>>= 8;
}, Mn = function(t, e) {
  var n = e.level, r = n == 0 ? 0 : n < 6 ? 1 : n == 9 ? 3 : 2;
  if (t[0] = 120, t[1] = r << 6 | (e.dictionary && 32), t[1] |= 31 - (t[0] << 8 | t[1]) % 31, e.dictionary) {
    var o = De();
    o.p(e.dictionary), Be(t, 2, o.d());
  }
}, Pn = function(t, e) {
  return ((t[0] & 15) != 8 || t[0] >> 4 > 7 || (t[0] << 8 | t[1]) % 31) && nt(6, "invalid zlib data"), (t[1] >> 5 & 1) == +!e && nt(6, "invalid zlib data: " + (t[1] & 32 ? "need" : "unexpected") + " dictionary"), (t[1] >> 3 & 4) + 2;
};
function Fn(t, e) {
  return Re(t, { i: 2 }, e && e.out, e && e.dictionary);
}
function vo(t, e) {
  e || (e = {});
  var n = De();
  n.p(t);
  var r = kn(t, e, e.dictionary ? 6 : 2, 4);
  return Mn(r, e), Be(r, r.length - 4, n.d()), r;
}
function yo(t, e) {
  return Re(t.subarray(Pn(t, e && e.dictionary), -4), { i: 2 }, e && e.out, e && e.dictionary);
}
var oe = typeof TextDecoder < "u" && /* @__PURE__ */ new TextDecoder(), Nn = 0;
try {
  oe.decode(ze, { stream: !0 }), Nn = 1;
} catch {
}
var En = function(t) {
  for (var e = "", n = 0; ; ) {
    var r = t[n++], o = (r > 127) + (r > 223) + (r > 239);
    if (n + o > t.length)
      return { s: e, r: Ut(t, n - 1) };
    o ? o == 3 ? (r = ((r & 15) << 18 | (t[n++] & 63) << 12 | (t[n++] & 63) << 6 | t[n++] & 63) - 65536, e += String.fromCharCode(55296 | r >> 10, 56320 | r & 1023)) : o & 1 ? e += String.fromCharCode((r & 31) << 6 | t[n++] & 63) : e += String.fromCharCode((r & 15) << 12 | (t[n++] & 63) << 6 | t[n++] & 63) : e += String.fromCharCode(r);
  }
};
function Tn(t, e) {
  if (e) {
    for (var n = "", r = 0; r < t.length; r += 16384)
      n += String.fromCharCode.apply(null, t.subarray(r, r + 16384));
    return n;
  } else {
    if (oe)
      return oe.decode(t);
    var o = En(t), s = o.s, n = o.r;
    return n.length && nt(8), s;
  }
}
var In = function(t, e) {
  return e + 30 + ut(t, e + 26) + ut(t, e + 28);
}, An = function(t, e, n) {
  var r = ut(t, e + 28), o = ut(t, e + 30), s = Tn(t.subarray(e + 46, e + 46 + r), !(ut(t, e + 8) & 2048)), l = e + 46 + r, i = Ln(t, l, o, n, it(t, e + 20), it(t, e + 24), it(t, e + 42)), c = i[0], u = i[1], a = i[2];
  return [ut(t, e + 10), c, u, s, l + o + ut(t, e + 32), a];
}, Ln = function(t, e, n, r, o, s, l) {
  var i = o == 4294967295, c = s == 4294967295, u = l == 4294967295, a = e + n, d = i + c + u;
  if (r && d) {
    for (; e + 4 < a; e += 4 + ut(t, e + 2))
      if (ut(t, e) == 1)
        return [
          i ? Zt(t, e + 4 + 8 * c) : o,
          c ? Zt(t, e + 4) : s,
          u ? Zt(t, e + 4 + 8 * (c + i)) : l,
          1
        ];
    r < 2 && nt(13);
  }
  return [o, s, l, 0];
};
function $n(t, e) {
  for (var n = {}, r = t.length - 22; it(t, r) != 101010256; --r)
    (!r || t.length - r > 65558) && nt(13);
  var o = ut(t, r + 8);
  if (!o)
    return {};
  var s = it(t, r + 16), l = it(t, r - 20) == 117853008;
  if (l) {
    var i = it(t, r - 12);
    l = it(t, i) == 101075792, l && (o = it(t, i + 32), s = it(t, i + 48));
  }
  for (var c = 0; c < o; ++c) {
    var u = An(t, s, l), a = u[0], d = u[1], m = u[2], p = u[3], b = u[4], g = u[5], k = In(t, g);
    s = b, a ? a == 8 ? n[p] = Fn(t.subarray(k, k + d), { out: new K(m) }) : nt(14, "unknown compression type " + a) : n[p] = Ut(t, k, k + d);
  }
  return n;
}
let je = null;
function Rn(t) {
  je = t;
}
const xo = Rn;
function On() {
  return je;
}
let Dt = null;
function wo(t) {
  Dt = t;
}
function Co() {
  return Dt !== null;
}
function zn(t, e) {
  if (!Dt) return null;
  let n = null;
  try {
    n = Dt(t, e);
  } catch {
    return null;
  }
  if (!n) return null;
  try {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(n)}`;
  } catch {
    return null;
  }
}
const Dn = /* @__PURE__ */ new Set(["emf", "wmf", "pict", "pct", "pic"]), Bn = 20556, jn = 4, Gn = 268435456;
let Bt = null;
function So(t) {
  Bt = t;
}
function ko() {
  return Bt !== null;
}
const Hn = (t, e) => (t[e] << 24 | t[e + 1] << 16 | t[e + 2] << 8 | t[e + 3]) >>> 0, we = (t, e) => (t[e + 3] << 24 | t[e + 2] << 16 | t[e + 1] << 8 | t[e]) >>> 0, Un = (t, e) => t[e + 1] << 8 | t[e];
function Qt(t) {
  if (t.length < 4) return null;
  switch (Hn(t, 0)) {
    case 65536:
    case 1953658213:
    case 1953784678:
      return "font/ttf";
    case 1330926671:
      return "font/otf";
    case 2001684038:
      return "font/woff";
    case 2001684018:
      return "font/woff2";
    default:
      return null;
  }
}
function Wn(t) {
  const e = Qt(t);
  if (e) return { data: t, mime: e };
  if (t.length < 82 || Un(t, 34) !== Bn) return null;
  const n = we(t, 12);
  if (n & jn) {
    if (!Bt) return null;
    let l = null;
    try {
      l = Bt(t);
    } catch {
      return null;
    }
    return l != null && l.length ? { data: l, mime: Qt(l) ?? "font/ttf" } : null;
  }
  const r = we(t, 4);
  if (!r || r > t.length - 82) return null;
  let o = t.subarray(t.length - r);
  if (n & Gn) {
    o = o.slice();
    for (let l = 0; l < o.length; l++) o[l] ^= 80;
  }
  const s = Qt(o);
  return s ? { data: o, mime: s } : null;
}
function Wt(t, e) {
  if (!t) return;
  const n = {}, r = f(t, "outerShdw"), o = f(t, "innerShdw"), s = r ?? o;
  if (s) {
    const u = j(v(s, "dist") ?? 0), a = (v(s, "dir") ?? 0) / 6e4 * (Math.PI / 180);
    n.shadow = {
      dx: u * Math.cos(a),
      dy: u * Math.sin(a),
      blur: j(v(s, "blurRad") ?? 0),
      color: q(s, e) ?? "rgba(0,0,0,0.4)",
      inner: s === o
    };
  }
  const l = f(t, "glow");
  l && (n.glow = {
    radius: j(v(l, "rad") ?? 0),
    color: q(l, e) ?? "rgba(0,0,0,0.4)"
  });
  const i = f(t, "softEdge");
  i && (n.softEdge = j(v(i, "rad") ?? 0));
  const c = f(t, "reflection");
  return c && (n.reflection = {
    alpha: (v(c, "stA") ?? 5e4) / 1e5,
    size: (v(c, "endPos") ?? 35e3) / 1e5,
    distance: j(v(c, "dist") ?? 0)
  }), Object.keys(n).length ? n : void 0;
}
const Xn = {
  none: "none",
  triangle: "triangle",
  stealth: "stealth",
  diamond: "diamond",
  oval: "oval",
  arrow: "arrow"
}, Ce = { sm: 2, med: 3, lg: 5 };
function Se(t) {
  if (!t) return;
  const e = Xn[h(t, "type") ?? "none"];
  if (!(!e || e === "none"))
    return {
      type: e,
      w: Ce[h(t, "w") ?? "med"] ?? 3,
      h: Ce[h(t, "len") ?? "med"] ?? 3
    };
}
const Yn = {
  matte: 1,
  plastic: 1,
  metal: 1.15,
  warmMatte: 1,
  translucentPowder: 0.9,
  powder: 0.95,
  dkEdge: 1.1,
  softEdge: 0.9,
  clear: 0.8,
  flat: 0.85,
  softmetal: 1.1
};
function Vn(t, e) {
  if (!t) return;
  const n = f(t, "sp3d"), r = f(t, "scene3d");
  if (!n && !r) return;
  const o = {}, s = v(n, "extrusionH");
  s && (o.extrusion = j(s));
  const l = q(f(n, "extrusionClr"), e);
  l && (o.extrusionColor = l);
  const i = f(n, "bevelT");
  i && (o.bevelTop = j(v(i, "h") ?? 38100));
  const c = f(n, "bevelB");
  c && (o.bevelBottom = j(v(c, "h") ?? 38100));
  const u = v(n, "contourW");
  u && (o.contourWidth = j(u), o.contourColor = q(f(n, "contourClr"), e) ?? void 0);
  const a = h(n, "prstMaterial");
  a && (o.material = a);
  const d = f(f(r, "camera"), "rot");
  return d && (o.rotX = (v(d, "rev") ?? 0) / 6e4, o.rotY = (v(d, "lat") ?? 0) / 6e4), !o.extrusion && (o.bevelTop || o.bevelBottom) && (o.extrusion = 6), o.extrusion && a && (o.extrusion *= Yn[a] ?? 1), Object.keys(o).length ? o : void 0;
}
const _n = { slow: 1e3, med: 750, fast: 500 }, qn = {
  fade: "fade",
  cut: "cut",
  push: "push",
  pull: "pull",
  cover: "cover",
  wipe: "wipe",
  split: "split",
  zoom: "zoom",
  dissolve: "dissolve",
  checker: "checker",
  blinds: "blinds",
  comb: "comb",
  wheel: "wheel",
  circle: "circle",
  diamond: "diamond",
  plus: "plus",
  wedge: "wedge",
  newsflash: "newsflash",
  randomBar: "randomBar",
  strips: "strips",
  random: "dissolve",
  fadeThroughBlack: "fade",
  // p14（PowerPoint 2010+）与 p159（morph）扩展。
  // 解析层按 localName 匹配、与命名空间无关，findTransition 又会钻进
  // mc:AlternateContent 的 Choice 分支，所以这里只需补名字即可命中。
  vortex: "vortex",
  switch: "switch",
  flip: "flip",
  ripple: "ripple",
  honeycomb: "honeycomb",
  glitter: "glitter",
  warp: "warp",
  flythrough: "flythrough",
  flash: "flash",
  shred: "shred",
  reveal: "reveal",
  wheelReverse: "wheelReverse",
  ferris: "ferris",
  gallery: "gallery",
  conveyor: "conveyor",
  pan: "pan",
  doors: "doors",
  window: "window",
  prism: "prism",
  morph: "morph"
};
function ke(t) {
  const e = Zn(t);
  if (!e) return;
  let n = "fade", r, o;
  for (let c = e.firstElementChild; c; c = c.nextElementSibling) {
    const u = qn[c.localName];
    if (u) {
      if (n = u, r = h(c, "dir") ?? h(c, "orient") ?? void 0, c.localName === "morph") {
        const a = h(c, "option");
        o = a === "byWord" || a === "byChar" ? a : "byObject";
      }
      if (c.localName === "split") {
        const a = h(c, "orient") ?? "horz", d = h(c, "dir") ?? "out";
        r = `${a}-${d}`;
      }
      break;
    }
  }
  const l = v(e, "p14:dur") ?? v(e, "dur") ?? _n[h(e, "spd") ?? "med"] ?? 750, i = v(e, "advTm");
  return {
    type: n,
    dir: r,
    durationMs: Math.max(80, Math.min(5e3, l)),
    advanceAfterMs: i ?? void 0,
    morphBy: o
  };
}
function Zn(t) {
  if (!t) return null;
  const e = f(t, "transition");
  if (e) return e;
  for (const n of H(t, "AlternateContent"))
    for (const r of [f(n, "Choice"), f(n, "Fallback")]) {
      const o = f(r, "transition");
      if (o) return o;
    }
  return null;
}
const Qn = {
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
}, Kn = {
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
}, Jn = {
  entr: "entrance",
  exit: "exit",
  emph: "emphasis",
  path: "motion",
  mediacall: "emphasis",
  verb: "emphasis"
};
function tr(t) {
  const e = t.match(/^([a-zA-Z]+)(?:\(([^)]*)\))?/);
  if (!e) return null;
  const n = e[1].toLowerCase(), r = (e[2] ?? "").toLowerCase(), o = r.startsWith("from"), s = r.includes("left") ? "l" : r.includes("right") ? "r" : r.includes("top") || r.includes("up") ? "u" : r.includes("bottom") || r.includes("down") ? "d" : null, i = s ? o ? s : { l: "r", r: "l", u: "d", d: "u" }[s] : r.includes("vertical") ? "vert" : r.includes("horizontal") ? "horz" : r.includes("in") ? "in" : r.includes("out") ? "out" : void 0, u = {
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
  }[n];
  return u ? { effect: u, dir: i } : null;
}
function er(t, e, n, r = 24) {
  const o = t.match(/[MLCZEmlcze]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
  if (!o) return;
  const s = [];
  let l = [0, 0], i = [0, 0], c = 0;
  const u = () => {
    const x = Number(o[c++]);
    return Number.isFinite(x) ? x : 0;
  }, a = (x) => {
    s.push(x), l = x;
  };
  for (; c < o.length; )
    switch (o[c++]) {
      case "M":
      case "m": {
        const P = [u(), u()];
        i = P, s.length = 0, a(P);
        break;
      }
      case "L":
      case "l":
        a([u(), u()]);
        break;
      case "C":
      case "c": {
        const [P, E, S, w, F, y] = [u(), u(), u(), u(), u(), u()], [M, T] = l;
        for (let N = 1; N <= 16; N++) {
          const I = N / 16, O = 1 - I;
          s.push([
            O * O * O * M + 3 * O * O * I * P + 3 * O * I * I * S + I * I * I * F,
            O * O * O * T + 3 * O * O * I * E + 3 * O * I * I * w + I * I * I * y
          ]);
        }
        l = [F, y];
        break;
      }
      case "Z":
      case "z":
        a([i[0], i[1]]);
        break;
      default:
        c = o.length;
    }
  if (s.length < 2) return;
  const [d, m] = s[0], p = s.map(([x, P]) => [(x - d) * e, (P - m) * n]), b = [0];
  for (let x = 1; x < p.length; x++)
    b.push(b[x - 1] + Math.hypot(p[x][0] - p[x - 1][0], p[x][1] - p[x - 1][1]));
  const g = b[b.length - 1];
  if (!(g > 0)) return;
  const k = [];
  let C = 1;
  for (let x = 0; x < r; x++) {
    const P = g * x / (r - 1);
    for (; C < b.length - 1 && b[C] < P; ) C++;
    const E = b[C] - b[C - 1], S = E > 0 ? (P - b[C - 1]) / E : 0;
    k.push([
      p[C - 1][0] + (p[C][0] - p[C - 1][0]) * S,
      p[C - 1][1] + (p[C][1] - p[C - 1][1]) * S
    ]);
  }
  return k;
}
function Ge(t, e = 8) {
  for (let n = t.firstElementChild; n; n = n.nextElementSibling) {
    if (n.localName === "animMotion") {
      const r = h(n, "path");
      if (r) return r;
    }
    if (e > 0) {
      const r = Ge(n, e - 1);
      if (r) return r;
    }
  }
  return null;
}
function He(t, e = 8) {
  for (let n = t.firstElementChild; n; n = n.nextElementSibling) {
    if (n.localName === "spTgt") {
      const r = v(n, "spid");
      if (r !== null) return r;
    }
    if (e > 0) {
      const r = He(n, e - 1);
      if (r !== null) return r;
    }
  }
  return null;
}
const nr = /* @__PURE__ */ new Set(["animEffect", "anim", "animRot", "animScale", "animClr", "animMotion"]);
function Ue(t, e = 8, n = !1) {
  let r = null;
  for (let o = t.firstElementChild; o; o = o.nextElementSibling) {
    const s = n || nr.has(o.localName);
    if (o.localName === "cTn") {
      const l = h(o, "dur");
      if (l && l !== "indefinite") {
        const i = Number(l);
        if (Number.isFinite(i) && i > 1 && n) return i;
        Number.isFinite(i) && i > 1 && (r === null || i > r) && (r = i);
      }
    }
    if (e > 0) {
      const l = Ue(o, e - 1, s);
      if (l !== null && s) return l;
      l !== null && (r === null || l > r) && (r = l);
    }
  }
  return r;
}
function We(t, e = 8) {
  for (let n = t.firstElementChild; n; n = n.nextElementSibling) {
    if (n.localName === "animEffect") {
      const r = h(n, "filter");
      if (r) return r;
    }
    if (e > 0) {
      const r = We(n, e - 1);
      if (r) return r;
    }
  }
  return null;
}
function rr(t) {
  const e = f(f(t, "stCondLst"), "cond"), n = h(e, "delay");
  if (!n || n === "indefinite") return 0;
  const r = Number(n);
  return Number.isFinite(r) ? Math.max(0, r) : 0;
}
function or(t, e = 0, n = 0) {
  if (!t) return;
  const r = [], o = (l, i) => {
    for (let c = l.firstElementChild; c; c = c.nextElementSibling) {
      if (c.localName === "cTn" && h(c, "presetClass")) {
        const u = sr(c, e, n);
        u && r.push(u);
        continue;
      }
      i > 0 && o(c, i - 1);
    }
  };
  if (o(t, 24), !r.length) return;
  let s = -1;
  for (const l of r)
    (l.trigger === "click" || s < 0) && s++, l.clickGroup = s;
  return r;
}
// Preserve an explicit main-sequence onBegin trigger, not just afterEffect.
function sourceAutoStart(effect) {
  const ancestors = [];
  for (let node = effect.parentElement; node; node = node.parentElement) {
    ancestors.push(node);
    if (node.localName === "timing") break;
  }
  const main = ancestors.find(node => node.localName === "cTn" && h(node, "nodeType") === "mainSeq");
  if (!main) return false;
  return ancestors.some(node => {
    const conditions = f(node, "stCondLst");
    return conditions && Array.from(conditions.children).some(condition =>
      condition.localName === "cond" && h(condition, "evt") === "onBegin"
      && h(f(condition, "tn"), "val") === h(main, "id")
      && Number(h(condition, "delay") || 0) === 0);
  });
}
function sr(t, e, n) {
  if (h(t, "presetClass") === "mediacall") {
    // Interactive object clicks are separate from the main Next sequence.
    for (let parent = t.parentElement; parent; parent = parent.parentElement) {
      if (h(parent, "nodeType") === "interactiveSeq") return null;
    }
    const target = He(t);
    const command = Array.from(t.getElementsByTagName("*")).find(node => node.localName === "cmd");
    const value = h(command, "cmd") || "";
    const from = /^playFrom\((\d+(?:\.\d+)?)\)$/i.exec(value);
    const action = from ? "play" : ({ play: "play", pause: "pause", togglepause: "togglePause", stop: "stop" })[value.toLowerCase()];
    if (target === null || !action) return null;
    const nodeType = h(t, "nodeType");
    return { target, kind: "media", effect: "media", action,
      startSeconds: from ? Number(from[1]) : undefined,
      delayMs: rr(t), durationMs: 0, autoStart: sourceAutoStart(t),
      trigger: nodeType === "withEffect" ? "withPrev" : nodeType === "afterEffect" ? "afterPrev" : "click" };
  }
  const r = He(t);
  if (r === null) return null;
  const o = h(t, "presetClass") ?? "entr", s = Jn[o] ?? "entrance", l = v(t, "presetID") ?? 10, i = v(t, "presetSubtype") ?? 0, c = h(t, "nodeType") ?? "clickEffect", u = We(t), a = u ? tr(u) : null, d = (a == null ? void 0 : a.effect) ?? Qn[l] ?? "fade", m = (a == null ? void 0 : a.dir) ?? Kn[i], p = c === "withEffect" ? "withPrev" : c === "afterEffect" ? "afterPrev" : "click", b = Ue(t) ?? 500, g = s === "motion" ? Ge(t) : null, k = g && e > 0 && n > 0 ? er(g, e, n) : void 0;
  return {
    target: r,
    effect: d,
    dir: m,
    delayMs: rr(t),
    durationMs: l === 1 && (o === "entr" || o === "exit") ? 0 : Math.max(60, Math.min(1e4, b)),
    autoStart: sourceAutoStart(t),
    trigger: p,
    kind: s,
    motionPath: k
  };
}
function sourceMediaSettings(slide) {
  return Array.from(slide.getElementsByTagName("*")).filter(node => node.localName === "cMediaNode").map(node => {
    const timing = f(node, "cTn");
    const condition = f(f(timing, "stCondLst"), "cond");
    const delay = h(condition, "delay");
    return { target: He(node), volume: Math.min(1, Math.max(0, (v(node, "vol") ?? 100000) / 100000)),
      muted: h(node, "mute") === "1", loop: h(timing, "repeatCount") === "indefinite",
      autoStart: delay !== null && delay !== "indefinite" && !h(condition, "evt"),
      delayMs: Number(delay) || 0 };
  });
}
function Xe(t) {
  const e = {};
  for (const n of H(t, "gd")) {
    const r = h(n, "name"), o = h(n, "fmla");
    if (r && (o != null && o.startsWith("val "))) {
      const s = Number(o.slice(4));
      Number.isFinite(s) && (e[r] = s);
    }
  }
  return e;
}
const st = 6e4;
function lr(t, e) {
  const n = Math.min(t, e), r = {
    l: 0,
    t: 0,
    r: t,
    b: e,
    w: t,
    h: e,
    hc: t / 2,
    vc: e / 2,
    ls: Math.max(t, e),
    ss: n,
    cd2: 180 * st,
    cd4: 90 * st,
    cd8: 45 * st,
    "3cd4": 270 * st,
    "3cd8": 135 * st,
    "5cd8": 225 * st,
    "7cd8": 315 * st
  };
  for (const o of [2, 3, 4, 5, 6, 8, 10, 32])
    r[`hd${o}`] = e / o, r[`wd${o}`] = t / o;
  for (const o of [2, 4, 6, 8, 16, 32]) r[`ssd${o}`] = n / o;
  return r;
}
function Me(t, e) {
  const n = (r) => {
    if (r in e) return e[r];
    const o = Number(r);
    return Number.isFinite(o) ? o : 0;
  };
  for (const r of H(t, "gd")) {
    const o = h(r, "name"), s = h(r, "fmla");
    if (!o || !s) continue;
    const [l, ...i] = s.trim().split(/\s+/), c = n(i[0] ?? "0"), u = n(i[1] ?? "0"), a = n(i[2] ?? "0");
    let d;
    switch (l) {
      case "*/":
        d = a === 0 ? 0 : c * u / a;
        break;
      case "+-":
        d = c + u - a;
        break;
      case "+/":
        d = a === 0 ? 0 : (c + u) / a;
        break;
      case "?:":
        d = c > 0 ? u : a;
        break;
      case "abs":
        d = Math.abs(c);
        break;
      case "at2":
        d = Math.atan2(u, c) * 180 * st / Math.PI;
        break;
      case "cat2":
        d = c * Math.cos(Math.atan2(a, u));
        break;
      case "cos":
        d = c * Math.cos(It(u / st));
        break;
      case "max":
        d = Math.max(c, u);
        break;
      case "min":
        d = Math.min(c, u);
        break;
      case "mod":
        d = Math.sqrt(c * c + u * u + a * a);
        break;
      case "pin":
        d = u < c ? c : u > a ? a : u;
        break;
      case "sat2":
        d = c * Math.sin(Math.atan2(a, u));
        break;
      case "sin":
        d = c * Math.sin(It(u / st));
        break;
      case "sqrt":
        d = Math.sqrt(Math.max(c, 0));
        break;
      case "tan":
        d = c * Math.tan(It(u / st));
        break;
      case "val":
        d = c;
        break;
      default:
        d = 0;
    }
    e[o] = Number.isFinite(d) ? d : 0;
  }
  return e;
}
function Ye(t, e, n) {
  const r = H(f(t, "pathLst"), "path");
  if (!r.length) return null;
  const o = [];
  let s = !1, l = !1;
  for (const c of r) {
    const u = v(c, "w") || 0, a = v(c, "h") || 0, d = u || e * 9525, m = a || n * 9525, p = lr(d, m);
    Me(f(t, "avLst"), p), Me(f(t, "gdLst"), p);
    const b = d ? e / d : 1, g = m ? n / m : 1, k = (S) => {
      if (S === null) return 0;
      if (S in p) return p[S];
      const w = Number(S);
      return Number.isFinite(w) ? w : 0;
    }, C = (S) => [k(h(S, "x")) * b, k(h(S, "y")) * g];
    (h(c, "fill") ?? "norm") !== "none" && (s = !0);
    const x = h(c, "stroke");
    x !== "0" && x !== "false" && (l = !0);
    let P = 0, E = 0;
    for (let S = c.firstElementChild; S; S = S.nextElementSibling) {
      const w = H(S, "pt");
      switch (S.localName) {
        case "moveTo":
          [P, E] = C(w[0]), o.push(`M ${Q(P)} ${Q(E)}`);
          break;
        case "lnTo":
          [P, E] = C(w[0]), o.push(`L ${Q(P)} ${Q(E)}`);
          break;
        case "cubicBezTo": {
          const [F, y] = C(w[0]), [M, T] = C(w[1]);
          [P, E] = C(w[2]), o.push(`C ${Q(F)} ${Q(y)} ${Q(M)} ${Q(T)} ${Q(P)} ${Q(E)}`);
          break;
        }
        case "quadBezTo": {
          const [F, y] = C(w[0]);
          [P, E] = C(w[1]), o.push(`Q ${Q(F)} ${Q(y)} ${Q(P)} ${Q(E)}`);
          break;
        }
        case "arcTo": {
          const F = k(h(S, "wR")) * b, y = k(h(S, "hR")) * g, M = k(h(S, "stAng")) / st, T = k(h(S, "swAng")) / st, N = P - F * Math.cos(It(M)), I = E - y * Math.sin(It(M)), O = Math.max(1, Math.ceil(Math.abs(T) / 180));
          for (let z = 0; z < O; z++) {
            const A = T / O, [U, D] = en(N, I, F, y, M + A * (z + 1));
            o.push(`A ${Q(F)} ${Q(y)} 0 ${Math.abs(A) > 180 ? 1 : 0} ${A >= 0 ? 1 : 0} ${Q(U)} ${Q(D)}`), P = U, E = D;
          }
          break;
        }
        case "close":
          o.push("Z");
          break;
      }
    }
  }
  const i = o.join(" ");
  return i.trim() ? { d: i, open: !s && l } : null;
}
function rt(t, e) {
  const n = f(t, e);
  return n ? h(n, "val") : null;
}
function ir(t) {
  if (!t) return "";
  let e = "";
  for (const n of H(t, "t")) e += n.textContent ?? "";
  return e;
}
function Rt(t, e = 12) {
  let n = "";
  for (let r = t.firstElementChild; r; r = r.nextElementSibling)
    r.localName === "t" ? n += r.textContent ?? "" : e > 0 && (n += Rt(r, e - 1));
  return n;
}
function X(t, e, n) {
  const r = f(t, e);
  return r ? yt(r, n) : [];
}
function yt(t, e) {
  const n = [];
  for (let r = t.firstElementChild; r; r = r.nextElementSibling) {
    const o = cr(r, e);
    o && n.push(...o);
  }
  return n;
}
function cr(t, e) {
  if (e <= 0) {
    const r = Rt(t);
    return r ? [{ kind: "run", text: r }] : null;
  }
  const n = e - 1;
  switch (t.localName) {
    case "r": {
      const r = ir(t);
      if (!r) return null;
      const o = rt(f(t, "rPr"), "sty");
      return [{ kind: "run", text: r, sty: o === "p" || o === "b" || o === "bi" ? o : "i" }];
    }
    case "f": {
      const r = rt(f(t, "fPr"), "type");
      return [{
        kind: "frac",
        num: X(t, "num", n),
        den: X(t, "den", n),
        type: r === "noBar" || r === "skw" || r === "lin" ? r : "bar"
      }];
    }
    case "rad": {
      const r = rt(f(t, "radPr"), "degHide");
      return [{
        kind: "rad",
        deg: r === "1" || r === "on" || r === "true" ? [] : X(t, "deg", n),
        base: X(t, "e", n)
      }];
    }
    case "sSup":
      return [{ kind: "script", base: X(t, "e", n), sup: X(t, "sup", n) }];
    case "sSub":
      return [{ kind: "script", base: X(t, "e", n), sub: X(t, "sub", n) }];
    case "sSubSup":
      return [{ kind: "script", base: X(t, "e", n), sub: X(t, "sub", n), sup: X(t, "sup", n) }];
    case "sPre":
      return [{ kind: "script", base: [], sub: X(t, "sub", n), sup: X(t, "sup", n) }, ...X(t, "e", n)];
    case "nary": {
      const r = f(t, "naryPr"), o = rt(r, "limLoc"), s = rt(r, "chr") ?? "∫", l = rt(r, "subHide") === "1", i = rt(r, "supHide") === "1";
      return [{
        kind: "nary",
        chr: s,
        sub: l ? [] : X(t, "sub", n),
        sup: i ? [] : X(t, "sup", n),
        base: X(t, "e", n),
        // 求和 / 连乘默认上下限在正上下，积分默认在右侧
        underOver: o ? o === "undOvr" : s !== "∫" && s !== "∮" && s !== "∬" && s !== "∭"
      }];
    }
    case "d": {
      const r = f(t, "dPr"), o = H(t, "e").map((s) => yt(s, n));
      return [{
        kind: "delim",
        beg: rt(r, "begChr") ?? "(",
        end: rt(r, "endChr") ?? ")",
        sep: rt(r, "sepChr") ?? ",",
        items: o.length ? o : [[]]
      }];
    }
    case "m":
      return [{
        kind: "matrix",
        rows: H(t, "mr").map((r) => H(r, "e").map((o) => yt(o, n)))
      }];
    case "acc":
      return [{ kind: "acc", chr: rt(f(t, "accPr"), "chr") ?? "̂", base: X(t, "e", n) }];
    case "bar": {
      const r = rt(f(t, "barPr"), "pos");
      return [{ kind: "acc", chr: "̅", base: X(t, "e", n), below: r === "bot" }];
    }
    case "groupChr": {
      const r = f(t, "groupChrPr"), o = rt(r, "pos");
      return [{ kind: "acc", chr: rt(r, "chr") ?? "⏟", base: X(t, "e", n), below: o !== "top" }];
    }
    case "limLow":
      return [{ kind: "lim", base: X(t, "e", n), limit: X(t, "lim", n), below: !0 }];
    case "limUpp":
      return [{ kind: "lim", base: X(t, "e", n), limit: X(t, "lim", n), below: !1 }];
    case "func":
      return [...X(t, "fName", n), { kind: "run", text: " " }, ...X(t, "e", n)];
    case "eqArr":
      return [{ kind: "stack", rows: H(t, "e").map((r) => yt(r, n)) }];
    case "box":
    case "borderBox":
    case "e":
    case "oMath":
      return yt(t, n);
    case "phant":
      return [{ kind: "run", text: " ".repeat(Math.max(1, Rt(t).length)), sty: "p" }];
    case "rPr":
    case "ctrlPr":
    case "argPr":
    case "fPr":
    case "radPr":
    case "naryPr":
    case "dPr":
    case "mPr":
    case "accPr":
    case "barPr":
    case "groupChrPr":
    case "limLowPr":
    case "limUppPr":
    case "funcPr":
    case "eqArrPr":
    case "boxPr":
    case "phantPr":
    case "sSupPr":
    case "sSubPr":
    case "sSubSupPr":
    case "sPrePr":
      return null;
    default: {
      const r = yt(t, n);
      if (r.length) return r;
      const o = Rt(t);
      return o ? [{ kind: "run", text: o }] : null;
    }
  }
}
function ar(t) {
  if (t.localName === "oMathPara") {
    const e = H(t, "oMath").map((n) => yt(n, 16));
    return e.length > 1 ? [{ kind: "stack", rows: e }] : e[0] ?? [];
  }
  return yt(t, 16);
}
function tt(t) {
  var n, r;
  let e = "";
  for (const o of t)
    switch (o.kind) {
      case "run":
        e += o.text;
        break;
      case "frac":
        e += `${tt(o.num)}/${tt(o.den)}`;
        break;
      case "rad":
        e += `√(${tt(o.base)})`;
        break;
      case "script":
        e += tt(o.base), (n = o.sub) != null && n.length && (e += `_${tt(o.sub)}`), (r = o.sup) != null && r.length && (e += `^${tt(o.sup)}`);
        break;
      case "nary":
        e += o.chr, o.sub.length && (e += `_${tt(o.sub)}`), o.sup.length && (e += `^${tt(o.sup)}`), e += tt(o.base);
        break;
      case "delim":
        e += o.beg + o.items.map((s) => tt(s)).join(o.sep) + o.end;
        break;
      case "matrix":
        e += o.rows.map((s) => s.map((l) => tt(l)).join(" ")).join("; ");
        break;
      case "acc":
        e += tt(o.base) + o.chr;
        break;
      case "lim":
        e += `${tt(o.base)}(${tt(o.limit)})`;
        break;
      case "stack":
        e += o.rows.map((s) => tt(s)).join(" ");
        break;
    }
  return e;
}
function St(t, e, n) {
  const r = { lvls: [] };
  if (!t) return r;
  const o = f(t, "defPPr");
  o && (r.def = se(o, e, n));
  for (let s = 1; s <= 9; s++) {
    const l = f(t, `lvl${s}pPr`);
    l && (r.lvls[s - 1] = se(l, e, n));
  }
  return r;
}
function se(t, e, n) {
  const r = { rp: {} };
  if (!t) return r;
  const o = h(t, "algn");
  o && (r.algn = o);
  const s = v(t, "marL");
  s !== null && (r.marL = j(s));
  const l = v(t, "indent");
  l !== null && (r.indent = j(l)), h(t, "rtl") !== null && (r.rtl = ot(t, "rtl"));
  const i = f(t, "lnSpc"), c = v(f(i, "spcPct"), "val");
  c !== null && (r.lnPct = c / 1e5);
  const u = v(f(i, "spcPts"), "val");
  u !== null && (r.lnPx = At(u));
  const a = v(f(f(t, "spcBef"), "spcPts"), "val");
  a !== null && (r.spcBef = At(a));
  const d = v(f(f(t, "spcAft"), "spcPts"), "val");
  d !== null && (r.spcAft = At(d)), f(t, "buNone") && (r.bullet = { kind: "none" });
  const m = f(t, "buChar");
  m && (r.bullet = { kind: "char", char: h(m, "char") ?? "•", font: h(f(t, "buFont"), "typeface") });
  const p = f(t, "buAutoNum");
  p && (r.bullet = {
    kind: "auto",
    scheme: h(p, "type") ?? "arabicPeriod",
    startAt: v(p, "startAt") ?? 1
  });
  const b = f(f(t, "buBlip"), "blip");
  if (b) {
    const P = h(b, "r:embed");
    P && (r.bullet = { kind: "image", rid: P });
  }
  const g = q(f(t, "buClr"), e);
  g && (r.buColor = g);
  const k = h(f(t, "buFont"), "typeface");
  k && (r.buFont = k);
  const C = v(f(t, "buSzPct"), "val");
  C !== null && (r.buSizePct = C / 1e5);
  const x = f(t, "defRPr");
  return x && (r.rp = le(x, e, n)), r;
}
function le(t, e, n) {
  const r = {};
  if (!t) return r;
  const o = v(t, "sz");
  o !== null && (r.sz = o), h(t, "b") !== null && (r.b = ot(t, "b")), h(t, "i") !== null && (r.i = ot(t, "i"));
  const s = h(t, "u");
  s !== null && (r.u = s !== "none");
  const l = h(t, "strike");
  l !== null && (r.strike = l !== "noStrike");
  const i = v(t, "baseline");
  i !== null && i !== 0 && (r.baseline = i / 1e3);
  const c = v(t, "spc");
  c !== null && c !== 0 && (r.spc = At(c));
  const u = h(t, "cap");
  u && (r.caps = u === "all" ? "all" : u === "small" ? "small" : "none");
  const a = q(f(t, "solidFill"), e);
  a && (r.color = a);
  const d = f(t, "gradFill");
  if (d) {
    const x = H(f(d, "gsLst"), "gs").map((P) => ({ pos: (v(P, "pos") ?? 0) / 1e5, color: q(P, e) ?? "#000" })).sort((P, E) => P.pos - E.pos);
    if (x.length) {
      const P = f(d, "lin"), E = P ? (v(P, "ang") ?? 0) / 6e4 + 90 : 180;
      r.gradient = `linear-gradient(${Math.round(E)}deg,${x.map((S) => `${S.color} ${Math.round(S.pos * 100)}%`).join(",")})`, r.color || (r.color = x[0].color);
    }
  }
  const m = q(f(t, "uFill"), e) ?? q(f(f(t, "uFill"), "solidFill"), e);
  m && (r.uColor = m);
  const p = q(f(t, "highlight"), e);
  p && (r.highlight = p);
  const b = f(t, "ln");
  if (b && !f(b, "noFill")) {
    const x = q(f(b, "solidFill"), e);
    x && (r.outline = { color: x, width: j(v(b, "w") ?? 9525) });
  }
  const g = Kt(h(f(t, "latin"), "typeface"), n);
  g && (r.latin = g);
  const k = Kt(h(f(t, "ea"), "typeface"), n);
  k && (r.ea = k);
  const C = Kt(h(f(t, "cs"), "typeface"), n);
  return C && (r.cs = C), r;
}
function Kt(t, e) {
  return t ? t === "+mj-lt" ? e.major.latin : t === "+mj-ea" ? e.major.ea : t === "+mj-cs" ? e.major.cs ?? e.major.latin : t === "+mn-lt" ? e.minor.latin : t === "+mn-ea" ? e.minor.ea : t === "+mn-cs" ? e.minor.cs ?? e.minor.latin : t : null;
}
const ie = (t, e) => ({ ...t, ...e }), ce = (t, e) => ({ ...t, ...e, rp: ie(t.rp, e.rp) });
function ur(t, e) {
  let n = { rp: {} };
  for (const r of t) {
    r.def && (n = ce(n, r.def));
    const o = r.lvls[e];
    o && (n = ce(n, o));
  }
  return n;
}
const fr = {
  "": "▪",
  "": "•",
  "": "➢",
  "": "✓",
  "": "●",
  "": "◆",
  "": "□",
  "": "❖",
  "§": "▪",
  n: "▪",
  l: "●",
  u: "◆",
  p: "❑",
  v: "❖",
  w: "♦",
  Ø: "➢",
  ü: "✓",
  F: "☞",
  q: "❑"
};
function dr(t, e, n) {
  if (!t || t.kind === "none" || t.kind === "image") return null;
  if (t.kind === "char") {
    const r = fr[t.char];
    return r || (t.font && /wingdings|webdings|symbol/i.test(t.font) ? "•" : t.char);
  }
  return e.length = n + 1, e[n] = (e[n] ?? t.startAt - 1) + 1, hr(t.scheme, e[n]);
}
function hr(t, e) {
  let n;
  return t.startsWith("alphaLc") ? n = Pe(e).toLowerCase() : t.startsWith("alphaUc") ? n = Pe(e) : t.startsWith("romanLc") ? n = Fe(e).toLowerCase() : t.startsWith("romanUc") ? n = Fe(e) : t.startsWith("circleNum") ? n = mr(e) : n = String(e), t.endsWith("ParenBoth") ? `(${n})` : t.endsWith("ParenR") ? `${n})` : t.endsWith("Period") ? `${n}.` : n;
}
function Pe(t) {
  let e = "";
  for (; t > 0; )
    e = String.fromCharCode(65 + (t - 1) % 26) + e, t = Math.floor((t - 1) / 26);
  return e;
}
function Fe(t) {
  const e = [[1e3, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let n = "";
  for (const [r, o] of e) for (; t >= r; )
    n += o, t -= r;
  return n;
}
const mr = (t) => t >= 1 && t <= 20 ? String.fromCharCode(9312 + t - 1) : String(t);
function pr(t) {
  for (const e of t) {
    const n = f(e, "prstTxWarp");
    if (!n) continue;
    const r = h(n, "prst");
    if (!r || r === "textNoShape") return;
    const o = {};
    for (const s of H(f(n, "avLst"), "gd")) {
      const l = h(s, "name"), i = Number((h(s, "fmla") ?? "").replace(/^val\s+/, ""));
      l && Number.isFinite(i) && (o[l] = i);
    }
    return { preset: r, adj: o };
  }
}
const Ne = 1.2, gr = { l: "left", ctr: "center", r: "right", just: "justify", dist: "justify" }, br = { horz: "horz", vert: "vert", vert270: "vert270", wordArtVert: "wordArtVert", eaVert: "vert", mongolianVert: "vert" };
function de(t, e) {
  var F;
  if (!t) return null;
  const r = [f(t, "bodyPr"), ...e.bodyPrFallbacks ?? []], o = (y) => {
    for (const M of r) {
      const T = h(M, y);
      if (T !== null) return T;
    }
    return null;
  }, s = o("anchor") ?? "t", l = s === "ctr" ? "middle" : s === "b" ? "bottom" : "top", i = (y, M) => {
    const T = o(y);
    return j(T === null ? M : Number(T));
  }, c = [i("tIns", 45720), i("rIns", 91440), i("bIns", 45720), i("lIns", 91440)], u = o("wrap") !== "none";
  let a = null, d = !1;
  for (const y of r)
    if (y) {
      if (f(y, "normAutofit")) {
        a = f(y, "normAutofit");
        break;
      }
      if (f(y, "spAutoFit")) {
        d = !0;
        break;
      }
    }
  const m = a ? v(a, "fontScale") : null, p = m != null ? m / 1e5 : 1, b = !!a && m == null, g = a ? (v(a, "lnSpcReduction") ?? 0) / 1e5 : 0, k = br[o("vert") ?? "horz"] ?? "horz", C = o("anchorCtr") === "1", x = Number(o("numCol") ?? "1"), P = Number(o("spcCol") ?? "0"), E = [], S = [];
  let w = !1;
  for (const y of H(t, "p")) {
    const M = f(y, "pPr"), T = v(M, "lvl") ?? 0, N = ce(ur(e.chain, T), se(M, e.ctx, e.fonts)), I = [], O = (D, W) => {
      var G;
      for (let L = D.firstElementChild; L; L = L.nextElementSibling)
        if (L.localName === "r" || L.localName === "fld") {
          const B = f(L, "rPr"), Z = ie(N.rp, le(B, e.ctx, e.fonts)), V = f(B, "hlinkClick");
          if (V && e.resolveLink) {
            const $ = e.resolveLink(h(V, "r:id") ?? "", h(V, "action"));
            $ && (Z.link = $);
          }
          let _ = ((G = f(L, "t")) == null ? void 0 : G.textContent) ?? "";
          L.localName === "fld" && !_ && (_ = yr(h(L, "type"), e)), I.push($t(_, Z, e)), _.trim() && (w = !0);
        } else if (L.localName === "br")
          I.push($t(`
`, N.rp, e));
        else if (L.localName === "AlternateContent") {
          const B = f(L, "Choice") ?? f(L, "Fallback");
          B && W > 0 && O(B, W - 1);
        } else if (L.localName === "oMathPara" || L.localName === "oMath") {
          const B = ar(L), Z = B.length ? tt(B) : vr(L);
          if (B.length || Z) {
            const V = $t(Z, { ...N.rp, i: !0 }, e);
            B.length && (V.math = B), I.push(V), w = !0;
          }
        } else W > 0 && (L.localName === "Choice" || L.localName === "Fallback") && O(L, W - 1);
    };
    if (O(y, 4), I.length === 0) {
      const D = f(y, "endParaRPr");
      I.push($t("", ie(N.rp, le(D, e.ctx, e.fonts)), e));
    }
    const z = Math.max(...I.map((D) => D.size), 1);
    let A = N.lnPct !== void 0 ? N.lnPct * Ne : null;
    A === null && N.lnPx && (A = N.lnPx / z), g && (A = Math.max(0.5, (A ?? Ne) - g));
    const U = ((F = N.bullet) == null ? void 0 : F.kind) === "image" && e.resolveImage ? e.resolveImage(N.bullet.rid) : null;
    S.push({
      align: gr[N.algn ?? "l"] ?? "left",
      lvl: T,
      marL: N.marL ?? 0,
      indent: N.indent ?? 0,
      bullet: dr(N.bullet, E, T),
      lineHeight: A,
      spaceBefore: N.spcBef ?? 0,
      spaceAfter: N.spcAft ?? 0,
      runs: I,
      bulletColor: N.buColor ?? null,
      bulletFont: N.buFont ?? null,
      bulletSize: N.buSizePct ?? null,
      bulletImage: U,
      rtl: N.rtl
    });
  }
  return w ? {
    anchor: l,
    insets: c,
    wrap: u,
    fontScale: p,
    paragraphs: S,
    ...b ? { autoFitCompute: !0 } : {},
    lnSpcReduction: g || void 0,
    vert: k !== "horz" ? k : void 0,
    anchorCtr: C || void 0,
    autoFitShape: d || void 0,
    columns: x > 1 ? x : void 0,
    columnGap: x > 1 ? j(P) : void 0,
    warp: pr(r)
  } : null;
}
function vr(t) {
  const e = [], n = (r, o) => {
    for (let s = r.firstElementChild; s; s = s.nextElementSibling)
      s.localName === "t" ? e.push(s.textContent ?? "") : o > 0 && n(s, o - 1);
  };
  return n(t, 12), e.join("").trim();
}
function yr(t, e) {
  return t ? t === "slidenum" ? String(e.slideNum) : t.startsWith("datetime") ? e.dateText ?? (/* @__PURE__ */ new Date()).toLocaleDateString() : t === "footer" ? e.footerText ?? "" : "" : "";
}
function $t(t, e, n) {
  const r = e.latin ?? n.fonts.minor.latin, o = e.ea ?? n.fonts.minor.ea, s = e.cs ?? n.fonts.minor.cs ?? null, l = [];
  r && l.push(r), o && o !== r && l.push(o), s && s !== r && s !== o && l.push(s);
  const i = At(e.sz ?? 1800);
  return {
    text: t,
    b: e.b ?? !1,
    i: e.i ?? !1,
    u: e.u ?? !1,
    strike: e.strike ?? !1,
    size: i,
    color: e.color ?? n.defaultColor ?? "rgb(0,0,0)",
    fonts: l,
    baseline: e.baseline,
    spacing: e.spc,
    caps: e.caps && e.caps !== "none" ? e.caps : void 0,
    outline: e.outline ?? null,
    gradient: e.gradient ?? null,
    link: e.link,
    highlight: e.highlight ?? null,
    underlineColor: e.uColor ?? null
  };
}
function xr(t) {
  const e = (h(t, "uniqueId") ?? "").toLowerCase();
  if (/orgchart|hierarchy/.test(e)) return "hierarchy";
  if (/pyramid/.test(e)) return "pyramid";
  if (/radial|cycle.*matrix/.test(e)) return "radial";
  if (/cycle|gear/.test(e)) return "cycle";
  if (/matrix|grid/.test(e)) return "snake";
  const n = /* @__PURE__ */ new Set(), r = (o, s) => {
    if (!(!o || s < 0))
      for (let l = o.firstElementChild; l; l = l.nextElementSibling) {
        if (l.localName === "alg") {
          const i = h(l, "type");
          i && n.add(i);
        }
        r(l, s - 1);
      }
  };
  return r(t, 12), n.has("hierRoot") || n.has("hierChild") ? "hierarchy" : n.has("pyra") ? "pyramid" : n.has("cycle") ? "cycle" : n.has("snake") ? "snake" : n.has("sp") && !n.has("lin") ? "radial" : "linear";
}
function wr(t) {
  const e = (h(t, "uniqueId") ?? "").toLowerCase();
  if (/vlist|vertical|^.*\/list1$/.test(e)) return !0;
  const n = t == null ? void 0 : t.getElementsByTagName("*");
  for (let r = 0; n && r < n.length; r++)
    if (n[r].localName === "param" && h(n[r], "type") === "linDir")
      return h(n[r], "val") === "fromT" || h(n[r], "val") === "fromB";
  return !1;
}
function Cr(t) {
  if (!t) return [];
  const e = t.localName === "dataModel" ? t : f(t, "dataModel"), n = f(e, "ptLst"), r = f(e, "cxnLst");
  if (!n) return [];
  const o = /* @__PURE__ */ new Map();
  let s = null;
  for (const u of H(n, "pt")) {
    const a = h(u, "modelId");
    if (!a) continue;
    const d = h(u, "type") ?? "node";
    d === "parTrans" || d === "sibTrans" || d === "pres" || (d === "doc" && (s = a), o.set(a, { id: a, txBody: f(u, "t"), kids: [] }));
  }
  for (const u of H(r, "cxn")) {
    if ((h(u, "type") ?? "parOf") !== "parOf") continue;
    const d = h(u, "srcId"), m = h(u, "destId");
    if (!d || !m) continue;
    const p = o.get(d);
    !p || !o.has(m) || p.kids.push({ id: m, ord: v(u, "srcOrd") ?? 0 });
  }
  const l = /* @__PURE__ */ new Set(), i = (u, a) => {
    if (l.has(u) || a > 12) return null;
    l.add(u);
    const d = o.get(u);
    return d ? (d.kids.sort((m, p) => m.ord - p.ord), {
      id: u,
      text: null,
      children: d.kids.map((m) => i(m.id, a + 1)).filter((m) => m !== null),
      depth: a
    }) : null;
  };
  if (s) {
    const u = i(s, -1);
    return u ? u.children : [];
  }
  const c = /* @__PURE__ */ new Set();
  for (const u of o.values()) for (const a of u.kids) c.add(a.id);
  return [...o.keys()].filter((u) => !c.has(u)).map((u) => i(u, 0)).filter((u) => u !== null);
}
function Sr(t, e) {
  const n = (t == null ? void 0 : t.localName) === "dataModel" ? t : f(t, "dataModel");
  for (const r of H(f(n, "ptLst"), "pt"))
    if (h(r, "modelId") === e) return f(r, "t");
  return null;
}
function kr(t) {
  if (!t) return [];
  const e = [], n = H(t, "styleLbl"), r = n.find((s) => (h(s, "name") ?? "").startsWith("node")) ?? n[0], o = f(r ?? null, "fillClrLst");
  for (let s = (o == null ? void 0 : o.firstElementChild) ?? null; s; s = s.nextElementSibling) {
    const l = h(s, "val");
    l && e.push(l);
  }
  return e;
}
function Mr(t) {
  const e = [], n = (r) => {
    for (const o of r)
      e.push(o), n(o.children);
  };
  return n(t), e;
}
function Pr(t, e, n, r) {
  const o = t.length ? t : [];
  if (!o.length) return [];
  const s = (r ? n : e) * 0.04, l = o.length;
  if (r) {
    const u = (n - s * (l - 1)) / l, a = Math.min(e, u * 5);
    return o.map((d, m) => ({
      x: (e - a) / 2,
      y: m * (u + s),
      w: a,
      h: u,
      pt: d,
      prst: "roundRect",
      colorIdx: m
    }));
  }
  const i = (e - s * (l - 1)) / l, c = Math.min(n, i * 0.8);
  return o.map((u, a) => ({
    x: a * (i + s),
    y: (n - c) / 2,
    w: i,
    h: c,
    pt: u,
    prst: "roundRect",
    colorIdx: a
  }));
}
function Fr(t, e, n) {
  const r = t.length;
  if (!r) return [];
  const o = Math.min(e, n) * (r <= 4 ? 0.34 : 0.28), s = o * 0.62, l = (e - o) / 2, i = (n - s) / 2;
  return t.map((c, u) => {
    const a = -Math.PI / 2 + u * 2 * Math.PI / r;
    return {
      x: e / 2 + l * Math.cos(a) - o / 2,
      y: n / 2 + i * Math.sin(a) - s / 2,
      w: o,
      h: s,
      pt: c,
      prst: "ellipse",
      colorIdx: u
    };
  });
}
function Nr(t, e, n) {
  const r = t.length;
  if (!r) return [];
  const o = n / r;
  return t.map((s, l) => {
    const i = (l + 1) / r * e;
    return { x: (e - i) / 2, y: l * o, w: i, h: o * 0.94, pt: s, prst: "trapezoid", colorIdx: l };
  });
}
function Er(t, e, n) {
  const r = t.length;
  if (!r) return [];
  const o = Math.ceil(Math.sqrt(r)), s = Math.ceil(r / o), l = e * 0.03, i = n * 0.05, c = (e - l * (o - 1)) / o, u = (n - i * (s - 1)) / s;
  return t.map((a, d) => ({
    x: d % o * (c + l),
    y: Math.floor(d / o) * (u + i),
    w: c,
    h: u,
    pt: a,
    prst: "roundRect",
    colorIdx: d
  }));
}
function Tr(t, e, n) {
  if (!t.length) return [];
  const [r, ...o] = t, s = Math.min(e, n) * 0.3, l = [{
    x: (e - s) / 2,
    y: (n - s) / 2,
    w: s,
    h: s,
    pt: r,
    prst: "ellipse",
    colorIdx: 0
  }], i = o.length, c = Math.min(e, n) * 0.26, u = c * 0.62;
  return o.forEach((a, d) => {
    const m = -Math.PI / 2 + d * 2 * Math.PI / Math.max(i, 1);
    l.push({
      x: e / 2 + (e - c) / 2 * Math.cos(m) - c / 2,
      y: n / 2 + (n - u) / 2 * Math.sin(m) - u / 2,
      w: c,
      h: u,
      pt: a,
      prst: "ellipse",
      colorIdx: d + 1
    });
  }), l;
}
function Ir(t, e, n) {
  const r = [], o = (c, u) => {
    if (c.length) {
      (r[u] ?? (r[u] = [])).push(...c);
      for (const a of c) o(a.children, u + 1);
    }
  };
  if (o(t, 0), !r.length) return [];
  const s = n / r.length, l = s * 0.62, i = [];
  return r.forEach((c, u) => {
    const a = e * 0.03, d = (e - a * (c.length - 1)) / c.length;
    c.forEach((m, p) => {
      i.push({
        x: p * (d + a),
        y: u * s + (s - l) / 2,
        w: d,
        h: l,
        pt: m,
        prst: "roundRect",
        colorIdx: u
      });
    });
  }), i;
}
const Ar = {
  linear: Pr,
  cycle: (t, e, n) => Fr(t, e, n),
  pyramid: (t, e, n) => Nr(t, e, n),
  hierarchy: (t, e, n) => Ir(t, e, n),
  snake: (t, e, n) => Er(t, e, n),
  radial: (t, e, n) => Tr(t, e, n)
};
function Lr(t, e, n, r) {
  const o = r.family === "hierarchy" ? t : Mr(t), s = Ar[r.family](o, e, n, r.vertical);
  if (!s.length) return [];
  const l = [];
  if (r.family === "hierarchy") {
    const i = new Map(s.map((a) => [a.pt.id, a])), c = (a, d) => {
      const m = a.x + a.w / 2, p = a.y + a.h, b = d.x + d.w / 2, g = d.y, k = (p + g) / 2, C = Math.min(m, b), x = Math.min(p, g), P = Math.max(Math.abs(b - m), 1), E = Math.max(g - p, 1), S = `M ${m - C} 0 L ${m - C} ${k - x} L ${b - C} ${k - x} L ${b - C} ${E}`;
      l.push({
        kind: "shape",
        x: C,
        y: x,
        w: P,
        h: E,
        rot: 0,
        flipH: !1,
        flipV: !1,
        path: S,
        fill: null,
        stroke: { color: r.colors[0] ?? "rgb(68,114,196)", width: 1.5, dash: null },
        text: null,
        openGeom: !0,
        name: "SmartArt 连线"
      });
    }, u = (a) => {
      for (const d of a) {
        const m = i.get(d.id);
        for (const p of d.children) {
          const b = i.get(p.id);
          m && b && c(m, b);
        }
        u(d.children);
      }
    };
    u(t);
  }
  for (const i of s) {
    const u = { type: "solid", color: r.colors[i.colorIdx % Math.max(r.colors.length, 1)] ?? "rgb(68,114,196)" }, a = Ot(i.prst, i.w, i.h, {}), d = {
      kind: "shape",
      x: i.x,
      y: i.y,
      w: i.w,
      h: i.h,
      rot: 0,
      flipH: !1,
      flipV: !1,
      path: a.d,
      fill: u,
      stroke: null,
      text: r.textOf(i.pt.id),
      name: "SmartArt 节点"
    };
    l.push(d);
  }
  return l;
}
function $r(t, e) {
  return {
    kind: "group",
    ...e,
    childX: 0,
    childY: 0,
    scaleX: 1,
    scaleY: 1,
    children: t,
    name: "SmartArt"
  };
}
const Rr = new TextDecoder(), Or = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff"
}, zr = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  wma: "audio/x-ms-wma",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  aac: "audio/aac",
  mid: "audio/midi",
  midi: "audio/midi"
};
class Ve {
  constructor(e) {
    this.assetMode = "blob", this.deferred = [], this.deferredIndex = /* @__PURE__ */ new Map(), this.xmlCache = /* @__PURE__ */ new Map(), this.relsCache = /* @__PURE__ */ new Map(), this.blobCache = /* @__PURE__ */ new Map(), this.objectUrls = [], this.files = $n(e);
  }
  xml(e) {
    if (!this.xmlCache.has(e)) {
      const n = this.files[e];
      let r = null;
      if (n)
        try {
          r = sn(Rr.decode(n));
        } catch {
          r = null;
        }
      this.xmlCache.set(e, r);
    }
    return this.xmlCache.get(e) ?? null;
  }
  rels(e) {
    if (!this.relsCache.has(e)) {
      const n = e.slice(0, e.lastIndexOf("/") + 1), r = {}, o = this.xml(`${n}_rels/${e.slice(n.length)}.rels`);
      for (const s of H(o, "Relationship")) {
        const l = h(s, "Id"), i = h(s, "Target");
        if (!l || !i) continue;
        const c = h(s, "TargetMode") === "External";
        r[l] = { type: h(s, "Type") ?? "", target: c ? i : Dr(n, i) };
      }
      this.relsCache.set(e, r);
    }
    return this.relsCache.get(e);
  }
  /** 把一段字节挂成可引用的地址：defer 下发令牌，否则建 blob URL */
  store(e, n, r) {
    if (this.assetMode === "defer") {
      let s = this.deferredIndex.get(e);
      return s === void 0 && (s = `asset:${this.deferred.length}`, this.deferred.push({ mime: r, data: n }), this.deferredIndex.set(e, s)), s;
    }
    let o = this.blobCache.get(e);
    return o === void 0 && (o = URL.createObjectURL(new Blob([n.slice().buffer], { type: r })), this.objectUrls.push(o), this.blobCache.set(e, o)), o;
  }
  blobUrl(e, n) {
    const r = this.files[e];
    return r ? this.store(`${n}|${e}`, r, n) : null;
  }
  /**
   * 嵌入字体的可用地址。
   *
   * fntdata 是 EOT 容器而不是裸 TTF，得先还原成 sfnt（见 font/eot.ts）。
   * 还原不出来就返回 null —— 与其声明一个浏览器注定拒绝的 @font-face，
   * 不如干脆不声明，让文本老实回退到替换字体。
   */
  fontUrl(e) {
    const n = this.files[e];
    if (!n) return null;
    const r = Wn(n);
    return r ? this.store(`font|${e}`, r.data, r.mime) : null;
  }
  /** 释放全部 blob URL，并清空缓存以便 zip 数据被回收 */
  dispose() {
    for (const e of this.objectUrls)
      try {
        URL.revokeObjectURL(e);
      } catch {
      }
    this.objectUrls = [], this.blobCache.clear(), this.xmlCache.clear(), this.relsCache.clear(), this.files = {};
  }
  mediaUrl(e) {
    const n = e.slice(e.lastIndexOf(".") + 1).toLowerCase();
    if (Dn.has(n)) {
      const o = `mf|${e}`;
      if (!this.blobCache.has(o)) {
        const s = this.files[e];
        this.blobCache.set(o, s ? zn(s) : null);
      }
      return this.blobCache.get(o) ?? null;
    }
    const r = Or[n];
    return r ? this.blobUrl(e, r) : null;
  }
}
function Dr(t, e) {
  if (e.startsWith("/")) return e.slice(1);
  const n = [];
  for (const r of (t + e).split("/"))
    r === ".." ? n.pop() : r !== "." && r !== "" && n.push(r);
  return n.join("/");
}
function kt(t, e) {
  for (const n of Object.values(t)) if (n.type.endsWith(e)) return n.target;
  return null;
}
function Br(t) {
  const e = {}, n = R(t, "themeElements", "clrScheme");
  if (n)
    for (let i = n.firstElementChild; i; i = i.nextElementSibling) {
      const c = i.firstElementChild;
      c && (e[i.localName] = c.localName === "srgbClr" ? h(c, "val") ?? "000000" : h(c, "lastClr") ?? (h(c, "val") === "window" ? "FFFFFF" : "000000"));
    }
  const r = R(t, "themeElements", "fontScheme"), o = (i) => {
    const c = f(r, i);
    return {
      latin: h(f(c, "latin"), "typeface") || null,
      ea: h(f(c, "ea"), "typeface") || null,
      cs: h(f(c, "cs"), "typeface") || null
    };
  }, s = R(t, "themeElements", "fmtScheme"), l = (i) => {
    const c = f(s, i), u = [];
    for (let a = (c == null ? void 0 : c.firstElementChild) ?? null; a; a = a.nextElementSibling) u.push(a);
    return u;
  };
  return {
    colors: e,
    fonts: { major: o("majorFont"), minor: o("minorFont") },
    fillStyles: l("fillStyleLst"),
    lnStyles: l("lnStyleLst"),
    effectStyles: l("effectStyleLst"),
    bgFillStyles: l("bgFillStyleLst")
  };
}
function Ee(t) {
  const e = [];
  for (const n of H(t, "sp")) {
    const r = R(n, "nvSpPr", "nvPr", "ph");
    r && e.push({ type: h(r, "type"), idx: h(r, "idx"), sp: n });
  }
  return e;
}
const _e = {
  title: ["title", "ctrTitle"],
  ctrTitle: ["ctrTitle", "title"],
  body: ["body", "subTitle", "obj"],
  subTitle: ["subTitle", "body"],
  obj: ["obj", "body"]
};
function jt(t, e, n) {
  var r;
  if (n !== null) {
    const o = t.find((s) => s.idx === n);
    if (o) return o.sp;
  }
  if (e)
    for (const o of _e[e] ?? [e]) {
      const s = t.find((l) => l.type === o);
      if (s) return s.sp;
    }
  return !e && n === null ? ((r = t.find((o) => o.type === "body")) == null ? void 0 : r.sp) ?? null : null;
}
function dt(t) {
  if (!t) return null;
  const e = f(t, "off"), n = f(t, "ext"), r = f(t, "chOff"), o = f(t, "chExt");
  return {
    x: j(v(e, "x")),
    y: j(v(e, "y")),
    w: j(v(n, "cx")),
    h: j(v(n, "cy")),
    rot: (v(t, "rot") ?? 0) / 6e4,
    flipH: ot(t, "flipH"),
    flipV: ot(t, "flipV"),
    chX: j(v(r, "x")),
    chY: j(v(r, "y")),
    chW: j(v(o, "cx")),
    chH: j(v(o, "cy"))
  };
}
const et = (t) => ({
  x: t.x,
  y: t.y,
  w: t.w,
  h: t.h,
  rot: t.rot,
  flipH: t.flipH,
  flipV: t.flipV
});
function qe(t, e) {
  return e ? { ...t, ctx: { ...t.ctx, phClr: e } } : t;
}
const jr = ["noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill"];
function Mt(t, e) {
  if (!t) return null;
  for (const n of jr) {
    const r = f(t, n);
    if (r) return he(r, e);
  }
  return null;
}
function he(t, e) {
  if (!t) return null;
  switch (t.localName) {
    case "noFill":
      return { type: "none" };
    case "solidFill":
      return { type: "solid", color: q(t, e.ctx) ?? "rgb(0,0,0)" };
    case "gradFill": {
      const n = H(f(t, "gsLst"), "gs").map((s) => ({ pos: (v(s, "pos") ?? 0) / 1e5, color: q(s, e.ctx) ?? "rgb(0,0,0)" })).sort((s, l) => s.pos - l.pos);
      if (!n.length) return null;
      if (f(t, "path")) return { type: "gradient", angle: 0, stops: n, radial: !0 };
      const o = f(t, "lin");
      return { type: "gradient", angle: o ? (v(o, "ang") ?? 0) / 6e4 : 90, stops: n };
    }
    case "blipFill": {
      const n = Ze(t, e);
      if (!n) return { type: "none" };
      const r = f(t, "tile"), o = v(f(f(t, "blip"), "alphaModFix"), "amt"), s = f(t, "srcRect"), l = (i) => (v(s, i) ?? 0) / 1e5;
      return {
        type: "image",
        src: n,
        alpha: o !== null ? o / 1e5 : void 0,
        crop: s ? { l: l("l"), t: l("t"), r: l("r"), b: l("b") } : void 0,
        tile: r ? { sx: (v(r, "sx") ?? 1e5) / 1e5, sy: (v(r, "sy") ?? 1e5) / 1e5, flip: h(r, "flip") ?? "none" } : void 0
      };
    }
    case "pattFill":
      return {
        type: "pattern",
        fg: q(f(t, "fgClr"), e.ctx) ?? "rgb(0,0,0)",
        bg: q(f(t, "bgClr"), e.ctx) ?? "rgba(0,0,0,0)",
        preset: h(t, "prst") ?? "pct50"
      };
    case "grpFill":
      return null;
  }
  return null;
}
function Ze(t, e) {
  var s;
  const n = f(t, "blip"), r = h(n, "r:embed") ?? h(n, "r:link"), o = r ? (s = e.rels[r]) == null ? void 0 : s.target : null;
  return o ? /^https?:/i.test(o) ? o : e.pkg.mediaUrl(o) : null;
}
function Gr(t) {
  const e = f(t, "blip");
  if (!e) return;
  const n = [];
  f(e, "grayscl") && n.push("grayscale(1)"), f(e, "duotone") && n.push("grayscale(1) contrast(1.1)");
  const r = f(e, "lum");
  if (r) {
    const o = (v(r, "bright") ?? 0) / 1e5, s = (v(r, "contrast") ?? 0) / 1e5;
    o && n.push(`brightness(${(1 + o).toFixed(2)})`), s && n.push(`contrast(${(1 + s).toFixed(2)})`);
  }
  return n.length ? n.join(" ") : void 0;
}
const Hr = {
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
}, Ur = { flat: "butt", rnd: "round", sq: "square" };
function Ft(t, e, n) {
  if (!t) return n;
  if (f(t, "noFill")) return null;
  const r = v(t, "w") !== null ? j(v(t, "w")) : (n == null ? void 0 : n.width) ?? 1, o = Mt(t, e);
  let s = (n == null ? void 0 : n.color) ?? null;
  if ((o == null ? void 0 : o.type) === "solid" ? s = o.color : (o == null ? void 0 : o.type) === "gradient" && o.stops.length && (s = o.stops[0].color), !s) return n ? { ...n, width: r } : null;
  const l = h(f(t, "prstDash"), "val"), i = Math.max(r, 1), c = l ? l === "solid" ? null : (Hr[l] ?? [4, 3]).map((p) => p * i) : (n == null ? void 0 : n.dash) ?? null, u = Se(f(t, "headEnd")) ?? (n == null ? void 0 : n.head), a = Se(f(t, "tailEnd")) ?? (n == null ? void 0 : n.tail), d = Ur[h(t, "cap") ?? ""] ?? (n == null ? void 0 : n.cap), m = f(t, "round") ? "round" : f(t, "bevel") ? "bevel" : f(t, "miter") ? "miter" : n == null ? void 0 : n.join;
  return { color: s, width: r, dash: c, cap: d, join: m, head: u, tail: a, compound: h(t, "cmpd") ?? (n == null ? void 0 : n.compound) };
}
function Wr(t, e) {
  if (!t) return { fill: null, stroke: null, fontColor: null, effects: void 0 };
  const n = (l, i) => {
    const c = f(t, l), u = Number(h(c, "idx") ?? "0");
    if (!c || !u) return { el: null, env: e };
    const a = q(c, e.ctx);
    return { el: i[Math.min(u, i.length) - 1] ?? null, env: qe(e, a) };
  }, r = n("fillRef", e.theme.fillStyles), o = n("lnRef", e.theme.lnStyles), s = n("effectRef", e.theme.effectStyles);
  return {
    fill: r.el ? he(r.el, r.env) : null,
    stroke: o.el ? Ft(o.el, o.env, null) : null,
    fontColor: q(f(t, "fontRef"), e.ctx),
    effects: s.el ? Wt(f(s.el, "effectLst") ?? s.el, s.env.ctx) : void 0
  };
}
function Pt(t, e, n) {
  const r = [];
  if (!t) return r;
  for (let o = t.firstElementChild; o; o = o.nextElementSibling) {
    let s = null;
    try {
      s = Xr(o, e, n);
    } catch (l) {
      s = Yr(o, l);
    }
    Array.isArray(s) ? r.push(...s) : s && r.push(s);
  }
  return r;
}
function Xr(t, e, n) {
  {
    let r = null;
    switch (t.localName) {
      case "sp":
      case "cxnSp": {
        const o = t.localName === "sp" ? "nvSpPr" : "nvCxnSpPr", s = R(t, o, "nvPr", "ph");
        if (n && s || s && e.hiddenPh.has(h(s, "type") ?? "")) break;
        r = Vr(t, e);
        break;
      }
      case "pic":
        r = Ke(t, e);
        break;
      case "grpSp":
        r = ro(t, e, n);
        break;
      case "graphicFrame":
        r = oo(t, e);
        break;
      case "contentPart":
        r = no(t, e);
        break;
      case "AlternateContent": {
        const o = f(t, "Choice");
        let s = o ? Pt(o, e, n) : [];
        if (!s.length) {
          const l = f(t, "Fallback");
          l && (s = Pt(l, e, n));
        }
        return s;
      }
    }
    return r;
  }
}
function Yr(t, e) {
  const n = f(t, "nvSpPr") ?? f(t, "nvPicPr") ?? f(t, "nvGrpSpPr") ?? f(t, "nvCxnSpPr") ?? f(t, "nvGraphicFramePr"), r = dt(R(t, "spPr", "xfrm") ?? R(t, "grpSpPr", "xfrm") ?? f(t, "xfrm"));
  if (!r || r.w <= 0 || r.h <= 0) return null;
  const o = h(f(n, "cNvPr"), "name") ?? t.localName, s = e instanceof Error ? e.message : String(e);
  return {
    kind: "unsupported",
    ...et(r),
    label: `${o}（解析失败：${s.slice(0, 40)}）`
  };
}
function Qe(t, e) {
  const n = f(t, "hlinkClick");
  if (n)
    return me(e, h(n, "r:id") ?? "", h(n, "action")) ?? void 0;
}
function me(t, e, n) {
  if (n != null && n.includes("nextslide")) return `slide:${t.slideNum + 1}`;
  if (n != null && n.includes("previousslide")) return `slide:${t.slideNum - 1}`;
  if (n != null && n.includes("firstslide")) return "slide:1";
  if (n != null && n.includes("lastslide")) return "slide:last";
  const r = t.rels[e];
  if (!r) return null;
  if (/^https?:|^mailto:/i.test(r.target)) return r.target;
  const o = t.slideIdMap[r.target];
  return o !== void 0 ? `slide:${o}` : null;
}
function Vr(t, e) {
  const n = t.localName === "cxnSp" ? "nvCxnSpPr" : "nvSpPr", r = R(t, n, "cNvPr"), o = R(t, n, "nvPr", "ph"), s = h(o, "type"), l = h(o, "idx"), i = f(t, "spPr"), c = o ? jt(e.layoutPh, s, l) : null, u = o ? jt(e.masterPh, s, l) : null;
  let a = dt(f(i, "xfrm"));
  if (!a && o && (a = dt(R(c, "spPr", "xfrm")) ?? dt(R(u, "spPr", "xfrm"))), !a) return null;
  const d = Wr(f(t, "style"), e);
  let m = i;
  !f(i, "prstGeom") && !f(i, "custGeom") && o && (m = R(c, "spPr") ?? R(u, "spPr") ?? i);
  const p = f(m, "prstGeom"), b = f(m, "custGeom");
  let g = null, k = !1;
  if (p) {
    const w = Ot(h(p, "prst") ?? "rect", a.w, a.h, Xe(f(p, "avLst")));
    g = w.d, k = w.open;
  } else if (b) {
    const w = Ye(b, a.w, a.h);
    w && (g = w.d, k = w.open);
  }
  let C = Mt(i, e);
  !C && o && (C = Mt(R(c, "spPr"), e) ?? Mt(R(u, "spPr"), e)), C || (C = d.fill), k && (C = { type: "none" });
  let x = Ft(f(i, "ln"), e, d.stroke);
  !f(i, "ln") && o && (x = Ft(R(c, "spPr", "ln") ?? R(u, "spPr", "ln"), e, x));
  const P = Wt(f(i, "effectLst"), e.ctx) ?? d.effects;
  !g && (C || x) && (g = Ot("rect", a.w, a.h, {}).d);
  const E = f(t, "txBody");
  let S = null;
  if (E) {
    const w = [e.docDefaults];
    if (o) {
      const y = s === "title" || s === "ctrTitle" ? "title" : !s || _e.body.includes(s) ? "body" : "other";
      w.push(e.masterStyles[y]), w.push(St(R(u, "txBody", "lstStyle"), e.ctx, e.theme.fonts)), w.push(St(R(c, "txBody", "lstStyle"), e.ctx, e.theme.fonts));
    }
    w.push(St(f(E, "lstStyle"), e.ctx, e.theme.fonts));
    const F = {
      ctx: e.ctx,
      fonts: e.theme.fonts,
      chain: w,
      defaultColor: d.fontColor,
      slideNum: e.slideNum,
      bodyPrFallbacks: [R(c, "txBody", "bodyPr"), R(u, "txBody", "bodyPr")],
      resolveLink: (y, M) => me(e, y, M),
      resolveImage: (y) => {
        var T;
        const M = (T = e.rels[y]) == null ? void 0 : T.target;
        return M ? e.pkg.mediaUrl(M) : null;
      }
    };
    S = de(E, F);
  }
  return !g && !S ? null : {
    kind: "shape",
    ...et(a),
    path: g,
    fill: C,
    stroke: x,
    text: S,
    openGeom: k || void 0,
    effects: P,
    scene3d: Vn(i, e.ctx),
    link: Qe(r, e),
    name: h(r, "name") ?? void 0,
    id: v(r, "id") ?? void 0
  };
}
const _r = /* @__PURE__ */ new Set(["videoFile", "quickTimeFile", "media"]), qr = /* @__PURE__ */ new Set(["audioFile", "wavAudioFile", "audioCd"]), Zr = (t) => /^[a-z][a-z0-9+.-]*:/i.test(t);
function Qr(t, e) {
  if (!t) return;
  let n = null, r = null;
  const o = t.getElementsByTagName("*");
  for (let u = 0; u < o.length; u++) {
    const a = o[u].localName;
    if (qr.has(a)) {
      n = "audio", r = o[u];
      break;
    }
    _r.has(a) && !r && (n = "video", r = o[u]);
  }
  if (!n || !r) return;
  const s = h(r, "r:link") ?? h(r, "r:embed"), l = s ? e.rels[s] : void 0;
  if (!l) return { kind: n, src: null };
  if (Zr(l.target)) return { kind: n, src: l.target, external: !0 };
  const i = l.target.slice(l.target.lastIndexOf(".") + 1).toLowerCase(), c = zr[i] ?? (n === "audio" ? "audio/mpeg" : "video/mp4");
  return { kind: n, src: e.pkg.blobUrl(l.target, c), mime: c };
}
function Ke(t, e) {
  var C;
  const n = f(t, "spPr"), r = R(t, "nvPicPr", "nvPr", "ph");
  let o = dt(f(n, "xfrm"));
  if (!o && r) {
    const x = h(r, "type"), P = h(r, "idx");
    o = dt(R(jt(e.layoutPh, x, P), "spPr", "xfrm")) ?? dt(R(jt(e.masterPh, x, P), "spPr", "xfrm"));
  }
  if (!o) return null;
  const s = R(t, "nvPicPr", "cNvPr"), l = f(t, "blipFill"), i = Ze(l, e), c = h(s, "name") ?? "图片", u = Qr(R(t, "nvPicPr", "nvPr"), e);
  if (!i && !u) return { kind: "unsupported", ...et(o), label: `${c}（格式不支持）` };
  const a = f(l, "srcRect"), d = (x) => (v(a, x) ?? 0) / 1e5, m = a ? { l: d("l"), t: d("t"), r: d("r"), b: d("b") } : null;
  let p = null;
  const b = f(n, "prstGeom"), g = f(n, "custGeom");
  b && (h(b, "prst") ?? "rect") !== "rect" ? p = Ot(h(b, "prst"), o.w, o.h, Xe(f(b, "avLst"))).d : g && (p = ((C = Ye(g, o.w, o.h)) == null ? void 0 : C.d) ?? null);
  const k = v(f(f(l, "blip"), "alphaModFix"), "amt");
  return {
    kind: "image",
    ...et(o),
    src: i ?? "",
    crop: m,
    clipPath: p,
    alpha: k !== null ? k / 1e5 : void 0,
    filter: Gr(l),
    stroke: Ft(f(n, "ln"), e, null),
    effects: Wt(f(n, "effectLst"), e.ctx),
    link: Qe(s, e),
    name: h(s, "name") ?? void 0,
    id: v(s, "id") ?? void 0,
    media: u
  };
}
function Kr(t, e, n) {
  const r = [], o = [], s = [], l = [];
  let i = !0;
  for (const c of t.split(",")) {
    const u = c.trim().split(/[\s]+/).filter((m) => m !== "");
    if (!u.length) continue;
    u.forEach((m, p) => {
      const b = m.match(/^(!|'|")?\s*(-?[\d.]+(?:[eE][-+]?\d+)?)$/);
      if (!b) return;
      const g = Number(b[2]);
      if (!Number.isFinite(g)) return;
      const k = b[1] ?? "";
      if (i || k === "!") {
        o[p] = g, s[p] = 0, l[p] = "!";
        return;
      }
      switch (k && (l[p] = k), l[p] ?? "!") {
        case "'":
          s[p] = g, o[p] = (o[p] ?? 0) + g;
          break;
        case '"':
          s[p] = (s[p] ?? 0) + g, o[p] = (o[p] ?? 0) + s[p];
          break;
        default:
          o[p] = g;
      }
    });
    const a = o[e], d = o[n];
    Number.isFinite(a) && Number.isFinite(d) && r.push([a, d]), i = !1;
  }
  return r;
}
function Jr(t) {
  const e = t.getElementsByTagName("*");
  for (let n = 0; n < e.length; n++) {
    if (e[n].localName !== "traceFormat") continue;
    const r = H(e[n], "channel").map((l) => (h(l, "name") ?? "").toUpperCase()), o = r.indexOf("X"), s = r.indexOf("Y");
    if (o >= 0 && s >= 0) return [o, s];
  }
  return [0, 1];
}
function to(t) {
  const e = /* @__PURE__ */ new Map(), n = t.getElementsByTagName("*");
  for (let r = 0; r < n.length; r++) {
    const o = n[r];
    if (o.localName !== "brush") continue;
    const s = h(o, "xml:id") ?? h(o, "id");
    if (!s) continue;
    const l = { color: "rgb(0,0,0)", width: 0 };
    for (const i of H(o, "brushProperty")) {
      const c = (h(i, "name") ?? "").toLowerCase(), u = h(i, "value") ?? "";
      if (c === "color") l.color = /^#?[0-9a-f]{6}$/i.test(u) ? `#${u.replace(/^#/, "")}` : u;
      else if (c === "width" || c === "height") {
        const a = Number(u);
        Number.isFinite(a) && a > l.width && (l.width = a);
      }
    }
    e.set(s, l);
  }
  return e;
}
function eo(t, e, n) {
  var P, E;
  const [r, o] = Jr(t), s = to(t), l = [], i = t.getElementsByTagName("*");
  for (let S = 0; S < i.length; S++) {
    if (i[S].localName !== "trace") continue;
    const w = Kr(i[S].textContent ?? "", r, o);
    if (w.length < 2) continue;
    const F = (h(i[S], "brushRef") ?? "").replace(/^#/, "");
    l.push({ pts: w, brush: s.get(F) ?? s.values().next().value });
  }
  if (!l.length) return [];
  let c = 1 / 0, u = 1 / 0, a = -1 / 0, d = -1 / 0;
  for (const S of l)
    for (const [w, F] of S.pts)
      w < c && (c = w), F < u && (u = F), w > a && (a = w), F > d && (d = F);
  const m = a - c, p = d - u, b = Math.min(m > 0 ? e / m : 1 / 0, p > 0 ? n / p : 1 / 0), g = Number.isFinite(b) && b > 0 ? b : 1, k = (e - m * g) / 2, C = (n - p * g) / 2, x = [];
  for (const S of l) {
    const w = S.pts.map(([z, A]) => [k + (z - c) * g, C + (A - u) * g]);
    let F = 1 / 0, y = 1 / 0, M = -1 / 0, T = -1 / 0;
    for (const [z, A] of w)
      z < F && (F = z), A < y && (y = A), z > M && (M = z), A > T && (T = A);
    const N = (z) => String(Math.round(z * 100) / 100), I = "M " + w.map(([z, A]) => `${N(z - F)} ${N(A - y)}`).join(" L "), O = Math.max(0.75, Math.min((((P = S.brush) == null ? void 0 : P.width) ?? 0) * g || 2, 24));
    x.push({
      kind: "shape",
      x: F,
      y,
      w: Math.max(M - F, 0),
      h: Math.max(T - y, 0),
      rot: 0,
      flipH: !1,
      flipV: !1,
      path: I,
      fill: { type: "none" },
      stroke: { color: ((E = S.brush) == null ? void 0 : E.color) ?? "rgb(0,0,0)", width: O, dash: null, cap: "round", join: "round" },
      text: null,
      openGeom: !0
    });
  }
  return x;
}
function no(t, e) {
  var i;
  const n = dt(f(t, "xfrm"));
  if (!n || n.w <= 0 || n.h <= 0) return null;
  const r = h(t, "r:id"), o = r ? (i = e.rels[r]) == null ? void 0 : i.target : null, s = o ? e.pkg.xml(o) : null;
  if (!s) return null;
  let l;
  try {
    l = eo(s, n.w, n.h);
  } catch {
    return null;
  }
  return l.length ? {
    kind: "group",
    ...et(n),
    childX: 0,
    childY: 0,
    scaleX: 1,
    scaleY: 1,
    children: l,
    name: h(R(t, "nvContentPartPr", "cNvPr"), "name") ?? "墨迹",
    id: v(R(t, "nvContentPartPr", "cNvPr"), "id") ?? void 0
  } : null;
}
function ro(t, e, n) {
  const r = f(t, "grpSpPr"), o = dt(f(r, "xfrm"));
  if (!o) return null;
  const s = Pt(t, e, n);
  return s.length ? {
    kind: "group",
    ...et(o),
    childX: o.chX,
    childY: o.chY,
    scaleX: o.chW ? o.w / o.chW : 1,
    scaleY: o.chH ? o.h / o.chH : 1,
    children: s,
    effects: Wt(f(r, "effectLst"), e.ctx),
    name: h(R(t, "nvGrpSpPr", "cNvPr"), "name") ?? void 0,
    id: v(R(t, "nvGrpSpPr", "cNvPr"), "id") ?? void 0
  } : null;
}
function oo(t, e) {
  const n = dt(f(t, "xfrm"));
  if (!n) return null;
  const r = R(t, "graphic", "graphicData"), o = h(r, "uri") ?? "", s = R(t, "nvGraphicFramePr", "cNvPr"), l = h(s, "name") ?? void 0, i = v(s, "id") ?? void 0, c = f(r, "tbl");
  if (c) return { ...uo(c, n, e, l), id: i };
  if (o.endsWith("/chart")) {
    const a = lo(r, n, e);
    return a ? { ...a, id: i } : { kind: "unsupported", ...et(n), label: "图表", name: l, id: i };
  }
  if (o.endsWith("/diagram")) {
    const a = io(r, n, e);
    return a ? { ...a, id: i } : { kind: "unsupported", ...et(n), label: "SmartArt", name: l, id: i };
  }
  if (o.endsWith("/ole") || o.includes("oleObject")) {
    const a = f(r, "oleObj");
    if (a) {
      const d = f(a, "pic");
      if (d) {
        const p = Ke(d, e);
        if (p && p.kind === "image" && p.src)
          return { ...p, ...et(n), name: l ?? p.name, id: i };
      }
      const m = so(a, e);
      if (m) return { kind: "image", ...et(n), src: m, crop: null, name: l, id: i };
    }
    return { kind: "unsupported", ...et(n), label: "OLE 对象", name: l, id: i };
  }
  const u = o.includes("/media") || o.includes("video") ? "媒体对象" : "不支持的对象";
  return { kind: "unsupported", ...et(n), label: u, name: l, id: i };
}
function so(t, e) {
  var s;
  const n = h(t, "spid");
  if (!n) return null;
  const r = kt(e.rels, "/vmlDrawing");
  if (!r) return null;
  const o = e.pkg.xml(r);
  if (!o) return null;
  for (const l of o.getElementsByTagName("*"))
    if (!(l.localName !== "shape" || h(l, "id") !== n))
      for (const i of l.getElementsByTagName("*")) {
        if (i.localName !== "imagedata") continue;
        const c = h(i, "o:relid") ?? h(i, "r:id"), u = c ? (s = e.pkg.rels(r)[c]) == null ? void 0 : s.target : null;
        return u ? e.pkg.mediaUrl(u) : null;
      }
  return null;
}
function lo(t, e, n) {
  var c;
  if (!t) return null;
  const r = On(), o = h(f(t, "chart"), "r:id"), s = o ? (c = n.rels[o]) == null ? void 0 : c.target : null;
  if (!r || !s) return null;
  const l = n.pkg.xml(s);
  if (!l) return null;
  let i;
  try {
    i = r(l, e.w, e.h, { ctx: n.ctx, fonts: n.theme.fonts, rels: n.pkg.rels(s) });
  } catch {
    return null;
  }
  return i.length ? {
    kind: "group",
    ...et(e),
    childX: 0,
    childY: 0,
    scaleX: 1,
    scaleY: 1,
    children: i,
    name: "图表"
  } : null;
}
function io(t, e, n) {
  var d;
  if (!t) return null;
  const r = f(t, "relIds");
  let o = null;
  const s = h(r, "r:dm"), l = s ? (d = n.rels[s]) == null ? void 0 : d.target : null;
  if (l) {
    const m = n.pkg.xml(l), p = m == null ? void 0 : m.getElementsByTagName("*");
    for (let b = 0; p && b < p.length; b++)
      if (p[b].localName === "dataModelExt") {
        const g = h(p[b], "relId");
        g && n.rels[g] && (o = n.rels[g].target);
        break;
      }
  }
  if (o || (o = kt(n.rels, "/diagramDrawing")), !o) return Jt(r, e, n);
  const i = n.pkg.xml(o), c = f(i, "spTree");
  if (!c) return Jt(r, e, n);
  const u = { ...n, rels: n.pkg.rels(o), partPath: o, layoutPh: [], masterPh: [] }, a = Pt(c, u, !1);
  return a.length ? {
    kind: "group",
    ...et(e),
    childX: 0,
    childY: 0,
    scaleX: 1,
    scaleY: 1,
    children: a,
    name: "SmartArt"
  } : Jt(r, e, n);
}
function Jt(t, e, n) {
  const r = (m) => {
    var g;
    const p = h(t, m), b = p ? (g = n.rels[p]) == null ? void 0 : g.target : null;
    return b ? n.pkg.xml(b) : null;
  }, o = r("r:dm"), s = Cr(o);
  if (!s.length) return null;
  const l = r("r:lo"), i = r("r:cs"), c = kr(i), u = (c.length ? c : ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"]).map((m) => /^[0-9a-fA-F]{6}$/.test(m) ? `#${m}` : `#${n.ctx.theme[n.ctx.clrMap[m] ?? m] ?? "4472C4"}`), a = {
    ctx: n.ctx,
    fonts: n.theme.fonts,
    chain: [n.docDefaults, n.masterStyles.other],
    defaultColor: "rgb(255,255,255)",
    slideNum: n.slideNum
  }, d = Lr(s, e.w, e.h, {
    family: xr(l),
    vertical: wr(l),
    colors: u,
    textOf: (m) => {
      const p = de(Sr(o, m), a);
      return p ? { ...p, anchor: "middle", paragraphs: p.paragraphs.map((b) => ({ ...b, align: "center" })) } : null;
    }
  });
  return d.length ? $r(d, { ...et(e), name: "SmartArt" }) : null;
}
function co(t, e) {
  if (!t) return null;
  const n = H(t, "tblStyle"), r = h(t, "def"), o = n.find((s) => h(s, "styleId") === e) ?? n.find((s) => h(s, "styleId") === r);
  return o ? {
    wholeTbl: f(o, "wholeTbl"),
    band1H: f(o, "band1H"),
    band2H: f(o, "band2H"),
    firstRow: f(o, "firstRow"),
    lastRow: f(o, "lastRow"),
    firstCol: f(o, "firstCol"),
    lastCol: f(o, "lastCol")
  } : null;
}
const ae = [
  ["l", "left", "lnL"],
  ["r", "right", "lnR"],
  ["t", "top", "lnT"],
  ["b", "bottom", "lnB"]
];
function ao(t, e) {
  const n = { fill: null, borders: {}, bold: !1, color: null };
  if (!t) return n;
  const r = f(t, "tcStyle");
  n.fill = Mt(f(r, "fill") ?? r, e);
  const o = f(r, "tcBdr");
  for (const [l, i] of ae) {
    const c = f(o, i);
    c && (n.borders[l] = Ft(f(c, "ln"), e, null));
  }
  const s = f(t, "tcTxStyle");
  return s && (n.bold = h(s, "b") === "on", n.color = q(s, e.ctx)), n;
}
function uo(t, e, n, r) {
  var g, k;
  const o = f(t, "tblPr"), s = ((k = (g = f(o, "tableStyleId")) == null ? void 0 : g.textContent) == null ? void 0 : k.trim()) ?? null, l = co(n.tableStyles, s), i = ot(o, "firstRow"), c = ot(o, "lastRow"), u = ot(o, "firstCol"), a = ot(o, "lastCol"), d = ot(o, "bandRow"), m = H(f(t, "tblGrid"), "gridCol").map((C) => j(v(C, "w"))), p = H(t, "tr"), b = p.map((C, x) => {
    const P = i && x === 0, E = c && x === p.length - 1, S = d ? i ? x - 1 : x : -1;
    return {
      height: j(v(C, "h")),
      cells: H(C, "tc").map((w, F) => {
        const y = u && F === 0, M = a && F === H(C, "tc").length - 1, T = [(l == null ? void 0 : l.wholeTbl) ?? null];
        S >= 0 && !P && !E && T.push(S % 2 === 0 ? (l == null ? void 0 : l.band1H) ?? null : (l == null ? void 0 : l.band2H) ?? null), y && T.push((l == null ? void 0 : l.firstCol) ?? null), M && T.push((l == null ? void 0 : l.lastCol) ?? null), P && T.push((l == null ? void 0 : l.firstRow) ?? null), E && T.push((l == null ? void 0 : l.lastRow) ?? null);
        let N = null;
        const I = {};
        let O = !1, z = null;
        for (const G of T) {
          const L = ao(G, n);
          L.fill && (N = L.fill);
          for (const [B] of ae) L.borders[B] !== void 0 && (I[B] = L.borders[B]);
          L.bold && (O = !0), L.color && (z = L.color);
        }
        const A = f(w, "tcPr"), U = Mt(A, n);
        U && (N = U);
        for (const [G, , L] of ae) {
          const B = f(A, L);
          B && (I[G] = Ft(B, n, null));
        }
        const D = de(f(w, "txBody"), {
          ctx: n.ctx,
          fonts: n.theme.fonts,
          chain: [n.docDefaults],
          slideNum: n.slideNum,
          defaultColor: z,
          resolveLink: (G, L) => me(n, G, L)
        });
        if (D && O)
          for (const G of D.paragraphs) for (const L of G.runs) L.b = !0;
        const W = (G, L) => {
          const B = v(A, G);
          return j(B === null ? L : B);
        };
        return {
          colSpan: v(w, "gridSpan") ?? 1,
          rowSpan: v(w, "rowSpan") ?? 1,
          merged: ot(w, "hMerge") || ot(w, "vMerge"),
          fill: N,
          text: D,
          borders: I,
          margins: [W("marT", 45720), W("marR", 91440), W("marB", 45720), W("marL", 91440)],
          vAlign: h(A, "anchor") === "ctr" ? "middle" : h(A, "anchor") === "b" ? "bottom" : "top",
          vert: h(A, "vert") === "vert" ? "vert" : h(A, "vert") === "vert270" ? "vert270" : void 0
        };
      })
    };
  });
  return { kind: "table", ...et(e), colWidths: m, rows: b, name: r };
}
function Je(t) {
  if (!t) return "";
  const e = [], n = t.getElementsByTagName("*");
  for (let r = 0; r < n.length; r++)
    n[r].localName === "t" ? e.push(n[r].textContent ?? "") : n[r].localName === "p" && e.length && e.push(`
`);
  return e.join("").replace(/\n+/g, `
`).trim();
}
function fo(t, e) {
  const n = /* @__PURE__ */ new Map();
  for (const r of Object.values(e)) {
    if (!/\/(commentAuthors|authors)$/.test(r.type)) continue;
    const o = t.xml(r.target);
    if (!o) continue;
    const s = o.getElementsByTagName("*");
    for (let l = 0; l < s.length; l++) {
      const i = s[l];
      if (i.localName !== "cmAuthor" && i.localName !== "author") continue;
      const c = h(i, "id"), u = h(i, "name");
      c === null || !u || n.set(c, { name: u, initials: h(i, "initials") ?? void 0 });
    }
  }
  return n;
}
function ho(t, e, n) {
  const r = [];
  for (const o of Object.values(e)) {
    if (!o.type.endsWith("/comments")) continue;
    const s = t.xml(o.target);
    if (s)
      for (const l of H(s, "cm")) {
        const i = h(l, "authorId") ?? "", c = n.get(i), u = f(l, "pos"), a = f(l, "text"), d = ((a == null ? void 0 : a.textContent) ?? Je(f(l, "txBody"))).trim(), m = v(l, "idx");
        r.push({
          author: (c == null ? void 0 : c.name) ?? (i ? `作者 ${i}` : "未知作者"),
          initials: c == null ? void 0 : c.initials,
          date: h(l, "dt") ?? h(l, "created") ?? void 0,
          text: d,
          x: j(v(u, "x")),
          y: j(v(u, "y")),
          idx: m !== null ? m : void 0
        });
      }
  }
  return r.sort((o, s) => (o.idx ?? 0) - (s.idx ?? 0)), r;
}
function mo(t, e) {
  const n = [], r = t.getElementsByTagName("*");
  for (let o = 0; o < r.length; o++)
    if (r[o].localName === "sectionLst") {
      for (const s of H(r[o], "section")) {
        const l = [], i = [];
        for (const c of H(f(s, "sldIdLst"), "sldId")) {
          const u = v(c, "id");
          if (u === null) continue;
          l.push(u);
          const a = e.get(u);
          a !== void 0 && i.push(a);
        }
        n.push({ name: h(s, "name") ?? `节 ${n.length + 1}`, slideIds: l, slideIndexes: i });
      }
      break;
    }
  return n;
}
function po(t, e, n) {
  var o;
  const r = [];
  for (const s of H(f(e, "embeddedFontLst"), "embeddedFont")) {
    const l = h(f(s, "font"), "typeface");
    if (l)
      for (const [i, c, u] of [["regular", !1, !1], ["bold", !0, !1], ["italic", !1, !0], ["boldItalic", !0, !0]]) {
        const a = h(f(s, i), "r:id"), d = a ? (o = n[a]) == null ? void 0 : o.target : null, m = d ? t.fontUrl(d) : null;
        m && r.push({ family: l, src: m, bold: c, italic: u });
      }
  }
  return r;
}
function Mo(t) {
  const e = new Ve(t);
  return e.assetMode = "defer", { presentation: tn(e, t, { lazy: !1 }), assets: e.deferred };
}
function Po(t, e = {}) {
  const n = new Ve(t);
  return e.assets === "defer" && (n.assetMode = "defer"), tn(n, t, e);
}
function tn(t, e, n) {
  var S;
  const r = "ppt/presentation.xml", o = t.xml(r);
  if (!o) throw new Error("无效的 .pptx：找不到 ppt/presentation.xml");
  const s = t.rels(r), l = f(o, "sldSz"), i = j(v(l, "cx") ?? 12192e3), c = j(v(l, "cy") ?? 6858e3), u = kt(s, "/tableStyles"), a = u ? t.xml(u) : null, d = { lvls: [] }, m = H(f(o, "sldIdLst"), "sldId"), p = {}, b = /* @__PURE__ */ new Map();
  m.forEach((w, F) => {
    var N;
    const y = h(w, "r:id"), M = y ? (N = s[y]) == null ? void 0 : N.target : null;
    M && (p[M] = F + 1);
    const T = v(w, "id");
    T !== null && b.set(T, F);
  });
  const g = fo(t, s), k = [];
  for (const w of m) {
    const F = h(w, "r:id"), y = F ? (S = s[F]) == null ? void 0 : S.target : null;
    y && k.push(y);
  }
  const C = (w, F) => ({
    background: { type: "solid", color: "rgb(255,255,255)" },
    elements: [{
      kind: "unsupported",
      x: i * 0.1,
      y: c * 0.4,
      w: i * 0.8,
      h: c * 0.2,
      rot: 0,
      flipH: !1,
      flipV: !1,
      label: `第 ${w + 1} 页解析失败：${F instanceof Error ? F.message : String(F)}`
    }]
  }), x = (w) => {
    try {
      return go(t, k[w], w + 1, o, d, a, p, g);
    } catch (F) {
      return C(w, F);
    }
  };
  let P;
  n.lazy === !1 ? P = k.map((w, F) => x(F)) : (P = new Array(k.length), k.forEach((w, F) => {
    let y;
    Object.defineProperty(P, F, {
      enumerable: !0,
      configurable: !0,
      get() {
        return y === void 0 && (y = x(F)), y;
      },
      set(M) {
        y = M;
      }
    });
  }));
  const E = mo(o, b);
  return {
    width: i,
    height: c,
    slides: P,
    source: "pptx",
    dispose: () => t.dispose(),
    embeddedFonts: po(t, o, s),
    sections: E.length ? E : void 0
  };
}
function go(t, e, n, r, o, s, l, i) {
  const c = t.xml(e), u = t.rels(e), a = kt(u, "/slideLayout"), d = a ? t.xml(a) : null, m = a ? t.rels(a) : {}, p = a ? kt(m, "/slideMaster") : null, b = p ? t.xml(p) : null, g = p ? t.rels(p) : {}, k = p ? kt(g, "/theme") : null, C = Br(k ? t.xml(k) : null), x = {}, P = f(b, "clrMap");
  if (P) for (const $ of Array.from(P.attributes)) x[$.localName] = $.value;
  const E = R(c, "clrMapOvr", "overrideClrMapping") ?? R(d, "clrMapOvr", "overrideClrMapping");
  if (E) for (const $ of Array.from(E.attributes)) x[$.localName] = $.value;
  const S = { theme: C.colors, clrMap: x };
  if (!o.def && !o.lvls.length) {
    const $ = St(f(r, "defaultTextStyle"), S, C.fonts);
    o.def = $.def, o.lvls = $.lvls;
  }
  const w = f(b, "txStyles"), F = {
    title: St(f(w, "titleStyle"), S, C.fonts),
    body: St(f(w, "bodyStyle"), S, C.fonts),
    other: St(f(w, "otherStyle"), S, C.fonts)
  }, y = R(b, "cSld", "spTree"), M = R(d, "cSld", "spTree"), T = R(c, "cSld", "spTree"), N = Ee(M), I = Ee(y), O = /* @__PURE__ */ new Set(), z = f(d, "hf") ?? f(b, "hf");
  z && (h(z, "sldNum") === "0" && O.add("sldNum"), h(z, "ftr") === "0" && O.add("ftr"), h(z, "dt") === "0" && O.add("dt"), h(z, "hdr") === "0" && O.add("hdr"));
  const A = ($, J) => ({
    pkg: t,
    ctx: S,
    theme: C,
    rels: $ ? t.rels($) : {},
    partPath: $ ?? "",
    docDefaults: o,
    masterStyles: F,
    layoutPh: J ? N : [],
    masterPh: J ? I : [],
    slideNum: n,
    tableStyles: s,
    hiddenPh: O,
    slideIdMap: l
  }), U = [];
  ot(c, "showMasterSp", !0) && ot(d, "showMasterSp", !0) && p && (U.push(...Pt(y, A(p, !1), !0)), U.push(...Pt(M, A(a, !1), !0))), U.push(...Pt(T, A(e, !0), !1));
  let W = null;
  for (const [$, J] of [[c, e], [d, a], [b, p]]) {
    const at = R($, "cSld", "bg");
    if (!at || !J) continue;
    const ht = A(J, !1), wt = f(at, "bgPr");
    if (wt)
      W = Mt(wt, ht);
    else {
      const bt = f(at, "bgRef");
      if (bt) {
        const Ct = Number(h(bt, "idx") ?? "0"), mt = q(bt, S), pt = C.bgFillStyles[Math.min(Ct, C.bgFillStyles.length) - 1] ?? null;
        W = pt ? he(pt, qe(ht, mt)) : mt ? { type: "solid", color: mt } : null;
      }
    }
    if (W) break;
  }
  const G = f(r, "sldSz"), L = j(v(G, "cx") ?? 12192e3), B = j(v(G, "cy") ?? 6858e3), Z = kt(u, "/notesSlide"), V = Z ? Je(R(t.xml(Z), "cSld", "spTree")) : "", _ = ho(t, u, i);
  return {
    background: W,
    elements: U,
    notes: V || void 0,
    comments: _.length ? _ : void 0,
    hidden: h(c, "show") === "0" || void 0,
    layoutName: h(R(d, "cSld"), "name") ?? void 0,
    transition: ke(c) ?? ke(d),
    animations: or(f(c, "timing"), L, B),
    mediaSettings: sourceMediaSettings(c)
  };
}
export {
  h as a,
  H as b,
  q as c,
  ot as d,
  j as e,
  wo as f,
  Co as g,
  ko as h,
  Fn as i,
  xo as j,
  f as k,
  So as l,
  zn as m,
  v as n,
  Mo as o,
  Po as p,
  Rn as s,
  yo as u,
  R as w,
  vo as z
};
