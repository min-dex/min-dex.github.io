import { hiddenBefore as C, staticHidden as w, groupSteps as M, slideText as S, renderSlideToSvg as v, slideToPng as T } from "./core.js?mindex=media2";
import { groupSteps as R, hiddenBefore as W, staticHidden as G } from "./core.js?mindex=media2";
const h = 1.15;
function $(s) {
  switch (s) {
    case "l":
      return [-100 * h, 0];
    case "r":
      return [100 * h, 0];
    case "u":
      return [0, -100 * h];
    case "d":
      return [0, 100 * h];
    case "lu":
      return [-100 * h, -100 * h];
    case "ru":
      return [100 * h, -100 * h];
    case "ld":
      return [-100 * h, 100 * h];
    case "rd":
      return [100 * h, 100 * h];
    default:
      return [0, 100 * h];
  }
}
function d(s, t) {
  const e = t ? 100 : 0;
  switch (s) {
    case "l":
      return `inset(0 ${e}% 0 0)`;
    case "r":
      return `inset(0 0 0 ${e}%)`;
    case "u":
      return `inset(0 0 ${e}% 0)`;
    case "horz":
      return `inset(0 ${e / 2}% 0 ${e / 2}%)`;
    case "vert":
      return `inset(${e / 2}% 0 ${e / 2}% 0)`;
    default:
      return `inset(${e}% 0 0 0)`;
  }
}
function A(s) {
  switch (s.effect) {
    case "appear":
      return { from: { opacity: 0 }, to: { opacity: 1 } };
    case "fly": {
      const [t, e] = $(s.dir);
      return {
        from: { opacity: 0, transform: `translate(${t}%, ${e}%)` },
        to: { opacity: 1, transform: "translate(0, 0)" }
      };
    }
    case "zoom":
      return {
        from: { opacity: 0, transform: s.dir === "out" ? "scale(1.6)" : "scale(0.1)" },
        to: { opacity: 1, transform: "scale(1)" }
      };
    case "grow":
      return { from: { opacity: 0, transform: "scale(0.2) rotate(-90deg)" }, to: { opacity: 1, transform: "scale(1) rotate(0)" } };
    case "spin":
      return { from: { opacity: 0, transform: "rotate(-180deg) scale(0.4)" }, to: { opacity: 1, transform: "rotate(0) scale(1)" } };
    case "swivel":
      return { from: { opacity: 0, transform: "rotateY(90deg)" }, to: { opacity: 1, transform: "rotateY(0)" } };
    case "float":
      return { from: { opacity: 0, transform: "translateY(30%)" }, to: { opacity: 1, transform: "translateY(0)" } };
    case "bounce":
      return { from: { opacity: 0, transform: "translateY(-60%)" }, to: { opacity: 1, transform: "translateY(0)" } };
    case "stretch":
      return { from: { opacity: 0, transform: "scaleX(0.05)" }, to: { opacity: 1, transform: "scaleX(1)" } };
    case "wipe":
    case "blinds":
    case "split":
    case "wheel":
      return {
        from: { opacity: 1, clipPath: d(s.dir, !0) },
        to: { opacity: 1, clipPath: d(s.dir, !1) }
      };
    case "dissolve":
    case "fade":
    case "random":
    default:
      return { from: { opacity: 0 }, to: { opacity: 1 } };
  }
}
function k(s) {
  const t = A({ ...s });
  return { from: t.to, to: t.from };
}
function E(s) {
  switch (s.effect) {
    case "spin":
      return { from: { transform: "rotate(0)" }, to: { transform: "rotate(360deg)" } };
    case "grow":
      return { from: { transform: "scale(1)" }, to: { transform: "scale(1.25)" } };
    default:
      return { from: { opacity: 1 }, to: { opacity: 0.35 } };
  }
}
function z(s) {
  return s.kind === "exit" ? k(s) : s.kind === "emphasis" ? E(s) : s.kind === "motion" ? { from: { opacity: 1 }, to: { opacity: 1 } } : A(s);
}
function Y(s, t) {
  var n, r;
  const e = [];
  let a = 0;
  for (const i of t) {
    const c = s.querySelector(`[data-el="${i.target}"]`);
    if (!c) continue;
    const o = i.trigger === "afterPrev" ? a + i.delayMs : i.delayMs;
    i.trigger === "afterPrev" ? a = o + i.durationMs : a = Math.max(a, o + i.durationMs);
    const { from: l, to: p } = z(i);
    c.style.visibility = "visible", i.kind === "entrance" && (c.style.opacity = "");
    const f = (n = i.motionPath) != null && n.length ? i.motionPath.map(([u, y]) => ({ transform: `translate(${u}px, ${y}px)` })) : [l, p];
    try {
      const u = c.animate(f, {
        duration: i.durationMs,
        delay: o,
        // 路径动画在 PowerPoint 里是匀速，不能套入场用的缓动
        easing: (r = i.motionPath) != null && r.length ? "linear" : "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        fill: "both"
      });
      i.kind === "exit" && u.finished.then(() => {
        c.style.visibility = "hidden";
      }).catch(() => {
      }), e.push(u);
    } catch {
      Object.assign(c.style, f[f.length - 1] ?? p);
    }
  }
  return {
    cancel: () => e.forEach((i) => {
      try {
        i.finish();
      } catch {
      }
    }),
    finished: Promise.all(e.map((i) => i.finished.catch(() => {
    }))).then(() => {
    })
  };
}
function x(s, t) {
  const e = s.dir ?? "", a = (r, i) => `translate(${r}, ${i})`, n = () => e.includes("l") ? ["-100%", "0"] : e.includes("r") ? ["100%", "0"] : e.includes("u") ? ["0", "-100%"] : ["0", "100%"];
  switch (s.type) {
    case "cut":
      return t ? [{ opacity: 1 }, { opacity: 1 }] : [{ opacity: 0 }, { opacity: 0 }];
    case "push":
    case "pull": {
      const [r, i] = n(), c = s.type === "pull" ? -1 : 1, o = (l) => l === "0" ? "0" : `${-parseFloat(l) * c}%`;
      return t ? [{ transform: a(c > 0 ? r : o(r), c > 0 ? i : o(i)) }, { transform: "translate(0,0)" }] : [{ transform: "translate(0,0)" }, { transform: a(o(r), o(i)) }];
    }
    case "cover": {
      const [r, i] = n();
      return t ? [{ transform: a(r, i) }, { transform: "translate(0,0)" }] : [{ opacity: 1 }, { opacity: 1 }];
    }
    case "wipe": {
      const r = d(e || "d", !0), i = d(e || "d", !1);
      return t ? [{ clipPath: r }, { clipPath: i }] : [{ opacity: 1 }, { opacity: 1 }];
    }
    case "split": {
      const r = e.startsWith("vert"), i = e.endsWith("out"), c = r ? "inset(0 50% 0 50%)" : "inset(50% 0 50% 0)", o = "inset(0 0 0 0)";
      return t ? i ? [{ clipPath: c }, { clipPath: o }] : [{ clipPath: o }, { clipPath: o }] : [{ clipPath: o }, { clipPath: c }];
    }
    case "zoom":
      return t ? [{ opacity: 0, transform: e === "out" ? "scale(1.4)" : "scale(0.6)" }, { opacity: 1, transform: "scale(1)" }] : [{ opacity: 1 }, { opacity: 0 }];
    case "wheel":
    case "circle":
    case "diamond":
    case "plus":
    case "wedge":
      return t ? [{ opacity: 0, transform: "scale(0.7)" }, { opacity: 1, transform: "scale(1)" }] : [{ opacity: 1 }, { opacity: 0 }];
    case "ripple":
      return t ? [{ clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(75% at 50% 50%)" }] : [{ opacity: 1 }, { opacity: 1 }];
    case "vortex":
      return t ? [{ opacity: 0, transform: "scale(0.2) rotate(-180deg)" }, { opacity: 1, transform: "none" }] : [{ opacity: 1 }, { opacity: 0 }];
    case "honeycomb":
      return t ? [{ opacity: 0, transform: "scale(0.85) rotate(-6deg)" }, { opacity: 1, transform: "none" }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(1.1)" }];
    case "glitter":
      return t ? [{ opacity: 0, clipPath: d(e || "l", !0) }, { opacity: 1, clipPath: d(e || "l", !1) }] : [{ opacity: 1 }, { opacity: 0 }];
    case "shred":
      return t ? [{ opacity: 0, transform: "scale(1.06)" }, { opacity: 1, transform: "none" }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scaleY(0.9)" }];
    case "flash":
      return t ? [{ opacity: 0, filter: "brightness(3)" }, { opacity: 1, filter: "brightness(1)" }] : [{ opacity: 1, filter: "brightness(1)" }, { opacity: 0, filter: "brightness(3)" }];
    case "reveal": {
      const [r, i] = n();
      return t ? [{ opacity: 0, transform: a(r, i) }, { opacity: 1, transform: "translate(0,0)" }] : [{ opacity: 1 }, { opacity: 0 }];
    }
    case "wheelReverse":
      return t ? [{ opacity: 0, transform: "scale(1.3) rotate(20deg)" }, { opacity: 1, transform: "none" }] : [{ opacity: 1 }, { opacity: 0 }];
    case "doors":
      return t ? [{ clipPath: "inset(0 50% 0 50%)" }, { clipPath: "inset(0 0 0 0)" }] : [{ opacity: 1 }, { opacity: 1 }];
    case "window":
      return t ? [{ clipPath: "inset(50% 0 50% 0)" }, { clipPath: "inset(0 0 0 0)" }] : [{ opacity: 1 }, { opacity: 1 }];
    case "switch":
    case "flip":
    case "prism": {
      const r = s.type === "flip" ? -1 : 1;
      return t ? [
        { opacity: 0, transform: `perspective(1400px) rotateY(${r * -80}deg)` },
        { opacity: 1, transform: "perspective(1400px) rotateY(0)" }
      ] : [
        { opacity: 1, transform: "perspective(1400px) rotateY(0)" },
        { opacity: 0, transform: `perspective(1400px) rotateY(${r * 80}deg)` }
      ];
    }
    case "ferris":
      return t ? [
        { opacity: 0, transform: "perspective(1400px) rotateX(70deg)" },
        { opacity: 1, transform: "perspective(1400px) rotateX(0)" }
      ] : [
        { opacity: 1, transform: "perspective(1400px) rotateX(0)" },
        { opacity: 0, transform: "perspective(1400px) rotateX(-70deg)" }
      ];
    case "gallery":
    case "conveyor": {
      const r = s.type === "conveyor" ? 25 : 12, i = e.includes("l") ? "-100%" : "100%", c = e.includes("l") ? "100%" : "-100%";
      return t ? [
        { transform: `perspective(1600px) translateX(${i}) rotateY(${r}deg)` },
        { transform: "perspective(1600px) translateX(0) rotateY(0)" }
      ] : [
        { transform: "perspective(1600px) translateX(0) rotateY(0)" },
        { transform: `perspective(1600px) translateX(${c}) rotateY(${-r}deg)` }
      ];
    }
    case "pan": {
      const [r, i] = n(), c = (o) => o === "0" ? "0" : `${-parseFloat(o)}%`;
      return t ? [{ transform: a(r, i) }, { transform: "translate(0,0)" }] : [{ transform: "translate(0,0)" }, { transform: a(c(r), c(i)) }];
    }
    case "flythrough":
      return t ? [{ opacity: 0, transform: "perspective(1000px) scale(0.15)" }, { opacity: 1, transform: "none" }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "perspective(1000px) scale(2.2)" }];
    case "warp":
      return t ? [{ opacity: 0, transform: "skewX(-18deg) scale(1.15)" }, { opacity: 1, transform: "none" }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "skewX(18deg) scale(0.9)" }];
    case "blinds":
    case "checker":
    case "comb":
    case "randomBar":
    case "strips":
    case "newsflash":
    case "dissolve":
    case "fade":
    case "morph":
    default:
      return t ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }];
  }
}
function b(s, t) {
  const e = Promise.all(s.map((a) => a.catch(() => {
  }))).then(() => {
  });
  return typeof setTimeout != "function" ? e : Promise.race([e, new Promise((a) => setTimeout(a, t + 250))]);
}
function L(s, t) {
  const e = /* @__PURE__ */ new Map();
  s.querySelectorAll("[data-el]").forEach((n) => {
    const r = n.getBoundingClientRect();
    (r.width > 0 || r.height > 0) && e.set(n.getAttribute("data-el") ?? "", r);
  });
  const a = [];
  return t.querySelectorAll("[data-el]").forEach((n) => {
    const r = e.get(n.getAttribute("data-el") ?? "");
    if (!r) return;
    const i = n.getBoundingClientRect();
    i.width <= 0 && i.height <= 0 || a.push({ node: n, from: r, to: i });
  }), a;
}
function X(s, t, e) {
  if (!s) return Promise.resolve();
  const a = { duration: e.durationMs, easing: "ease-in-out", fill: "both" }, n = L(s, t), r = new Set(n.map((o) => o.node.getAttribute("data-el"))), i = [], c = (o, l) => {
    try {
      i.push(o.animate(l, a).finished);
    } catch {
    }
  };
  for (const { node: o, from: l, to: p } of n) {
    const f = l.left - p.left, u = l.top - p.top, y = p.width > 0 ? l.width / p.width : 1, P = p.height > 0 ? l.height / p.height : 1;
    c(o, [
      { transformOrigin: "left top", transform: `translate(${f}px, ${u}px) scale(${y}, ${P})` },
      { transformOrigin: "left top", transform: "none" }
    ]);
  }
  return s.querySelectorAll("[data-el]").forEach((o) => {
    const l = r.has(o.getAttribute("data-el"));
    c(o, l ? [{ opacity: 0 }, { opacity: 0 }] : [{ opacity: 1 }, { opacity: 0 }]);
  }), t.querySelectorAll("[data-el]").forEach((o) => {
    r.has(o.getAttribute("data-el")) || c(o, [{ opacity: 0 }, { opacity: 1 }]);
  }), b(i, e.durationMs).then(() => {
    s.remove();
  });
}
function N(s, t, e) {
  if (!e || e.type === "none")
    return s == null || s.remove(), Promise.resolve();
  if (e.type === "morph" && s) return X(s, t, e);
  const a = { duration: e.durationMs, easing: "ease-in-out", fill: "both" }, n = [];
  try {
    n.push(t.animate(x(e, !0), a).finished), s && n.push(s.animate(x(e, !1), a).finished);
  } catch {
    return s == null || s.remove(), Promise.resolve();
  }
  return b(n, e.durationMs).then(() => {
    s == null || s.remove();
  });
}
function V(s) {
  var e;
  const t = (e = s.transition) == null ? void 0 : e.advanceAfterMs;
  return t !== void 0 && t > 0 ? t : null;
}
class F {
  constructor(t, e = {}) {
    this.presentation = t, this.options = e, this.idx = 0, this.zoomValue = 1, this.groups = [], this.cursor = 0, this.listeners = /* @__PURE__ */ new Set(), this.autoTimer = null, this.textCache = /* @__PURE__ */ new Map(), this.idx = this.clamp(e.index ?? 0), this.loadAnimations();
  }
  // ---------------- 只读状态 ----------------
  get index() {
    return this.idx;
  }
  get count() {
    return this.presentation.slides.length;
  }
  get slide() {
    return this.presentation.slides[this.idx];
  }
  get zoom() {
    return this.zoomValue;
  }
  get animate() {
    return this.options.animate === !0;
  }
  get animationTotal() {
    return this.groups.length;
  }
  get animationDone() {
    return this.cursor;
  }
  get hasPendingAnimation() {
    return this.animate && this.cursor < this.groups.length;
  }
  /**
   * 当前应当隐藏的元素 id —— UI 据此设置可见性。
   *
   * 不播动画时不是「全部可见」，而是动画终态：入场与退场的元素属于不同时刻，
   * 一起画出来就是几帧叠在一起（见 core 的 staticHidden）。
   */
  get hiddenElementIds() {
    return this.animate ? C(this.groups, this.cursor) : w(this.slide);
  }
  /** 本页的自动换片延迟（毫秒），未配置则为 null */
  get autoAdvanceDelay() {
    return this.options.autoAdvance ? V(this.slide) : null;
  }
  // ---------------- 订阅 ----------------
  subscribe(t) {
    return this.listeners.add(t), () => this.listeners.delete(t);
  }
  emit(t) {
    for (const e of this.listeners) e(t);
  }
  // ---------------- 导航 ----------------
  clamp(t) {
    return Math.max(0, Math.min(this.count - 1, t));
  }
  visible(t) {
    var e;
    return !this.options.skipHidden || !((e = this.presentation.slides[t]) != null && e.hidden);
  }
  /**
   * 跳转到指定页。返回是否真的换了页。
   * 前进时带上目标页的切换效果；回退不播切换，避免观感错乱。
   */
  goTo(t, e = "forward") {
    const a = this.clamp(t);
    if (a === this.idx) return !1;
    const n = this.idx;
    return this.idx = a, this.loadAnimations(), this.emit({
      type: "slide",
      index: a,
      previous: n,
      transition: e === "forward" && this.animate ? this.slide.transition : void 0
    }), !0;
  }
  /** 有待播动画时先播动画，否则翻页 */
  next() {
    if (this.playNextAnimation()) return;
    let t = this.idx + 1;
    for (; t < this.count && !this.visible(t); ) t++;
    t < this.count && this.goTo(t);
  }
  prev() {
    let t = this.idx - 1;
    for (; t >= 0 && !this.visible(t); ) t--;
    t >= 0 && this.goTo(t, "backward");
  }
  setZoom(t) {
    const e = Math.max(0.1, Math.min(8, t));
    e !== this.zoomValue && (this.zoomValue = e, this.emit({ type: "zoom", zoom: e }));
  }
  setAnimate(t) {
    this.options.animate !== t && (this.options = { ...this.options, animate: t }, this.loadAnimations(), this.emit({ type: "animation", done: this.cursor, total: this.groups.length, group: null }));
  }
  // ---------------- 动画 ----------------
  loadAnimations() {
    this.groups = this.animate ? M(this.slide.animations) : [], this.cursor = 0;
  }
  /**
   * 推进一批动画。返回应播放的这一批；没有待播批次时返回 null。
   * 真正的播放由 UI 层执行——状态机只负责「该播哪一批」。
   */
  playNextAnimation() {
    if (!this.hasPendingAnimation) return null;
    const t = this.groups[this.cursor];
    return this.cursor++, this.emit({ type: "animation", done: this.cursor, total: this.groups.length, group: t }), t;
  }
  /** 直接跳到本页动画终态 */
  finishAnimations() {
    this.cursor !== this.groups.length && (this.cursor = this.groups.length, this.emit({ type: "animation", done: this.cursor, total: this.groups.length, group: null }));
  }
  // ---------------- 自动换片 ----------------
  /** 启动自动换片计时；返回取消函数。由 UI 层在每次换页后调用。 */
  scheduleAutoAdvance() {
    this.cancelAutoAdvance();
    const t = this.autoAdvanceDelay;
    return t === null ? () => {
    } : (this.autoTimer = setTimeout(() => {
      this.autoTimer = null, this.next();
    }, t), () => this.cancelAutoAdvance());
  }
  cancelAutoAdvance() {
    this.autoTimer !== null && (clearTimeout(this.autoTimer), this.autoTimer = null);
  }
  // ---------------- 文本 / 搜索 ----------------
  text(t) {
    let e = this.textCache.get(t);
    return e === void 0 && (e = S(this.presentation.slides[t]), this.textCache.set(t, e)), e;
  }
  /** 全文搜索，返回命中的页索引 */
  search(t) {
    const e = t.trim().toLowerCase();
    if (!e) return [];
    const a = [];
    for (let n = 0; n < this.count; n++)
      this.text(n).toLowerCase().includes(e) && a.push(n);
    return a;
  }
  /** 解析内部跳转目标（`slide:3` / `slide:last`）为页索引；外部链接返回 null */
  resolveLink(t) {
    if (!t.startsWith("slide:")) return null;
    const e = t.slice(6), a = e === "last" ? this.count : Number(e);
    return Number.isFinite(a) ? this.clamp(a - 1) : null;
  }
  destroy() {
    this.cancelAutoAdvance(), this.listeners.clear(), this.textCache.clear();
  }
}
const g = "http://www.w3.org/2000/svg", D = "http://www.w3.org/1999/xhtml";
let m = null;
function H() {
  m = null;
}
function q(s) {
  if (m !== null) return m;
  const t = s.body ?? s.documentElement;
  if (!t) return !0;
  const e = s.createElementNS(g, "svg");
  e.setAttribute("viewBox", "0 0 100 100"), e.setAttribute("width", "200"), e.setAttribute("height", "200"), e.setAttribute("style", "position:absolute;left:-9999px;top:-9999px;pointer-events:none");
  const a = s.createElementNS(g, "foreignObject");
  a.setAttribute("width", "100"), a.setAttribute("height", "100");
  const n = s.createElementNS(D, "div");
  n.setAttribute("style", "width:100px;height:100px"), a.appendChild(n), e.appendChild(a), t.appendChild(e);
  const r = n.getBoundingClientRect().width;
  return e.remove(), m = r === 0 || r > 150, m;
}
class O {
  constructor(t, e, a = {}) {
    this.container = t, this.presentation = e, this.svgCache = /* @__PURE__ */ new Map(), this.playing = null, this.cancelAuto = null, this.onChange = null, this.onAnimStep = null, this.onLinkClick = null, this.handleClick = (r) => {
      const i = r.target, c = i == null ? void 0 : i.closest("[data-slide]");
      if (c) {
        r.preventDefault();
        const p = this.state.resolveLink(`slide:${c.getAttribute("data-slide") ?? ""}`);
        p !== null && this.goTo(p);
        return;
      }
      const o = i == null ? void 0 : i.closest("a[href]"), l = o == null ? void 0 : o.getAttribute("href");
      l && this.onLinkClick && this.onLinkClick(l) === !0 && r.preventDefault();
    }, this.media = a.media ?? "badge";
    const n = a.textMode ?? "auto";
    this.textMode = n !== "auto" ? n : q(t.ownerDocument) ? "html" : "svg", this.state = new F(e, a), this.unsubscribe = this.state.subscribe((r) => {
      var i, c;
      r.type === "slide" ? (this.paint(r.transition), (i = this.onChange) == null || i.call(this, r.index)) : r.type === "animation" ? (r.group ? this.play(r.group) : this.applyVisibility(), (c = this.onAnimStep) == null || c.call(this, r.done, r.total)) : r.type === "zoom" && this.applyZoom();
    }), this.container.addEventListener("click", this.handleClick), this.paint();
  }
  // ---------------- 转发给状态机 ----------------
  get index() {
    return this.state.index;
  }
  get count() {
    return this.state.count;
  }
  get slide() {
    return this.state.slide;
  }
  get zoomLevel() {
    return this.state.zoom;
  }
  get animationTotal() {
    return this.state.animationTotal;
  }
  get animationDone() {
    return this.state.animationDone;
  }
  get hasPendingAnimation() {
    return this.state.hasPendingAnimation;
  }
  goTo(t, e = "forward") {
    this.state.goTo(t, e);
  }
  next() {
    this.state.next();
  }
  prev() {
    this.state.prev();
  }
  setZoom(t) {
    this.state.setZoom(t);
  }
  finishAnimations() {
    this.state.finishAnimations();
  }
  search(t) {
    return this.state.search(t);
  }
  text(t) {
    return this.state.text(t);
  }
  setAnimate(t) {
    this.state.setAnimate(t), this.paint();
  }
  playNextAnimation() {
    return this.state.playNextAnimation() !== null;
  }
  // ---------------- 渲染 ----------------
  /** 带缓存的单页 SVG（主视图用） */
  slideSvg(t) {
    let e = this.svgCache.get(t);
    return e === void 0 && (e = v(this.presentation, this.presentation.slides[t], {
      media: this.media,
      textMode: this.textMode
    }), this.svgCache.set(t, e)), e;
  }
  /** 不走缓存，用于缩略图等需要独立 defs id 的场景 */
  renderSlide(t) {
    const e = this.presentation.slides[t];
    return v(this.presentation, e, {
      // 缩略图不嵌播放器：既没意义，还会为每个缩略图各建一个媒体元素
      textMode: this.textMode,
      // 缩略图是静态产物，没有后续的 applyVisibility，隐藏状态只能烘进 SVG
      hiddenElements: [...w(e)]
    });
  }
  /**
   * 重渲当前页，页码与动画进度都不变。
   *
   * 给「渲染完之后世界才变」的情况用，最典型的是网络字体到货：原生 `<text>`
   * 路径的断行是渲染时拿 canvas 量出来烘进 SVG 的，字体换了就必须重量一遍；
   * `foreignObject` 路径由浏览器自己重排，重渲只是顺带把缓存换掉。
   */
  refresh() {
    this.svgCache.delete(this.index), this.paint();
  }
  exportPng(t = 2, e = this.index) {
    return T(this.presentation, this.presentation.slides[e], t);
  }
  paint(t) {
    const epoch = this.paintEpoch = (this.paintEpoch || 0) + 1;
    var i, c, o;
    (i = this.playing) == null || i.cancel(), this.playing = null, (c = this.cancelAuto) == null || c.call(this);
    const e = document.createElement("div");
    e.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center", e.innerHTML = this.slideSvg(this.index);
    const a = this.container.firstElementChild, n = this.container.ownerDocument.defaultView;
    (!n || n.getComputedStyle(this.container).position === "static") && (this.container.style.position = "relative"), t && a ? (this.container.appendChild(e), N(a, e, t).then(() => { if (this.paintEpoch === epoch) this.startAutoAdvance(); })) : (this.container.innerHTML = "", this.container.appendChild(e), this.startAutoAdvance());
    const r = e.querySelector("svg");
    r && (r.style.display = "block", r.style.maxWidth = "none"), this.applyZoom(), this.applyVisibility(), (o = this.onAnimStep) == null || o.call(this, this.state.animationDone, this.state.animationTotal);
  }
  play(t) {
    var e;
    (e = this.playing) == null || e.cancel(), this.playing = Y(this.container, t), this.applyVisibility();
  }
  /**
   * 按状态机给出的隐藏集合设置元素可见性。
   *
   * 不播动画时也要跑：静态画面取的是动画终态，退场元素同样得藏起来。
   */
  applyVisibility() {
    const t = this.state.hiddenElementIds;
    this.container.querySelectorAll("[data-el]").forEach((e) => {
      const a = Number(e.getAttribute("data-el"));
      e.style.visibility = t.has(a) ? "hidden" : "";
    });
  }
  applyZoom() {
    const t = this.container.querySelector("svg");
    if (!t) return;
    const e = this.state.zoom;
    e === 1 ? (t.style.width = "100%", t.style.height = "100%") : (t.style.width = `${this.presentation.width * e}px`, t.style.height = `${this.presentation.height * e}px`);
  }
  startAutoAdvance() {
    const epoch = this.paintEpoch;
    queueMicrotask(() => {
      if (this.paintEpoch !== epoch) return;
      const first = this.state.slide.animations?.[0];
      if (this.state.animate && this.state.animationDone === 0 && first?.autoStart) {
        this.state.playNextAnimation();
      }
      this.cancelAuto = this.state.scheduleAutoAdvance();
    });
  }
  destroy() {
    this.paintEpoch = (this.paintEpoch || 0) + 1;
    var t, e;
    this.container.removeEventListener("click", this.handleClick), this.unsubscribe(), (t = this.playing) == null || t.cancel(), (e = this.cancelAuto) == null || e.call(this), this.state.destroy(), this.container.innerHTML = "", this.svgCache.clear();
  }
}
export {
  F as PresentationState,
  O as Viewer,
  V as autoAdvanceMs,
  q as foreignObjectScalesCorrectly,
  z as framesFor,
  R as groupSteps,
  W as hiddenBefore,
  L as morphPairs,
  Y as playGroup,
  N as playTransition,
  H as resetForeignObjectProbe,
  G as staticHidden,
  x as transitionFrames
};
