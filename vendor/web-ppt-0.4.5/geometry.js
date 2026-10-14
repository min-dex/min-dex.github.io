const a = (t) => Number.isFinite(t) ? String(Math.round(t * 1e3) / 1e3) : "0", F = (t) => t * Math.PI / 180, L = (t) => ({ d: t, open: !0 }), s = (t, n, r) => (t[n] ?? r) / 1e5, S = (t, n, r) => (t[n] ?? r) / 6e4;
function d(t, n = !0) {
  return t.length ? "M " + t.map(([r, $]) => `${a(r)} ${a($)}`).join(" L ") + (n ? " Z" : "") : "";
}
function j(t, n, r, $, o) {
  return [t + r * Math.cos(F(o)), n + $ * Math.sin(F(o))];
}
function A(t, n, r, $, o, e) {
  const c = Math.max(-359.99, Math.min(359.99, e)), [i, u] = j(t, n, r, $, o + c);
  return `A ${a(r)} ${a($)} 0 ${Math.abs(c) > 180 ? 1 : 0} ${c >= 0 ? 1 : 0} ${a(i)} ${a(u)}`;
}
function Y(t, n, r, $, o, e) {
  const [c, i] = j(t, n, r, $, o);
  return `M ${a(c)} ${a(i)} ${A(t, n, r, $, o, e)}`;
}
function f(t) {
  if (t.length < 2) return "";
  const n = t.slice(0, -1).reverse();
  return "M " + [...t, ...n].map(([r, $]) => `${a(r)} ${a($)}`).join(" L ");
}
function _(t, n, r, $) {
  return m(t, n, r, $) + " " + m(t, n, r, $, !0);
}
function m(t, n, r, $, o = !1) {
  const e = o ? -180 : 180;
  return `M ${a(t - r)} ${a(n)} ${A(t, n, r, $, 180, e)} ${A(t, n, r, $, 180 + e, e)} Z`;
}
function I(t, n) {
  return (r, $) => {
    const o = [];
    for (let e = 0; e < t; e++) o.push(j(r / 2, $ / 2, r / 2, $ / 2, n + 360 * e / t));
    return d(o);
  };
}
function B(t, n) {
  return (r, $, o) => {
    const e = o.adj !== void 0 ? o.adj / 1e5 : n, c = Math.min(0.95, Math.max(0.05, e)), i = [];
    for (let u = 0; u < t * 2; u++) {
      const M = u % 2 === 0 ? 1 : c;
      i.push(j(r / 2, $ / 2, r / 2 * M, $ / 2 * M, -90 + u * 180 / t));
    }
    return d(i);
  };
}
function W(t, n, r, $) {
  const o = [[0, 0], [t, 0], [t, n], [0, n]], e = [[1, 0], [0, 1], [-1, 0], [0, -1]], c = [];
  for (let i = 0; i < 4; i++) {
    const [u, M] = o[i], l = Math.max(0, r[i]), p = e[(i + 3) % 4], C = e[i], g = [u - p[0] * l, M - p[1] * l], b = [u + C[0] * l, M + C[1] * l];
    c.push(`${i === 0 ? "M" : "L"} ${a(g[0])} ${a(g[1])}`), l > 0 && c.push($[i] === "r" ? `A ${a(l)} ${a(l)} 0 0 1 ${a(b[0])} ${a(b[1])}` : `L ${a(b[0])} ${a(b[1])}`);
  }
  return c.join(" ") + " Z";
}
const v = (t, n, r) => ($, o, e) => {
  const c = n.map((i, u) => i ? Math.min($, o) * Math.min(s(e, i, r[u]), 0.5) : 0);
  return W($, o, c, t);
}, G = {
  r: ([t, n]) => [t, n],
  l: ([t, n], r) => [r - t, n],
  d: ([t, n]) => [n, t],
  u: ([t, n], r, $) => [n, $ - t]
};
function q(t) {
  return (n, r, $) => {
    const o = t === "r" || t === "l", e = o ? n : r, c = o ? r : n, i = c * Math.min(s($, "adj1", 5e4), 1) / 2, u = Math.min(e, c * s($, "adj2", 5e4)), M = c / 2, l = [
      [0, M - i],
      [e - u, M - i],
      [e - u, 0],
      [e, M],
      [e - u, c],
      [e - u, M + i],
      [0, M + i]
    ];
    return d(l.map((p) => G[t](p, n, r)));
  };
}
function O(t) {
  return (n, r, $) => {
    const o = t === "r" || t === "l", e = o ? n : r, c = o ? r : n, i = c * s($, "adj1", 18515) / 2, u = Math.min(e / 2, c * s($, "adj2", 18515)), M = Math.max(0, e - Math.max(u, e * (1 - s($, "adj4", 66667)))), l = c / 2, p = [
      [0, 0],
      [M, 0],
      [M, l - i],
      [e - u, l - i],
      [e - u, 0],
      [e, l],
      [e - u, c],
      [e - u, l + i],
      [M, l + i],
      [M, c],
      [0, c]
    ];
    return d(p.map((C) => G[t](C, n, r)));
  };
}
function Q(t, n, r) {
  return [t / 2 + t * s(r, "adj1", -20833), n / 2 + n * s(r, "adj2", 62500)];
}
function c0(t, n, r, $) {
  const o = [[t * 0.15, n]];
  return $ === 1 ? o.push([t * s(r, "adj2", -8333), n + n * s(r, "adj1", 18750)]) : (o.push([t * 0.05, n * 1.2]), o.push([t * s(r, "adj4", -16667), n + n * s(r, "adj3", 44444)]), $ >= 3 && o.push([t * s(r, "adj6", -16667) - t * 0.12, n + n * s(r, "adj5", 44444)])), " " + f(o);
}
function Z(t, n) {
  return (r, $, o) => d([[0, 0], [r, 0], [r, $], [0, $]]) + (n ? " " + f([[0, 0], [0, $]]) : "") + c0(r, $, o, t);
}
function z(t) {
  return (n, r) => {
    const $ = Math.min(Math.hypot(n, r) / 20, Math.min(n, r) / 2), o = (e, c, i, u) => {
      const [M, l] = [e + i * $, c], [p, C] = [e, c + u * $];
      if (t === "s") return d([[e, c], [M, l], [M, C], [p, C]]);
      const g = t === "q" ? i * u > 0 ? 1 : 0 : i * u > 0 ? 0 : 1;
      return `M ${a(e)} ${a(c)} L ${a(M)} ${a(l)} A ${a($)} ${a($)} 0 0 ${g} ${a(p)} ${a(C)} Z`;
    };
    return [
      o(0, 0, 1, 1),
      o(n, 0, -1, 1),
      o(n, r, -1, -1),
      o(0, r, 1, -1)
    ].join(" ");
  };
}
function E(t, n, r, $) {
  const o = n / 4;
  return $ ? `C ${a(n - o)} ${a(t + r)} ${a(o)} ${a(t - r)} 0 ${a(t)}` : `C ${a(o)} ${a(t - r)} ${a(o * 3)} ${a(t + r)} ${a(n)} ${a(t)}`;
}
function P(t, n, r, $, o, e, c, i, u = !1) {
  const M = i >= c ? 1 : -1, l = Math.max(1, Math.min(e, Math.min(r, $) - o - 1)), p = (r + $) / 2 - o / 2, C = Math.min(Math.abs(i - c) * (u ? 0.35 : 0.6), l / Math.max(p, 1) * (180 / Math.PI)), g = i - M * C, b = u ? c + M * C : c, k = g - b, [D, X] = j(t, n, r, $, b), [J, K] = j(t, n, r + l, $ + l, g), [V, x] = j(t, n, r - o / 2, $ - o / 2, i), [y, h] = j(t, n, r - o - l, $ - o - l, g), [w, t0] = j(t, n, r - o, $ - o, g);
  let U = "";
  if (u) {
    const [n0, $0] = j(t, n, r - o - l, $ - o - l, b), [a0, o0] = j(t, n, r - o / 2, $ - o / 2, c), [r0, e0] = j(t, n, r + l, $ + l, b);
    U = `L ${a(n0)} ${a($0)} L ${a(a0)} ${a(o0)} L ${a(r0)} ${a(e0)} `;
  }
  return `M ${a(D)} ${a(X)} ${A(t, n, r, $, b, k)} L ${a(J)} ${a(K)} L ${a(V)} ${a(x)} L ${a(y)} ${a(h)} L ${a(w)} ${a(t0)} ${A(t, n, r - o, $ - o, g, -k)} ${U}Z`;
}
function H(t, n, r) {
  const $ = t / 2, o = n / 2, e = Math.min(t, n) / 2, c = e * 0.78, i = 360 / r, u = [];
  for (let M = 0; M < r; M++) {
    const l = M * i;
    u.push(j($, o, c, c, l - i * 0.28)), u.push(j($, o, e, e, l - i * 0.16)), u.push(j($, o, e, e, l + i * 0.16)), u.push(j($, o, c, c, l + i * 0.28));
  }
  return d(u) + " " + m($, o, e * 0.36, e * 0.36, !0);
}
function N(t, n, r) {
  return d([[0, 0], [t, 0], [t, n], [0, n]]) + " " + f([[r, r], [t - r, r], [t - r, n - r], [r, n - r], [r, r]]);
}
function R(t, n, r) {
  const $ = Math.min(t, n) * 0.125;
  return N(t, n, $) + " " + r(Math.min(t, n) * 0.24, t / 2, n / 2);
}
const T = {
  // 矩形族
  rect: (t, n) => d([[0, 0], [t, 0], [t, n], [0, n]]),
  roundRect: v(["r", "r", "r", "r"], ["adj", "adj", "adj", "adj"], [16667, 16667, 16667, 16667]),
  round1Rect: v(["n", "r", "n", "n"], [null, "adj", null, null], [0, 16667, 0, 0]),
  round2SameRect: v(["r", "r", "r", "r"], ["adj1", "adj1", "adj2", "adj2"], [16667, 16667, 0, 0]),
  round2DiagRect: v(["r", "r", "r", "r"], ["adj1", "adj2", "adj1", "adj2"], [16667, 0, 16667, 0]),
  snip1Rect: v(["n", "s", "n", "n"], [null, "adj", null, null], [0, 16667, 0, 0]),
  snip2SameRect: v(["s", "s", "s", "s"], ["adj1", "adj1", "adj2", "adj2"], [16667, 16667, 0, 0]),
  snip2DiagRect: v(["s", "s", "s", "s"], ["adj1", "adj2", "adj1", "adj2"], [0, 16667, 0, 16667]),
  snipRoundRect: v(["r", "s", "n", "n"], ["adj1", "adj2", null, null], [16667, 16667, 0, 0]),
  plaque: (t, n, r) => {
    const $ = Math.min(t, n) * Math.min(s(r, "adj", 16667), 0.5);
    return `M ${a($)} 0 L ${a(t - $)} 0 A ${a($)} ${a($)} 0 0 0 ${a(t)} ${a($)} L ${a(t)} ${a(n - $)} A ${a($)} ${a($)} 0 0 0 ${a(t - $)} ${a(n)} L ${a($)} ${a(n)} A ${a($)} ${a($)} 0 0 0 0 ${a(n - $)} L 0 ${a($)} A ${a($)} ${a($)} 0 0 0 ${a($)} 0 Z`;
  },
  bevel: (t, n, r) => N(t, n, Math.min(t, n) * Math.min(s(r, "adj", 12500), 0.5)),
  // 四角装饰片：无调节值，尺寸由对角线长度决定
  cornerTabs: z("q"),
  squareTabs: z("s"),
  plaqueTabs: z("c"),
  frame: (t, n, r) => {
    const $ = Math.min(t, n) * Math.min(s(r, "adj1", 12500), 0.5);
    return d([[0, 0], [t, 0], [t, n], [0, n]]) + " " + d([[$, $], [$, n - $], [t - $, n - $], [t - $, $]]);
  },
  halfFrame: (t, n, r) => {
    const $ = Math.min(t, n) * s(r, "adj1", 33333), o = Math.min(t, n) * s(r, "adj2", 33333);
    return d([[0, 0], [t, 0], [t - o, $], [o, $], [o, n - $], [0, n]]);
  },
  corner: (t, n, r) => {
    const $ = Math.min(t, n) * s(r, "adj1", 5e4), o = Math.min(t, n) * s(r, "adj2", 5e4);
    return d([[0, 0], [o, 0], [o, n - $], [t, n - $], [t, n], [0, n]]);
  },
  diagStripe: (t, n, r) => {
    const $ = Math.min(s(r, "adj", 5e4), 1);
    return d([[0, n * (1 - $)], [t * (1 - $), 0], [t, 0], [0, n]]);
  },
  foldedCorner: (t, n, r) => {
    const $ = Math.min(t, n) * s(r, "adj", 16667);
    return d([[0, 0], [t, 0], [t, n - $], [t - $, n], [0, n]]) + ` M ${a(t - $)} ${a(n)} L ${a(t - $ * 0.72)} ${a(n - $ * 0.72)} L ${a(t)} ${a(n - $)} Z`;
  },
  // 基本形
  ellipse: (t, n) => m(t / 2, n / 2, t / 2, n / 2),
  triangle: (t, n, r) => d([[t * s(r, "adj", 5e4), 0], [t, n], [0, n]]),
  rtTriangle: (t, n) => d([[0, 0], [t, n], [0, n]]),
  diamond: (t, n) => d([[t / 2, 0], [t, n / 2], [t / 2, n], [0, n / 2]]),
  parallelogram: (t, n, r) => {
    const $ = Math.min(t, Math.min(t, n) * s(r, "adj", 25e3));
    return d([[$, 0], [t, 0], [t - $, n], [0, n]]);
  },
  trapezoid: (t, n, r) => {
    const $ = Math.min(t / 2, Math.min(t, n) * s(r, "adj", 25e3));
    return d([[$, 0], [t - $, 0], [t, n], [0, n]]);
  },
  nonIsoscelesTrapezoid: (t, n, r) => d([[t * s(r, "adj1", 25e3), 0], [t - t * s(r, "adj2", 25e3), 0], [t, n], [0, n]]),
  pentagon: I(5, -90),
  heptagon: I(7, -90),
  decagon: I(10, -90),
  dodecagon: I(12, -90),
  hexagon: (t, n, r) => {
    const $ = Math.min(t / 2, Math.min(t, n) * s(r, "adj", 25e3));
    return d([[$, 0], [t - $, 0], [t, n / 2], [t - $, n], [$, n], [0, n / 2]]);
  },
  octagon: (t, n, r) => {
    const $ = Math.min(Math.min(t, n) / 2, Math.min(t, n) * s(r, "adj", 29289));
    return d([[$, 0], [t - $, 0], [t, $], [t, n - $], [t - $, n], [$, n], [0, n - $], [0, $]]);
  },
  homePlate: (t, n, r) => {
    const $ = Math.min(t, Math.min(t, n) * s(r, "adj", 5e4));
    return d([[0, 0], [t - $, 0], [t, n / 2], [t - $, n], [0, n]]);
  },
  chevron: (t, n, r) => {
    const $ = Math.min(t, Math.min(t, n) * s(r, "adj", 5e4));
    return d([[0, 0], [t - $, 0], [t, n / 2], [t - $, n], [0, n], [$, n / 2]]);
  },
  plus: (t, n, r) => {
    const $ = Math.min(t, n) * Math.min(s(r, "adj", 25e3), 0.5);
    return d([
      [$, 0],
      [t - $, 0],
      [t - $, $],
      [t, $],
      [t, n - $],
      [t - $, n - $],
      [t - $, n],
      [$, n],
      [$, n - $],
      [0, n - $],
      [0, $],
      [$, $]
    ]);
  },
  teardrop: (t, n, r) => {
    const $ = Math.max(0, s(r, "adj", 1e5)), o = Math.SQRT1_2 + $ * (1 - Math.SQRT1_2), e = t / 2, c = n / 2;
    return `M 0 ${a(c)} ${A(e, c, t / 2, n / 2, 180, 90)} L ${a(e + t / 2 * o)} ${a(c - n / 2 * o)} L ${a(t)} ${a(c)} ${A(e, c, t / 2, n / 2, 0, 180)} Z`;
  },
  can: (t, n, r) => {
    const $ = Math.min(n / 2, n * s(r, "adj", 25e3) / 2);
    return `M 0 ${a($)} ${A(t / 2, $, t / 2, $, 180, 180)} L ${a(t)} ${a(n - $)} ${A(t / 2, n - $, t / 2, $, 0, 180)} Z ` + _(t / 2, $, t / 2, $);
  },
  cube: (t, n, r) => {
    const $ = Math.min(t, n) * Math.min(s(r, "adj", 25e3), 0.5);
    return d([[0, $], [$, 0], [t, 0], [t, n - $], [t - $, n], [0, n]]) + " " + f([[0, $], [t - $, $], [t, 0]]) + " " + f([[t - $, $], [t - $, n]]);
  },
  donut: (t, n, r) => {
    const $ = Math.min(t, n) * Math.min(s(r, "adj", 25e3), 0.5);
    return m(t / 2, n / 2, t / 2, n / 2) + " " + m(t / 2, n / 2, t / 2 - $, n / 2 - $, !0);
  },
  noSmoking: (t, n, r) => {
    const $ = Math.min(t, n) * Math.min(s(r, "adj", 18750), 0.5), o = t / 2 - $, e = n / 2 - $, c = t / 2, i = n / 2, u = $ / 2, M = Math.cos(F(-45)), l = Math.sin(F(-45)), p = -l, C = M, [g, b] = [c - M * o, i - l * e], [k, D] = [c + M * o, i + l * e], X = d([
      [g + p * u, b + C * u],
      [k + p * u, D + C * u],
      [k - p * u, D - C * u],
      [g - p * u, b - C * u]
    ]);
    return m(c, i, t / 2, n / 2) + " " + m(c, i, o, e, !0) + " " + X;
  },
  pie: (t, n, r) => {
    const $ = S(r, "adj1", 0), o = ((S(r, "adj2", 270 * 6e4) - $) % 360 + 360) % 360, [e, c] = j(t / 2, n / 2, t / 2, n / 2, $);
    return `M ${a(t / 2)} ${a(n / 2)} L ${a(e)} ${a(c)} ${A(t / 2, n / 2, t / 2, n / 2, $, o)} Z`;
  },
  // 固定 90° 扇形：圆心在右下角，从 180° 顺时针扫到 270°
  pieWedge: (t, n) => `M 0 ${a(n)} ${A(t, n, t, n, 180, 90)} L ${a(t)} ${a(n)} Z`,
  chord: (t, n, r) => {
    const $ = S(r, "adj1", 27e5), o = ((S(r, "adj2", 270 * 6e4) - $) % 360 + 360) % 360;
    return Y(t / 2, n / 2, t / 2, n / 2, $, o) + " Z";
  },
  arc: (t, n, r) => {
    const $ = S(r, "adj1", 162e5), o = ((S(r, "adj2", 0) - $) % 360 + 360) % 360;
    return L(Y(t / 2, n / 2, t / 2, n / 2, $, o));
  },
  blockArc: (t, n, r) => {
    const $ = S(r, "adj1", 108e5), o = ((S(r, "adj2", 0) - $) % 360 + 360) % 360, e = Math.min(t, n) * Math.min(s(r, "adj3", 25e3), 0.5), [c, i] = j(t / 2, n / 2, t / 2 - e, n / 2 - e, $ + o);
    return Y(t / 2, n / 2, t / 2, n / 2, $, o) + ` L ${a(c)} ${a(i)} ${A(t / 2, n / 2, t / 2 - e, n / 2 - e, $ + o, -o)} Z`;
  },
  cloud: (t, n) => {
    const r = (e) => e * t, $ = (e) => e * n, o = (e, c, i, u, M, l) => `C ${a(r(e))} ${a($(c))} ${a(r(i))} ${a($(u))} ${a(r(M))} ${a($(l))} `;
    return `M ${a(r(0.2))} ${a($(0.79))} ` + o(0.06, 0.79, 0, 0.66, 0.07, 0.55) + o(0, 0.43, 0.1, 0.31, 0.22, 0.34) + o(0.25, 0.16, 0.44, 0.09, 0.56, 0.19) + o(0.65, 0.05, 0.86, 0.09, 0.88, 0.26) + o(1, 0.3, 1.01, 0.48, 0.92, 0.56) + o(1, 0.69, 0.9, 0.83, 0.76, 0.79) + o(0.68, 0.91, 0.5, 0.93, 0.42, 0.84) + o(0.36, 0.91, 0.25, 0.89, 0.2, 0.79) + "Z";
  },
  heart: (t, n) => {
    const r = (o) => o * t, $ = (o) => o * n;
    return `M ${a(r(0.5))} ${a($(1))} C ${a(r(-0.06))} ${a($(0.53))} ${a(r(0.08))} ${a($(-0.11))} ${a(r(0.5))} ${a($(0.25))} C ${a(r(0.92))} ${a($(-0.11))} ${a(r(1.06))} ${a($(0.53))} ${a(r(0.5))} ${a($(1))} Z`;
  },
  lightningBolt: (t, n) => d([[0.55, 0], [1, 0.55], [0.68, 0.55], [0.8, 1], [0, 0.42], [0.42, 0.42]].map(([r, $]) => [r * t, $ * n])),
  sun: (t, n, r) => {
    const $ = Math.min(s(r, "adj", 25e3), 0.45), o = t / 2, e = n / 2, c = o * (1 - $ * 1.4), i = e * (1 - $ * 1.4), u = [];
    for (let M = 0; M < 8; M++) {
      const l = M * 45, [p, C] = j(o, e, c, i, l - 9), [g, b] = j(o, e, o, e, l), [k, D] = j(o, e, c, i, l + 9);
      u.push(`M ${a(p)} ${a(C)} L ${a(g)} ${a(b)} L ${a(k)} ${a(D)} Z`);
    }
    return m(o, e, c, i) + " " + u.join(" ");
  },
  moon: (t, n, r) => {
    const $ = s(r, "adj", 5e4);
    return `M ${a(t)} 0 C ${a(t * (1 - $ * 1.6))} ${a(n * 0.15)} ${a(t * (1 - $ * 1.6))} ${a(n * 0.85)} ${a(t)} ${a(n)} C ${a(t * 0.1)} ${a(n * 0.92)} ${a(t * 0.1)} ${a(n * 0.08)} ${a(t)} 0 Z`;
  },
  smileyFace: (t, n, r) => {
    const $ = n * s(r, "adj", 4653) * 2;
    return m(t / 2, n / 2, t / 2, n / 2) + " " + m(t * 0.32, n * 0.35, t * 0.055, n * 0.08, !0) + " " + m(t * 0.68, n * 0.35, t * 0.055, n * 0.08, !0) + ` M ${a(t * 0.26)} ${a(n * 0.63)} Q ${a(t * 0.5)} ${a(n * 0.85 + $)} ${a(t * 0.74)} ${a(n * 0.63)} Q ${a(t * 0.5)} ${a(n * 0.85 + $)} ${a(t * 0.26)} ${a(n * 0.63)}`;
  },
  irregularSeal1: (t, n) => d([
    [0.09, 0.28],
    [0.24, 0.35],
    [0.13, 0.09],
    [0.35, 0.26],
    [0.42, 0],
    [0.53, 0.24],
    [0.72, 0.06],
    [0.7, 0.31],
    [0.93, 0.24],
    [0.81, 0.45],
    [1, 0.53],
    [0.83, 0.64],
    [0.96, 0.83],
    [0.73, 0.79],
    [0.75, 1],
    [0.56, 0.86],
    [0.45, 1],
    [0.38, 0.83],
    [0.19, 0.94],
    [0.23, 0.72],
    [0, 0.75],
    [0.16, 0.58],
    [0, 0.45]
  ].map(([r, $]) => [r * t, $ * n])),
  irregularSeal2: (t, n) => d([
    [0.11, 0.32],
    [0.25, 0.28],
    [0.15, 0.11],
    [0.36, 0.2],
    [0.4, 0.02],
    [0.55, 0.17],
    [0.68, 0],
    [0.71, 0.2],
    [0.9, 0.14],
    [0.85, 0.36],
    [1, 0.42],
    [0.86, 0.55],
    [0.98, 0.72],
    [0.79, 0.72],
    [0.82, 0.93],
    [0.63, 0.82],
    [0.55, 1],
    [0.44, 0.85],
    [0.28, 0.96],
    [0.28, 0.76],
    [0.06, 0.8],
    [0.17, 0.62],
    [0, 0.5]
  ].map(([r, $]) => [r * t, $ * n])),
  gear6: (t, n) => H(t, n, 6),
  gear9: (t, n) => H(t, n, 9),
  funnel: (t, n) => {
    const r = n * 0.1;
    return `M 0 ${a(r)} ${A(t / 2, r, t / 2, r, 180, 180)} L ${a(t * 0.56)} ${a(n * 0.72)} L ${a(t * 0.56)} ${a(n)} L ${a(t * 0.44)} ${a(n)} L ${a(t * 0.44)} ${a(n * 0.72)} Z`;
  },
  // 星形
  star4: B(4, 0.3),
  star5: B(5, 0.382),
  star6: B(6, 0.577),
  star7: B(7, 0.605),
  star8: B(8, 0.375),
  star10: B(10, 0.618),
  star12: B(12, 0.5),
  star16: B(16, 0.375),
  star24: B(24, 0.375),
  star32: B(32, 0.375),
  // 箭头
  rightArrow: q("r"),
  leftArrow: q("l"),
  upArrow: q("u"),
  downArrow: q("d"),
  leftRightArrow: (t, n, r) => {
    const $ = n * Math.min(s(r, "adj1", 5e4), 1) / 2, o = Math.min(t / 2, n * s(r, "adj2", 5e4)), e = n / 2;
    return d([
      [0, e],
      [o, 0],
      [o, e - $],
      [t - o, e - $],
      [t - o, 0],
      [t, e],
      [t - o, n],
      [t - o, e + $],
      [o, e + $],
      [o, n]
    ]);
  },
  upDownArrow: (t, n, r) => {
    const $ = t * Math.min(s(r, "adj1", 5e4), 1) / 2, o = Math.min(n / 2, t * s(r, "adj2", 5e4)), e = t / 2;
    return d([
      [e, 0],
      [t, o],
      [e + $, o],
      [e + $, n - o],
      [t, n - o],
      [e, n],
      [0, n - o],
      [e - $, n - o],
      [e - $, o],
      [0, o]
    ]);
  },
  quadArrow: (t, n, r) => {
    const $ = Math.min(t, n) * s(r, "adj2", 22500) / 2, o = Math.min(t, n) * s(r, "adj3", 25e3), e = t / 2, c = n / 2;
    return d([
      [e, 0],
      [e + o, o],
      [e + $, o],
      [e + $, c - $],
      [t - o, c - $],
      [t - o, c - o],
      [t, c],
      [t - o, c + o],
      [t - o, c + $],
      [e + $, c + $],
      [e + $, n - o],
      [e + o, n - o],
      [e, n],
      [e - o, n - o],
      [e - $, n - o],
      [e - $, c + $],
      [o, c + $],
      [o, c + o],
      [0, c],
      [o, c - o],
      [o, c - $],
      [e - $, c - $],
      [e - $, o],
      [e - o, o]
    ]);
  },
  leftRightUpArrow: (t, n, r) => {
    const $ = Math.min(t, n) * s(r, "adj2", 22500) / 2, o = Math.min(t, n) * s(r, "adj3", 25e3), e = t / 2, c = n - $;
    return d([
      [e, 0],
      [e + o, o],
      [e + $, o],
      [e + $, c - $],
      [t - o, c - $],
      [t - o, c - o],
      [t, c],
      [t - o, c + o],
      [t - o, n],
      [o, n],
      [o, c + o],
      [0, c],
      [o, c - o],
      [o, c - $],
      [e - $, c - $],
      [e - $, o],
      [e - o, o]
    ]);
  },
  bentUpArrow: (t, n, r) => {
    const $ = Math.min(t, n) * Math.min(s(r, "adj3", 25e3), 0.6), o = Math.min(t / 2, Math.max(Math.min(t, n) * s(r, "adj1", 25e3), $ * 0.6)), e = Math.min(n, Math.min(t, n) * s(r, "adj2", 25e3)), c = t - o;
    return d([
      [0, n],
      [c + $ / 2, n],
      [c + $ / 2, e],
      [t, e],
      [c, 0],
      [c - o, e],
      [c - $ / 2, e],
      [c - $ / 2, n - $],
      [0, n - $]
    ]);
  },
  leftUpArrow: (t, n, r) => {
    const $ = Math.min(t, n), o = $ * Math.min(s(r, "adj1", 25e3), 0.6), e = Math.min($ / 2, Math.max($ * s(r, "adj2", 25e3), o * 0.6)), c = Math.min($, $ * s(r, "adj3", 25e3));
    return d([
      [t - e, 0],
      [t, c],
      [t - e + o / 2, c],
      [t - e + o / 2, n],
      [c, n],
      [0, n - e],
      [c, n - 2 * e],
      [c, n - e - o / 2],
      [t - e - o / 2, n - e - o / 2],
      [t - e - o / 2, c],
      [t - 2 * e, c]
    ]);
  },
  bentArrow: (t, n, r) => {
    const $ = Math.min(t, n) * s(r, "adj1", 25e3), o = Math.min(Math.min(t, n) * s(r, "adj2", 25e3), n / 2), e = o;
    return d([
      [0, n],
      [0, e - $ / 2],
      [t - o, e - $ / 2],
      [t - o, e - o],
      [t, e],
      [t - o, e + o],
      [t - o, e + $ / 2],
      [$, e + $ / 2],
      [$, n]
    ]);
  },
  uturnArrow: (t, n, r) => {
    const $ = Math.min(t / 3, t * Math.max(s(r, "adj1", 25e3), 0.08)), o = $ / 2, e = Math.min($ * 1.1, t / 4), c = Math.min(n / 3, e * 1.6), i = t - e, u = (i + o) / 2, M = Math.min(u, n - c - 4);
    return `M 0 ${a(n)} L 0 ${a(M)} A ${a(u)} ${a(M)} 0 0 1 ${a(u * 2)} ${a(M)} L ${a(i + o)} ${a(n - c)} L ${a(i + e)} ${a(n - c)} L ${a(i)} ${a(n)} L ${a(i - e)} ${a(n - c)} L ${a(i - o)} ${a(n - c)} L ${a(i - o)} ${a(M)} A ${a(u - $)} ${a(M - $)} 0 0 0 ${a($)} ${a(M)} L ${a($)} ${a(n)} Z`;
  },
  curvedRightArrow: (t, n, r) => {
    const $ = n * Math.min(s(r, "adj1", 25e3), 0.5), o = Math.min(t, n) * Math.min(s(r, "adj3", 25e3), 0.4);
    return P(0, n, t - o, n - o, $, o, 270, 360);
  },
  curvedLeftArrow: (t, n, r) => {
    const $ = n * Math.min(s(r, "adj1", 25e3), 0.5), o = Math.min(t, n) * Math.min(s(r, "adj3", 25e3), 0.4);
    return P(t, n, t - o, n - o, $, o, 270, 180);
  },
  curvedUpArrow: (t, n, r) => {
    const $ = t * Math.min(s(r, "adj1", 25e3), 0.5), o = Math.min(t, n) * Math.min(s(r, "adj3", 25e3), 0.4);
    return P(t, n, t - o, n - o, $, o, 180, 270);
  },
  curvedDownArrow: (t, n, r) => {
    const $ = t * Math.min(s(r, "adj1", 25e3), 0.5), o = Math.min(t, n) * Math.min(s(r, "adj3", 25e3), 0.4);
    return P(t, 0, t - o, n - o, $, o, 180, 90);
  },
  stripedRightArrow: (t, n, r) => {
    const $ = n * Math.min(s(r, "adj1", 5e4), 1) / 2, o = Math.min(t, n * s(r, "adj2", 5e4)), e = n / 2, c = t * 0.05;
    return d([[c * 2.4, e - $], [t - o, e - $], [t - o, 0], [t, e], [t - o, n], [t - o, e + $], [c * 2.4, e + $]]) + " " + d([[0, e - $], [c, e - $], [c, e + $], [0, e + $]]) + " " + d([[c * 1.4, e - $], [c * 2, e - $], [c * 2, e + $], [c * 1.4, e + $]]);
  },
  notchedRightArrow: (t, n, r) => {
    const $ = n * Math.min(s(r, "adj1", 5e4), 1) / 2, o = Math.min(t, n * s(r, "adj2", 5e4)), e = n / 2;
    return d([
      [0, e - $],
      [t - o, e - $],
      [t - o, 0],
      [t, e],
      [t - o, n],
      [t - o, e + $],
      [0, e + $],
      [o * 0.5, e]
    ]);
  },
  circularArrow: (t, n, r) => {
    const $ = Math.min(t, n) / 2, o = $ * Math.min(Math.max(s(r, "adj1", 12500), 0.06), 0.35), e = o * 1.6, c = $ - e;
    return P(t / 2, n / 2, c, c, o, e, 200, 450);
  },
  leftCircularArrow: (t, n, r) => {
    const $ = Math.min(t, n) / 2, o = $ * Math.min(Math.max(s(r, "adj1", 12500), 0.06), 0.35), e = o * 1.6;
    return P(t / 2, n / 2, $ - e, $ - e, o, e, -20, -270);
  },
  leftRightCircularArrow: (t, n, r) => {
    const $ = Math.min(t, n) / 2, o = $ * Math.min(Math.max(s(r, "adj1", 12500), 0.06), 0.35), e = o * 1.6;
    return P(t / 2, n / 2, $ - e, $ - e, o, e, 200, 430, !0);
  },
  swooshArrow: (t, n, r) => {
    const $ = Math.min(t, n), o = $ * Math.min(Math.max(s(r, "adj2", 16667), 0.04), 0.4), e = $ * Math.min(Math.max(s(r, "adj1", 25e3), 0.08), 0.6), c = o * 1.6;
    return `M 0 ${a(n)} Q ${a(t * 0.65)} ${a(n * 0.95)} ${a(t - e * 1.2)} ${a(e * 0.1)} L ${a(t)} 0 L ${a(t - e * 0.1)} ${a(e * 1.2)} Q ${a(t * 0.65 - c)} ${a(n * 0.95 - c)} 0 ${a(n)} Z`;
  },
  rightArrowCallout: O("r"),
  leftArrowCallout: O("l"),
  upArrowCallout: O("u"),
  downArrowCallout: O("d"),
  leftRightArrowCallout: (t, n, r) => {
    const $ = n * s(r, "adj1", 18515) / 2, o = Math.min(t / 3, n * s(r, "adj2", 18515)), e = t * s(r, "adj4", 48123), c = n / 2, i = (t - e) / 2, u = (t + e) / 2;
    return d([
      [0, c],
      [o, 0],
      [o, c - $],
      [i, c - $],
      [i, 0],
      [u, 0],
      [u, c - $],
      [t - o, c - $],
      [t - o, 0],
      [t, c],
      [t - o, n],
      [t - o, c + $],
      [u, c + $],
      [u, n],
      [i, n],
      [i, c + $],
      [o, c + $],
      [o, n]
    ]);
  },
  upDownArrowCallout: (t, n, r) => {
    const $ = t * s(r, "adj1", 18515) / 2, o = Math.min(t / 2, $ + t * s(r, "adj2", 18515)), e = Math.min(n * 0.3, t * s(r, "adj3", 18515)), c = Math.max(0, Math.min(n * s(r, "adj4", 48123), n - 2.4 * e)), i = t / 2, u = (n - c) / 2, M = (n + c) / 2;
    return d([
      [i, 0],
      [i + o, e],
      [i + $, e],
      [i + $, u],
      [t, u],
      [t, M],
      [i + $, M],
      [i + $, n - e],
      [i + o, n - e],
      [i, n],
      [i - o, n - e],
      [i - $, n - e],
      [i - $, M],
      [0, M],
      [0, u],
      [i - $, u],
      [i - $, e],
      [i - o, e]
    ]);
  },
  quadArrowCallout: (t, n, r) => {
    const $ = Math.min(t, n), o = $ * s(r, "adj3", 18515), e = $ * s(r, "adj2", 18515) / 2, c = Math.min(Math.max($ * s(r, "adj4", 48123) / 2, e * 1.2), $ / 2 - o), i = t / 2, u = n / 2;
    return d([
      [i, 0],
      [i + o, o],
      [i + e, o],
      [i + e, u - c],
      [i + c, u - c],
      [i + c, u - e],
      [t - o, u - e],
      [t - o, u - o],
      [t, u],
      [t - o, u + o],
      [t - o, u + e],
      [i + c, u + e],
      [i + c, u + c],
      [i + e, u + c],
      [i + e, n - o],
      [i + o, n - o],
      [i, n],
      [i - o, n - o],
      [i - e, n - o],
      [i - e, u + c],
      [i - c, u + c],
      [i - c, u + e],
      [o, u + e],
      [o, u + o],
      [0, u],
      [o, u - o],
      [o, u - e],
      [i - c, u - e],
      [i - c, u - c],
      [i - e, u - c],
      [i - e, o],
      [i - o, o]
    ]);
  },
  // 数学符号
  mathPlus: (t, n, r) => {
    const $ = Math.min(t, n) * s(r, "adj1", 23520) / 2, o = t / 2, e = n / 2, c = t * 0.45, i = n * 0.45;
    return d([
      [o - $, e - i],
      [o + $, e - i],
      [o + $, e - $],
      [o + c, e - $],
      [o + c, e + $],
      [o + $, e + $],
      [o + $, e + i],
      [o - $, e + i],
      [o - $, e + $],
      [o - c, e + $],
      [o - c, e - $],
      [o - $, e - $]
    ]);
  },
  mathMinus: (t, n, r) => {
    const $ = Math.min(t, n) * s(r, "adj1", 23520) / 2;
    return d([[t * 0.05, n / 2 - $], [t * 0.95, n / 2 - $], [t * 0.95, n / 2 + $], [t * 0.05, n / 2 + $]]);
  },
  mathMultiply: (t, n, r) => {
    const $ = Math.min(t, n) * s(r, "adj1", 23520) / 2, o = t / 2, e = n / 2, c = Math.min(t, n) * 0.42, i = $ * Math.SQRT2;
    return d([
      [o - c, e - c + i],
      [o - c + i, e - c],
      [o, e - i],
      [o + c - i, e - c],
      [o + c, e - c + i],
      [o + i, e],
      [o + c, e + c - i],
      [o + c - i, e + c],
      [o, e + i],
      [o - c + i, e + c],
      [o - c, e + c - i],
      [o - i, e]
    ]);
  },
  mathDivide: (t, n, r) => {
    const $ = Math.min(t, n) * s(r, "adj1", 23520) / 2, o = Math.min(t, n) * 0.09;
    return d([[t * 0.08, n / 2 - $], [t * 0.92, n / 2 - $], [t * 0.92, n / 2 + $], [t * 0.08, n / 2 + $]]) + " " + m(t / 2, n * 0.22, o, o) + " " + m(t / 2, n * 0.78, o, o);
  },
  mathEqual: (t, n, r) => {
    const $ = Math.min(t, n) * s(r, "adj1", 23520) / 2, o = n * s(r, "adj2", 11760);
    return d([[t * 0.05, n / 2 - o - $], [t * 0.95, n / 2 - o - $], [t * 0.95, n / 2 - o + $], [t * 0.05, n / 2 - o + $]]) + " " + d([[t * 0.05, n / 2 + o - $], [t * 0.95, n / 2 + o - $], [t * 0.95, n / 2 + o + $], [t * 0.05, n / 2 + o + $]]);
  },
  mathNotEqual: (t, n, r) => {
    const $ = Math.min(t, n) * s(r, "adj1", 23520) / 2, o = n * 0.16;
    return d([[t * 0.05, n / 2 - o - $], [t * 0.95, n / 2 - o - $], [t * 0.95, n / 2 - o + $], [t * 0.05, n / 2 - o + $]]) + " " + d([[t * 0.05, n / 2 + o - $], [t * 0.95, n / 2 + o - $], [t * 0.95, n / 2 + o + $], [t * 0.05, n / 2 + o + $]]) + " " + d([[t * 0.42, 0], [t * 0.56, 0], [t * 0.62, n], [t * 0.48, n]]);
  },
  // 括号
  leftBracket: (t, n, r) => {
    const $ = Math.min(n / 2, n * s(r, "adj", 8333));
    return L(`M ${a(t)} 0 L ${a($)} 0 A ${a($)} ${a($)} 0 0 0 0 ${a($)} L 0 ${a(n - $)} A ${a($)} ${a($)} 0 0 0 ${a($)} ${a(n)} L ${a(t)} ${a(n)}`);
  },
  rightBracket: (t, n, r) => {
    const $ = Math.min(n / 2, n * s(r, "adj", 8333));
    return L(`M 0 0 L ${a(t - $)} 0 A ${a($)} ${a($)} 0 0 1 ${a(t)} ${a($)} L ${a(t)} ${a(n - $)} A ${a($)} ${a($)} 0 0 1 ${a(t - $)} ${a(n)} L 0 ${a(n)}`);
  },
  bracketPair: (t, n, r) => {
    const $ = Math.min(Math.min(t, n) / 2, Math.min(t, n) * s(r, "adj", 16667));
    return L(
      `M ${a($)} 0 A ${a($)} ${a($)} 0 0 0 0 ${a($)} L 0 ${a(n - $)} A ${a($)} ${a($)} 0 0 0 ${a($)} ${a(n)} M ${a(t - $)} 0 A ${a($)} ${a($)} 0 0 1 ${a(t)} ${a($)} L ${a(t)} ${a(n - $)} A ${a($)} ${a($)} 0 0 1 ${a(t - $)} ${a(n)}`
    );
  },
  leftBrace: (t, n, r) => {
    const $ = Math.min(n / 4, n * s(r, "adj1", 8333)), o = n * s(r, "adj2", 5e4);
    return L(
      `M ${a(t)} 0 A ${a(t)} ${a($)} 0 0 0 ${a(t / 2)} ${a($)} L ${a(t / 2)} ${a(o - $)} A ${a(t / 2)} ${a($)} 0 0 1 0 ${a(o)} A ${a(t / 2)} ${a($)} 0 0 1 ${a(t / 2)} ${a(o + $)} L ${a(t / 2)} ${a(n - $)} A ${a(t)} ${a($)} 0 0 0 ${a(t)} ${a(n)}`
    );
  },
  rightBrace: (t, n, r) => {
    const $ = Math.min(n / 4, n * s(r, "adj1", 8333)), o = n * s(r, "adj2", 5e4);
    return L(
      `M 0 0 A ${a(t)} ${a($)} 0 0 1 ${a(t / 2)} ${a($)} L ${a(t / 2)} ${a(o - $)} A ${a(t / 2)} ${a($)} 0 0 0 ${a(t)} ${a(o)} A ${a(t / 2)} ${a($)} 0 0 0 ${a(t / 2)} ${a(o + $)} L ${a(t / 2)} ${a(n - $)} A ${a(t)} ${a($)} 0 0 1 0 ${a(n)}`
    );
  },
  bracePair: (t, n, r) => {
    const $ = Math.min(n / 4, n * s(r, "adj", 8333)), o = t / 4;
    return L(
      `M ${a(o)} 0 A ${a(o)} ${a($)} 0 0 0 ${a(o)} ${a($)} L ${a(o)} ${a(n / 2 - $)} A ${a(o)} ${a($)} 0 0 1 0 ${a(n / 2)} A ${a(o)} ${a($)} 0 0 1 ${a(o)} ${a(n / 2 + $)} L ${a(o)} ${a(n - $)} A ${a(o)} ${a($)} 0 0 0 ${a(o)} ${a(n)} M ${a(t - o)} 0 A ${a(o)} ${a($)} 0 0 1 ${a(t - o)} ${a($)} L ${a(t - o)} ${a(n / 2 - $)} A ${a(o)} ${a($)} 0 0 0 ${a(t)} ${a(n / 2)} A ${a(o)} ${a($)} 0 0 0 ${a(t - o)} ${a(n / 2 + $)} L ${a(t - o)} ${a(n - $)} A ${a(o)} ${a($)} 0 0 1 ${a(t - o)} ${a(n)}`
    );
  },
  // 缎带 / 卷轴 / 波浪
  ribbon: (t, n, r) => {
    const $ = n * s(r, "adj1", 16667), o = t * s(r, "adj2", 5e4) / 2, e = t / 2, c = [[0, 0], [e - o, 0], [e - o + $, n * 0.5], [e - o, n], [0, n], [$, n * 0.5]], i = [[t, 0], [e + o, 0], [e + o - $, n * 0.5], [e + o, n], [t, n], [t - $, n * 0.5]], u = [[e - o, 0], [e + o, 0], [e + o, n], [e - o, n]];
    return d(c) + " " + d(i) + " " + d(u);
  },
  ribbon2: (t, n, r) => {
    const $ = n * s(r, "adj1", 16667), o = t * s(r, "adj2", 5e4) / 2, e = t / 2, c = [[e - o, n], [e + o, n], [e + o, 0], [e - o, 0]], i = [[0, n], [e - o, n], [e - o + $, n * 0.5], [e - o, 0], [0, 0], [$, n * 0.5]], u = [[t, n], [e + o, n], [e + o - $, n * 0.5], [e + o, 0], [t, 0], [t - $, n * 0.5]];
    return d(c) + " " + d(i) + " " + d(u);
  },
  ellipseRibbon: (t, n, r) => {
    const $ = n * Math.min(s(r, "adj3", 12500) * 2, 0.5), o = n * Math.min(s(r, "adj1", 25e3), 0.35), e = t * Math.min(s(r, "adj2", 5e4) / 2, 0.3), c = n * 0.12, i = `M 0 ${a(o)} Q ${a(t / 2)} ${a(-o)} ${a(t)} ${a(o)} L ${a(t)} ${a(o + $)} Q ${a(t / 2)} ${a($ - o)} 0 ${a(o + $)} Z`, u = (M) => d([[M, o + $ * 0.2], [M + e, o + $ * 0.2], [M + e, n], [M + e / 2, n - c], [M, n]]);
    return `${i} ${u(0)} ${u(t - e)}`;
  },
  ellipseRibbon2: (t, n, r) => {
    const $ = n * Math.min(s(r, "adj3", 12500) * 2, 0.5), o = n * Math.min(s(r, "adj1", 25e3), 0.35), e = t * Math.min(s(r, "adj2", 5e4) / 2, 0.3), c = n * 0.12, i = `M 0 ${a(n - o)} Q ${a(t / 2)} ${a(n + o)} ${a(t)} ${a(n - o)} L ${a(t)} ${a(n - o - $)} Q ${a(t / 2)} ${a(n + o - $)} 0 ${a(n - o - $)} Z`, u = (M) => d([[M, n - o - $ * 0.2], [M + e, n - o - $ * 0.2], [M + e, 0], [M + e / 2, c], [M, 0]]);
    return `${i} ${u(0)} ${u(t - e)}`;
  },
  leftRightRibbon: (t, n, r) => {
    const $ = Math.min(n * Math.min(s(r, "adj1", 5e4), 1) / 2, n / 4), o = t * Math.min(s(r, "adj2", 5e4), 0.9) / 2, e = Math.min((t / 2 - o) * 0.6, Math.max(n * s(r, "adj3", 16667) * 2, 1)), c = $ * 1.8, i = t / 2, u = n / 2;
    return d([
      [0, u],
      [e, u - c],
      [e, u - $],
      [i - o, u - $],
      [i - o, 0],
      [i + o, 0],
      [i + o, u - $],
      [t - e, u - $],
      [t - e, u - c],
      [t, u],
      [t - e, u + c],
      [t - e, u + $],
      [i + o, u + $],
      [i + o, n],
      [i - o, n],
      [i - o, u + $],
      [e, u + $],
      [e, u + c]
    ]);
  },
  verticalScroll: (t, n, r) => {
    const $ = Math.min(t, n) * Math.min(s(r, "adj", 12500), 0.25);
    return `M ${a($)} ${a($)} L ${a($)} ${a(n - $)} A ${a($)} ${a($)} 0 0 0 ${a($ * 2)} ${a(n)} L ${a(t)} ${a(n)} L ${a(t)} ${a($)} A ${a($)} ${a($)} 0 0 0 ${a(t - $ * 2)} ${a($)} Z M ${a($)} ${a($)} A ${a($)} ${a($)} 0 0 1 ${a($ * 2)} 0 L ${a(t - $)} 0 A ${a($)} ${a($)} 0 0 1 ${a(t - $ * 2)} ${a($)} Z`;
  },
  horizontalScroll: (t, n, r) => {
    const $ = Math.min(t, n) * Math.min(s(r, "adj", 12500), 0.25);
    return `M ${a($)} ${a($)} L ${a(t - $)} ${a($)} A ${a($)} ${a($)} 0 0 1 ${a(t)} ${a($ * 2)} L ${a(t)} ${a(n)} L ${a($ * 2)} ${a(n)} A ${a($)} ${a($)} 0 0 1 ${a($)} ${a(n - $ * 2)} Z M ${a($)} ${a($)} A ${a($)} ${a($)} 0 0 0 0 ${a($ * 2)} L 0 ${a(n - $)} A ${a($)} ${a($)} 0 0 0 ${a($)} ${a(n - $ * 2)} Z`;
  },
  wave: (t, n, r) => {
    const $ = n * Math.min(s(r, "adj1", 12500), 0.4);
    return `M 0 ${a($)} ${E($, t, $, !1)} L ${a(t)} ${a(n - $)} ${E(n - $, t, $, !0)} Z`;
  },
  doubleWave: (t, n, r) => {
    const $ = n * Math.min(s(r, "adj1", 6250), 0.25), o = t / 8, e = `C ${a(o)} ${a($ - $ * 2)} ${a(o * 3)} ${a($ + $ * 2)} ${a(t / 2)} ${a($)} C ${a(t / 2 + o)} ${a($ - $ * 2)} ${a(t / 2 + o * 3)} ${a($ + $ * 2)} ${a(t)} ${a($)}`, c = `C ${a(t - o)} ${a(n - $ + $ * 2)} ${a(t - o * 3)} ${a(n - $ - $ * 2)} ${a(t / 2)} ${a(n - $)} C ${a(t / 2 - o)} ${a(n - $ + $ * 2)} ${a(t / 2 - o * 3)} ${a(n - $ - $ * 2)} 0 ${a(n - $)}`;
    return `M 0 ${a($)} ${e} L ${a(t)} ${a(n - $)} ${c} Z`;
  },
  // 标注
  wedgeRectCallout: (t, n, r) => {
    const [$, o] = Q(t, n, r);
    return d([[0, 0], [t, 0], [t, n], [t * 0.6, n], [$, o], [t * 0.4, n], [0, n]]);
  },
  wedgeRoundRectCallout: (t, n, r) => {
    const [$, o] = Q(t, n, r), e = Math.min(t, n) * 0.1667;
    return `M ${a(e)} 0 L ${a(t - e)} 0 A ${a(e)} ${a(e)} 0 0 1 ${a(t)} ${a(e)} L ${a(t)} ${a(n - e)} A ${a(e)} ${a(e)} 0 0 1 ${a(t - e)} ${a(n)} L ${a(t * 0.6)} ${a(n)} L ${a($)} ${a(o)} L ${a(t * 0.4)} ${a(n)} L ${a(e)} ${a(n)} A ${a(e)} ${a(e)} 0 0 1 0 ${a(n - e)} L 0 ${a(e)} A ${a(e)} ${a(e)} 0 0 1 ${a(e)} 0 Z`;
  },
  wedgeEllipseCallout: (t, n, r) => {
    const [$, o] = Q(t, n, r), e = t / 2, c = n / 2, i = Math.atan2(o - c, $ - e) * 180 / Math.PI, [u, M] = j(e, c, t / 2, n / 2, i + 8);
    return `M ${a(u)} ${a(M)} ${A(e, c, t / 2, n / 2, i + 8, 344)} L ${a($)} ${a(o)} Z`;
  },
  cloudCallout: (t, n, r) => {
    const [$, o] = Q(t, n, r);
    return T.cloud(t, n * 0.8, {}) + " " + m(t * 0.36, n * 0.88, t * 0.045, n * 0.045) + " " + m($, o, t * 0.025, n * 0.025);
  },
  borderCallout1: Z(1, !1),
  borderCallout2: Z(2, !1),
  borderCallout3: Z(3, !1),
  callout1: Z(1, !1),
  callout2: Z(2, !1),
  callout3: Z(3, !1),
  accentCallout1: Z(1, !0),
  accentCallout2: Z(2, !0),
  accentCallout3: Z(3, !0),
  accentBorderCallout1: Z(1, !0),
  accentBorderCallout2: Z(2, !0),
  accentBorderCallout3: Z(3, !0),
  // 流程图
  flowChartProcess: (t, n) => d([[0, 0], [t, 0], [t, n], [0, n]]),
  flowChartAlternateProcess: (t, n) => {
    const r = Math.min(t, n) * 0.1667;
    return W(t, n, [r, r, r, r], ["r", "r", "r", "r"]);
  },
  flowChartDecision: (t, n) => d([[t / 2, 0], [t, n / 2], [t / 2, n], [0, n / 2]]),
  flowChartInputOutput: (t, n) => d([[t * 0.2, 0], [t, 0], [t * 0.8, n], [0, n]]),
  flowChartPredefinedProcess: (t, n) => d([[0, 0], [t, 0], [t, n], [0, n]]) + " " + f([[t / 8, 0], [t / 8, n]]) + " " + f([[t * 7 / 8, 0], [t * 7 / 8, n]]),
  flowChartInternalStorage: (t, n) => d([[0, 0], [t, 0], [t, n], [0, n]]) + " " + f([[t / 8, 0], [t / 8, n]]) + " " + f([[0, n / 8], [t, n / 8]]),
  flowChartDocument: (t, n) => `M 0 0 L ${a(t)} 0 L ${a(t)} ${a(n * 0.84)} C ${a(t * 0.75)} ${a(n * 1.06)} ${a(t * 0.25)} ${a(n * 0.62)} 0 ${a(n * 0.84)} Z`,
  flowChartMultidocument: (t, n) => `M 0 ${a(n * 0.2)} L ${a(t * 0.9)} ${a(n * 0.2)} L ${a(t * 0.9)} ${a(n * 0.86)} C ${a(t * 0.68)} ${a(n * 1.04)} ${a(t * 0.22)} ${a(n * 0.66)} 0 ${a(n * 0.86)} Z ` + f([[t * 0.05, n * 0.1], [t * 0.95, n * 0.1], [t * 0.95, n * 0.76]]) + " " + f([[t * 0.1, 0], [t, 0], [t, n * 0.66]]),
  flowChartTerminator: (t, n) => {
    const r = Math.min(n / 2, t / 2);
    return `M ${a(r)} 0 L ${a(t - r)} 0 A ${a(r)} ${a(n / 2)} 0 0 1 ${a(t - r)} ${a(n)} L ${a(r)} ${a(n)} A ${a(r)} ${a(n / 2)} 0 0 1 ${a(r)} 0 Z`;
  },
  flowChartPreparation: (t, n) => d([[t * 0.2, 0], [t * 0.8, 0], [t, n / 2], [t * 0.8, n], [t * 0.2, n], [0, n / 2]]),
  flowChartManualInput: (t, n) => d([[0, n * 0.2], [t, 0], [t, n], [0, n]]),
  flowChartManualOperation: (t, n) => d([[0, 0], [t, 0], [t * 0.8, n], [t * 0.2, n]]),
  flowChartConnector: (t, n) => m(t / 2, n / 2, t / 2, n / 2),
  flowChartOffpageConnector: (t, n) => d([[0, 0], [t, 0], [t, n * 0.8], [t / 2, n], [0, n * 0.8]]),
  flowChartPunchedCard: (t, n) => d([[t * 0.2, 0], [t, 0], [t, n], [0, n], [0, n * 0.2]]),
  flowChartPunchedTape: (t, n) => `M 0 ${a(n * 0.11)} ${E(n * 0.11, t, n * 0.11, !1)} L ${a(t)} ${a(n * 0.89)} ${E(n * 0.89, t, n * 0.11, !0)} Z`,
  flowChartSummingJunction: (t, n) => m(t / 2, n / 2, t / 2, n / 2) + " " + f([[t * 0.1464, n * 0.1464], [t * (1 - 0.1464), n * (1 - 0.1464)]]) + " " + f([[t * (1 - 0.1464), n * 0.1464], [t * 0.1464, n * (1 - 0.1464)]]),
  flowChartOr: (t, n) => m(t / 2, n / 2, t / 2, n / 2) + " " + f([[t / 2, 0], [t / 2, n]]) + " " + f([[0, n / 2], [t, n / 2]]),
  flowChartCollate: (t, n) => d([[0, 0], [t, 0], [t / 2, n / 2], [t, n], [0, n], [t / 2, n / 2]]),
  flowChartSort: (t, n) => d([[t / 2, 0], [t, n / 2], [t / 2, n], [0, n / 2]]) + " " + f([[0, n / 2], [t, n / 2]]),
  flowChartExtract: (t, n) => d([[t / 2, 0], [t, n], [0, n]]),
  flowChartMerge: (t, n) => d([[0, 0], [t, 0], [t / 2, n]]),
  flowChartOnlineStorage: (t, n) => `M ${a(t * 0.16)} 0 L ${a(t)} 0 A ${a(t * 0.16)} ${a(n / 2)} 0 0 0 ${a(t)} ${a(n)} L ${a(t * 0.16)} ${a(n)} A ${a(t * 0.16)} ${a(n / 2)} 0 0 1 ${a(t * 0.16)} 0 Z`,
  flowChartOfflineStorage: (t, n) => d([[0, 0], [t, 0], [t / 2, n]]) + " " + f([[t * 0.1, n * 0.2], [t * 0.9, n * 0.2]]),
  flowChartMagneticTape: (t, n) => m(t / 2, n * 0.46, t / 2, n * 0.46) + ` M ${a(t * 0.5)} ${a(n * 0.92)} L ${a(t)} ${a(n * 0.92)} L ${a(t)} ${a(n)} L ${a(t * 0.5)} ${a(n)} Z`,
  flowChartMagneticDisk: (t, n) => T.can(t, n, { adj: 25e3 }),
  flowChartMagneticDrum: (t, n) => {
    const r = Math.min(t / 2, t * 0.125);
    return `M ${a(r)} 0 L ${a(t - r)} 0 ${A(t - r, n / 2, r, n / 2, -90, 180)} L ${a(r)} ${a(n)} ${A(r, n / 2, r, n / 2, 90, 180)} Z ` + _(t - r, n / 2, r, n / 2);
  },
  flowChartDisplay: (t, n) => `M ${a(t * 0.16)} 0 L ${a(t * 0.84)} 0 A ${a(t * 0.16)} ${a(n / 2)} 0 0 1 ${a(t * 0.84)} ${a(n)} L ${a(t * 0.16)} ${a(n)} L 0 ${a(n / 2)} Z`,
  flowChartDelay: (t, n) => `M 0 0 L ${a(t / 2)} 0 A ${a(t / 2)} ${a(n / 2)} 0 0 1 ${a(t / 2)} ${a(n)} L 0 ${a(n)} Z`,
  // 动作按钮
  actionButtonBlank: (t, n) => N(t, n, Math.min(t, n) * 0.125),
  actionButtonHome: (t, n) => R(t, n, (r, $, o) => d([[$, o - r], [$ + r, o], [$ + r * 0.6, o], [$ + r * 0.6, o + r], [$ - r * 0.6, o + r], [$ - r * 0.6, o], [$ - r, o]])),
  actionButtonForwardNext: (t, n) => R(t, n, (r, $, o) => d([[$ - r * 0.6, o - r], [$ + r * 0.7, o], [$ - r * 0.6, o + r]])),
  actionButtonBackPrevious: (t, n) => R(t, n, (r, $, o) => d([[$ + r * 0.6, o - r], [$ - r * 0.7, o], [$ + r * 0.6, o + r]])),
  actionButtonBeginning: (t, n) => R(t, n, (r, $, o) => d([[$ + r * 0.7, o - r], [$ - r * 0.3, o], [$ + r * 0.7, o + r]]) + " " + d([[$ - r * 0.7, o - r], [$ - r * 0.45, o - r], [$ - r * 0.45, o + r], [$ - r * 0.7, o + r]])),
  actionButtonEnd: (t, n) => R(t, n, (r, $, o) => d([[$ - r * 0.7, o - r], [$ + r * 0.3, o], [$ - r * 0.7, o + r]]) + " " + d([[$ + r * 0.45, o - r], [$ + r * 0.7, o - r], [$ + r * 0.7, o + r], [$ + r * 0.45, o + r]])),
  actionButtonInformation: (t, n) => R(t, n, (r, $, o) => m($, o, r, r) + " " + m($, o - r * 0.45, r * 0.16, r * 0.16) + " " + d([[$ - r * 0.16, o - r * 0.15], [$ + r * 0.16, o - r * 0.15], [$ + r * 0.16, o + r * 0.6], [$ - r * 0.16, o + r * 0.6]])),
  actionButtonReturn: (t, n) => R(t, n, (r, $, o) => `M ${a($ - r * 0.6)} ${a(o + r * 0.7)} L ${a($ + r * 0.2)} ${a(o + r * 0.7)} A ${a(r * 0.5)} ${a(r * 0.5)} 0 0 0 ${a($ + r * 0.2)} ${a(o - r * 0.3)} L ${a($ - r * 0.2)} ${a(o - r * 0.3)} M ${a($ - r * 0.2)} ${a(o - r * 0.6)} L ${a($ - r * 0.6)} ${a(o - r * 0.3)} L ${a($ - r * 0.2)} ${a(o)} Z`),
  actionButtonDocument: (t, n) => R(t, n, (r, $, o) => d([[$ - r * 0.55, o - r * 0.8], [$ + r * 0.2, o - r * 0.8], [$ + r * 0.55, o - r * 0.45], [$ + r * 0.55, o + r * 0.8], [$ - r * 0.55, o + r * 0.8]])),
  actionButtonSound: (t, n) => R(t, n, (r, $, o) => d([[$ - r * 0.7, o - r * 0.3], [$ - r * 0.3, o - r * 0.3], [$ + r * 0.1, o - r * 0.8], [$ + r * 0.1, o + r * 0.8], [$ - r * 0.3, o + r * 0.3], [$ - r * 0.7, o + r * 0.3]]) + " " + f([[$ + r * 0.35, o - r * 0.4], [$ + r * 0.75, o - r * 0.6]]) + " " + f([[$ + r * 0.35, o], [$ + r * 0.8, o]]) + " " + f([[$ + r * 0.35, o + r * 0.4], [$ + r * 0.75, o + r * 0.6]])),
  actionButtonMovie: (t, n) => R(t, n, (r, $, o) => d([
    [$ - r * 0.8, o - r * 0.5],
    [$ + r * 0.35, o - r * 0.5],
    [$ + r * 0.35, o - r * 0.15],
    [$ + r * 0.8, o - r * 0.45],
    [$ + r * 0.8, o + r * 0.45],
    [$ + r * 0.35, o + r * 0.15],
    [$ + r * 0.35, o + r * 0.5],
    [$ - r * 0.8, o + r * 0.5]
  ])),
  actionButtonHelp: (t, n) => R(t, n, (r, $, o) => `M ${a($ - r * 0.35)} ${a(o - r * 0.3)} A ${a(r * 0.35)} ${a(r * 0.35)} 0 1 1 ${a($)} ${a(o + r * 0.1)} L ${a($)} ${a(o + r * 0.35)} ` + m($, o + r * 0.68, r * 0.13, r * 0.13)),
  // 符号 / 连接线
  chartX: (t, n) => L(`M 0 0 L ${a(t)} ${a(n)} M ${a(t)} 0 L 0 ${a(n)}`),
  chartPlus: (t, n) => L(`M ${a(t / 2)} 0 L ${a(t / 2)} ${a(n)} M 0 ${a(n / 2)} L ${a(t)} ${a(n / 2)}`),
  chartStar: (t, n) => L(`M 0 0 L ${a(t)} ${a(n)} M ${a(t)} 0 L 0 ${a(n)} M ${a(t / 2)} 0 L ${a(t / 2)} ${a(n)}`),
  line: (t, n) => L(`M 0 0 L ${a(t)} ${a(n)}`),
  lineInv: (t, n) => L(`M 0 ${a(n)} L ${a(t)} 0`),
  straightConnector1: (t, n) => L(`M 0 0 L ${a(t)} ${a(n)}`),
  bentConnector2: (t, n) => L(`M 0 0 L ${a(t)} 0 L ${a(t)} ${a(n)}`),
  bentConnector3: (t, n, r) => {
    const $ = t * s(r, "adj1", 5e4);
    return L(`M 0 0 L ${a($)} 0 L ${a($)} ${a(n)} L ${a(t)} ${a(n)}`);
  },
  bentConnector4: (t, n, r) => {
    const $ = t * s(r, "adj1", 5e4), o = n * s(r, "adj2", 5e4);
    return L(`M 0 0 L ${a($)} 0 L ${a($)} ${a(o)} L ${a(t)} ${a(o)} L ${a(t)} ${a(n)}`);
  },
  bentConnector5: (t, n, r) => {
    const $ = t * s(r, "adj1", 5e4), o = n * s(r, "adj2", 5e4), e = t * s(r, "adj3", 5e4);
    return L(`M 0 0 L ${a($)} 0 L ${a($)} ${a(o)} L ${a(e)} ${a(o)} L ${a(e)} ${a(n)} L ${a(t)} ${a(n)}`);
  },
  curvedConnector2: (t, n) => L(`M 0 0 Q ${a(t)} 0 ${a(t)} ${a(n)}`),
  curvedConnector3: (t, n, r) => {
    const $ = t * s(r, "adj1", 5e4);
    return L(`M 0 0 C ${a($)} 0 ${a($)} ${a(n)} ${a(t)} ${a(n)}`);
  },
  curvedConnector4: (t, n) => L(`M 0 0 C ${a(t * 0.5)} 0 ${a(t * 0.5)} ${a(n * 0.5)} ${a(t * 0.75)} ${a(n * 0.5)} S ${a(t)} ${a(n * 0.75)} ${a(t)} ${a(n)}`),
  curvedConnector5: (t, n) => L(`M 0 0 C ${a(t * 0.4)} 0 ${a(t * 0.4)} ${a(n * 0.5)} ${a(t * 0.5)} ${a(n * 0.5)} S ${a(t * 0.6)} ${a(n)} ${a(t)} ${a(n)}`)
};
function i0(t, n, r, $) {
  const o = T[t] ?? T.rect, e = Math.max(n, 0), c = Math.max(r, 0);
  let i;
  try {
    const M = o(e, c, $);
    i = typeof M == "string" ? { d: M, open: !1 } : M;
  } catch {
    return { d: T.rect(e, c, {}), open: !1 };
  }
  const u = Math.max(e, c) * 20 + 1e3;
  for (const M of i.d.match(/-?\d+(?:\.\d+)?/g) ?? [])
    if (Math.abs(Number(M)) > u)
      return { d: T.rect(e, c, {}), open: !1 };
  return i;
}
function s0(t) {
  return t in T;
}
export {
  j as ep,
  s0 as isKnownPreset,
  a as n,
  i0 as presetGeom,
  F as rad
};
