(() => {
  // ../../packages/core/src/math.ts
  var clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  var lerp = (a, b, p) => a + (b - a) * p;
  var prog = (t, t0, d) => d <= 0 ? t >= t0 ? 1 : 0 : clamp((t - t0) / d);
  function quad(a, c, b, p) {
    const q = 1 - p;
    return [q * q * a[0] + 2 * q * p * c[0] + p * p * b[0], q * q * a[1] + 2 * q * p * c[1] + p * p * b[1]];
  }
  function arcControl(a, b, bend = 0.25) {
    return [(a[0] + b[0]) / 2 - (b[1] - a[1]) * bend, (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend];
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = s + 1831565813 >>> 0;
      let r = Math.imul(s ^ s >>> 15, 1 | s);
      r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }
  function seedOf(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  // ../../packages/core/src/easing.ts
  var linear = (p) => p;
  var sineIn = (p) => 1 - Math.cos(p * Math.PI / 2);
  var sineOut = (p) => Math.sin(p * Math.PI / 2);
  var sineInOut = (p) => -(Math.cos(Math.PI * p) - 1) / 2;
  var quadIn = (p) => p * p;
  var quadOut = (p) => 1 - (1 - p) * (1 - p);
  var quadInOut = (p) => p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
  var cubicIn = (p) => p ** 3;
  var cubicOut = (p) => 1 - (1 - p) ** 3;
  var cubicInOut = (p) => p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
  var quartIn = (p) => p ** 4;
  var quartOut = (p) => 1 - (1 - p) ** 4;
  var quartInOut = (p) => p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2;
  var quintIn = (p) => p ** 5;
  var quintOut = (p) => 1 - (1 - p) ** 5;
  var quintInOut = (p) => p < 0.5 ? 16 * p ** 5 : 1 - (-2 * p + 2) ** 5 / 2;
  var expoIn = (p) => p <= 0 ? 0 : 2 ** (10 * p - 10);
  var expoOut = (p) => p >= 1 ? 1 : 1 - 2 ** (-10 * p);
  var expoInOut = (p) => p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? 2 ** (20 * p - 10) / 2 : (2 - 2 ** (-20 * p + 10)) / 2;
  var circOut = (p) => Math.sqrt(1 - (p - 1) ** 2);
  var circInOut = (p) => p < 0.5 ? (1 - Math.sqrt(1 - (2 * p) ** 2)) / 2 : (Math.sqrt(1 - (-2 * p + 2) ** 2) + 1) / 2;
  var backOut = (s = 1.70158) => (p) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2;
  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (u) => ((ax * u + bx) * u + cx) * u;
    const sy = (u) => ((ay * u + by) * u + cy) * u;
    const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
    return (p) => {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      let u = p;
      for (let i = 0; i < 8; i++) {
        const e = sx(u) - p, d = dx(u);
        if (Math.abs(e) < 1e-7) return sy(u);
        if (Math.abs(d) < 1e-6) break;
        u -= e / d;
      }
      let lo = 0, hi = 1;
      u = p;
      for (let i = 0; i < 40; i++) {
        const x = sx(u);
        if (Math.abs(x - p) < 1e-7) break;
        if (x < p) lo = u;
        else hi = u;
        u = (lo + hi) / 2;
      }
      return sy(u);
    };
  }
  var emphasizedOut = cubicBezier(0.05, 0.7, 0.1, 1);
  var EASINGS = {
    linear,
    sineIn,
    sineOut,
    sineInOut,
    quadIn,
    quadOut,
    quadInOut,
    cubicIn,
    cubicOut,
    cubicInOut,
    quartIn,
    quartOut,
    quartInOut,
    quintIn,
    quintOut,
    quintInOut,
    expoIn,
    expoOut,
    expoInOut,
    circOut,
    circInOut,
    backOut: backOut(),
    emphasizedOut
  };
  var ease = (e, fallback = cubicInOut) => typeof e === "function" ? e : e ? EASINGS[e] : fallback;

  // ../../packages/core/src/spring.ts
  function toFreq(p = {}) {
    if ("stiffness" in p) {
      const m = p.mass ?? 1;
      const w = Math.sqrt(p.stiffness / m);
      return { w, zeta: p.damping / (2 * Math.sqrt(p.stiffness * m)), v0: p.velocity ?? 0 };
    }
    return { w: 2 * Math.PI * (p.freq ?? 1.8), zeta: p.zeta ?? 0.5, v0: p.velocity ?? 0 };
  }
  function spring(t, params = {}) {
    if (t <= 0) return 0;
    const { w, zeta, v0 } = toFreq(params);
    let x;
    if (zeta < 1) {
      const wd = w * Math.sqrt(1 - zeta * zeta);
      const a = -1, b = (v0 + zeta * w * a) / wd;
      x = Math.exp(-zeta * w * t) * (a * Math.cos(wd * t) + b * Math.sin(wd * t));
    } else if (zeta === 1) {
      const a = -1, b = v0 + w * a;
      x = Math.exp(-w * t) * (a + b * t);
    } else {
      const s = w * Math.sqrt(zeta * zeta - 1);
      const r1 = -zeta * w + s, r2 = -zeta * w - s;
      const c2 = (v0 - r1 * -1) / (r2 - r1), c1 = -1 - c2;
      x = c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
    }
    return 1 + x;
  }

  // ../../packages/core/src/keys.ts
  function keys(t, ks, fallback = cubicInOut) {
    if (!ks.length) throw new Error("keys(): empty track");
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) {
      if (t < ks[i][0]) {
        const [ta, va] = ks[i - 1], [tb, vb, e] = ks[i];
        return lerp(va, vb, ease(e, fallback)(prog(t, ta, tb - ta)));
      }
    }
    return ks[ks.length - 1][1];
  }

  // ../../packages/core/src/camera.ts
  function camera(tracks, stage2) {
    const cx = stage2.width / 2, cy = stage2.height / 2;
    return (t) => ({
      x: tracks.x?.length ? keys(t, tracks.x) : cx,
      y: tracks.y?.length ? keys(t, tracks.y) : cy,
      zoom: tracks.zoom?.length ? keys(t, tracks.zoom) : 1,
      rotate: tracks.rotate?.length ? keys(t, tracks.rotate) : 0
    });
  }
  function cameraTransform(c, stage2, extraZoom = 1) {
    const r = c.rotate ? ` rotate(${c.rotate}deg)` : "";
    return `translate(${stage2.width / 2}px,${stage2.height / 2}px)${r} scale(${c.zoom * extraZoom}) translate(${-c.x}px,${-c.y}px)`;
  }
  function worldToScreen(c, stage2, p) {
    const dx = (p[0] - c.x) * c.zoom, dy = (p[1] - c.y) * c.zoom;
    const a = c.rotate * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    return [stage2.width / 2 + dx * cos - dy * sin, stage2.height / 2 + dx * sin + dy * cos];
  }
  function screenToWorld(c, stage2, p) {
    const a = -c.rotate * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const sx = p[0] - stage2.width / 2, sy = p[1] - stage2.height / 2;
    const dx = sx * cos - sy * sin, dy = sx * sin + sy * cos;
    return [c.x + dx / c.zoom, c.y + dy / c.zoom];
  }
  function parallax(c, depth, stage2) {
    const cx = stage2.width / 2, cy = stage2.height / 2;
    return { x: cx + (c.x - cx) * depth, y: cy + (c.y - cy) * depth, zoom: 1 + (c.zoom - 1) * depth, rotate: c.rotate * depth };
  }
  function cameraDisplacement(a, b, stage2) {
    const pts = [[0, 0], [stage2.width, 0], [0, stage2.height], [stage2.width, stage2.height], [stage2.width / 2, stage2.height / 2]];
    let m = 0;
    for (const p of pts) {
      const w = screenToWorld(a, stage2, p), q = worldToScreen(b, stage2, w);
      m = Math.max(m, Math.hypot(q[0] - p[0], q[1] - p[1]));
    }
    return m;
  }

  // ../../packages/core/src/video.ts
  function defineScene(def) {
    if (!(def.end > def.start)) throw new Error(`scene "${def.name}": end (${def.end}) must be after start (${def.start})`);
    return def;
  }
  defineScene.from = (file, def) => ({ ...defineScene(def), file });
  function defineVideo(def) {
    const names = /* @__PURE__ */ new Set();
    for (const s of def.scenes) {
      if (names.has(s.name)) throw new Error(`video "${def.title}": two scenes are named "${s.name}"`);
      names.add(s.name);
      if (s.start < 0 || s.end > def.duration + 1e-9) throw new Error(`scene "${s.name}": [${s.start}, ${s.end}] is outside the video's 0\u2013${def.duration} s`);
    }
    return def;
  }
  function allMarkers(v) {
    const out = [...v.markers ?? []];
    for (const s of v.scenes) {
      out.push({ name: s.name, t: s.start, kind: "cut" });
      for (const [n, dt] of Object.entries(s.markers ?? {})) out.push({ name: `${s.name}.${n}`, t: s.start + dt, kind: "note" });
    }
    return out.sort((a, b) => a.t - b.t);
  }
  function activeScenes(v, t0, t1 = t0) {
    return v.scenes.filter((s) => t1 >= s.start && t0 < s.end);
  }
  function withAspect(v, aspect) {
    if (!aspect || aspect === (v.aspect ?? "16:9")) return v;
    const o = v.variants?.[aspect];
    if (!o) throw new Error(`video "${v.title}" has no layout for aspect ${aspect}; add variants["${aspect}"]`);
    return { ...v, ...o, aspect };
  }

  // ../../packages/core/src/theme.ts
  function defineTheme(t) {
    return t;
  }
  function themeCss(t, base = "") {
    const vars = [];
    for (const [k, v] of Object.entries(t.colors)) vars.push(`--c-${k}:${v}`);
    for (const [k, v] of Object.entries(t.fonts)) if (v) vars.push(`--f-${k}:${v}`);
    for (const [k, v] of Object.entries(t.radii)) vars.push(`--r-${k}:${v}px`);
    for (const [k, v] of Object.entries(t.shadows)) vars.push(`--s-${k}:${v}`);
    for (const [k, v] of Object.entries(t.extra ?? {})) vars.push(`--x-${k}:${v}`);
    const faces = (t.fontFaces ?? []).filter((f) => f.src).map((f) => {
      if (!f.src) return "";
      const url = /^(https?:|data:|\/)/.test(f.src) ? f.src : base + f.src;
      return `@font-face{font-family:"${f.family}";src:url("${url}");font-weight:${f.weight ?? "400"};font-style:${f.style ?? "normal"};${f.stretch ? `font-stretch:${f.stretch};` : ""}font-display:block}`;
    });
    return `${faces.join("\n")}
:root{${vars.join(";")}}`;
  }

  // ../../packages/core/src/storyboard.ts
  var easingNames = Object.keys(EASINGS);

  // ../../packages/core/src/dom.ts
  function tf(el, transform, opacity = 1) {
    el.style.transform = transform;
    el.style.opacity = String(opacity);
    el.style.visibility = opacity <= 1e-3 ? "hidden" : "";
  }
  function ensureStyle(id, css) {
    if (typeof document === "undefined" || document.getElementById(`dolly-style-${id}`)) return;
    const s = document.createElement("style");
    s.id = `dolly-style-${id}`;
    s.textContent = css;
    document.head.append(s);
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  var stageEl = null;
  var stageScale = 1;
  function setStage(el, scale) {
    stageEl = el;
    stageScale = scale;
  }
  function stagePoint(el, fx = 0.5, fy = 0.5) {
    if (!stageEl) throw new Error("stagePoint(): no stage mounted");
    const st = stageEl.getBoundingClientRect(), r = el.getBoundingClientRect();
    return [(r.left - st.left + r.width * fx) / stageScale, (r.top - st.top + r.height * fy) / stageScale];
  }

  // ../../packages/core/src/components/text.ts
  var CSS2 = `
.dolly-wm{display:inline-block;overflow:hidden;vertical-align:top;padding:0 .02em .14em;margin:0 -.02em -.14em}
.dolly-wi{display:inline-block;will-change:transform}
.dolly-accent{color:var(--c-accent)}`;
  function masked(el, text, opts2 = {}) {
    ensureStyle("masked", CSS2);
    const parts = text.split(/(\|[^|]*\|)/).filter(Boolean);
    let out = "";
    for (const part of parts) {
      const accent = part.startsWith("|") && part.endsWith("|") && part.length > 1;
      const s = accent ? part.slice(1, -1) : part;
      const units = opts2.chars ? [...s] : s.split(/(\s+)/);
      for (const u of units) {
        if (u === "") continue;
        if (!opts2.chars && /^\s+$/.test(u)) {
          out += " ";
          continue;
        }
        const cls = accent ? ` ${opts2.accentClass ?? "dolly-accent"}` : "";
        out += `<span class="dolly-wm"><span class="dolly-wi${cls}">${u === " " ? "&nbsp;" : escapeHtml(u)}</span></span>`;
      }
    }
    el.insertAdjacentHTML(opts2.prepend === false ? "beforeend" : "afterbegin", out);
    return [...el.querySelectorAll(".dolly-wi")];
  }
  function typeIn(units, t, tin, tout = Infinity, o = {}) {
    const stagger = o.stagger ?? 0.05, dur = o.dur ?? 0.75, exitDur = o.exitDur ?? 0.5, rise = o.rise ?? 140, rot = o.rotate ?? 6;
    const ein = o.ease ?? expoOut, eout = o.exitEase ?? quartInOut;
    units.forEach((u, i) => {
      const pin = ein(prog(t, tin + i * stagger, dur));
      const pout = eout(prog(t, tout + i * stagger * 0.6, exitDur));
      u.style.transform = `translateY(${(1 - pin) * rise - pout * rise}%) rotate(${(1 - pin) * rot}deg)`;
    });
  }

  // ../../packages/core/src/components/odometer.ts
  var CSS3 = `
.dolly-rl{display:inline-block;overflow:hidden;height:var(--dolly-lh,1.75em);vertical-align:top}
.dolly-rl>span{display:block}
.dolly-rl>span>span{display:block;height:var(--dolly-lh,1.75em)}`;
  var cell = (c) => c === " " || !c ? "&nbsp;" : escapeHtml(c);
  function roll(a, b, p) {
    ensureStyle("odometer", CSS3);
    const n = Math.max(a.length, b.length), A = a.padStart(n, " "), B = b.padStart(n, " ");
    let html = "";
    for (let i = 0; i < n; i++) {
      const ca = A[i] === " " ? "" : A[i], cb = B[i] === " " ? "" : B[i];
      if (ca === cb) {
        html += cell(cb);
        continue;
      }
      const q = expoOut(clamp(p * 1.4 - (n - 1 - i) * 0.05));
      if (q >= 1) {
        html += cell(cb);
        continue;
      }
      html += `<span class="dolly-rl"><span style="transform:translateY(${-q * 50}%)"><span>${cell(ca)}</span><span>${cell(cb)}</span></span></span>`;
    }
    return html;
  }
  function slide(a, b, p) {
    ensureStyle("odometer", CSS3);
    const q = expoOut(clamp(p));
    return q >= 1 ? escapeHtml(b) : `<span class="dolly-rl"><span style="transform:translateY(${-q * 50}%)"><span>${escapeHtml(a)}</span><span>${escapeHtml(b)}</span></span></span>`;
  }
  function setHtml(el, html) {
    if (el.__dollyHtml === html) return;
    el.innerHTML = html;
    el.__dollyHtml = html;
  }

  // ../../packages/core/src/components/primitives.ts
  var CSS4 = `
.dolly-badge{position:absolute;white-space:nowrap;background:var(--c-ink);color:#fff;font:600 19px/1.75 var(--f-ui,var(--f-body));padding:0 .6em;
  border-radius:var(--r-sm) var(--r-sm) var(--r-sm) 2px;box-shadow:0 6px 16px -6px rgba(10,12,16,.45);transform-origin:0 100%}
.dolly-chip{position:absolute;background:var(--c-surface);border-radius:var(--r-lg);padding:22px 30px 20px;box-shadow:var(--s-card)}
.dolly-card{position:absolute;background:var(--c-surface);border-radius:var(--r-lg);box-shadow:var(--s-float)}
.dolly-label{display:block;font:600 15px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--c-muted)}`;
  var primitivesCss = () => ensureStyle("primitives", CSS4);
  function badge(text, cls = "") {
    primitivesCss();
    const b = document.createElement("span");
    b.className = `dolly-badge ${cls}`.trim();
    b.textContent = text;
    return b;
  }
  function popIn(el, t, t0, o = {}) {
    const s = spring(t - t0, { freq: o.freq ?? 2.1, zeta: o.zeta ?? 0.42 });
    tf(el, `scale(${t < t0 ? 0 : Math.max(0, s)}) rotate(${(1 - clamp(s)) * (o.rotate ?? -8)}deg)${o.extra ? " " + o.extra : ""}`, clamp((t - t0) / (o.fade ?? 0.11)));
    return s;
  }
  function land(t, t0, amount = 0.035) {
    if (t <= t0) return 0;
    return Math.sin(Math.min(1, (t - t0) / 0.35) * Math.PI) * amount * Math.exp(-(t - t0) * 3);
  }
  var bob = (t, i, amp = 4, speed = 1.1) => Math.sin(t * speed + i * 1.9) * amp;

  // ../../packages/core/src/components/cursor.ts
  var CSS5 = `
.dolly-cursor{position:absolute;left:0;top:0;width:26px;z-index:5;filter:drop-shadow(0 4px 6px rgba(0,0,0,.25));transform-origin:2px 2px}
.dolly-ripple{position:absolute;left:0;top:0;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:2px solid var(--c-accent);z-index:4}`;
  var resolve = (p) => typeof p === "function" ? p() : p;
  function cursor(layer, o) {
    ensureStyle("cursor", CSS5);
    const ns = "http://www.w3.org/2000/svg";
    const el = document.createElementNS(ns, "svg");
    el.setAttribute("class", "dolly-cursor");
    el.setAttribute("viewBox", "0 0 26 36");
    el.innerHTML = `<path d="M2 2v28l7.5-7 5 11 5-2.3-5-10.7H25z" fill="${o.fill ?? "#14161b"}" stroke="${o.stroke ?? "#fff"}" stroke-width="2.4" stroke-linejoin="round"/>`;
    const ripple = document.createElement("div");
    ripple.className = "dolly-ripple";
    layer.append(el, ripple);
    const clicks = o.clicks ?? [];
    const from = o.from ?? o.path[0].t, to = o.to ?? o.path[o.path.length - 1].t + 0.4;
    const pos = (t) => {
      let p = resolve(o.path[0].at);
      for (let i = 1; i < o.path.length; i++) {
        const a = o.path[i - 1], b = o.path[i];
        if (t >= a.t) {
          const A = resolve(a.at), B = resolve(b.at);
          const e = (b.ease ?? cubicInOut)(prog(t, a.t, b.t - a.t));
          p = quad(A, arcControl(A, B, b.bend ?? 0.25), B, e);
        }
      }
      return p;
    };
    const render = (t) => {
      if (t < from || t > to) {
        tf(el, "none", 0);
        tf(ripple, "none", 0);
        return;
      }
      const p = pos(t);
      const press = clicks.reduce((m, tc) => Math.max(m, 1 - Math.abs(t - tc) / 0.09), 0);
      const fade = clamp((t - from) * 4) * (1 - prog(t, to - 0.4, 0.4));
      tf(el, `translate(${p[0]}px,${p[1]}px) scale(${1 - 0.14 * clamp(press)})`, fade);
      const rc = clicks.find((tc) => t >= tc && t < tc + 0.5);
      if (rc !== void 0) {
        const q = expoOut(prog(t, rc, 0.5));
        tf(ripple, `translate(${p[0]}px,${p[1]}px) scale(${0.3 + q * 1.3})`, (1 - q) * 0.8);
      } else tf(ripple, "none", 0);
    };
    return { el, ripple, pos, render };
  }

  // ../../packages/core/src/components/typing.ts
  var CSS6 = `
.dolly-ch{display:inline-block}
.dolly-caret{display:inline-block;width:2px;height:1.05em;background:var(--c-accent);vertical-align:-.15em;margin-left:2px}`;
  function typing(t, o) {
    ensureStyle("typing", CSS6);
    const n = clamp(Math.floor((t - o.t0) / o.gap) + 1, 0, o.text.length);
    const typed = o.text.slice(0, n), last = n ? o.t0 + (n - 1) * o.gap : -Infinity;
    const shown = o.format ? o.format(typed) : typed;
    const chars = [...shown].map((ch, i, all) => {
      const isNew = i === all.length - 1 && t - last < 0.25;
      const q = isNew ? expoOut(prog(t, last, 0.22)) : 1;
      return `<span class="dolly-ch" style="transform:translateY(${(1 - q) * -14}px) scale(${lerp(1.25, 1, q)});opacity:${q}">${escapeHtml(ch)}</span>`;
    }).join("");
    const caret = o.focused && (t * 1.9 % 1 < 0.55 || t - last < 0.5) ? `<span class="dolly-caret"></span>` : "";
    return { n, typed, last, html: chars + caret };
  }

  // ../../packages/core/src/components/layout.ts
  var tilt = (ry, rx = 0, perspective = 1500, extra = "") => `perspective(${perspective}px)${extra ? " " + extra : ""} rotateY(${ry}deg) rotateX(${rx}deg)`;
  function swingIn(el, t, t0, o = {}) {
    const p = spring(t - t0, { freq: 1, zeta: 0.7 });
    const drift = sineInOut(prog(t, t0 + 0.95, o.driftDur ?? 4.5));
    const ry = lerp(o.from ?? -38, o.to ?? -10, p) + drift * (o.drift ?? 5);
    tf(el, tilt(ry, (o.rx ?? 2) - drift * 2, 1500, `translateX(${(1 - p) * (o.dx ?? 520)}px)`), clamp((t - t0) * 4));
  }
  function parallaxGrid(layer, o = {}) {
    const g = document.createElement("div");
    const dot = o.dot ?? 1.3, gap = o.gap ?? 28, depth = o.depth ?? 0.5;
    g.style.cssText = `position:absolute;inset:-2px;background-image:radial-gradient(circle, ${o.color ?? "#d3d8e1"} ${dot}px, transparent ${dot + 0.3}px)`;
    layer.append(g);
    return (cam2, stage2, extraZoom = 1) => {
      const c = parallax({ ...cam2, zoom: cam2.zoom * extraZoom }, depth, stage2);
      const s = gap * c.zoom;
      g.style.backgroundSize = `${s}px ${s}px`;
      g.style.backgroundPosition = `${-c.x * c.zoom + stage2.width / 2}px ${-c.y * c.zoom + stage2.height / 2}px`;
    };
  }
  function zoomInto(layer, target, t, t0, t1, o = {}) {
    const z = prog(t, t0, t1 - t0);
    if (z <= 0) return { z, css: "", origin: "" };
    const W = o.stage?.width ?? 1280, H = o.stage?.height ?? 720;
    layer.style.transform = "none";
    target.style.transform = "none";
    const [px, py] = stagePoint(target, 0.5, 0.5);
    const e = quartInOut(z), zs = Math.exp(Math.log(o.maxScale ?? 60) * Math.pow(z, 2.2));
    target.style.color = `rgba(255,255,255,${1 - clamp(z * (o.fadeText ?? 3.5))})`;
    return { z, css: `translate(${(W / 2 - px) * e}px,${(H / 2 - py) * e}px) scale(${zs})`, origin: `${px}px ${py}px` };
  }
  var END_CSS = `
.dolly-end{position:absolute;inset:0;background:var(--c-ink);color:#f3f4f7}
.dolly-end .logo{position:absolute;left:50%;top:21%;font:700 64px/1.75 var(--f-ui,var(--f-body));padding:0 .42em;border-radius:30px 30px 30px 5px;background:#fff;color:var(--c-ink);transform-origin:50% 50%}
.dolly-end .name{position:absolute;left:0;right:0;top:46%;text-align:center;margin:0;transform-origin:50% 0;font:800 116px/1 var(--f-display);letter-spacing:-.04em}
.dolly-end .tag{position:absolute;left:0;right:0;top:66%;text-align:center;margin:0;transform-origin:50% 0;font:500 34px var(--f-body);color:#a5abb8}
.dolly-end .tag .dolly-accent{color:var(--c-accent-soft,#8ea0ff)}`;
  function endCard(layer, o) {
    ensureStyle("end-card", END_CSS);
    const el = document.createElement("div");
    el.className = "dolly-end";
    el.innerHTML = `<div class="logo"></div><h2 class="name"></h2><p class="tag"></p>`;
    layer.append(el);
    const logo = el.querySelector(".logo"), name = el.querySelector(".name"), tag = el.querySelector(".tag");
    logo.textContent = o.logo;
    const nameChars = masked(name, o.name, { chars: true }), tagWords = masked(tag, o.tagline);
    return {
      el,
      render(t) {
        const push = 1 + sineInOut(prog(t, o.pushFrom, o.pushDur)) * 0.05;
        const ls = spring(t - o.at.logo, { freq: 1.5, zeta: 0.5 });
        logo.style.marginLeft = -logo.offsetWidth / 2 + "px";
        tf(logo, `scale(${Math.max(0, ls) * push}) rotate(${(1 - ls) * -14}deg)`, clamp((t - o.at.logo) * 8));
        name.style.transform = tag.style.transform = `scale(${push})`;
        typeIn(nameChars, t, o.at.name, Infinity, { stagger: 0.04, dur: 0.8 });
        typeIn(tagWords, t, o.at.tag, Infinity, { stagger: 0.07, dur: 0.8 });
      }
    };
  }

  // ../../packages/core/src/runtime.ts
  var DollyRenderError = class extends Error {
    scene;
    t;
    constructor(scene, t, cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      super(`scene "${scene}" at t=${t.toFixed(3)}s: ${msg}`);
      this.name = "DollyRenderError";
      this.scene = scene;
      this.t = t;
      if (cause instanceof Error && cause.stack) this.stack = `${this.name}: ${this.message}
${cause.stack.split("\n").slice(1).join("\n")}`;
    }
  };
  var IDENTITY = (w, h) => ({ x: w / 2, y: h / 2, zoom: 1, rotate: 0 });
  function freezeClock() {
    let now = 0, rand = rng(1);
    const epoch = Date.UTC(2026, 0, 1);
    Math.random = () => rand();
    Date.now = () => epoch + now * 1e3;
    performance.now = () => now * 1e3;
    return { at(t) {
      now = t;
      rand = rng(seedOf(t.toFixed(6)));
    } };
  }
  async function mount(input, opts2 = {}) {
    const params = new URLSearchParams(location.search);
    const v = withAspect(input, params.get("aspect") ?? opts2.aspect);
    const W = v.stage.width, H = v.stage.height;
    const clock = freezeClock();
    const bg = v.background ?? v.theme.colors.bg;
    const style = document.createElement("style");
    style.textContent = `${themeCss(v.theme, opts2.assetBase ?? "")}
html,body{margin:0;overflow:hidden;background:#000}
*{box-sizing:border-box}
*,*::before,*::after{animation-play-state:paused!important;transition:none!important}
#dolly-stage{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;transform-origin:0 0;background:${bg};color:var(--c-fg);font-family:var(--f-body)}
.dolly-layer{position:absolute;left:0;top:0;width:${W}px;height:${H}px}
#dolly-world{transform-origin:0 0;z-index:10}
#dolly-hud{z-index:20}
.dolly-c{position:absolute;left:0;top:0;width:${W}px;height:${H}px}`;
    document.head.append(style);
    const sheets = (v.theme.fontCss ?? []).map((href) => new Promise((res, rej) => {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      l.onload = () => res();
      l.onerror = () => rej(new Error(`font stylesheet failed to load: ${href}`));
      document.head.append(l);
    }));
    const stage2 = document.createElement("div");
    stage2.id = "dolly-stage";
    const world = document.createElement("div");
    world.id = "dolly-world";
    world.className = "dolly-layer";
    const hud = document.createElement("div");
    hud.id = "dolly-hud";
    hud.className = "dolly-layer";
    stage2.append(world, hud);
    document.body.append(stage2);
    const fit = () => {
      const k = Math.min(innerWidth / W, innerHeight / H);
      stage2.style.transform = `scale(${k})`;
      stage2.style.left = (innerWidth - W * k) / 2 + "px";
      stage2.style.top = (innerHeight - H * k) / 2 + "px";
      setStage(stage2, k);
      return k;
    };
    let scale = fit();
    addEventListener("resize", () => {
      scale = fit();
    });
    const camera2 = (t) => v.camera ? v.camera(t) : IDENTITY(W, H);
    const markers = allMarkers(v);
    const screens = /* @__PURE__ */ new Map();
    const screenLayer = (z) => {
      let l = screens.get(z);
      if (!l) {
        l = document.createElement("div");
        l.className = "dolly-layer";
        l.style.zIndex = String(z);
        stage2.append(l);
        screens.set(z, l);
      }
      return l;
    };
    const makeCtx = (name, owned) => {
      const container = (parent, layer) => {
        const c = document.createElement("div");
        c.className = "dolly-c";
        c.dataset.scene = name;
        c.dataset.layer = layer;
        parent.append(c);
        owned.push(c);
        return c;
      };
      let w, hd;
      const ctx = {
        video: v,
        stage: v.stage,
        aspect: v.aspect ?? "16:9",
        theme: v.theme,
        get world() {
          return w ??= container(world, "world");
        },
        get hud() {
          return hd ??= container(hud, "hud");
        },
        layers: { stage: stage2, world, hud },
        screen: (z, layer = `screen${z}`) => container(screenLayer(z), layer),
        camera: camera2,
        $: (id) => {
          for (const c of owned) {
            const el = c.querySelector(`#${CSS.escape(id)}`);
            if (el) return el;
          }
          throw new Error(`scene "${name}": no element #${id}`);
        },
        marker: (m) => {
          const found = markers.find((x) => x.name === m);
          if (!found) throw new Error(`no marker "${m}" (have: ${markers.map((x) => x.name).join(", ")})`);
          return found.t;
        }
      };
      return ctx;
    };
    const mounted = [];
    const worldOwned = [];
    const worldCtx = makeCtx("world", worldOwned);
    mounted.push({ def: null, name: "world", ctx: worldCtx, containers: worldOwned, visible: true });
    for (const s of v.scenes) {
      const owned = [];
      mounted.push({ def: s, name: s.name, ctx: makeCtx(s.name, owned), containers: owned, visible: true });
    }
    const time = (t, s) => {
      const start = s?.start ?? 0, end = s?.end ?? v.duration;
      return { t, local: t - start, progress: Math.min(1, Math.max(0, (t - start) / (end - start))), start, end };
    };
    const render = (t) => {
      clock.at(t);
      world.style.transform = cameraTransform(camera2(t), v.stage);
      if (v.world?.render) {
        try {
          v.world.render(time(t), worldCtx);
        } catch (e) {
          throw new DollyRenderError("world", t, e);
        }
      }
      for (const m of mounted) {
        if (!m.def) continue;
        const on = t >= m.def.start && t < m.def.end;
        if (on !== m.visible) {
          for (const c of m.containers) c.style.display = on ? "" : "none";
          m.visible = on;
        }
        if (!on) continue;
        try {
          m.def.render(time(t, m.def), m.ctx);
        } catch (e) {
          throw new DollyRenderError(m.name, t, e);
        }
      }
    };
    const meta = {
      title: v.title,
      fps: v.fps,
      duration: v.duration,
      stage: { ...v.stage },
      bpm: v.bpm,
      beatOffset: v.beatOffset,
      aspect: v.aspect ?? "16:9",
      scenes: v.scenes.map((s) => ({ name: s.name, start: s.start, end: s.end, file: s.file })),
      markers,
      audio: v.audio ?? [],
      background: bg
    };
    const LAYER = /^(dolly-stage|dolly-world|dolly-hud)$/;
    const tracked = () => [...stage2.querySelectorAll("*")].filter((el) => !LAYER.test(el.id) && !el.classList.contains("dolly-layer") && !el.classList.contains("dolly-c"));
    const visibleBox = (el) => {
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return null;
      const r = el.getBoundingClientRect();
      return r.width || r.height ? r : null;
    };
    const motion = (t0, t1) => {
      const st = stage2.getBoundingClientRect();
      const inside = (x, horizontal) => horizontal ? x >= st.left - 2 && x <= st.right + 2 : x >= st.top - 2 && x <= st.bottom + 2;
      render(t0);
      const a = /* @__PURE__ */ new Map();
      for (const el of tracked()) {
        const r = visibleBox(el);
        if (r) a.set(el, r);
      }
      render(t1);
      let px = 0, who = null;
      for (const el of tracked()) {
        const r0 = a.get(el);
        if (!r0) continue;
        const r1 = visibleBox(el);
        if (!r1) continue;
        const d = Math.max(
          inside(r0.left, true) || inside(r1.left, true) ? Math.abs(r1.left - r0.left) : 0,
          inside(r0.right, true) || inside(r1.right, true) ? Math.abs(r1.right - r0.right) : 0,
          inside(r0.top, false) || inside(r1.top, false) ? Math.abs(r1.top - r0.top) : 0,
          inside(r0.bottom, false) || inside(r1.bottom, false) ? Math.abs(r1.bottom - r0.bottom) : 0
        );
        if (d > px) {
          px = d;
          who = el;
        }
      }
      const cam2 = cameraDisplacement(camera2(t0), camera2(t1), v.stage) * scale;
      return { px: Math.max(px, cam2), camera: cam2, element: who ? describe(who) : null };
    };
    const describe = (el) => {
      const n = el.dataset?.name ?? (el.id ? `#${el.id}` : null);
      if (n) return n;
      const parts = [];
      for (let e = el; e && e !== stage2 && parts.length < 4; e = e.parentElement) {
        if (e.id) {
          parts.unshift(`#${e.id}`);
          break;
        }
        const cls = [...e.classList].filter((c) => !c.startsWith("dolly-"))[0];
        parts.unshift(e.tagName.toLowerCase() + (cls ? `.${cls}` : ""));
      }
      return parts.join(" > ");
    };
    const inspect = (t, o = {}) => {
      render(t);
      const st = stage2.getBoundingClientRect();
      const out = [];
      for (const el of tracked()) {
        const r = visibleBox(el);
        if (!r) continue;
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? "").join("").trim();
        if (!own && !o.all) continue;
        let op = 1;
        for (let e = el; e && e !== stage2; e = e.parentElement) op *= +getComputedStyle(e).opacity;
        const cs = getComputedStyle(el);
        let bgc;
        for (let e = el; e; e = e.parentElement) {
          const b = getComputedStyle(e).backgroundColor;
          if (b && b !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(b)) {
            bgc = b;
            break;
          }
          if (e === stage2) break;
        }
        const he = el;
        const ratio = he.offsetHeight ? r.height / he.offsetHeight : scale;
        out.push({
          name: describe(el),
          scene: el.closest(".dolly-c")?.dataset.scene ?? null,
          rect: { x: (r.left - st.left) / scale, y: (r.top - st.top) / scale, w: r.width / scale, h: r.height / scale },
          opacity: +op.toFixed(3),
          ...own ? { text: own, fontSize: +(parseFloat(cs.fontSize) * ratio / scale).toFixed(2), color: cs.color, background: bgc ?? bg } : {}
        });
      }
      return { t, camera: camera2(t), scenes: activeScenes(v, t).map((s) => s.name), elements: out };
    };
    const api = { version: 1, meta, ready: null, render, motion, inspect, fit: () => scale = fit() };
    window.__dolly = api;
    api.ready = (async () => {
      if (v.world?.setup) await v.world.setup(worldCtx);
      for (const m of mounted) if (m.def?.setup) {
        try {
          await m.def.setup(m.ctx);
        } catch (e) {
          throw new DollyRenderError(m.name, 0, e);
        }
      }
      await Promise.all(sheets);
      const faces = v.theme.fontFaces ?? [];
      const results = await Promise.all(faces.map((f) => document.fonts.load(`${f.style ?? "normal"} ${f.weight?.split(" ")[0] ?? "400"} 32px "${f.family}"`).then((r) => [f, r.length])));
      const missing = results.filter(([, n]) => n === 0).map(([f]) => `${f.family} ${f.weight ?? ""} (${f.src ?? "from fontCss"})`);
      if (missing.length) throw new Error(`fonts failed to load: ${missing.join("; ")}`);
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode().catch(() => {
        throw new Error(`image failed to load: ${i.src}`);
      })));
      render(0);
      return meta;
    })();
    return api;
  }

  // theme.ts
  var theme = defineTheme({
    name: "price-peek",
    colors: { bg: "#eef1f6", fg: "#14161b", accent: "#3355ff", "accent-soft": "#8ea0ff", muted: "#8a90a0", surface: "#ffffff", ink: "#14161b", line: "#dfe2e8", grid: "#d3d8e1" },
    // price: glyphs Instrument Sans lacks (₩, ฿, 万) fall back to the generic sans-serif, as on the store page
    fonts: { display: '"Bricolage Grotesque", sans-serif', body: '"Instrument Sans", "Segoe UI", sans-serif', price: '"Instrument Sans", sans-serif', ui: '"Segoe UI", "Instrument Sans", sans-serif' },
    // TODO(self-host): vendor these OFL fonts into fonts/ so renders never touch the network.
    fontCss: ["https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600;700&display=block"],
    fontFaces: [
      { family: "Bricolage Grotesque", weight: "800" },
      { family: "Bricolage Grotesque", weight: "700" },
      { family: "Instrument Sans", weight: "500" },
      { family: "Instrument Sans", weight: "600" },
      { family: "Instrument Sans", weight: "700" }
    ],
    radii: { sm: 8, md: 14, lg: 22 },
    shadows: {
      card: "0 24px 48px -28px rgba(20,24,40,.35), 0 0 0 1px rgba(20,24,40,.05)",
      float: "0 50px 90px -40px rgba(20,24,40,.5), 0 0 0 1px rgba(20,24,40,.06)"
    }
  });

  // shared.ts
  var R = { EUR: 1, DKK: 7.4748, KRW: 1499.01, USD: 1.1253, GBP: 0.84385, JPY: 177.82, CNY: 7.524, CHF: 0.9272, THB: 37.602 };
  var dk = (n, d = 0) => n.toLocaleString("da-DK", { minimumFractionDigits: d, maximumFractionDigits: d });
  var FMT = { DKK: { suf: " kr." }, EUR: { pre: "\u20AC" }, USD: { pre: "$" }, GBP: { pre: "\xA3" } };
  function money(v, c = "DKK") {
    const f = FMT[c];
    let num, sc = "";
    if (v >= 1e9) {
      num = dk(v / 1e9, 1);
      sc = " mia.";
    } else if (v >= 1e8) {
      num = dk(v / 1e6, 0);
      sc = " mio.";
    } else if (v >= 1e6) {
      num = dk(v / 1e6, 1);
      sc = " mio.";
    } else if (v >= 10) num = dk(Math.round(v));
    else num = dk(v, 2);
    return f.pre ? `${f.pre}${num}${sc}` : `${num}${sc}${f.suf}`;
  }
  var conv = (v, from, to = "DKK") => money(v / R[from] * R[to], to);
  var T_REEL = [7.25, 9.25, 11.25, 13.25];
  var REEL_X = 2190;
  var REEL_Y0 = 330;
  var REEL_GAP = 250;
  var T_D = { popIn: 13.55, cursorIn: 14.3, atSel: 15, open: 15.1, glide: 15.65, pick: 16.3, cursorOut: 17.4 };
  var T_E = { dolly: 19, zoom: 24.15, zoomEnd: 25.35 };
  var T_F = { logo: 25.5, name: 25.8, tag: 26.35 };
  function sharedStyles() {
    ensureStyle("price-peek", `
#dolly-stage{font-variant-numeric:tabular-nums}
.pp-h{position:absolute;margin:0;font:800 76px/0.98 var(--f-display);letter-spacing:-.035em;color:var(--c-fg)}
.pp-abs{position:absolute}
.pp-mark{position:absolute;left:80px;bottom:56px;display:flex;align-items:center;gap:12px;font:700 24px var(--f-display);letter-spacing:-.01em}
.pp-mark i{display:inline-block;background:var(--c-ink);color:#fff;font:700 15px/1.75 var(--f-ui);font-style:normal;padding:0 .55em;border-radius:7px 7px 7px 1px}
.dolly-badge{letter-spacing:0}
.dolly-chip .city{display:block;margin-top:8px;font:600 15px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--c-muted)}
.dolly-chip .p{white-space:nowrap;position:relative;display:inline-block;margin-top:10px;font:700 44px/1.1 var(--f-price);letter-spacing:-.02em}
.dolly-chip .p .dolly-badge{top:-30px;right:-34px}
.pp-item{position:absolute;transform-origin:0 50%}
.pp-item .w,.pp-yen .w{position:relative;display:inline-block;font:700 92px/1.05 var(--f-price);letter-spacing:-.03em;white-space:nowrap}
.pp-item .w .dolly-badge,.pp-yen .w .dolly-badge{top:-34px;right:-46px;font-size:28px}
.pp-yen .w .dolly-badge{transform-origin:50% 100%}
.pp-item .note{display:block;margin-top:14px;font:600 16px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--c-muted)}
.pp-yen{position:absolute;transform-origin:0 50%;white-space:nowrap}
`);
  }

  // scenes/prices.ts
  var CHIPS = [
    ["Seoul", "\u20A91,500,000", 15e5, "KRW", 600, 62],
    ["New York", "$249", 249, "USD", 1040, 116],
    ["Berlin", "19,99 \u20AC", 19.99, "EUR", 640, 258],
    ["Tokyo", "\xA542,800", 42800, "JPY", 960, 314],
    ["London", "\xA3219", 219, "GBP", 660, 452],
    ["Bangkok", "\u0E3F8,490", 8490, "THB", 1e3, 500]
  ];
  var CHIP_IN = [[0, 0], [380, -160], [-260, 60], [320, 120], [-200, 260], [300, 300]];
  var T_CHIP = [0, 1.1, 1.25, 1.4, 1.55, 1.7];
  var T_BADGE = [3.5, 3.75, 4, 4.25, 4.5, 4.75];
  var headA;
  var headB;
  var chips = [];
  var prices_default = defineScene.from("scenes/prices.ts", {
    name: "prices",
    start: 0,
    end: 7.4,
    markers: { "head-a": 2.05, "head-b": 3.3, badges: 3.5 },
    setup(ctx) {
      primitivesCss();
      const hA = document.createElement("h2");
      hA.className = "pp-h";
      hA.style.cssText = "left:80px;top:190px;width:470px";
      const hB = document.createElement("h2");
      hB.className = "pp-h";
      hB.style.cssText = "left:80px;top:150px;width:520px";
      ctx.world.append(hA, hB);
      headA = masked(hA, "Shopping |abroad?|");
      headB = masked(hB, "Every price, in |your| currency.");
      for (const [city, shown, v, c, x, y] of CHIPS) {
        const el = document.createElement("div");
        el.className = "dolly-chip";
        el.style.left = x + "px";
        el.style.top = y + "px";
        const p = document.createElement("span");
        p.className = "p";
        const b = badge(conv(v, c));
        p.append(b);
        const cityEl = document.createElement("span");
        cityEl.className = "city";
        cityEl.textContent = city;
        el.append(p, cityEl);
        ctx.world.append(el);
        chips.push({ el, chars: masked(p, shown, { chars: true }), badge: b });
      }
    },
    render({ t }) {
      chips.forEach(({ el, chars, badge: b }, i) => {
        const [dx, dy] = CHIP_IN[i];
        const s = i === 0 ? 1 : spring(t - T_CHIP[i], { freq: 1.25, zeta: 0.62 });
        const bump = 1 + land(t, T_BADGE[i]);
        const y = bob(t, i, 4, 1.1) * clamp(t - 2.5);
        tf(
          el,
          `translate(${dx * (1 - s)}px,${dy * (1 - s) + y}px) rotate(${(1 - s) * (i % 2 ? 9 : -9)}deg) scale(${(i === 0 ? 1 : lerp(0.7, 1, s)) * bump})`,
          i === 0 ? clamp(t * 6) : clamp((t - T_CHIP[i]) * 5)
        );
        typeIn(chars, t, i === 0 ? 0.15 : T_CHIP[i] + 0.1, Infinity, i === 0 ? { stagger: 0.045, dur: 0.8 } : { stagger: 0.03, dur: 0.6 });
        popIn(b, t, T_BADGE[i]);
      });
      typeIn(headA, t, 2.05, 3.15, { stagger: 0.08 });
      typeIn(headB, t, 3.3, Infinity, { stagger: 0.06 });
    }
  });

  // scenes/reel.ts
  var REEL = [
    ["3\uC5B5 5,000\uB9CC\uC6D0", 35e7, "KRW", "Korean \uC5B5 and \uB9CC"],
    ["3\u4E07\u5186", 3e4, "JPY", "Japanese \u4E07"],
    ["19,99 \u20AC", 19.99, "EUR", "Decimal comma"]
  ];
  var head;
  var items = [];
  var reel_default = defineScene.from("scenes/reel.ts", {
    name: "reel",
    start: 6.9,
    end: 13.8,
    setup(ctx) {
      const hC = document.createElement("h2");
      hC.className = "pp-h";
      hC.style.cssText = "left:80px;top:200px;width:430px";
      ctx.hud.append(hC);
      head = masked(hC, "Reads prices the |local| way.");
      REEL.forEach(([shown, v, c, note], i) => {
        const el = document.createElement("div");
        el.className = "pp-item";
        el.style.left = REEL_X + "px";
        el.style.top = REEL_Y0 + i * REEL_GAP - 70 + "px";
        const w = document.createElement("span");
        w.className = "w";
        const b = badge(conv(v, c));
        w.append(b);
        const n = document.createElement("span");
        n.className = "note";
        n.textContent = note;
        el.append(w, n);
        ctx.world.append(el);
        items.push({ el, chars: masked(w, shown, { chars: true }), badge: b });
      });
    },
    render({ t }, ctx) {
      const cy = ctx.camera(t).y;
      items.forEach(({ el, chars, badge: b }, i) => {
        const d = (REEL_Y0 + i * REEL_GAP - (cy - 30)) / REEL_GAP;
        const k = Math.min(Math.abs(d), 1.6);
        tf(el, `scale(${1 - 0.14 * k})`, t < T_REEL[i] - 0.3 ? 0 : clamp(1 - 0.7 * k) * (1 - prog(t, 13.2, 0.5)));
        typeIn(chars, t, T_REEL[i] - 0.25, Infinity, { stagger: 0.035, dur: 0.7 });
        popIn(b, t, T_REEL[i] + 0.5);
      });
      typeIn(head, t, 7.45, 12.75, { stagger: 0.07 });
    }
  });

  // scenes/control.ts
  var OPTS = [["DKK", "Danish krone"], ["EUR", "Euro"], ["USD", "US dollar"], ["GBP", "British pound"], ["SEK", "Swedish krona"], ["NOK", "Norwegian krone"]];
  var CSS7 = `
.pp-pop{position:absolute;width:400px;background:#fff;border-radius:20px;box-shadow:var(--s-float);font-family:var(--f-body);transform-origin:0 50%}
.pp-pop header{display:flex;align-items:center;gap:14px;padding:20px 22px;border-bottom:1px solid #eceef2}
.pp-pop header i{font:700 15px/1.75 var(--f-ui);font-style:normal;background:var(--c-ink);color:#fff;padding:0 .55em;border-radius:7px 7px 7px 1px}
.pp-pop header b{display:block;font-size:18px;line-height:1.75;height:1.75em;overflow:hidden}
.pp-pop header small{display:block;color:var(--c-muted);font-size:14px}
.pp-pop .r{position:relative;display:flex;align-items:center;justify-content:space-between;padding:15px 22px;border-bottom:1px solid #eceef2;font-size:17px}
.pp-pop .r:last-child{border-bottom:0}
.pp-pop .sel{border:1px solid var(--c-line);border-radius:9px;padding:2px 12px;font-size:16px;font-weight:600;background:#fff;line-height:1.75}
.pp-pop .sel.open{border-color:var(--c-accent);box-shadow:0 0 0 4px rgba(51,85,255,.15)}
.pp-menu{position:absolute;right:22px;top:54px;width:236px;background:#fff;border-radius:12px;padding:6px;z-index:2;transform-origin:70% 0;box-shadow:0 24px 48px -20px rgba(20,24,40,.4),0 0 0 1px rgba(20,24,40,.08)}
.pp-menu .opt{position:relative;padding:8px 10px;border-radius:8px;font-size:15px;font-weight:500;z-index:1}
.pp-menu .opt b{display:inline-block;width:42px;font-weight:700}
.pp-menu .opt.hi{color:#fff}
.pp-menu .pill{position:absolute;left:6px;right:6px;height:36px;border-radius:8px;background:var(--c-accent)}
.pp-tg{width:44px;height:26px;border-radius:13px;background:var(--c-ink);position:relative}
.pp-tg::after{content:"";position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:50%;background:#fff}
.pp-tg.off{background:#d5d8de}.pp-tg.off::after{right:auto;left:4px}`;
  var head2;
  var yenChars;
  var yen;
  var yenB;
  var popWrap;
  var sel;
  var rateLine;
  var menu;
  var pill;
  var opts;
  var cur;
  var control_default = defineScene.from("scenes/control.ts", {
    name: "control",
    start: 12.9,
    end: 19.8,
    markers: { "pop-in": 0.65, pick: 3.4 },
    setup(ctx) {
      ensureStyle("pp-control", CSS7);
      const hD = document.createElement("h2");
      hD.className = "pp-h";
      hD.style.cssText = "left:80px;top:96px;width:620px";
      ctx.hud.append(hD);
      head2 = masked(hD, "Your currency, your call.");
      yen = document.createElement("div");
      yen.className = "pp-yen";
      const w = document.createElement("span");
      w.className = "w";
      yenB = badge("");
      w.append(yenB);
      yen.append(w);
      ctx.world.append(yen);
      yenChars = masked(w, "\xA542,800", { chars: true });
      popWrap = document.createElement("div");
      popWrap.className = "pp-abs";
      popWrap.style.cssText = "left:2380px;top:800px";
      popWrap.innerHTML = `<div class="pp-pop">
      <header><i>kr.</i><div><b class="rate"></b><small>Daily ECB rate</small></div></header>
      <div class="r">Convert to <span class="sel"></span><div class="pp-menu"><div class="pill"></div>${OPTS.map(([c, n]) => `<div class="opt"><b>${c}</b>${n}</div>`).join("")}</div></div>
      <div class="r">On <span class="pp-tg"></span></div>
      <div class="r">On this site <span class="pp-tg"></span></div>
      <div class="r">Show all prices <span class="pp-tg off"></span></div>
      <div class="r">Area &amp; weight <span class="pp-tg"></span></div></div>`;
      ctx.world.append(popWrap);
      sel = popWrap.querySelector(".sel");
      rateLine = popWrap.querySelector(".rate");
      menu = popWrap.querySelector(".pp-menu");
      pill = popWrap.querySelector(".pill");
      opts = [...popWrap.querySelectorAll(".opt")];
      const selP = () => stagePoint(sel, 0.55, 0.6);
      const eurP = () => stagePoint(opts[1], 0.35, 0.55);
      cur = cursor(ctx.screen(30, "cursor"), {
        path: [
          { t: T_D.cursorIn, at: [1250, 690] },
          { t: T_D.atSel, at: selP },
          { t: T_D.glide - 0.1, at: selP },
          { t: T_D.glide + 0.3, at: eurP },
          { t: T_D.cursorOut, at: eurP },
          { t: 18.4, at: () => {
            const [x, y] = eurP();
            return [x + 150, y + 210];
          } }
        ],
        clicks: [T_D.open, T_D.pick],
        from: T_D.cursorIn,
        to: 18.5
      });
    },
    render({ t }, ctx) {
      const cy = ctx.camera(t).y;
      {
        const arrive = T_REEL[3], sl = expoOut(prog(t, 13.55, 1));
        const d = (REEL_Y0 + 3 * REEL_GAP - (cy - 30)) / REEL_GAP, k = Math.min(Math.abs(d), 1.6);
        yen.style.left = lerp(REEL_X, 1690, sl) + "px";
        yen.style.top = lerp(REEL_Y0 + 3 * REEL_GAP - 70, 1150 - 60, sl) + "px";
        tf(yen, `scale(${(1 - 0.14 * k) * lerp(1, 0.9, sl)})`, t < arrive - 0.3 ? 0 : 1 - 0.6 * Math.min(k, 1.2));
        typeIn(yenChars, t, arrive - 0.25, Infinity, { stagger: 0.035, dur: 0.7 });
      }
      typeIn(head2, t, 13.8, Infinity, { stagger: 0.06 });
      swingIn(popWrap, t, T_D.popIn);
      const pk = prog(t, T_D.pick, 0.55);
      setHtml(sel, t < T_D.pick ? "DKK \xB7 Danish krone \u25BE" : slide("DKK \xB7 Danish krone \u25BE", "EUR \xB7 Euro \u25BE", pk));
      const r0 = `1.000 \u20A9 = ${conv(1e3, "KRW")}`, r1 = `1.000 \u20A9 = ${conv(1e3, "KRW", "EUR")}`;
      setHtml(rateLine, t < T_D.pick ? r0 : slide(r0, r1, pk));
      {
        const t0 = T_REEL[3] + 0.5;
        if (t < T_D.pick + 0.05) {
          yenB.textContent = conv(42800, "JPY");
          popIn(yenB, t, t0);
        } else {
          const f = (t - T_D.pick - 0.05) / 0.5, half = f < 0.5;
          yenB.textContent = half ? conv(42800, "JPY") : conv(42800, "JPY", "EUR");
          const ang = half ? f * 2 * 90 : lerp(-90, 0, spring((f - 0.5) * 0.5, { freq: 2.2, zeta: 0.45 }));
          tf(yenB, `perspective(500px) rotateX(${ang}deg)`, 1);
        }
      }
      sel.classList.toggle("open", t >= T_D.open && t < T_D.pick + 0.15);
      if (t >= T_D.open && t < T_D.pick + 0.3) {
        const pin = spring(t - T_D.open, { freq: 2.4, zeta: 0.7 }), pout = cubicInOut(prog(t, T_D.pick + 0.08, 0.2));
        tf(menu, `translateY(${(1 - pin) * -10}px) scale(${lerp(0.92, 1, pin) - pout * 0.04})`, clamp((t - T_D.open) * 8) * (1 - pout));
        opts.forEach((o, i) => {
          const q = expoOut(prog(t, T_D.open + 0.04 + i * 0.035, 0.4));
          o.style.transform = `translateY(${(1 - q) * -8}px)`;
          o.style.opacity = String(q);
        });
        const gp = spring(t - T_D.glide, { freq: 2.6, zeta: 0.75 });
        const top = lerp(opts[0].offsetTop, opts[1].offsetTop, gp);
        pill.style.top = top + "px";
        opts.forEach((o) => o.classList.toggle("hi", Math.abs(o.offsetTop - top) < 18));
      } else {
        tf(menu, t < T_D.open ? "translateY(-10px) scale(0.92)" : "translateY(0px) scale(0.96)", 0);
        opts.forEach((o) => {
          o.style.transform = "none";
          o.style.opacity = "1";
        });
      }
      cur.render(t);
    }
  });

  // scenes/typing.ts
  var TYPE1 = { t0: 20.45, gap: 0.2, text: "500000", cur: "KRW", focus: 20.1 };
  var TYPE2 = { t0: 22.3, gap: 0.22, text: "1200", cur: "USD", focus: 21.95 };
  var CSS8 = `
.pp-le{position:absolute;left:0;top:0;width:1280px;height:720px}
.pp-form{position:absolute;background:#fff;border-radius:22px;padding:34px 38px 40px;box-shadow:var(--s-float);transform-origin:0 50%}
.pp-form .lab{font:600 16px var(--f-price);letter-spacing:.08em;text-transform:uppercase;color:var(--c-muted)}
.pp-form .line{display:flex;align-items:center;gap:18px;margin-top:16px;font:600 28px var(--f-price);color:#5b6170}
.pp-inp{position:relative;width:330px;height:78px;border-radius:14px;border:2px solid var(--c-line);font:600 36px/74px var(--f-price);color:var(--c-fg);padding:0 20px;white-space:nowrap}
.pp-inp.focus{border-color:var(--c-accent);box-shadow:0 0 0 5px rgba(51,85,255,.15)}
.pp-inp .pre{color:#9aa0ad;margin-right:6px}
.pp-inp .dolly-caret{height:38px;vertical-align:-6px}
.pp-inp .dolly-badge{top:-34px;right:-24px;font-size:24px}`;
  var lE;
  var form;
  var head3;
  var inputs = [];
  var typing_default = defineScene.from("scenes/typing.ts", {
    name: "typing",
    start: 19,
    end: 25.4,
    setup(ctx) {
      ensureStyle("pp-typing", CSS8);
      lE = document.createElement("div");
      lE.className = "pp-le";
      ctx.screen(40, "typing").append(lE);
      const hE = document.createElement("h2");
      hE.className = "pp-h";
      hE.style.cssText = "left:80px;top:170px;width:500px";
      form = document.createElement("div");
      form.className = "pp-form";
      form.style.cssText = "left:640px;top:150px;width:580px";
      form.innerHTML = `<div class="lab">Price range \xB7 min</div><div class="line"><div class="pp-inp"></div>\uC6D0</div>
      <div class="lab" style="margin-top:46px">Budget</div><div class="line"><div class="pp-inp"></div></div>`;
      lE.append(hE, form);
      head3 = masked(hE, "Even the numbers you |type.|");
      form.querySelectorAll(".pp-inp").forEach((el, i) => {
        const k = i === 0 ? TYPE1 : TYPE2;
        if (k.cur === "USD") {
          const pre = document.createElement("span");
          pre.className = "pre";
          pre.textContent = "$";
          el.append(pre);
        }
        const text = document.createElement("span");
        el.append(text);
        const b = badge("");
        el.append(b);
        inputs.push({ el, text, badge: b, k });
      });
    },
    render({ t }) {
      typeIn(head3, t, 19.55, Infinity, { stagger: 0.06 });
      for (const { el, text, badge: b, k } of inputs) {
        const focused = k === TYPE1 ? t >= k.focus && t < TYPE2.focus : t >= k.focus;
        el.classList.toggle("focus", focused);
        const st = typing(t, { t0: k.t0, gap: k.gap, text: k.text, focused, format: k.cur === "USD" ? (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : void 0 });
        setHtml(text, st.html);
        if (!st.n) {
          tf(b, "scale(0)", 0);
          continue;
        }
        const now = conv(+st.typed, k.cur);
        setHtml(b, st.n > 1 ? roll(conv(+k.text.slice(0, st.n - 1), k.cur), now, prog(t, st.last, 0.3)) : now);
        if (st.n === 1) popIn(b, t, k.t0, { freq: 2.3 });
        else {
          const q = prog(t, st.last, 0.3);
          tf(b, `scale(${1 + 0.1 * Math.sin(q * Math.PI) * (1 - q)})`, 1);
        }
      }
      const arr = cubicInOut(prog(t, T_E.dolly + 0.1, 0.8));
      const fy = sineInOut(prog(t, 19.6, 5));
      form.style.transform = `perspective(1500px) rotateY(${lerp(-16, -5, fy)}deg) rotateX(${lerp(4, 1, fy)}deg)`;
      let css = `scale(${lerp(0.62, 1, arr)})`, origin = "640px 360px";
      const z = zoomInto(lE, inputs[1].badge, t, T_E.zoom, T_E.zoomEnd, { maxScale: 60 });
      if (z.z > 0) {
        css = z.css;
        origin = z.origin;
      }
      lE.style.transformOrigin = origin;
      tf(lE, css, t < T_E.dolly + 0.1 || t >= T_E.zoomEnd ? 0 : clamp(arr * 1.5));
    }
  });

  // scenes/end.ts
  var FLOATS = [
    ["7.480 kr.", 150, 120, 1],
    ["\u20AC241", 1050, 96, 0],
    ["1.654 kr.", 1040, 590, 2],
    ["$271", 190, 580, 0],
    ["1,7 mio. kr.", 960, 250, 0],
    ["149 kr.", 120, 340, 2],
    ["\xA3203", 1130, 420, 1],
    ["1.261 kr.", 330, 640, 1]
  ];
  var card;
  var floats = [];
  var end_default = defineScene.from("scenes/end.ts", {
    name: "end",
    start: 25.33,
    end: 30,
    setup(ctx) {
      ensureStyle("pp-end", `.dolly-end .dolly-badge{background:#262a33;color:#c9cdd6;box-shadow:none;transform-origin:50% 50%}`);
      card = endCard(ctx.screen(60, "end"), { logo: "kr.", name: "Price Peek", tagline: "Any price, in |your| currency.", at: T_F, pushFrom: T_E.zoomEnd, pushDur: 4.65 });
      for (const [s, x, y] of FLOATS) {
        const b = badge(s);
        b.style.left = x + "px";
        b.style.top = y + "px";
        card.el.insertBefore(b, card.el.firstChild);
        floats.push(b);
      }
    },
    render({ t }) {
      card.render(t);
      FLOATS.forEach(([, x, y, depth], i) => {
        const t0 = T_F.tag + 0.1 + i * 0.09, s = spring(t - t0, { freq: 1.3, zeta: 0.6 });
        const par = [0.4, 0.8, 1.5][depth], sc = [0.8, 1, 1.55][depth];
        const dx = (x - 640) * (1 - s) * -0.4, dy = (y - 360) * (1 - s) * -0.4;
        const drift = (t - T_E.zoomEnd) * -14 * par;
        const el = floats[i];
        el.style.filter = depth === 2 ? "blur(3px)" : depth === 0 ? "blur(1px)" : "none";
        tf(el, `translate(${dx + drift}px,${dy + Math.sin(t * 0.8 + i) * 6 * par}px) scale(${sc * Math.max(0, s)})`, clamp((t - t0) * 4) * [0.45, 0.8, 0.55][depth]);
      });
    }
  });

  // video.ts
  var stage = { width: 1280, height: 720 };
  var cam = camera({
    x: [[0, 795], [0.95, 795], [2.45, 640, quartInOut], [6.7, 650, sineInOut], [7.3, 2240, quartInOut]],
    y: [
      [0, 112],
      [0.95, 116],
      [2.45, 360, quartInOut],
      [6.7, 352, sineInOut],
      [7.3, 360, quartInOut],
      [9, 360],
      [9.55, 360 + REEL_GAP, quartInOut],
      [11, 360 + REEL_GAP],
      [11.55, 360 + 2 * REEL_GAP, quartInOut],
      [13, 360 + 2 * REEL_GAP],
      [13.6, 360 + 3 * REEL_GAP, quartInOut],
      [19, 370 + 3 * REEL_GAP, sineInOut]
    ],
    // pull back from the extreme close-up, then a slow push-in on every hold so the frame never sits still
    zoom: [
      [0, 2.7],
      [0.95, 2.55],
      [2.45, 1, quartInOut],
      [6.7, 1.07, sineInOut],
      [7, 1, quartInOut],
      [13.1, 1.05, sineInOut],
      [13.6, 1, quartInOut],
      [19, 1.06, sineInOut]
    ]
  }, stage);
  var grid;
  var glow;
  var mark;
  var video_default = defineVideo({
    title: "Price Peek",
    stage,
    fps: 60,
    duration: 30,
    bpm: 120,
    theme,
    camera: cam,
    world: {
      setup(ctx) {
        sharedStyles();
        const bg = ctx.screen(0, "background");
        grid = parallaxGrid(bg, { gap: 28, dot: 1.3, color: "#d3d8e1", depth: 0.5 });
        glow = document.createElement("div");
        glow.style.cssText = "position:absolute;width:900px;height:900px;margin:-450px 0 0 -450px;border-radius:50%;background:radial-gradient(closest-side, rgba(255,255,255,.85), rgba(255,255,255,0))";
        bg.append(glow);
        mark = document.createElement("div");
        mark.className = "pp-mark";
        mark.innerHTML = "<i>kr.</i>Price Peek";
        ctx.screen(50, "brand").append(mark);
      },
      render({ t }, ctx) {
        const c = ctx.camera(t);
        const dol = cubicInOut(prog(t, T_E.dolly, 0.75));
        const ws = c.zoom * (1 + dol * 1.4);
        const w = ctx.layers.world;
        w.style.transform = `translate(640px,360px) scale(${ws}) translate(${-c.x}px,${-c.y}px)`;
        w.style.opacity = String(1 - dol);
        w.style.visibility = dol >= 1 ? "hidden" : "visible";
        ctx.layers.hud.style.transformOrigin = "640px 360px";
        tf(ctx.layers.hud, `scale(${1 + dol * 0.5})`, 1 - dol);
        grid(c, stage, 1 + dol * 1.4);
        glow.style.left = 640 + Math.sin(t * 0.35) * 260 + "px";
        glow.style.top = 330 + Math.cos(t * 0.27) * 140 + "px";
        tf(mark, `translateY(${(1 - expoOut(prog(t, 0.6, 0.8))) * 20}px)`, expoOut(prog(t, 0.6, 0.8)) * (1 - prog(t, T_E.zoom, 0.4)));
      }
    },
    scenes: [prices_default, reel_default, control_default, typing_default, end_default],
    markers: [
      { name: "hook", t: 0, kind: "cut" },
      { name: "badges", t: 3.5, kind: "beat" },
      { name: "whip", t: 6.7, kind: "cut" },
      { name: "pick-euro", t: 16.3, kind: "beat" },
      { name: "dolly", t: 19, kind: "cut" },
      { name: "zoom-end", t: 24.15, kind: "cut" }
    ]
  });

  // dolly-entry.ts
  window.__dollyMount = mount(video_default, { assetBase: "/project/" }).catch((e) => {
    window.__dollyError = String(e && e.stack || e);
    throw e;
  });
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvbWF0aC50cyIsICIuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9lYXNpbmcudHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvc3ByaW5nLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2tleXMudHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvY2FtZXJhLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3ZpZGVvLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3RoZW1lLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3N0b3J5Ym9hcmQudHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvZG9tLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2NvbXBvbmVudHMvdGV4dC50cyIsICIuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9jb21wb25lbnRzL29kb21ldGVyLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2NvbXBvbmVudHMvcHJpbWl0aXZlcy50cyIsICIuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9jb21wb25lbnRzL2N1cnNvci50cyIsICIuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9jb21wb25lbnRzL3R5cGluZy50cyIsICIuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9jb21wb25lbnRzL2xheW91dC50cyIsICIuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9ydW50aW1lLnRzIiwgInRoZW1lLnRzIiwgInNoYXJlZC50cyIsICJzY2VuZXMvcHJpY2VzLnRzIiwgInNjZW5lcy9yZWVsLnRzIiwgInNjZW5lcy9jb250cm9sLnRzIiwgInNjZW5lcy90eXBpbmcudHMiLCAic2NlbmVzL2VuZC50cyIsICJ2aWRlby50cyIsICJkb2xseS1lbnRyeS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gUHVyZSBzY2FsYXIgaGVscGVycy4gRXZlcnl0aGluZyBoZXJlIGlzIGEgZnVuY3Rpb24gb2YgaXRzIGFyZ3VtZW50cyBvbmx5LCBzbyBpdCBydW5zIHRoZSBzYW1lIGluIHRoZVxuLy8gYnJvd3NlciwgaW4gTm9kZSAobGludCwgdGVzdHMpIGFuZCBvbiBldmVyeSByZW5kZXIgd29ya2VyLlxuXG5leHBvcnQgY29uc3QgY2xhbXAgPSAoeDogbnVtYmVyLCBhID0gMCwgYiA9IDEpOiBudW1iZXIgPT4gTWF0aC5taW4oYiwgTWF0aC5tYXgoYSwgeCkpO1xuXG5leHBvcnQgY29uc3QgbGVycCA9IChhOiBudW1iZXIsIGI6IG51bWJlciwgcDogbnVtYmVyKTogbnVtYmVyID0+IGEgKyAoYiAtIGEpICogcDtcblxuLyoqIFByb2dyZXNzIG9mIHQgdGhyb3VnaCBbdDAsIHQwICsgZF0sIGNsYW1wZWQgdG8gMC4uMS4gQSB6ZXJvIGR1cmF0aW9uIGlzIGEgc3RlcCBhdCB0MC4gKi9cbmV4cG9ydCBjb25zdCBwcm9nID0gKHQ6IG51bWJlciwgdDA6IG51bWJlciwgZDogbnVtYmVyKTogbnVtYmVyID0+IChkIDw9IDAgPyAodCA+PSB0MCA/IDEgOiAwKSA6IGNsYW1wKCh0IC0gdDApIC8gZCkpO1xuXG4vKiogSW52ZXJzZSBsZXJwLCB1bmNsYW1wZWQuICovXG5leHBvcnQgY29uc3QgdW5sZXJwID0gKGE6IG51bWJlciwgYjogbnVtYmVyLCB4OiBudW1iZXIpOiBudW1iZXIgPT4gKGIgPT09IGEgPyAwIDogKHggLSBhKSAvIChiIC0gYSkpO1xuXG4vKiogTWFwIHggZnJvbSBbYTAsIGExXSB0byBbYjAsIGIxXSwgY2xhbXBlZC4gKi9cbmV4cG9ydCBjb25zdCByZW1hcCA9ICh4OiBudW1iZXIsIGEwOiBudW1iZXIsIGExOiBudW1iZXIsIGIwOiBudW1iZXIsIGIxOiBudW1iZXIpOiBudW1iZXIgPT4gbGVycChiMCwgYjEsIGNsYW1wKHVubGVycChhMCwgYTEsIHgpKSk7XG5cbmV4cG9ydCB0eXBlIFZlYzIgPSByZWFkb25seSBbbnVtYmVyLCBudW1iZXJdO1xuXG5leHBvcnQgY29uc3QgbGVycDIgPSAoYTogVmVjMiwgYjogVmVjMiwgcDogbnVtYmVyKTogW251bWJlciwgbnVtYmVyXSA9PiBbbGVycChhWzBdLCBiWzBdLCBwKSwgbGVycChhWzFdLCBiWzFdLCBwKV07XG5cbmV4cG9ydCBjb25zdCBkaXN0ID0gKGE6IFZlYzIsIGI6IFZlYzIpOiBudW1iZXIgPT4gTWF0aC5oeXBvdChiWzBdIC0gYVswXSwgYlsxXSAtIGFbMV0pO1xuXG4vKiogUG9pbnQgb24gYSBxdWFkcmF0aWMgYmV6aWVyLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1YWQoYTogVmVjMiwgYzogVmVjMiwgYjogVmVjMiwgcDogbnVtYmVyKTogW251bWJlciwgbnVtYmVyXSB7XG4gIGNvbnN0IHEgPSAxIC0gcDtcbiAgcmV0dXJuIFtxICogcSAqIGFbMF0gKyAyICogcSAqIHAgKiBjWzBdICsgcCAqIHAgKiBiWzBdLCBxICogcSAqIGFbMV0gKyAyICogcSAqIHAgKiBjWzFdICsgcCAqIHAgKiBiWzFdXTtcbn1cblxuLyoqIFBvaW50IG9uIGEgY3ViaWMgYmV6aWVyLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGN1YmljKGE6IFZlYzIsIGMxOiBWZWMyLCBjMjogVmVjMiwgYjogVmVjMiwgcDogbnVtYmVyKTogW251bWJlciwgbnVtYmVyXSB7XG4gIGNvbnN0IHEgPSAxIC0gcCwgdzAgPSBxICogcSAqIHEsIHcxID0gMyAqIHEgKiBxICogcCwgdzIgPSAzICogcSAqIHAgKiBwLCB3MyA9IHAgKiBwICogcDtcbiAgcmV0dXJuIFt3MCAqIGFbMF0gKyB3MSAqIGMxWzBdICsgdzIgKiBjMlswXSArIHczICogYlswXSwgdzAgKiBhWzFdICsgdzEgKiBjMVsxXSArIHcyICogYzJbMV0gKyB3MyAqIGJbMV1dO1xufVxuXG4vKipcbiAqIENvbnRyb2wgcG9pbnQgdGhhdCBiZW5kcyB0aGUgc3RyYWlnaHQgcGF0aCBhXHUyMTkyYiBzaWRld2F5cyBieSBgYmVuZGAgXHUwMEQ3IGl0cyBsZW5ndGgsIGdpdmluZyB0aGUgY3VydmVkLFxuICogaGFuZC1tb3ZlZCBwYXRocyBhIGN1cnNvciBzaG91bGQgZm9sbG93LiBQb3NpdGl2ZSBiZW5kcyB0byB0aGUgbGVmdCBvZiB0aGUgZGlyZWN0aW9uIG9mIHRyYXZlbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFyY0NvbnRyb2woYTogVmVjMiwgYjogVmVjMiwgYmVuZCA9IDAuMjUpOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgcmV0dXJuIFsoYVswXSArIGJbMF0pIC8gMiAtIChiWzFdIC0gYVsxXSkgKiBiZW5kLCAoYVsxXSArIGJbMV0pIC8gMiArIChiWzBdIC0gYVswXSkgKiBiZW5kXTtcbn1cblxuLyoqXG4gKiBTZWVkZWQgUFJORyAobXVsYmVycnkzMikuIFNjZW5lcyBtdXN0IG5ldmVyIHVzZSBNYXRoLnJhbmRvbTogZnJhbWVzIGFyZSByZW5kZXJlZCBpbiBwYXJhbGxlbCwgb3V0IG9mXG4gKiBvcmRlciBhbmQgbW9yZSB0aGFuIG9uY2UsIHNvIGV2ZXJ5IHZhbHVlIGhhcyB0byBjb21lIGZyb20gdGhlIHNlZWQgYW5kIHRoZSB0aW1lLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcm5nKHNlZWQ6IG51bWJlcik6ICgpID0+IG51bWJlciB7XG4gIGxldCBzID0gc2VlZCA+Pj4gMDtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBzID0gKHMgKyAweDZkMmI3OWY1KSA+Pj4gMDtcbiAgICBsZXQgciA9IE1hdGguaW11bChzIF4gKHMgPj4+IDE1KSwgMSB8IHMpO1xuICAgIHIgPSAociArIE1hdGguaW11bChyIF4gKHIgPj4+IDcpLCA2MSB8IHIpKSBeIHI7XG4gICAgcmV0dXJuICgociBeIChyID4+PiAxNCkpID4+PiAwKSAvIDQyOTQ5NjcyOTY7XG4gIH07XG59XG5cbi8qKiBTdGFibGUgaGFzaCBvZiBhIHN0cmluZyB0byBhIDMyLWJpdCBzZWVkIChGTlYtMWEpLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlZWRPZihzOiBzdHJpbmcpOiBudW1iZXIge1xuICBsZXQgaCA9IDB4ODExYzlkYzU7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcy5sZW5ndGg7IGkrKykgaCA9IE1hdGguaW11bChoIF4gcy5jaGFyQ29kZUF0KGkpLCAweDAxMDAwMTkzKTtcbiAgcmV0dXJuIGggPj4+IDA7XG59XG5cbi8qKiBTbW9vdGggdmFsdWUgbm9pc2UgaW4gWy0xLCAxXSwgc2VlZGVkLCBmb3IgZHJpZnQgYW5kIGhhbmRoZWxkIHdvYmJsZSB0aGF0IHN0YXlzIGEgcHVyZSBmdW5jdGlvbiBvZiB0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vaXNlMSh0OiBudW1iZXIsIHNlZWQgPSAwKTogbnVtYmVyIHtcbiAgY29uc3QgaSA9IE1hdGguZmxvb3IodCksIGYgPSB0IC0gaTtcbiAgY29uc3QgaCA9IChuOiBudW1iZXIpID0+IHJuZyhzZWVkT2YoYCR7c2VlZH06JHtufWApKSgpICogMiAtIDE7XG4gIGNvbnN0IHUgPSBmICogZiAqICgzIC0gMiAqIGYpO1xuICByZXR1cm4gbGVycChoKGkpLCBoKGkgKyAxKSwgdSk7XG59XG5cbi8qKiBSb3VuZCB0byBhIGdyaWQgc3RlcCAoYmVhdHMsIGZyYW1lcykuICovXG5leHBvcnQgY29uc3Qgc25hcCA9ICh4OiBudW1iZXIsIHN0ZXA6IG51bWJlcik6IG51bWJlciA9PiBNYXRoLnJvdW5kKHggLyBzdGVwKSAqIHN0ZXA7XG4iLCAiLy8gRWFzaW5nIGN1cnZlcywgcCBpbiAwLi4xIFx1MjE5MiAwLi4xLiBOYW1lcyBmb2xsb3cgZWFzaW5ncy5uZXQgc28gdGhleSBhcmUgZWFzeSB0byB0YWxrIGFib3V0LlxuLy8gTW90aW9uIGdyYW1tYXI6IGVudHJhbmNlcyBlYXNlIG91dCAoZXhwb091dCwgY3ViaWNPdXQpLCBleGl0cyBlYXNlIGluLCBtb3ZlcyB3aXRoaW4gdGhlIGZyYW1lIGVhc2Vcbi8vIGluLW91dCAocXVhcnRJbk91dCBmb3IgY2FtZXJhIG1vdmVzKSwgZHJpZnRzIHVzZSBzaW5lSW5PdXQsIGxpbmVhciBvbmx5IGZvciB0aGluZ3MgdGhhdCBuZXZlciBzdG9wLlxuXG5leHBvcnQgdHlwZSBFYXNpbmcgPSAocDogbnVtYmVyKSA9PiBudW1iZXI7XG5cbmV4cG9ydCBjb25zdCBsaW5lYXI6IEVhc2luZyA9IHAgPT4gcDtcblxuZXhwb3J0IGNvbnN0IHNpbmVJbjogRWFzaW5nID0gcCA9PiAxIC0gTWF0aC5jb3MoKHAgKiBNYXRoLlBJKSAvIDIpO1xuZXhwb3J0IGNvbnN0IHNpbmVPdXQ6IEVhc2luZyA9IHAgPT4gTWF0aC5zaW4oKHAgKiBNYXRoLlBJKSAvIDIpO1xuZXhwb3J0IGNvbnN0IHNpbmVJbk91dDogRWFzaW5nID0gcCA9PiAtKE1hdGguY29zKE1hdGguUEkgKiBwKSAtIDEpIC8gMjtcblxuZXhwb3J0IGNvbnN0IHF1YWRJbjogRWFzaW5nID0gcCA9PiBwICogcDtcbmV4cG9ydCBjb25zdCBxdWFkT3V0OiBFYXNpbmcgPSBwID0+IDEgLSAoMSAtIHApICogKDEgLSBwKTtcbmV4cG9ydCBjb25zdCBxdWFkSW5PdXQ6IEVhc2luZyA9IHAgPT4gKHAgPCAwLjUgPyAyICogcCAqIHAgOiAxIC0gKC0yICogcCArIDIpICoqIDIgLyAyKTtcblxuZXhwb3J0IGNvbnN0IGN1YmljSW46IEVhc2luZyA9IHAgPT4gcCAqKiAzO1xuZXhwb3J0IGNvbnN0IGN1YmljT3V0OiBFYXNpbmcgPSBwID0+IDEgLSAoMSAtIHApICoqIDM7XG5leHBvcnQgY29uc3QgY3ViaWNJbk91dDogRWFzaW5nID0gcCA9PiAocCA8IDAuNSA/IDQgKiBwICoqIDMgOiAxIC0gKC0yICogcCArIDIpICoqIDMgLyAyKTtcblxuZXhwb3J0IGNvbnN0IHF1YXJ0SW46IEVhc2luZyA9IHAgPT4gcCAqKiA0O1xuZXhwb3J0IGNvbnN0IHF1YXJ0T3V0OiBFYXNpbmcgPSBwID0+IDEgLSAoMSAtIHApICoqIDQ7XG5leHBvcnQgY29uc3QgcXVhcnRJbk91dDogRWFzaW5nID0gcCA9PiAocCA8IDAuNSA/IDggKiBwICoqIDQgOiAxIC0gKC0yICogcCArIDIpICoqIDQgLyAyKTtcblxuZXhwb3J0IGNvbnN0IHF1aW50SW46IEVhc2luZyA9IHAgPT4gcCAqKiA1O1xuZXhwb3J0IGNvbnN0IHF1aW50T3V0OiBFYXNpbmcgPSBwID0+IDEgLSAoMSAtIHApICoqIDU7XG5leHBvcnQgY29uc3QgcXVpbnRJbk91dDogRWFzaW5nID0gcCA9PiAocCA8IDAuNSA/IDE2ICogcCAqKiA1IDogMSAtICgtMiAqIHAgKyAyKSAqKiA1IC8gMik7XG5cbmV4cG9ydCBjb25zdCBleHBvSW46IEVhc2luZyA9IHAgPT4gKHAgPD0gMCA/IDAgOiAyICoqICgxMCAqIHAgLSAxMCkpO1xuZXhwb3J0IGNvbnN0IGV4cG9PdXQ6IEVhc2luZyA9IHAgPT4gKHAgPj0gMSA/IDEgOiAxIC0gMiAqKiAoLTEwICogcCkpO1xuZXhwb3J0IGNvbnN0IGV4cG9Jbk91dDogRWFzaW5nID0gcCA9PlxuICBwIDw9IDAgPyAwIDogcCA+PSAxID8gMSA6IHAgPCAwLjUgPyAyICoqICgyMCAqIHAgLSAxMCkgLyAyIDogKDIgLSAyICoqICgtMjAgKiBwICsgMTApKSAvIDI7XG5cbmV4cG9ydCBjb25zdCBjaXJjT3V0OiBFYXNpbmcgPSBwID0+IE1hdGguc3FydCgxIC0gKHAgLSAxKSAqKiAyKTtcbmV4cG9ydCBjb25zdCBjaXJjSW5PdXQ6IEVhc2luZyA9IHAgPT5cbiAgcCA8IDAuNSA/ICgxIC0gTWF0aC5zcXJ0KDEgLSAoMiAqIHApICoqIDIpKSAvIDIgOiAoTWF0aC5zcXJ0KDEgLSAoLTIgKiBwICsgMikgKiogMikgKyAxKSAvIDI7XG5cbi8qKiBPdmVyc2hvb3RzIGJ5IGBzYCAoMS43MDE1OCBcdTIyNDggMTAlKSBiZWZvcmUgc2V0dGxpbmcuICovXG5leHBvcnQgY29uc3QgYmFja091dCA9IChzID0gMS43MDE1OCk6IEVhc2luZyA9PiBwID0+IDEgKyAocyArIDEpICogKHAgLSAxKSAqKiAzICsgcyAqIChwIC0gMSkgKiogMjtcblxuLyoqXG4gKiBDU1MgY3ViaWMtYmV6aWVyKHgxLCB5MSwgeDIsIHkyKS4gU29sdmVzIHgodSkgPSBwIGJ5IE5ld3RvbiBpdGVyYXRpb25zIHdpdGggYSBiaXNlY3Rpb24gZmFsbGJhY2s7XG4gKiBhY2N1cmF0ZSB0byB+MWUtNywgZGV0ZXJtaW5pc3RpYy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGN1YmljQmV6aWVyKHgxOiBudW1iZXIsIHkxOiBudW1iZXIsIHgyOiBudW1iZXIsIHkyOiBudW1iZXIpOiBFYXNpbmcge1xuICBjb25zdCBjeCA9IDMgKiB4MSwgYnggPSAzICogKHgyIC0geDEpIC0gY3gsIGF4ID0gMSAtIGN4IC0gYng7XG4gIGNvbnN0IGN5ID0gMyAqIHkxLCBieSA9IDMgKiAoeTIgLSB5MSkgLSBjeSwgYXkgPSAxIC0gY3kgLSBieTtcbiAgY29uc3Qgc3ggPSAodTogbnVtYmVyKSA9PiAoKGF4ICogdSArIGJ4KSAqIHUgKyBjeCkgKiB1O1xuICBjb25zdCBzeSA9ICh1OiBudW1iZXIpID0+ICgoYXkgKiB1ICsgYnkpICogdSArIGN5KSAqIHU7XG4gIGNvbnN0IGR4ID0gKHU6IG51bWJlcikgPT4gKDMgKiBheCAqIHUgKyAyICogYngpICogdSArIGN4O1xuICByZXR1cm4gcCA9PiB7XG4gICAgaWYgKHAgPD0gMCkgcmV0dXJuIDA7XG4gICAgaWYgKHAgPj0gMSkgcmV0dXJuIDE7XG4gICAgbGV0IHUgPSBwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgODsgaSsrKSB7XG4gICAgICBjb25zdCBlID0gc3godSkgLSBwLCBkID0gZHgodSk7XG4gICAgICBpZiAoTWF0aC5hYnMoZSkgPCAxZS03KSByZXR1cm4gc3kodSk7XG4gICAgICBpZiAoTWF0aC5hYnMoZCkgPCAxZS02KSBicmVhaztcbiAgICAgIHUgLT0gZSAvIGQ7XG4gICAgfVxuICAgIGxldCBsbyA9IDAsIGhpID0gMTsgdSA9IHA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCA0MDsgaSsrKSB7XG4gICAgICBjb25zdCB4ID0gc3godSk7XG4gICAgICBpZiAoTWF0aC5hYnMoeCAtIHApIDwgMWUtNykgYnJlYWs7XG4gICAgICBpZiAoeCA8IHApIGxvID0gdTsgZWxzZSBoaSA9IHU7XG4gICAgICB1ID0gKGxvICsgaGkpIC8gMjtcbiAgICB9XG4gICAgcmV0dXJuIHN5KHUpO1xuICB9O1xufVxuXG4vKiogTWF0ZXJpYWwgMyBcImVtcGhhc2l6ZWQgZGVjZWxlcmF0ZVwiLCBhIGdvb2QgZGVmYXVsdCBmb3IgbGFyZ2UgZW50cmFuY2VzLiAqL1xuZXhwb3J0IGNvbnN0IGVtcGhhc2l6ZWRPdXQgPSBjdWJpY0JlemllcigwLjA1LCAwLjcsIDAuMSwgMSk7XG5cbmV4cG9ydCBjb25zdCBFQVNJTkdTID0ge1xuICBsaW5lYXIsIHNpbmVJbiwgc2luZU91dCwgc2luZUluT3V0LCBxdWFkSW4sIHF1YWRPdXQsIHF1YWRJbk91dCwgY3ViaWNJbiwgY3ViaWNPdXQsIGN1YmljSW5PdXQsXG4gIHF1YXJ0SW4sIHF1YXJ0T3V0LCBxdWFydEluT3V0LCBxdWludEluLCBxdWludE91dCwgcXVpbnRJbk91dCwgZXhwb0luLCBleHBvT3V0LCBleHBvSW5PdXQsIGNpcmNPdXQsIGNpcmNJbk91dCxcbiAgYmFja091dDogYmFja091dCgpLCBlbXBoYXNpemVkT3V0LFxufSBhcyBjb25zdCBzYXRpc2ZpZXMgUmVjb3JkPHN0cmluZywgRWFzaW5nPjtcblxuZXhwb3J0IHR5cGUgRWFzaW5nTmFtZSA9IGtleW9mIHR5cGVvZiBFQVNJTkdTO1xuXG4vKiogQWNjZXB0IGFuIGVhc2luZyBmdW5jdGlvbiBvciBpdHMgbmFtZSAoc3Rvcnlib2FyZHMgYW5kIGtleWZyYW1lIEpTT04gcmVmZXIgdG8gZWFzaW5ncyBieSBuYW1lKS4gKi9cbmV4cG9ydCBjb25zdCBlYXNlID0gKGU6IEVhc2luZyB8IEVhc2luZ05hbWUgfCB1bmRlZmluZWQsIGZhbGxiYWNrOiBFYXNpbmcgPSBjdWJpY0luT3V0KTogRWFzaW5nID0+XG4gIHR5cGVvZiBlID09PSBcImZ1bmN0aW9uXCIgPyBlIDogZSA/IEVBU0lOR1NbZV0gOiBmYWxsYmFjaztcbiIsICIvLyBEYW1wZWQgc3ByaW5ncyBhcyBjbG9zZWQtZm9ybSBmdW5jdGlvbnMgb2YgdGltZSAobm8gaW50ZWdyYXRpb24sIHNvIGFueSB0IGNhbiBiZSBldmFsdWF0ZWQgZGlyZWN0bHkgYW5kXG4vLyBldmVyeSB3b3JrZXIgZ2V0cyB0aGUgc2FtZSB2YWx1ZSkuIFR3byBwYXJhbWV0ZXJpc2F0aW9uczpcbi8vICAgLSBmcmVxdWVuY3kgKEh6KSArIGRhbXBpbmcgcmF0aW8gemV0YTogaG93IG1vdGlvbiBkZXNpZ25lcnMgdGhpbmsgKFwiMS44IEh6LCBhIGxpdHRsZSBib3VuY3lcIilcbi8vICAgLSBzdGlmZm5lc3MgLyBtYXNzIC8gZGFtcGluZzogaG93IHBoeXNpY3MgbGlicmFyaWVzIChmcmFtZXItbW90aW9uLCByZWFjdC1zcHJpbmcpIGFyZSBjb25maWd1cmVkXG4vLyBCb3RoIG1hcCBvbnRvIHRoZSBzYW1lIHNvbHV0aW9uIG9mIHgnJyArIDJcdTAzQjZcdTAzQzkgeCcgKyBcdTAzQzlcdTAwQjIgeCA9IDAgd2l0aCB4KDApID0gLTEgKGkuZS4gdGhlIHZhbHVlIDAgXHUyMTkyIDEpLlxuXG5leHBvcnQgaW50ZXJmYWNlIFNwcmluZ0ZyZXEgeyBmcmVxPzogbnVtYmVyOyB6ZXRhPzogbnVtYmVyOyB2ZWxvY2l0eT86IG51bWJlciB9XG5leHBvcnQgaW50ZXJmYWNlIFNwcmluZ1BoeXNpY3MgeyBzdGlmZm5lc3M6IG51bWJlcjsgbWFzcz86IG51bWJlcjsgZGFtcGluZzogbnVtYmVyOyB2ZWxvY2l0eT86IG51bWJlciB9XG5leHBvcnQgdHlwZSBTcHJpbmdQYXJhbXMgPSBTcHJpbmdGcmVxIHwgU3ByaW5nUGh5c2ljcztcblxuZnVuY3Rpb24gdG9GcmVxKHA6IFNwcmluZ1BhcmFtcyA9IHt9KTogeyB3OiBudW1iZXI7IHpldGE6IG51bWJlcjsgdjA6IG51bWJlciB9IHtcbiAgaWYgKFwic3RpZmZuZXNzXCIgaW4gcCkge1xuICAgIGNvbnN0IG0gPSBwLm1hc3MgPz8gMTtcbiAgICBjb25zdCB3ID0gTWF0aC5zcXJ0KHAuc3RpZmZuZXNzIC8gbSk7XG4gICAgcmV0dXJuIHsgdywgemV0YTogcC5kYW1waW5nIC8gKDIgKiBNYXRoLnNxcnQocC5zdGlmZm5lc3MgKiBtKSksIHYwOiBwLnZlbG9jaXR5ID8/IDAgfTtcbiAgfVxuICByZXR1cm4geyB3OiAyICogTWF0aC5QSSAqIChwLmZyZXEgPz8gMS44KSwgemV0YTogcC56ZXRhID8/IDAuNSwgdjA6IHAudmVsb2NpdHkgPz8gMCB9O1xufVxuXG4vKipcbiAqIFNwcmluZyBwcm9ncmVzcyAwIFx1MjE5MiAxIGF0IHRpbWUgdCAoc2Vjb25kcyBzaW5jZSByZWxlYXNlKS4gVW5kZXItZGFtcGVkICh6ZXRhIDwgMSkgb3ZlcnNob290cyBhbmRcbiAqIHJpbmdzOyBjcml0aWNhbGx5IGRhbXBlZCAoemV0YSA9IDEpIGlzIHRoZSBmYXN0ZXN0IHdpdGhvdXQgb3ZlcnNob290OyBvdmVyLWRhbXBlZCBjcmVlcHMuXG4gKiBgdmVsb2NpdHlgIGlzIHRoZSBpbml0aWFsIHZlbG9jaXR5IGluIHVuaXRzIG9mIHRoZSBmdWxsIHRyYXZlbCBwZXIgc2Vjb25kLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc3ByaW5nKHQ6IG51bWJlciwgcGFyYW1zOiBTcHJpbmdQYXJhbXMgPSB7fSk6IG51bWJlciB7XG4gIGlmICh0IDw9IDApIHJldHVybiAwO1xuICBjb25zdCB7IHcsIHpldGEsIHYwIH0gPSB0b0ZyZXEocGFyYW1zKTtcbiAgLy8gZGlzcGxhY2VtZW50IGZyb20gdGFyZ2V0IHgodCksIHgoMCkgPSAtMSwgeCcoMCkgPSB2MFxuICBsZXQgeDogbnVtYmVyO1xuICBpZiAoemV0YSA8IDEpIHtcbiAgICBjb25zdCB3ZCA9IHcgKiBNYXRoLnNxcnQoMSAtIHpldGEgKiB6ZXRhKTtcbiAgICBjb25zdCBhID0gLTEsIGIgPSAodjAgKyB6ZXRhICogdyAqIGEpIC8gd2Q7XG4gICAgeCA9IE1hdGguZXhwKC16ZXRhICogdyAqIHQpICogKGEgKiBNYXRoLmNvcyh3ZCAqIHQpICsgYiAqIE1hdGguc2luKHdkICogdCkpO1xuICB9IGVsc2UgaWYgKHpldGEgPT09IDEpIHtcbiAgICBjb25zdCBhID0gLTEsIGIgPSB2MCArIHcgKiBhO1xuICAgIHggPSBNYXRoLmV4cCgtdyAqIHQpICogKGEgKyBiICogdCk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgcyA9IHcgKiBNYXRoLnNxcnQoemV0YSAqIHpldGEgLSAxKTtcbiAgICBjb25zdCByMSA9IC16ZXRhICogdyArIHMsIHIyID0gLXpldGEgKiB3IC0gcztcbiAgICBjb25zdCBjMiA9ICh2MCAtIHIxICogLTEpIC8gKHIyIC0gcjEpLCBjMSA9IC0xIC0gYzI7XG4gICAgeCA9IGMxICogTWF0aC5leHAocjEgKiB0KSArIGMyICogTWF0aC5leHAocjIgKiB0KTtcbiAgfVxuICByZXR1cm4gMSArIHg7XG59XG5cbi8qKiBQZWFrIG92ZXJzaG9vdCBvZiBhbiB1bmRlci1kYW1wZWQgc3ByaW5nIHJlbGVhc2VkIGZyb20gcmVzdCwgYXMgYSBmcmFjdGlvbiBvZiB0aGUgdHJhdmVsLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNwcmluZ092ZXJzaG9vdChwYXJhbXM6IFNwcmluZ1BhcmFtcyA9IHt9KTogbnVtYmVyIHtcbiAgY29uc3QgeyB6ZXRhIH0gPSB0b0ZyZXEocGFyYW1zKTtcbiAgcmV0dXJuIHpldGEgPj0gMSA/IDAgOiBNYXRoLmV4cCgoLXpldGEgKiBNYXRoLlBJKSAvIE1hdGguc3FydCgxIC0gemV0YSAqIHpldGEpKTtcbn1cblxuLyoqXG4gKiBUaW1lIGFmdGVyIHdoaWNoIHRoZSBzcHJpbmcgc3RheXMgd2l0aGluIGB0b2xlcmFuY2VgIG9mIGl0cyB0YXJnZXQgKGVudmVsb3BlIGJvdW5kKS4gTGludCB1c2VzIGl0IHRvXG4gKiBjaGVjayBhIHNwcmluZyBoYXMgc2V0dGxlZCBiZWZvcmUgYSBjdXQsIGFuZCB0aW1lbGluZXMgdXNlIGl0IGFzIGEgc3ByaW5nJ3MgZWZmZWN0aXZlIGR1cmF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc3ByaW5nU2V0dGxlVGltZShwYXJhbXM6IFNwcmluZ1BhcmFtcyA9IHt9LCB0b2xlcmFuY2UgPSAwLjAwNSk6IG51bWJlciB7XG4gIGNvbnN0IHsgdywgemV0YSB9ID0gdG9GcmVxKHBhcmFtcyk7XG4gIGlmICh6ZXRhIDwgMSkgcmV0dXJuIC1NYXRoLmxvZyh0b2xlcmFuY2UgKiBNYXRoLnNxcnQoMSAtIHpldGEgKiB6ZXRhKSkgLyAoemV0YSAqIHcpO1xuICAvLyAob3Zlci9jcml0aWNhbGx5IGRhbXBlZCkgc2VhcmNoIG51bWVyaWNhbGx5XG4gIGxldCB0ID0gMDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCAyMDAwICYmIE1hdGguYWJzKDEgLSBzcHJpbmcodCArIDAuMDEsIHBhcmFtcykpID4gdG9sZXJhbmNlOyBpKyspIHQgKz0gMC4wMTtcbiAgcmV0dXJuIHQ7XG59XG5cbi8qKlxuICogQXBwbGUtc3R5bGUgc3ByaW5nIGZyb20gYSBwZXJjZXB0dWFsIGR1cmF0aW9uIGFuZCBib3VuY2UgKFN3aWZ0VUkgYC5zcHJpbmcoZHVyYXRpb246Ym91bmNlOilgKTpcbiAqIG1hc3MgMSwgc3RpZmZuZXNzICgyXHUwM0MwL2QpXHUwMEIyLCBib3VuY2UgMCA9IGNyaXRpY2FsbHkgZGFtcGVkLCAwLjE1ID0gc25hcHB5LCAwLjMgPSBib3VuY3kuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcHBsZVNwcmluZyhkdXJhdGlvbjogbnVtYmVyLCBib3VuY2UgPSAwKTogU3ByaW5nUGh5c2ljcyB7XG4gIGNvbnN0IHN0aWZmbmVzcyA9ICgyICogTWF0aC5QSSAvIGR1cmF0aW9uKSAqKiAyO1xuICBjb25zdCBkYW1waW5nID0gYm91bmNlID49IDAgPyAoMSAtIGJvdW5jZSkgKiA0ICogTWF0aC5QSSAvIGR1cmF0aW9uIDogNCAqIE1hdGguUEkgLyAoZHVyYXRpb24gKiAoMSArIGJvdW5jZSkpO1xuICByZXR1cm4geyBzdGlmZm5lc3MsIG1hc3M6IDEsIGRhbXBpbmcgfTtcbn1cbiIsICIvLyBLZXlmcmFtZWQgdmFsdWVzLiBBIHRyYWNrIGlzIGEgbGlzdCBvZiBbdGltZSwgdmFsdWUsIGVhc2luZz9dOyB0aGUgZWFzaW5nIGJlbG9uZ3MgdG8gdGhlIHNlZ21lbnQgdGhhdFxuLy8gRU5EUyBhdCB0aGF0IGtleSAodGhlIG1vdmUgaW50byBpdCksIHdoaWNoIHJlYWRzIG5hdHVyYWxseTogXCJhdCAyLjQ1IHMgYXJyaXZlIGF0IDY0MCwgcXVhcnRJbk91dFwiLlxuaW1wb3J0IHsgbGVycCwgcHJvZyB9IGZyb20gXCIuL21hdGgudHNcIjtcbmltcG9ydCB7IGVhc2UsIHR5cGUgRWFzaW5nLCB0eXBlIEVhc2luZ05hbWUsIGN1YmljSW5PdXQgfSBmcm9tIFwiLi9lYXNpbmcudHNcIjtcbmltcG9ydCB7IHNwcmluZywgdHlwZSBTcHJpbmdQYXJhbXMgfSBmcm9tIFwiLi9zcHJpbmcudHNcIjtcblxuZXhwb3J0IHR5cGUgS2V5ID0gcmVhZG9ubHkgW3Q6IG51bWJlciwgdmFsdWU6IG51bWJlciwgZWFzaW5nPzogRWFzaW5nIHwgRWFzaW5nTmFtZV07XG5cbi8qKiBFdmFsdWF0ZSBhIGtleWZyYW1lIHRyYWNrIGF0IHQuIEhvbGRzIHRoZSBmaXJzdCB2YWx1ZSBiZWZvcmUgdGhlIGZpcnN0IGtleSBhbmQgdGhlIGxhc3QgYWZ0ZXIuICovXG5leHBvcnQgZnVuY3Rpb24ga2V5cyh0OiBudW1iZXIsIGtzOiByZWFkb25seSBLZXlbXSwgZmFsbGJhY2s6IEVhc2luZyA9IGN1YmljSW5PdXQpOiBudW1iZXIge1xuICBpZiAoIWtzLmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKFwia2V5cygpOiBlbXB0eSB0cmFja1wiKTtcbiAgaWYgKHQgPD0ga3NbMF1bMF0pIHJldHVybiBrc1swXVsxXTtcbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBrcy5sZW5ndGg7IGkrKykge1xuICAgIGlmICh0IDwga3NbaV1bMF0pIHtcbiAgICAgIGNvbnN0IFt0YSwgdmFdID0ga3NbaSAtIDFdLCBbdGIsIHZiLCBlXSA9IGtzW2ldO1xuICAgICAgcmV0dXJuIGxlcnAodmEsIHZiLCBlYXNlKGUsIGZhbGxiYWNrKShwcm9nKHQsIHRhLCB0YiAtIHRhKSkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4ga3Nba3MubGVuZ3RoIC0gMV1bMV07XG59XG5cbi8qKiBUaW1lcyB3aGVyZSBhIHRyYWNrJ3Mgc2VnbWVudHMgc3RhcnQgbW92aW5nOiB1c2VmdWwgZm9yIGN1dC1vbi1tb3Rpb24gYW5kIGxpbnQuICovXG5leHBvcnQgZnVuY3Rpb24ga2V5TW92ZXMoa3M6IHJlYWRvbmx5IEtleVtdKTogQXJyYXk8eyB0MDogbnVtYmVyOyB0MTogbnVtYmVyOyBmcm9tOiBudW1iZXI7IHRvOiBudW1iZXIgfT4ge1xuICBjb25zdCBvdXQgPSBbXTtcbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBrcy5sZW5ndGg7IGkrKykgaWYgKGtzW2ldWzFdICE9PSBrc1tpIC0gMV1bMV0pIG91dC5wdXNoKHsgdDA6IGtzW2kgLSAxXVswXSwgdDE6IGtzW2ldWzBdLCBmcm9tOiBrc1tpIC0gMV1bMV0sIHRvOiBrc1tpXVsxXSB9KTtcbiAgcmV0dXJuIG91dDtcbn1cblxuZXhwb3J0IHR5cGUgVmVjMktleSA9IHJlYWRvbmx5IFt0OiBudW1iZXIsIHZhbHVlOiByZWFkb25seSBbbnVtYmVyLCBudW1iZXJdLCBlYXNpbmc/OiBFYXNpbmcgfCBFYXNpbmdOYW1lXTtcblxuLyoqIEtleWZyYW1lZCAyRCBwb2ludCAoYm90aCBjb21wb25lbnRzIHNoYXJlIHRpbWluZyBhbmQgZWFzaW5nKS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBrZXlzMih0OiBudW1iZXIsIGtzOiByZWFkb25seSBWZWMyS2V5W10sIGZhbGxiYWNrOiBFYXNpbmcgPSBjdWJpY0luT3V0KTogW251bWJlciwgbnVtYmVyXSB7XG4gIHJldHVybiBba2V5cyh0LCBrcy5tYXAoKFtrLCB2LCBlXSkgPT4gW2ssIHZbMF0sIGVdIGFzIEtleSksIGZhbGxiYWNrKSwga2V5cyh0LCBrcy5tYXAoKFtrLCB2LCBlXSkgPT4gW2ssIHZbMV0sIGVdIGFzIEtleSksIGZhbGxiYWNrKV07XG59XG5cbi8qKiBWYWx1ZSB0aGF0IHNwcmluZ3MgZnJvbSBgZnJvbWAgdG8gYHRvYCBzdGFydGluZyBhdCB0MC4gKi9cbmV4cG9ydCBjb25zdCBzcHJpbmdUbyA9ICh0OiBudW1iZXIsIHQwOiBudW1iZXIsIGZyb206IG51bWJlciwgdG86IG51bWJlciwgcGFyYW1zPzogU3ByaW5nUGFyYW1zKTogbnVtYmVyID0+XG4gIGxlcnAoZnJvbSwgdG8sIHNwcmluZyh0IC0gdDAsIHBhcmFtcykpO1xuXG4vKipcbiAqIFN0YWdnZXI6IHN0YXJ0IHRpbWUgb2YgaXRlbSBpIG9mIG4uIGBlYWNoYCBzZWNvbmRzIGFwYXJ0LCBvciBzcHJlYWQgb3ZlciBgdG90YWxgIHNlY29uZHM7XG4gKiBgZnJvbWAgcGlja3MgdGhlIG9yZGVyIChcInN0YXJ0XCIsIFwiZW5kXCIsIFwiY2VudGVyXCIgb3IgYW4gaW5kZXggdGhlIHdhdmUgcmFkaWF0ZXMgZnJvbSkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdGFnZ2VyKGk6IG51bWJlciwgbjogbnVtYmVyLCBvcHRzOiB7IGVhY2g/OiBudW1iZXI7IHRvdGFsPzogbnVtYmVyOyBmcm9tPzogXCJzdGFydFwiIHwgXCJlbmRcIiB8IFwiY2VudGVyXCIgfCBudW1iZXIgfSA9IHt9KTogbnVtYmVyIHtcbiAgY29uc3QgZWFjaCA9IG9wdHMudG90YWwgIT09IHVuZGVmaW5lZCA/IChuID4gMSA/IG9wdHMudG90YWwgLyAobiAtIDEpIDogMCkgOiAob3B0cy5lYWNoID8/IDAuMDUpO1xuICBjb25zdCBmcm9tID0gb3B0cy5mcm9tID8/IFwic3RhcnRcIjtcbiAgY29uc3Qgb3JpZ2luID0gZnJvbSA9PT0gXCJzdGFydFwiID8gMCA6IGZyb20gPT09IFwiZW5kXCIgPyBuIC0gMSA6IGZyb20gPT09IFwiY2VudGVyXCIgPyAobiAtIDEpIC8gMiA6IGZyb207XG4gIHJldHVybiBNYXRoLmFicyhpIC0gb3JpZ2luKSAqIGVhY2g7XG59XG4iLCAiLy8gQSB2aXJ0dWFsIGNhbWVyYSBvdmVyIGEgd29ybGQgcGxhbmUuIFRoZSBjYW1lcmEgc3RhdGUgbmFtZXMgdGhlIHdvcmxkIHBvaW50IGF0IHRoZSBjZW50cmUgb2YgdGhlXG4vLyBzY3JlZW4sIHRoZSB6b29tIGFuZCBhIHJvbGwgYW5nbGUuIE1vdmVzIGFyZSBidWlsdCBmcm9tIGtleWZyYW1lIHRyYWNrcyBzbyB0aGUgd2hvbGUgY2FtZXJhIHBhdGggaXMgYVxuLy8gcHVyZSBmdW5jdGlvbiBvZiB0ICh3aGljaCBhbHNvIG1ha2VzIGl0IGluc3BlY3RhYmxlOiB0aGUgcGxheWVyIGRyYXdzIGl0LCBsaW50IGNoZWNrcyBpdHMgc3BlZWQgYW5kXG4vLyB0aGUgcmVuZGVyZXIgdHVybnMgaXRzIHZlbG9jaXR5IGludG8gbW90aW9uLWJsdXIgc2FtcGxlIGNvdW50cykuXG5pbXBvcnQgeyBrZXlzLCB0eXBlIEtleSB9IGZyb20gXCIuL2tleXMudHNcIjtcbmltcG9ydCB0eXBlIHsgRWFzaW5nLCBFYXNpbmdOYW1lIH0gZnJvbSBcIi4vZWFzaW5nLnRzXCI7XG5pbXBvcnQgdHlwZSB7IFZlYzIgfSBmcm9tIFwiLi9tYXRoLnRzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2FtZXJhU3RhdGUgeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgem9vbTogbnVtYmVyOyByb3RhdGU6IG51bWJlciB9XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVjdCB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyB3OiBudW1iZXI7IGg6IG51bWJlciB9XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmlld3BvcnQgeyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9XG5cbi8qKiBLZXlmcmFtZSB0cmFja3MgZm9yIGVhY2ggY2FtZXJhIHByb3BlcnR5LiBNaXNzaW5nIHRyYWNrcyBob2xkIHRoZWlyIGRlZmF1bHQuICovXG5leHBvcnQgaW50ZXJmYWNlIENhbWVyYVRyYWNrcyB7IHg/OiBLZXlbXTsgeT86IEtleVtdOyB6b29tPzogS2V5W107IHJvdGF0ZT86IEtleVtdIH1cblxuZXhwb3J0IHR5cGUgQ2FtZXJhRm4gPSAodDogbnVtYmVyKSA9PiBDYW1lcmFTdGF0ZTtcblxuLyoqIEJ1aWxkIGEgY2FtZXJhIGZyb20ga2V5ZnJhbWUgdHJhY2tzLiBEZWZhdWx0IGZyYW1pbmc6IHRoZSBzdGFnZSBjZW50cmUgYXQgem9vbSAxLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNhbWVyYSh0cmFja3M6IENhbWVyYVRyYWNrcywgc3RhZ2U6IFZpZXdwb3J0KTogQ2FtZXJhRm4ge1xuICBjb25zdCBjeCA9IHN0YWdlLndpZHRoIC8gMiwgY3kgPSBzdGFnZS5oZWlnaHQgLyAyO1xuICByZXR1cm4gdCA9PiAoe1xuICAgIHg6IHRyYWNrcy54Py5sZW5ndGggPyBrZXlzKHQsIHRyYWNrcy54KSA6IGN4LFxuICAgIHk6IHRyYWNrcy55Py5sZW5ndGggPyBrZXlzKHQsIHRyYWNrcy55KSA6IGN5LFxuICAgIHpvb206IHRyYWNrcy56b29tPy5sZW5ndGggPyBrZXlzKHQsIHRyYWNrcy56b29tKSA6IDEsXG4gICAgcm90YXRlOiB0cmFja3Mucm90YXRlPy5sZW5ndGggPyBrZXlzKHQsIHRyYWNrcy5yb3RhdGUpIDogMCxcbiAgfSk7XG59XG5cbi8qKlxuICogRmx1ZW50IGJ1aWxkZXIgZm9yIGNhbWVyYSBwYXRocyBpbiBzaG90IGxhbmd1YWdlLiBFYWNoIGNhbGwgYXBwZW5kcyBrZXlzOyB0aW1lcyBhcmUgYWJzb2x1dGUuXG4gKiAgIGNhbWVyYVBhdGgoc3RhZ2UpLmF0KDAsIHsgeDogNzk1LCB5OiAxMTIsIHpvb206IDIuNyB9KVxuICogICAgIC5wdWxsQmFjaygwLjk1LCAyLjQ1LCB7IHg6IDY0MCwgeTogMzYwLCB6b29tOiAxIH0pXG4gKiAgICAgLndoaXAoNi43LCA3LjMsIHsgeDogMjI0MCB9KVxuICogICAgIC5wdXNoKDcuMywgOSwgMC4wNSlcbiAqICAgICAuYnVpbGQoKVxuICovXG5leHBvcnQgY2xhc3MgQ2FtZXJhUGF0aCB7XG4gIHJlYWRvbmx5IHRyYWNrczogUmVxdWlyZWQ8Q2FtZXJhVHJhY2tzPiA9IHsgeDogW10sIHk6IFtdLCB6b29tOiBbXSwgcm90YXRlOiBbXSB9O1xuICBwcml2YXRlIHN0YWdlOiBWaWV3cG9ydDtcbiAgY29uc3RydWN0b3Ioc3RhZ2U6IFZpZXdwb3J0KSB7IHRoaXMuc3RhZ2UgPSBzdGFnZTsgfVxuXG4gIHByaXZhdGUgbGFzdChwcm9wOiBrZXlvZiBDYW1lcmFTdGF0ZSk6IG51bWJlciB7XG4gICAgY29uc3QgdHIgPSB0aGlzLnRyYWNrc1twcm9wXTtcbiAgICBpZiAodHIubGVuZ3RoKSByZXR1cm4gdHJbdHIubGVuZ3RoIC0gMV1bMV07XG4gICAgcmV0dXJuIHByb3AgPT09IFwieFwiID8gdGhpcy5zdGFnZS53aWR0aCAvIDIgOiBwcm9wID09PSBcInlcIiA/IHRoaXMuc3RhZ2UuaGVpZ2h0IC8gMiA6IHByb3AgPT09IFwiem9vbVwiID8gMSA6IDA7XG4gIH1cblxuICBwcml2YXRlIGFkZChwcm9wOiBrZXlvZiBDYW1lcmFTdGF0ZSwgdDogbnVtYmVyLCB2OiBudW1iZXIsIGU/OiBFYXNpbmcgfCBFYXNpbmdOYW1lKTogdm9pZCB7XG4gICAgY29uc3QgdHIgPSB0aGlzLnRyYWNrc1twcm9wXTtcbiAgICBpZiAodHIubGVuZ3RoICYmIHQgPCB0clt0ci5sZW5ndGggLSAxXVswXSkgdGhyb3cgbmV3IEVycm9yKGBjYW1lcmE6IGtleSBmb3IgXCIke3Byb3B9XCIgYXQgJHt0fXMgaXMgYmVmb3JlIHRoZSBwcmV2aW91cyBrZXkgYXQgJHt0clt0ci5sZW5ndGggLSAxXVswXX1zYCk7XG4gICAgdHIucHVzaChlID8gW3QsIHYsIGVdIDogW3QsIHZdKTtcbiAgfVxuXG4gIC8qKiBTZXQgdGhlIGNhbWVyYSBhdCB0aW1lIHQgKGEgaG9sZCBwb2ludDsgdGhlIG1vdmUgaW50byBpdCB1c2VzIGBlYXNlYCkuICovXG4gIGF0KHQ6IG51bWJlciwgczogUGFydGlhbDxDYW1lcmFTdGF0ZT4sIGVhc2U/OiBFYXNpbmcgfCBFYXNpbmdOYW1lKTogdGhpcyB7XG4gICAgZm9yIChjb25zdCBrIG9mIFtcInhcIiwgXCJ5XCIsIFwiem9vbVwiLCBcInJvdGF0ZVwiXSBhcyBjb25zdCkgaWYgKHNba10gIT09IHVuZGVmaW5lZCkgdGhpcy5hZGQoaywgdCwgc1trXSEsIGVhc2UpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqIEhvbGQgZXZlcnkgcHJvcGVydHkgZnJvbSBpdHMgbGFzdCB2YWx1ZSB1bnRpbCB0IChrZWVwcyBhIGxhdGVyIG1vdmUgZnJvbSBzdGFydGluZyBlYXJseSkuICovXG4gIGhvbGQodDogbnVtYmVyKTogdGhpcyB7XG4gICAgZm9yIChjb25zdCBrIG9mIFtcInhcIiwgXCJ5XCIsIFwiem9vbVwiLCBcInJvdGF0ZVwiXSBhcyBjb25zdCkgaWYgKHRoaXMudHJhY2tzW2tdLmxlbmd0aCkgdGhpcy5hZGQoaywgdCwgdGhpcy5sYXN0KGspKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKiBBIG1vdmUgZnJvbSB0MCB0byB0MS4gUHJvcGVydGllcyBub3QgZ2l2ZW4gc3RheSB3aGVyZSB0aGV5IGFyZS4gKi9cbiAgbW92ZSh0MDogbnVtYmVyLCB0MTogbnVtYmVyLCB0bzogUGFydGlhbDxDYW1lcmFTdGF0ZT4sIGVhc2U6IEVhc2luZyB8IEVhc2luZ05hbWUgPSBcInF1YXJ0SW5PdXRcIik6IHRoaXMge1xuICAgIGZvciAoY29uc3QgayBvZiBbXCJ4XCIsIFwieVwiLCBcInpvb21cIiwgXCJyb3RhdGVcIl0gYXMgY29uc3QpIHtcbiAgICAgIGlmICh0b1trXSA9PT0gdW5kZWZpbmVkKSBjb250aW51ZTtcbiAgICAgIHRoaXMuYWRkKGssIHQwLCB0aGlzLmxhc3QoaykpO1xuICAgICAgdGhpcy5hZGQoaywgdDEsIHRvW2tdISwgZWFzZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqIEZhc3QgaG9yaXpvbnRhbCBvciB2ZXJ0aWNhbCBtb3ZlIGJldHdlZW4gcmVnaW9ucy4gS2VlcCBpdCAwLjVcdTIwMTMwLjcgczsgbW90aW9uIGJsdXIgc2VsbHMgaXQuICovXG4gIHdoaXAodDA6IG51bWJlciwgdDE6IG51bWJlciwgdG86IFBhcnRpYWw8Q2FtZXJhU3RhdGU+KTogdGhpcyB7IHJldHVybiB0aGlzLm1vdmUodDAsIHQxLCB0bywgXCJxdWFydEluT3V0XCIpOyB9XG5cbiAgLyoqIFJldmVhbDogc3RhcnQgY2xvc2UgYW5kIHB1bGwgYmFjayB0byBzaG93IHRoZSBjb250ZXh0LiAqL1xuICBwdWxsQmFjayh0MDogbnVtYmVyLCB0MTogbnVtYmVyLCB0bzogUGFydGlhbDxDYW1lcmFTdGF0ZT4pOiB0aGlzIHsgcmV0dXJuIHRoaXMubW92ZSh0MCwgdDEsIHRvLCBcInF1YXJ0SW5PdXRcIik7IH1cblxuICAvKiogU2xvdyBwdXNoLWluIG92ZXIgYSBob2xkLCBzbyB0aGUgZnJhbWUgbmV2ZXIgc2l0cyBzdGlsbCAobW90aW9uIGdyYW1tYXI6ICs1XHUyMDEzNyAlIHpvb20pLiAqL1xuICBwdXNoKHQwOiBudW1iZXIsIHQxOiBudW1iZXIsIGFtb3VudCA9IDAuMDYpOiB0aGlzIHtcbiAgICB0aGlzLmFkZChcInpvb21cIiwgdDAsIHRoaXMubGFzdChcInpvb21cIikpO1xuICAgIHRoaXMuYWRkKFwiem9vbVwiLCB0MSwgdGhpcy5sYXN0KFwiem9vbVwiKSAqICgxICsgYW1vdW50KSwgXCJzaW5lSW5PdXRcIik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogRnJhbWUgYSB3b3JsZCByZWN0IHdpdGggcGFkZGluZyAoZnJhY3Rpb24gb2YgdGhlIHZpZXdwb3J0IGtlcHQgYXJvdW5kIGl0KS4gKi9cbiAgZm9jdXModDA6IG51bWJlciwgdDE6IG51bWJlciwgcmVjdDogUmVjdCwgcGFkZGluZyA9IDAuMTUsIGVhc2U6IEVhc2luZyB8IEVhc2luZ05hbWUgPSBcInF1YXJ0SW5PdXRcIik6IHRoaXMge1xuICAgIHJldHVybiB0aGlzLm1vdmUodDAsIHQxLCBmaXRSZWN0KHJlY3QsIHRoaXMuc3RhZ2UsIHBhZGRpbmcpLCBlYXNlKTtcbiAgfVxuXG4gIGJ1aWxkKCk6IENhbWVyYUZuIHsgcmV0dXJuIGNhbWVyYSh0aGlzLnRyYWNrcywgdGhpcy5zdGFnZSk7IH1cbn1cblxuZXhwb3J0IGNvbnN0IGNhbWVyYVBhdGggPSAoc3RhZ2U6IFZpZXdwb3J0KTogQ2FtZXJhUGF0aCA9PiBuZXcgQ2FtZXJhUGF0aChzdGFnZSk7XG5cbi8qKiBDYW1lcmEgc3RhdGUgdGhhdCBmcmFtZXMgYHJlY3RgIGluc2lkZSB0aGUgdmlld3BvcnQgd2l0aCBgcGFkZGluZ2Agb24gdGhlIHRpZ2h0ZXIgYXhpcy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmaXRSZWN0KHJlY3Q6IFJlY3QsIHN0YWdlOiBWaWV3cG9ydCwgcGFkZGluZyA9IDAuMTUpOiBDYW1lcmFTdGF0ZSB7XG4gIGNvbnN0IHpvb20gPSBNYXRoLm1pbihzdGFnZS53aWR0aCAqICgxIC0gcGFkZGluZykgLyByZWN0LncsIHN0YWdlLmhlaWdodCAqICgxIC0gcGFkZGluZykgLyByZWN0LmgpO1xuICByZXR1cm4geyB4OiByZWN0LnggKyByZWN0LncgLyAyLCB5OiByZWN0LnkgKyByZWN0LmggLyAyLCB6b29tLCByb3RhdGU6IDAgfTtcbn1cblxuLyoqIENTUyB0cmFuc2Zvcm0gdGhhdCBtYXBzIHdvcmxkIGNvb3JkaW5hdGVzIHRvIHN0YWdlIGNvb3JkaW5hdGVzIGZvciB0aGlzIGNhbWVyYS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjYW1lcmFUcmFuc2Zvcm0oYzogQ2FtZXJhU3RhdGUsIHN0YWdlOiBWaWV3cG9ydCwgZXh0cmFab29tID0gMSk6IHN0cmluZyB7XG4gIGNvbnN0IHIgPSBjLnJvdGF0ZSA/IGAgcm90YXRlKCR7Yy5yb3RhdGV9ZGVnKWAgOiBcIlwiO1xuICByZXR1cm4gYHRyYW5zbGF0ZSgke3N0YWdlLndpZHRoIC8gMn1weCwke3N0YWdlLmhlaWdodCAvIDJ9cHgpJHtyfSBzY2FsZSgke2Muem9vbSAqIGV4dHJhWm9vbX0pIHRyYW5zbGF0ZSgkey1jLnh9cHgsJHstYy55fXB4KWA7XG59XG5cbi8qKiBXb3JsZCBwb2ludCBcdTIxOTIgc3RhZ2UgcG9pbnQuICovXG5leHBvcnQgZnVuY3Rpb24gd29ybGRUb1NjcmVlbihjOiBDYW1lcmFTdGF0ZSwgc3RhZ2U6IFZpZXdwb3J0LCBwOiBWZWMyKTogW251bWJlciwgbnVtYmVyXSB7XG4gIGNvbnN0IGR4ID0gKHBbMF0gLSBjLngpICogYy56b29tLCBkeSA9IChwWzFdIC0gYy55KSAqIGMuem9vbTtcbiAgY29uc3QgYSA9IChjLnJvdGF0ZSAqIE1hdGguUEkpIC8gMTgwLCBjb3MgPSBNYXRoLmNvcyhhKSwgc2luID0gTWF0aC5zaW4oYSk7XG4gIHJldHVybiBbc3RhZ2Uud2lkdGggLyAyICsgZHggKiBjb3MgLSBkeSAqIHNpbiwgc3RhZ2UuaGVpZ2h0IC8gMiArIGR4ICogc2luICsgZHkgKiBjb3NdO1xufVxuXG4vKiogU3RhZ2UgcG9pbnQgXHUyMTkyIHdvcmxkIHBvaW50LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNjcmVlblRvV29ybGQoYzogQ2FtZXJhU3RhdGUsIHN0YWdlOiBWaWV3cG9ydCwgcDogVmVjMik6IFtudW1iZXIsIG51bWJlcl0ge1xuICBjb25zdCBhID0gKC1jLnJvdGF0ZSAqIE1hdGguUEkpIC8gMTgwLCBjb3MgPSBNYXRoLmNvcyhhKSwgc2luID0gTWF0aC5zaW4oYSk7XG4gIGNvbnN0IHN4ID0gcFswXSAtIHN0YWdlLndpZHRoIC8gMiwgc3kgPSBwWzFdIC0gc3RhZ2UuaGVpZ2h0IC8gMjtcbiAgY29uc3QgZHggPSBzeCAqIGNvcyAtIHN5ICogc2luLCBkeSA9IHN4ICogc2luICsgc3kgKiBjb3M7XG4gIHJldHVybiBbYy54ICsgZHggLyBjLnpvb20sIGMueSArIGR5IC8gYy56b29tXTtcbn1cblxuLyoqXG4gKiBDYW1lcmEgZm9yIGEgcGFyYWxsYXggbGF5ZXIgYXQgYGRlcHRoYCAoMSA9IHRoZSB3b3JsZCBwbGFuZSwgMCA9IGluZmluaXRlbHkgZmFyLCA+IDEgPSBuZWFyZXIgdGhhbiB0aGVcbiAqIHdvcmxkKS4gSXQgcGFucyBhbmQgem9vbXMgcHJvcG9ydGlvbmFsbHkgbGVzcyAob3IgbW9yZSksIHdoaWNoIG1ha2VzIGNhbWVyYSBtb3ZlcyByZWFkYWJsZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcmFsbGF4KGM6IENhbWVyYVN0YXRlLCBkZXB0aDogbnVtYmVyLCBzdGFnZTogVmlld3BvcnQpOiBDYW1lcmFTdGF0ZSB7XG4gIGNvbnN0IGN4ID0gc3RhZ2Uud2lkdGggLyAyLCBjeSA9IHN0YWdlLmhlaWdodCAvIDI7XG4gIHJldHVybiB7IHg6IGN4ICsgKGMueCAtIGN4KSAqIGRlcHRoLCB5OiBjeSArIChjLnkgLSBjeSkgKiBkZXB0aCwgem9vbTogMSArIChjLnpvb20gLSAxKSAqIGRlcHRoLCByb3RhdGU6IGMucm90YXRlICogZGVwdGggfTtcbn1cblxuLyoqXG4gKiBMYXJnZXN0IG9uLXNjcmVlbiBkaXNwbGFjZW1lbnQgKHN0YWdlIHB4KSBvZiBhbnkgc2NyZWVuIHBvaW50IGJldHdlZW4gdHdvIGNhbWVyYSBzdGF0ZXMsIHNhbXBsZWQgYXRcbiAqIHRoZSBjb3JuZXJzIGFuZCBjZW50cmUuIFJvdGF0aW9uIGFuZCB6b29tIG1vdmUgdGhlIGNvcm5lcnMgbW9zdDsgcGFucyBtb3ZlIGV2ZXJ5IHBvaW50IGVxdWFsbHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjYW1lcmFEaXNwbGFjZW1lbnQoYTogQ2FtZXJhU3RhdGUsIGI6IENhbWVyYVN0YXRlLCBzdGFnZTogVmlld3BvcnQpOiBudW1iZXIge1xuICBjb25zdCBwdHM6IFZlYzJbXSA9IFtbMCwgMF0sIFtzdGFnZS53aWR0aCwgMF0sIFswLCBzdGFnZS5oZWlnaHRdLCBbc3RhZ2Uud2lkdGgsIHN0YWdlLmhlaWdodF0sIFtzdGFnZS53aWR0aCAvIDIsIHN0YWdlLmhlaWdodCAvIDJdXTtcbiAgbGV0IG0gPSAwO1xuICBmb3IgKGNvbnN0IHAgb2YgcHRzKSB7XG4gICAgY29uc3QgdyA9IHNjcmVlblRvV29ybGQoYSwgc3RhZ2UsIHApLCBxID0gd29ybGRUb1NjcmVlbihiLCBzdGFnZSwgdyk7XG4gICAgbSA9IE1hdGgubWF4KG0sIE1hdGguaHlwb3QocVswXSAtIHBbMF0sIHFbMV0gLSBwWzFdKSk7XG4gIH1cbiAgcmV0dXJuIG07XG59XG4iLCAiLy8gVGhlIGF1dGhvcmluZyBtb2RlbC4gQSB2aWRlbyBpcyBhIHN0YWdlIChkZXNpZ24gc2l6ZSksIGEgdGltZWxpbmUgb2Ygc2NlbmVzIHdpdGggbmFtZWQgbWFya2VycywgYW5cbi8vIG9wdGlvbmFsIGFsd2F5cy1vbiBcIndvcmxkXCIgKGJhY2tncm91bmQsIGNhbWVyYSwgYnJhbmQgbWFyaykgYW5kIGEgdGhlbWUuIEV2ZXJ5IHNjZW5lIG93bnMgRE9NIGl0IGJ1aWxkc1xuLy8gb25jZSBpbiBzZXR1cCgpIGFuZCB1cGRhdGVzIGluIHJlbmRlcih0KS4gcmVuZGVyKCkgbXVzdCBiZSBwdXJlOiBpdCBzZXRzIGV2ZXJ5IHByb3BlcnR5IGl0IGFuaW1hdGVzXG4vLyBmcm9tIHQgYWxvbmUsIHNvIGZyYW1lcyBjYW4gYmUgcmVuZGVyZWQgb3V0IG9mIG9yZGVyLCBpbiBwYXJhbGxlbCBhbmQgbW9yZSB0aGFuIG9uY2UuXG4vL1xuLy8gU2NlbmVzIGFyZSBvbmx5IHJlbmRlcmVkIGluc2lkZSBbc3RhcnQsIGVuZF07IG91dHNpZGUgaXQgdGhlaXIgY29udGFpbmVycyBhcmUgaGlkZGVuLiBUaGF0IGNvbnRyYWN0XG4vLyBpcyB3aGF0IGxldHMgdGhlIGZyYW1lIGNhY2hlIHJlLXJlbmRlciBvbmx5IHRoZSBmcmFtZXMgYSBjaGFuZ2VkIHNjZW5lIGNhbiBhZmZlY3QuXG5pbXBvcnQgdHlwZSB7IENhbWVyYUZuLCBDYW1lcmFTdGF0ZSwgVmlld3BvcnQgfSBmcm9tIFwiLi9jYW1lcmEudHNcIjtcbmltcG9ydCB0eXBlIHsgVGhlbWUgfSBmcm9tIFwiLi90aGVtZS50c1wiO1xuXG5leHBvcnQgdHlwZSBBc3BlY3QgPSBcIjE2OjlcIiB8IFwiOToxNlwiIHwgXCIxOjFcIiB8IFwiNDo1XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWFya2VyIHsgbmFtZTogc3RyaW5nOyB0OiBudW1iZXI7IGtpbmQ/OiBcImN1dFwiIHwgXCJiZWF0XCIgfCBcInZvXCIgfCBcIm5vdGVcIiB9XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2NlbmVUaW1lIHtcbiAgLyoqIEdsb2JhbCB0aW1lIGluIHNlY29uZHMuICovXG4gIHQ6IG51bWJlcjtcbiAgLyoqIFNlY29uZHMgc2luY2UgdGhlIHNjZW5lJ3Mgc3RhcnQuICovXG4gIGxvY2FsOiBudW1iZXI7XG4gIC8qKiAwLi4xIHRocm91Z2ggdGhlIHNjZW5lLiAqL1xuICBwcm9ncmVzczogbnVtYmVyO1xuICBzdGFydDogbnVtYmVyO1xuICBlbmQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMYXllciB7XG4gIC8qKiBTY2VuZS1vd25lZCBjb250YWluZXIuIEhpZGRlbiB3aGlsZSB0aGUgc2NlbmUgaXMgaW5hY3RpdmUuICovXG4gIGVsOiBIVE1MRWxlbWVudDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTY2VuZUNvbnRleHQge1xuICAvKiogVGhlIHZpZGVvIGRlZmluaXRpb24gKHN0YWdlIHNpemUsIGZwcywgbWFya2Vyc1x1MjAyNikuICovXG4gIHZpZGVvOiBWaWRlb0RlZjtcbiAgc3RhZ2U6IFZpZXdwb3J0O1xuICBhc3BlY3Q6IEFzcGVjdDtcbiAgdGhlbWU6IFRoZW1lO1xuICAvKiogQ29udGFpbmVyIGluc2lkZSB0aGUgY2FtZXJhLW1vdmVkIHdvcmxkIGxheWVyLiAqL1xuICB3b3JsZDogSFRNTEVsZW1lbnQ7XG4gIC8qKiBDb250YWluZXIgaW4gc2NyZWVuIHNwYWNlLCBhYm92ZSB0aGUgd29ybGQgKGhlYWRsaW5lcyB0aGF0IHN0YXkgcHV0IHdoaWxlIHRoZSBjYW1lcmEgbW92ZXMpLiAqL1xuICBodWQ6IEhUTUxFbGVtZW50O1xuICAvKiogRXh0cmEgc2NyZWVuLXNwYWNlIGNvbnRhaW5lciBhdCBhIHotb3JkZXIgb2YgeW91ciBjaG9pY2UgKGUuZy4gYSBsYXllciByZWFjaGVkIGJ5IGEgZG9sbHkpLiAqL1xuICBzY3JlZW4oejogbnVtYmVyLCBuYW1lPzogc3RyaW5nKTogSFRNTEVsZW1lbnQ7XG4gIC8qKiBDYW1lcmEgc3RhdGUgYXQgdCAoaWRlbnRpdHkgaWYgdGhlIHZpZGVvIGhhcyBubyBjYW1lcmEpLiAqL1xuICBjYW1lcmEodDogbnVtYmVyKTogQ2FtZXJhU3RhdGU7XG4gIC8qKiBUaGUgc2hhcmVkIGxheWVycyB0aGVtc2VsdmVzICh3b3JsZC1sZXZlbCBlZmZlY3RzIHN1Y2ggYXMgYSBkb2xseSB0aGF0IG1vdmVzIGV2ZXJ5IHNjZW5lIGF0IG9uY2UpLiAqL1xuICBsYXllcnM6IHsgc3RhZ2U6IEhUTUxFbGVtZW50OyB3b3JsZDogSFRNTEVsZW1lbnQ7IGh1ZDogSFRNTEVsZW1lbnQgfTtcbiAgLyoqIEZpbmQgYW4gZWxlbWVudCBieSBpZCB3aXRoaW4gdGhpcyBzY2VuZSdzIGNvbnRhaW5lcnMgKHRocm93cyB3aXRoIHRoZSBzY2VuZSBuYW1lIGlmIG1pc3NpbmcpLiAqL1xuICAkKGlkOiBzdHJpbmcpOiBIVE1MRWxlbWVudDtcbiAgLyoqIFNlY29uZHMgb2YgYSBtYXJrZXIgYnkgbmFtZSAodGhyb3dzIGlmIGl0IGRvZXNuJ3QgZXhpc3QpLiAqL1xuICBtYXJrZXIobmFtZTogc3RyaW5nKTogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNjZW5lRGVmIHtcbiAgbmFtZTogc3RyaW5nO1xuICBzdGFydDogbnVtYmVyO1xuICBlbmQ6IG51bWJlcjtcbiAgLyoqIFNvdXJjZSBmaWxlIChmaWxsZWQgaW4gYnkgdGhlIGJ1bmRsZXIpIHNvIHRoZSBmcmFtZSBjYWNoZSBjYW4gdGVsbCB3aGljaCBmcmFtZXMgYSBjaGFuZ2UgdG91Y2hlcy4gKi9cbiAgZmlsZT86IHN0cmluZztcbiAgc2V0dXA/KGN0eDogU2NlbmVDb250ZXh0KTogdm9pZCB8IFByb21pc2U8dm9pZD47XG4gIHJlbmRlcih0aW1lOiBTY2VuZVRpbWUsIGN0eDogU2NlbmVDb250ZXh0KTogdm9pZDtcbiAgLyoqIE1hcmtlcnMgaW5zaWRlIHRoaXMgc2NlbmUsIHJlbGF0aXZlIHRvIGl0cyBzdGFydC4gKi9cbiAgbWFya2Vycz86IFJlY29yZDxzdHJpbmcsIG51bWJlcj47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgV29ybGREZWYge1xuICBzZXR1cD8oY3R4OiBTY2VuZUNvbnRleHQpOiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbiAgLyoqIEFsd2F5cyByZW5kZXJlZCwgYmVmb3JlIHRoZSBzY2VuZXMuICovXG4gIHJlbmRlcj8odGltZTogU2NlbmVUaW1lLCBjdHg6IFNjZW5lQ29udGV4dCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmlkZW9EZWYge1xuICB0aXRsZTogc3RyaW5nO1xuICAvKiogRGVzaWduIHNpemUgaW4gQ1NTIHB4LiBPdXRwdXQgcmVzb2x1dGlvbiBpcyBhIHJlbmRlciBvcHRpb247IHRoZSBzdGFnZSBzY2FsZXMgdG8gaXQuICovXG4gIHN0YWdlOiBWaWV3cG9ydDtcbiAgZnBzOiBudW1iZXI7XG4gIGR1cmF0aW9uOiBudW1iZXI7XG4gIC8qKiBCZWF0IGdyaWQgZm9yIG1hcmtlcnMsIGxpbnQgYW5kIHRoZSBwbGF5ZXIncyBzbmFwLiAqL1xuICBicG0/OiBudW1iZXI7XG4gIC8qKiBCZWF0IG9mZnNldCAoc2Vjb25kcykgb2YgdGhlIGZpcnN0IGRvd25iZWF0LiAqL1xuICBiZWF0T2Zmc2V0PzogbnVtYmVyO1xuICBhc3BlY3Q/OiBBc3BlY3Q7XG4gIHRoZW1lOiBUaGVtZTtcbiAgY2FtZXJhPzogQ2FtZXJhRm47XG4gIC8qKiBTdGFnZSBiYWNrZ3JvdW5kIGNvbG91ciAoYmVoaW5kIGV2ZXJ5dGhpbmcpLiBEZWZhdWx0cyB0byB0aGUgdGhlbWUncyBiZy4gKi9cbiAgYmFja2dyb3VuZD86IHN0cmluZztcbiAgd29ybGQ/OiBXb3JsZERlZjtcbiAgc2NlbmVzOiBTY2VuZURlZltdO1xuICBtYXJrZXJzPzogTWFya2VyW107XG4gIC8qKiBQZXItYXNwZWN0IG92ZXJyaWRlczogYSBkaWZmZXJlbnQgc3RhZ2Ugc2l6ZSBvciBzY2VuZSBsaXN0IGZvciA5OjE2LCAxOjEsIDQ6NS4gKi9cbiAgdmFyaWFudHM/OiBQYXJ0aWFsPFJlY29yZDxBc3BlY3QsIFBhcnRpYWw8UGljazxWaWRlb0RlZiwgXCJzdGFnZVwiIHwgXCJzY2VuZXNcIiB8IFwiY2FtZXJhXCIgfCBcIm1hcmtlcnNcIiB8IFwid29ybGRcIj4+Pj47XG4gIC8qKiBBdWRpbyB0cmFja3MgZm9yIHRoZSBwbGF5ZXIgYW5kIHRoZSBmaW5hbCBtdXguIFBhdGhzIHJlbGF0aXZlIHRvIHRoZSBwcm9qZWN0LiAqL1xuICBhdWRpbz86IEFycmF5PHsgc3JjOiBzdHJpbmc7IHN0YXJ0PzogbnVtYmVyOyBnYWluPzogbnVtYmVyOyByb2xlPzogXCJtdXNpY1wiIHwgXCJ2b1wiIHwgXCJzZnhcIiB9Pjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZmluZVNjZW5lKGRlZjogU2NlbmVEZWYpOiBTY2VuZURlZiB7XG4gIGlmICghKGRlZi5lbmQgPiBkZWYuc3RhcnQpKSB0aHJvdyBuZXcgRXJyb3IoYHNjZW5lIFwiJHtkZWYubmFtZX1cIjogZW5kICgke2RlZi5lbmR9KSBtdXN0IGJlIGFmdGVyIHN0YXJ0ICgke2RlZi5zdGFydH0pYCk7XG4gIHJldHVybiBkZWY7XG59XG4vKiogVXNlZCBieSB0aGUgYnVuZGxlciB0byBzdGFtcCBlYWNoIHNjZW5lIHdpdGggaXRzIHNvdXJjZSBmaWxlLiAqL1xuZGVmaW5lU2NlbmUuZnJvbSA9IChmaWxlOiBzdHJpbmcsIGRlZjogU2NlbmVEZWYpOiBTY2VuZURlZiA9PiAoeyAuLi5kZWZpbmVTY2VuZShkZWYpLCBmaWxlIH0pO1xuXG5leHBvcnQgZnVuY3Rpb24gZGVmaW5lVmlkZW8oZGVmOiBWaWRlb0RlZik6IFZpZGVvRGVmIHtcbiAgY29uc3QgbmFtZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBzIG9mIGRlZi5zY2VuZXMpIHtcbiAgICBpZiAobmFtZXMuaGFzKHMubmFtZSkpIHRocm93IG5ldyBFcnJvcihgdmlkZW8gXCIke2RlZi50aXRsZX1cIjogdHdvIHNjZW5lcyBhcmUgbmFtZWQgXCIke3MubmFtZX1cImApO1xuICAgIG5hbWVzLmFkZChzLm5hbWUpO1xuICAgIGlmIChzLnN0YXJ0IDwgMCB8fCBzLmVuZCA+IGRlZi5kdXJhdGlvbiArIDFlLTkpIHRocm93IG5ldyBFcnJvcihgc2NlbmUgXCIke3MubmFtZX1cIjogWyR7cy5zdGFydH0sICR7cy5lbmR9XSBpcyBvdXRzaWRlIHRoZSB2aWRlbydzIDBcdTIwMTMke2RlZi5kdXJhdGlvbn0gc2ApO1xuICB9XG4gIHJldHVybiBkZWY7XG59XG5cbi8qKiBTY2VuZSBtYXJrZXJzIG1hZGUgZ2xvYmFsLCBwbHVzIHZpZGVvIG1hcmtlcnMgYW5kIG9uZSBcInNjZW5lOjxuYW1lPlwiIG1hcmtlciBwZXIgc2NlbmUgc3RhcnQuICovXG5leHBvcnQgZnVuY3Rpb24gYWxsTWFya2Vycyh2OiBWaWRlb0RlZik6IE1hcmtlcltdIHtcbiAgY29uc3Qgb3V0OiBNYXJrZXJbXSA9IFsuLi4odi5tYXJrZXJzID8/IFtdKV07XG4gIGZvciAoY29uc3QgcyBvZiB2LnNjZW5lcykge1xuICAgIG91dC5wdXNoKHsgbmFtZTogcy5uYW1lLCB0OiBzLnN0YXJ0LCBraW5kOiBcImN1dFwiIH0pO1xuICAgIGZvciAoY29uc3QgW24sIGR0XSBvZiBPYmplY3QuZW50cmllcyhzLm1hcmtlcnMgPz8ge30pKSBvdXQucHVzaCh7IG5hbWU6IGAke3MubmFtZX0uJHtufWAsIHQ6IHMuc3RhcnQgKyBkdCwga2luZDogXCJub3RlXCIgfSk7XG4gIH1cbiAgcmV0dXJuIG91dC5zb3J0KChhLCBiKSA9PiBhLnQgLSBiLnQpO1xufVxuXG4vKiogU2NlbmVzIGFjdGl2ZSBhbnl3aGVyZSBpbiBbdDAsIHQxXSAoaW5jbHVzaXZlIHN0YXJ0LCBleGNsdXNpdmUgZW5kKS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhY3RpdmVTY2VuZXModjogVmlkZW9EZWYsIHQwOiBudW1iZXIsIHQxID0gdDApOiBTY2VuZURlZltdIHtcbiAgcmV0dXJuIHYuc2NlbmVzLmZpbHRlcihzID0+IHQxID49IHMuc3RhcnQgJiYgdDAgPCBzLmVuZCk7XG59XG5cbmV4cG9ydCBjb25zdCBiZWF0VGltZSA9ICh2OiBWaWRlb0RlZiwgYmVhdDogbnVtYmVyKTogbnVtYmVyID0+ICh2LmJlYXRPZmZzZXQgPz8gMCkgKyAoYmVhdCAqIDYwKSAvICh2LmJwbSA/PyAxMjApO1xuXG4vKiogQXBwbHkgYW4gYXNwZWN0IHZhcmlhbnQncyBvdmVycmlkZXMuICovXG5leHBvcnQgZnVuY3Rpb24gd2l0aEFzcGVjdCh2OiBWaWRlb0RlZiwgYXNwZWN0OiBBc3BlY3QgfCB1bmRlZmluZWQpOiBWaWRlb0RlZiB7XG4gIGlmICghYXNwZWN0IHx8IGFzcGVjdCA9PT0gKHYuYXNwZWN0ID8/IFwiMTY6OVwiKSkgcmV0dXJuIHY7XG4gIGNvbnN0IG8gPSB2LnZhcmlhbnRzPy5bYXNwZWN0XTtcbiAgaWYgKCFvKSB0aHJvdyBuZXcgRXJyb3IoYHZpZGVvIFwiJHt2LnRpdGxlfVwiIGhhcyBubyBsYXlvdXQgZm9yIGFzcGVjdCAke2FzcGVjdH07IGFkZCB2YXJpYW50c1tcIiR7YXNwZWN0fVwiXWApO1xuICByZXR1cm4geyAuLi52LCAuLi5vLCBhc3BlY3QgfTtcbn1cbiIsICIvLyBEZXNpZ24gdG9rZW5zLiBBIHZpZGVvIGFkb3B0cyBhIGJyYW5kIGJ5IHN3YXBwaW5nIGl0cyB0aGVtZTogY29sb3VycywgZm9udHMsIHJhZGlpIGFuZCBzaGFkb3dzIGJlY29tZVxuLy8gQ1NTIGN1c3RvbSBwcm9wZXJ0aWVzICgtLWMtKiwgLS1mLSosIC0tci0qLCAtLXMtKikgdGhhdCBjb21wb25lbnRzIHJlYWQsIHNvIG5vdGhpbmcgaGFyZC1jb2RlcyBhXG4vLyBjb2xvdXIuIEZvbnRzIGFyZSBzZWxmLWhvc3RlZCBmaWxlcyBnYXRlZCBiZWZvcmUgZnJhbWUgMCwgc28gcmVuZGVycyBuZXZlciBkZXBlbmQgb24gdGhlIG5ldHdvcmsuXG5cbmV4cG9ydCBpbnRlcmZhY2UgRm9udEZhY2UgeyBmYW1pbHk6IHN0cmluZzsgLyoqIEZpbGUgdG8gbG9hZDsgb21pdCB3aGVuIGEgZm9udENzcyBzdHlsZXNoZWV0IHByb3ZpZGVzIGl0ICh0aGUgZmFjZSBpcyBzdGlsbCB2ZXJpZmllZCkuICovIHNyYz86IHN0cmluZzsgd2VpZ2h0Pzogc3RyaW5nOyBzdHlsZT86IHN0cmluZzsgc3RyZXRjaD86IHN0cmluZyB9XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGhlbWUge1xuICBuYW1lOiBzdHJpbmc7XG4gIGNvbG9yczogeyBiZzogc3RyaW5nOyBmZzogc3RyaW5nOyBhY2NlbnQ6IHN0cmluZzsgbXV0ZWQ6IHN0cmluZzsgc3VyZmFjZTogc3RyaW5nOyBpbms6IHN0cmluZzsgW2s6IHN0cmluZ106IHN0cmluZyB9O1xuICBmb250czogeyBkaXNwbGF5OiBzdHJpbmc7IGJvZHk6IHN0cmluZzsgbW9ubz86IHN0cmluZzsgdWk/OiBzdHJpbmc7IFtrOiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQgfTtcbiAgLyoqIEZvbnQgZmlsZXMgdG8gbG9hZCAocmVsYXRpdmUgdG8gdGhlIHByb2plY3QsIG9yIGFic29sdXRlIFVSTHMpLiBFdmVyeSBmYWNlIGlzIHZlcmlmaWVkIGJlZm9yZSBmcmFtZSAwLiAqL1xuICBmb250RmFjZXM/OiBGb250RmFjZVtdO1xuICAvKiogU3R5bGVzaGVldHMgdGhhdCBkZWNsYXJlIGZvbnRzIChlLmcuIGEgR29vZ2xlIEZvbnRzIFVSTCkuIFByZWZlciBzZWxmLWhvc3RlZCBmaWxlczogcmVuZGVycyB0aGVuIG5ldmVyIHRvdWNoIHRoZSBuZXR3b3JrLiAqL1xuICBmb250Q3NzPzogc3RyaW5nW107XG4gIHJhZGlpOiB7IHNtOiBudW1iZXI7IG1kOiBudW1iZXI7IGxnOiBudW1iZXI7IFtrOiBzdHJpbmddOiBudW1iZXIgfTtcbiAgc2hhZG93czogeyBjYXJkOiBzdHJpbmc7IGZsb2F0OiBzdHJpbmc7IFtrOiBzdHJpbmddOiBzdHJpbmcgfTtcbiAgLyoqIEZyZWUtZm9ybSBleHRyYSB0b2tlbnMgZXhwb3NlZCBhcyAtLXgtPGtleT4uICovXG4gIGV4dHJhPzogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgbnVtYmVyPjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZmluZVRoZW1lKHQ6IFRoZW1lKTogVGhlbWUgeyByZXR1cm4gdDsgfVxuXG4vKiogVGhlbWUgXHUyMTkyIENTUyB0ZXh0IChjdXN0b20gcHJvcGVydGllcyBvbiA6cm9vdCBwbHVzIEBmb250LWZhY2UgcnVsZXMpLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRoZW1lQ3NzKHQ6IFRoZW1lLCBiYXNlID0gXCJcIik6IHN0cmluZyB7XG4gIGNvbnN0IHZhcnM6IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKHQuY29sb3JzKSkgdmFycy5wdXNoKGAtLWMtJHtrfToke3Z9YCk7XG4gIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKHQuZm9udHMpKSBpZiAodikgdmFycy5wdXNoKGAtLWYtJHtrfToke3Z9YCk7XG4gIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKHQucmFkaWkpKSB2YXJzLnB1c2goYC0tci0ke2t9OiR7dn1weGApO1xuICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyh0LnNoYWRvd3MpKSB2YXJzLnB1c2goYC0tcy0ke2t9OiR7dn1gKTtcbiAgZm9yIChjb25zdCBbaywgdl0gb2YgT2JqZWN0LmVudHJpZXModC5leHRyYSA/PyB7fSkpIHZhcnMucHVzaChgLS14LSR7a306JHt2fWApO1xuICBjb25zdCBmYWNlcyA9ICh0LmZvbnRGYWNlcyA/PyBbXSkuZmlsdGVyKGYgPT4gZi5zcmMpLm1hcChmID0+IHtcbiAgICBpZiAoIWYuc3JjKSByZXR1cm4gXCJcIjtcbiAgICBjb25zdCB1cmwgPSAvXihodHRwcz86fGRhdGE6fFxcLykvLnRlc3QoZi5zcmMpID8gZi5zcmMgOiBiYXNlICsgZi5zcmM7XG4gICAgcmV0dXJuIGBAZm9udC1mYWNle2ZvbnQtZmFtaWx5OlwiJHtmLmZhbWlseX1cIjtzcmM6dXJsKFwiJHt1cmx9XCIpO2ZvbnQtd2VpZ2h0OiR7Zi53ZWlnaHQgPz8gXCI0MDBcIn07Zm9udC1zdHlsZToke2Yuc3R5bGUgPz8gXCJub3JtYWxcIn07JHtmLnN0cmV0Y2ggPyBgZm9udC1zdHJldGNoOiR7Zi5zdHJldGNofTtgIDogXCJcIn1mb250LWRpc3BsYXk6YmxvY2t9YDtcbiAgfSk7XG4gIHJldHVybiBgJHtmYWNlcy5qb2luKFwiXFxuXCIpfVxcbjpyb290eyR7dmFycy5qb2luKFwiO1wiKX19YDtcbn1cblxuLyoqIEEgbmV1dHJhbCBkZWZhdWx0IHRoZW1lIChzeXN0ZW0gZm9udHMpIHNvIGEgbmV3IHByb2plY3QgcmVuZGVycyBiZWZvcmUgYSBicmFuZCBpcyBhcHBsaWVkLiAqL1xuZXhwb3J0IGNvbnN0IGRlZmF1bHRUaGVtZTogVGhlbWUgPSB7XG4gIG5hbWU6IFwiZGVmYXVsdFwiLFxuICBjb2xvcnM6IHsgYmc6IFwiI2VlZjFmNlwiLCBmZzogXCIjMTQxNjFiXCIsIGFjY2VudDogXCIjMzM1NWZmXCIsIG11dGVkOiBcIiM4YTkwYTBcIiwgc3VyZmFjZTogXCIjZmZmZmZmXCIsIGluazogXCIjMTQxNjFiXCIsIGxpbmU6IFwiI2RmZTJlOFwiIH0sXG4gIGZvbnRzOiB7IGRpc3BsYXk6ICdcIlNlZ29lIFVJXCIsIHN5c3RlbS11aSwgc2Fucy1zZXJpZicsIGJvZHk6ICdcIlNlZ29lIFVJXCIsIHN5c3RlbS11aSwgc2Fucy1zZXJpZicsIG1vbm86IFwiQ29uc29sYXMsIG1vbm9zcGFjZVwiLCB1aTogJ1wiU2Vnb2UgVUlcIiwgc3lzdGVtLXVpLCBzYW5zLXNlcmlmJyB9LFxuICByYWRpaTogeyBzbTogOCwgbWQ6IDE0LCBsZzogMjIgfSxcbiAgc2hhZG93czoge1xuICAgIGNhcmQ6IFwiMCAyNHB4IDQ4cHggLTI4cHggcmdiYSgyMCwyNCw0MCwuMzUpLCAwIDAgMCAxcHggcmdiYSgyMCwyNCw0MCwuMDUpXCIsXG4gICAgZmxvYXQ6IFwiMCA1MHB4IDkwcHggLTQwcHggcmdiYSgyMCwyNCw0MCwuNSksIDAgMCAwIDFweCByZ2JhKDIwLDI0LDQwLC4wNilcIixcbiAgfSxcbn07XG5cbi8qKiBXQ0FHIHJlbGF0aXZlIGx1bWluYW5jZSBvZiBhICNyZ2IvI3JyZ2diYi9yZ2IoKS9yZ2JhKCkgY29sb3VyIChhbHBoYSBpZ25vcmVkKS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsdW1pbmFuY2UoY29sb3I6IHN0cmluZyk6IG51bWJlciB7XG4gIGNvbnN0IFtyLCBnLCBiXSA9IHBhcnNlQ29sb3IoY29sb3IpO1xuICBjb25zdCBjaCA9IChjOiBudW1iZXIpID0+IHsgYyAvPSAyNTU7IHJldHVybiBjIDw9IDAuMDQwNDUgPyBjIC8gMTIuOTIgOiAoKGMgKyAwLjA1NSkgLyAxLjA1NSkgKiogMi40OyB9O1xuICByZXR1cm4gMC4yMTI2ICogY2gocikgKyAwLjcxNTIgKiBjaChnKSArIDAuMDcyMiAqIGNoKGIpO1xufVxuXG4vKiogV0NBRyBjb250cmFzdCByYXRpbyBiZXR3ZWVuIHR3byBjb2xvdXJzICgxLi4yMSkuICovXG5leHBvcnQgZnVuY3Rpb24gY29udHJhc3QoYTogc3RyaW5nLCBiOiBzdHJpbmcpOiBudW1iZXIge1xuICBjb25zdCBsYSA9IGx1bWluYW5jZShhKSwgbGIgPSBsdW1pbmFuY2UoYik7XG4gIHJldHVybiAoTWF0aC5tYXgobGEsIGxiKSArIDAuMDUpIC8gKE1hdGgubWluKGxhLCBsYikgKyAwLjA1KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ29sb3IoYzogc3RyaW5nKTogW251bWJlciwgbnVtYmVyLCBudW1iZXIsIG51bWJlcl0ge1xuICBjID0gYy50cmltKCk7XG4gIGlmIChjLnN0YXJ0c1dpdGgoXCIjXCIpKSB7XG4gICAgbGV0IGggPSBjLnNsaWNlKDEpO1xuICAgIGlmIChoLmxlbmd0aCA9PT0gMyB8fCBoLmxlbmd0aCA9PT0gNCkgaCA9IFsuLi5oXS5tYXAoeCA9PiB4ICsgeCkuam9pbihcIlwiKTtcbiAgICBjb25zdCBuID0gcGFyc2VJbnQoaC5zbGljZSgwLCA2KSwgMTYpO1xuICAgIHJldHVybiBbKG4gPj4gMTYpICYgMjU1LCAobiA+PiA4KSAmIDI1NSwgbiAmIDI1NSwgaC5sZW5ndGggPT09IDggPyBwYXJzZUludChoLnNsaWNlKDYpLCAxNikgLyAyNTUgOiAxXTtcbiAgfVxuICBjb25zdCBtID0gYy5tYXRjaCgvcmdiYT9cXCgoW14pXSspXFwpLyk7XG4gIGlmIChtKSB7XG4gICAgY29uc3QgcCA9IG1bMV0uc3BsaXQoL1tcXHMsL10rLykuZmlsdGVyKEJvb2xlYW4pLm1hcChOdW1iZXIpO1xuICAgIHJldHVybiBbcFswXSwgcFsxXSwgcFsyXSwgcFszXSA/PyAxXTtcbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoYGNhbid0IHBhcnNlIGNvbG91ciBcIiR7Y31cImApO1xufVxuIiwgIi8vIFN0b3J5Ym9hcmQ6IGFuIG9wdGlvbmFsIGludGVybWVkaWF0ZSByZXByZXNlbnRhdGlvbiBvZiBhIHZpZGVvJ3Mgc3RydWN0dXJlIChzY2VuZXMsIGR1cmF0aW9ucyxcbi8vIG9uLXNjcmVlbiB0ZXh0LCB2b2ljZS1vdmVyIGxpbmVzLCBiZWF0cyksIHJldmlld2VkIGJlZm9yZSBhbnkgbW90aW9uIGlzIHdyaXR0ZW4uIFBsYWluIEpTT04gc28gYVxuLy8gaHVtYW4gY2FuIHJlYWQgaXQgYW5kIGFuIGFnZW50IGNhbiBnZW5lcmF0ZSBpdCBmcm9tIGEgYnJpZWYuIFZhbGlkYXRpb24gaXMgaGFuZC13cml0dGVuIChubyBkZXBzKVxuLy8gYW5kIHJldHVybnMgZXZlcnkgcHJvYmxlbSB3aXRoIGEgSlNPTiBwYXRoLCBub3QganVzdCB0aGUgZmlyc3QuXG5pbXBvcnQgeyBFQVNJTkdTIH0gZnJvbSBcIi4vZWFzaW5nLnRzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3Rvcnlib2FyZFNjZW5lIHtcbiAgbmFtZTogc3RyaW5nO1xuICAvKiogU2Vjb25kcy4gRWl0aGVyIGR1cmF0aW9uIG9yIHN0YXJ0K2VuZDsgc2NlbmVzIGFyZSBsYWlkIGVuZCB0byBlbmQgd2hlbiBzdGFydCBpcyBvbWl0dGVkLiAqL1xuICBzdGFydD86IG51bWJlcjtcbiAgZHVyYXRpb246IG51bWJlcjtcbiAgLyoqIFdoYXQgdGhlIHZpZXdlciBzaG91bGQgdGFrZSBhd2F5IChvbmUgaWRlYSBwZXIgYmVhdCkuICovXG4gIGlkZWE6IHN0cmluZztcbiAgLyoqIE9uLXNjcmVlbiB0ZXh0IChoZWFkbGluZXMgXHUyMjY0IDkgd29yZHMpLiAqL1xuICB0ZXh0Pzogc3RyaW5nW107XG4gIC8qKiBWb2ljZS1vdmVyIGxpbmUgZm9yIHRoaXMgc2NlbmUuICovXG4gIHZvPzogc3RyaW5nO1xuICAvKiogSG93IHRoZSBjYW1lcmEgZ2V0cyBoZXJlIGZyb20gdGhlIHByZXZpb3VzIHNjZW5lLiAqL1xuICB0cmFuc2l0aW9uPzogXCJjdXRcIiB8IFwid2hpcFwiIHwgXCJwdWxsLWJhY2tcIiB8IFwicHVzaFwiIHwgXCJkb2xseS10aHJvdWdoXCIgfCBcInpvb20taW50b1wiIHwgXCJtYXRjaC1jdXRcIiB8IFwicmVlbFwiIHwgXCJjb250aW51aXR5XCI7XG4gIC8qKiBIZXJvIGVsZW1lbnQgLyB2aXN1YWwuICovXG4gIHZpc3VhbD86IHN0cmluZztcbiAgLyoqIE5hbWVkIGJlYXRzIGluc2lkZSB0aGUgc2NlbmUsIHNlY29uZHMgZnJvbSBpdHMgc3RhcnQuICovXG4gIGJlYXRzPzogUmVjb3JkPHN0cmluZywgbnVtYmVyPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdG9yeWJvYXJkIHtcbiAgJHNjaGVtYT86IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgLyoqIFdoYXQgdGhlIHZpZGVvIGlzIGZvciAoc3RvcmUgbGlzdGluZywgbGF1bmNoIHR3ZWV0LCBZb3VUdWJlXHUyMDI2KS4gKi9cbiAgcHVycG9zZT86IHN0cmluZztcbiAgYXNwZWN0PzogXCIxNjo5XCIgfCBcIjk6MTZcIiB8IFwiMToxXCIgfCBcIjQ6NVwiO1xuICBmcHM/OiBudW1iZXI7XG4gIGJwbT86IG51bWJlcjtcbiAgYnJhbmQ/OiB7IGNvbG9ycz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47IGZvbnRzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB9O1xuICBzY2VuZXM6IFN0b3J5Ym9hcmRTY2VuZVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFByb2JsZW0geyBwYXRoOiBzdHJpbmc7IG1lc3NhZ2U6IHN0cmluZzsgc2V2ZXJpdHk6IFwiZXJyb3JcIiB8IFwid2FyblwiIH1cblxuY29uc3QgVFJBTlNJVElPTlMgPSBbXCJjdXRcIiwgXCJ3aGlwXCIsIFwicHVsbC1iYWNrXCIsIFwicHVzaFwiLCBcImRvbGx5LXRocm91Z2hcIiwgXCJ6b29tLWludG9cIiwgXCJtYXRjaC1jdXRcIiwgXCJyZWVsXCIsIFwiY29udGludWl0eVwiXTtcblxuLyoqIFdvcmRzIGEgdmlld2VyIGNhbiByZWFkIHBlciBzZWNvbmQgb2Ygb24tc2NyZWVuIHRpbWUgKHdpdGggMC41IHMgdG8gbm90aWNlIHRoZSB0ZXh0KS4gKi9cbmV4cG9ydCBjb25zdCByZWFkaW5nVGltZSA9ICh0ZXh0OiBzdHJpbmcpOiBudW1iZXIgPT4gMC41ICsgdGV4dC50cmltKCkuc3BsaXQoL1xccysvKS5maWx0ZXIoQm9vbGVhbikubGVuZ3RoIC8gMztcblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlU3Rvcnlib2FyZChzYjogdW5rbm93bik6IHsgb2s6IGJvb2xlYW47IHByb2JsZW1zOiBQcm9ibGVtW107IHRpbWVsaW5lOiBBcnJheTx7IG5hbWU6IHN0cmluZzsgc3RhcnQ6IG51bWJlcjsgZW5kOiBudW1iZXIgfT4gfSB7XG4gIGNvbnN0IHByb2JsZW1zOiBQcm9ibGVtW10gPSBbXTtcbiAgY29uc3QgZXJyID0gKHBhdGg6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKSA9PiBwcm9ibGVtcy5wdXNoKHsgcGF0aCwgbWVzc2FnZSwgc2V2ZXJpdHk6IFwiZXJyb3JcIiB9KTtcbiAgY29uc3Qgd2FybiA9IChwYXRoOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykgPT4gcHJvYmxlbXMucHVzaCh7IHBhdGgsIG1lc3NhZ2UsIHNldmVyaXR5OiBcIndhcm5cIiB9KTtcbiAgY29uc3QgdGltZWxpbmU6IEFycmF5PHsgbmFtZTogc3RyaW5nOyBzdGFydDogbnVtYmVyOyBlbmQ6IG51bWJlciB9PiA9IFtdO1xuICBpZiAoIXNiIHx8IHR5cGVvZiBzYiAhPT0gXCJvYmplY3RcIikgeyBlcnIoXCIkXCIsIFwic3Rvcnlib2FyZCBtdXN0IGJlIGFuIG9iamVjdFwiKTsgcmV0dXJuIHsgb2s6IGZhbHNlLCBwcm9ibGVtcywgdGltZWxpbmUgfTsgfVxuICBjb25zdCBzID0gc2IgYXMgUGFydGlhbDxTdG9yeWJvYXJkPjtcbiAgaWYgKHR5cGVvZiBzLnRpdGxlICE9PSBcInN0cmluZ1wiIHx8ICFzLnRpdGxlKSBlcnIoXCIkLnRpdGxlXCIsIFwidGl0bGUgaXMgcmVxdWlyZWRcIik7XG4gIGlmIChzLmFzcGVjdCAmJiAhW1wiMTY6OVwiLCBcIjk6MTZcIiwgXCIxOjFcIiwgXCI0OjVcIl0uaW5jbHVkZXMocy5hc3BlY3QpKSBlcnIoXCIkLmFzcGVjdFwiLCBgYXNwZWN0IG11c3QgYmUgMTY6OSwgOToxNiwgMToxIG9yIDQ6NSAoZ290ICR7cy5hc3BlY3R9KWApO1xuICBpZiAocy5mcHMgIT09IHVuZGVmaW5lZCAmJiAhWzI0LCAyNSwgMzAsIDUwLCA2MF0uaW5jbHVkZXMocy5mcHMpKSB3YXJuKFwiJC5mcHNcIiwgYHVudXN1YWwgZnBzICR7cy5mcHN9YCk7XG4gIGlmICghQXJyYXkuaXNBcnJheShzLnNjZW5lcykgfHwgIXMuc2NlbmVzLmxlbmd0aCkgeyBlcnIoXCIkLnNjZW5lc1wiLCBcImF0IGxlYXN0IG9uZSBzY2VuZSBpcyByZXF1aXJlZFwiKTsgcmV0dXJuIHsgb2s6IGZhbHNlLCBwcm9ibGVtcywgdGltZWxpbmUgfTsgfVxuICBsZXQgY3Vyc29yID0gMDtcbiAgY29uc3QgbmFtZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcy5zY2VuZXMuZm9yRWFjaCgoc2MsIGkpID0+IHtcbiAgICBjb25zdCBwID0gYCQuc2NlbmVzWyR7aX1dYDtcbiAgICBpZiAoIXNjIHx8IHR5cGVvZiBzYyAhPT0gXCJvYmplY3RcIikgeyBlcnIocCwgXCJzY2VuZSBtdXN0IGJlIGFuIG9iamVjdFwiKTsgcmV0dXJuOyB9XG4gICAgaWYgKHR5cGVvZiBzYy5uYW1lICE9PSBcInN0cmluZ1wiIHx8ICEvXlthLXpdW2EtejAtOS1dKiQvLnRlc3Qoc2MubmFtZSkpIGVycihgJHtwfS5uYW1lYCwgXCJuYW1lIG11c3QgYmUga2ViYWItY2FzZSAoYS16LCAwLTksIC0pXCIpO1xuICAgIGVsc2UgaWYgKG5hbWVzLmhhcyhzYy5uYW1lKSkgZXJyKGAke3B9Lm5hbWVgLCBgZHVwbGljYXRlIHNjZW5lIG5hbWUgXCIke3NjLm5hbWV9XCJgKTtcbiAgICBlbHNlIG5hbWVzLmFkZChzYy5uYW1lKTtcbiAgICBpZiAodHlwZW9mIHNjLmR1cmF0aW9uICE9PSBcIm51bWJlclwiIHx8ICEoc2MuZHVyYXRpb24gPiAwKSkgZXJyKGAke3B9LmR1cmF0aW9uYCwgXCJkdXJhdGlvbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyIG9mIHNlY29uZHNcIik7XG4gICAgaWYgKHR5cGVvZiBzYy5pZGVhICE9PSBcInN0cmluZ1wiIHx8ICFzYy5pZGVhKSBlcnIoYCR7cH0uaWRlYWAsIFwiaWRlYSBpcyByZXF1aXJlZDogd2hhdCBzaG91bGQgdGhlIHZpZXdlciB0YWtlIGF3YXk/XCIpO1xuICAgIGlmIChzYy50cmFuc2l0aW9uICYmICFUUkFOU0lUSU9OUy5pbmNsdWRlcyhzYy50cmFuc2l0aW9uKSkgZXJyKGAke3B9LnRyYW5zaXRpb25gLCBgdHJhbnNpdGlvbiBtdXN0IGJlIG9uZSBvZiAke1RSQU5TSVRJT05TLmpvaW4oXCIsIFwiKX1gKTtcbiAgICBjb25zdCBzdGFydCA9IHR5cGVvZiBzYy5zdGFydCA9PT0gXCJudW1iZXJcIiA/IHNjLnN0YXJ0IDogY3Vyc29yO1xuICAgIGlmICh0eXBlb2Ygc2Muc3RhcnQgPT09IFwibnVtYmVyXCIgJiYgc2Muc3RhcnQgPCBjdXJzb3IgLSAxLjUpIHdhcm4oYCR7cH0uc3RhcnRgLCBgb3ZlcmxhcHMgdGhlIHByZXZpb3VzIHNjZW5lIGJ5ICR7KGN1cnNvciAtIHNjLnN0YXJ0KS50b0ZpeGVkKDIpfSBzYCk7XG4gICAgY29uc3QgZHVyID0gdHlwZW9mIHNjLmR1cmF0aW9uID09PSBcIm51bWJlclwiID8gc2MuZHVyYXRpb24gOiAwO1xuICAgIHRpbWVsaW5lLnB1c2goeyBuYW1lOiBzYy5uYW1lLCBzdGFydCwgZW5kOiBzdGFydCArIGR1ciB9KTtcbiAgICBjdXJzb3IgPSBzdGFydCArIGR1cjtcbiAgICAoc2MudGV4dCA/PyBbXSkuZm9yRWFjaCgodHh0LCBqKSA9PiB7XG4gICAgICBjb25zdCB3b3JkcyA9IHR4dC50cmltKCkuc3BsaXQoL1xccysvKS5sZW5ndGg7XG4gICAgICBpZiAod29yZHMgPiA5KSB3YXJuKGAke3B9LnRleHRbJHtqfV1gLCBgJHt3b3Jkc30gd29yZHM7IGhlYWRsaW5lcyByZWFkIGJlc3QgYXQgXHUyMjY0IDlgKTtcbiAgICAgIGNvbnN0IG5lZWQgPSByZWFkaW5nVGltZSh0eHQpO1xuICAgICAgaWYgKGR1ciAmJiBuZWVkID4gZHVyKSBlcnIoYCR7cH0udGV4dFske2p9XWAsIGBuZWVkcyB+JHtuZWVkLnRvRml4ZWQoMSl9IHMgdG8gcmVhZCBidXQgdGhlIHNjZW5lIGlzICR7ZHVyfSBzYCk7XG4gICAgfSk7XG4gICAgaWYgKHNjLnZvKSB7XG4gICAgICBjb25zdCBzZWNzID0gc2Mudm8udHJpbSgpLnNwbGl0KC9cXHMrLykubGVuZ3RoIC8gMi41OyAvLyAxNTAgd3BtXG4gICAgICBpZiAoZHVyICYmIHNlY3MgPiBkdXIgKyAwLjI1KSBlcnIoYCR7cH0udm9gLCBgdm9pY2Utb3ZlciBuZWVkcyB+JHtzZWNzLnRvRml4ZWQoMSl9IHMgYXQgMTUwIHdwbSBidXQgdGhlIHNjZW5lIGlzICR7ZHVyfSBzYCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2IsIHRdIG9mIE9iamVjdC5lbnRyaWVzKHNjLmJlYXRzID8/IHt9KSkgaWYgKHR5cGVvZiB0ICE9PSBcIm51bWJlclwiIHx8IHQgPCAwIHx8IHQgPiBkdXIpIGVycihgJHtwfS5iZWF0cy4ke2J9YCwgYGJlYXQgbXVzdCBiZSB3aXRoaW4gMFx1MjAxMyR7ZHVyfSBzYCk7XG4gIH0pO1xuICBjb25zdCB0b3RhbCA9IGN1cnNvcjtcbiAgaWYgKHRvdGFsID4gNjApIHdhcm4oXCIkLnNjZW5lc1wiLCBgdG90YWwgJHt0b3RhbC50b0ZpeGVkKDEpfSBzOyBwcm9tb3Mgd29yayBiZXN0IGF0IDE1XHUyMDEzNjAgc2ApO1xuICBpZiAocy5zY2VuZXNbMF0gJiYgKHMuc2NlbmVzWzBdLmR1cmF0aW9uID8/IDApID4gMykgd2FybihcIiQuc2NlbmVzWzBdLmR1cmF0aW9uXCIsIFwidGhlIGZpcnN0IHNjZW5lIGlzIHRoZSBob29rOiBsYW5kIGl0IHdpdGhpbiAyXHUyMDEzMyBzXCIpO1xuICByZXR1cm4geyBvazogIXByb2JsZW1zLnNvbWUocCA9PiBwLnNldmVyaXR5ID09PSBcImVycm9yXCIpLCBwcm9ibGVtcywgdGltZWxpbmUgfTtcbn1cblxuLyoqIEpTT04gU2NoZW1hIGZvciBlZGl0b3JzIGFuZCBhZ2VudHMgKGtlcHQgaW4gc3luYyB3aXRoIHRoZSBpbnRlcmZhY2VzIGFib3ZlKS4gKi9cbmV4cG9ydCBjb25zdCBzdG9yeWJvYXJkU2NoZW1hID0ge1xuICAkc2NoZW1hOiBcImh0dHBzOi8vanNvbi1zY2hlbWEub3JnL2RyYWZ0LzIwMjAtMTIvc2NoZW1hXCIsXG4gIHRpdGxlOiBcImRvbGx5IHN0b3J5Ym9hcmRcIixcbiAgdHlwZTogXCJvYmplY3RcIixcbiAgcmVxdWlyZWQ6IFtcInRpdGxlXCIsIFwic2NlbmVzXCJdLFxuICBwcm9wZXJ0aWVzOiB7XG4gICAgdGl0bGU6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgIHB1cnBvc2U6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgIGFzcGVjdDogeyBlbnVtOiBbXCIxNjo5XCIsIFwiOToxNlwiLCBcIjE6MVwiLCBcIjQ6NVwiXSB9LFxuICAgIGZwczogeyB0eXBlOiBcIm51bWJlclwiIH0sXG4gICAgYnBtOiB7IHR5cGU6IFwibnVtYmVyXCIgfSxcbiAgICBicmFuZDogeyB0eXBlOiBcIm9iamVjdFwiIH0sXG4gICAgc2NlbmVzOiB7XG4gICAgICB0eXBlOiBcImFycmF5XCIsIG1pbkl0ZW1zOiAxLFxuICAgICAgaXRlbXM6IHtcbiAgICAgICAgdHlwZTogXCJvYmplY3RcIiwgcmVxdWlyZWQ6IFtcIm5hbWVcIiwgXCJkdXJhdGlvblwiLCBcImlkZWFcIl0sXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICBuYW1lOiB7IHR5cGU6IFwic3RyaW5nXCIsIHBhdHRlcm46IFwiXlthLXpdW2EtejAtOS1dKiRcIiB9LFxuICAgICAgICAgIHN0YXJ0OiB7IHR5cGU6IFwibnVtYmVyXCIgfSwgZHVyYXRpb246IHsgdHlwZTogXCJudW1iZXJcIiwgZXhjbHVzaXZlTWluaW11bTogMCB9LFxuICAgICAgICAgIGlkZWE6IHsgdHlwZTogXCJzdHJpbmdcIiB9LCB0ZXh0OiB7IHR5cGU6IFwiYXJyYXlcIiwgaXRlbXM6IHsgdHlwZTogXCJzdHJpbmdcIiB9IH0sIHZvOiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcbiAgICAgICAgICB0cmFuc2l0aW9uOiB7IGVudW06IFRSQU5TSVRJT05TIH0sIHZpc3VhbDogeyB0eXBlOiBcInN0cmluZ1wiIH0sXG4gICAgICAgICAgYmVhdHM6IHsgdHlwZTogXCJvYmplY3RcIiwgYWRkaXRpb25hbFByb3BlcnRpZXM6IHsgdHlwZTogXCJudW1iZXJcIiB9IH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59IGFzIGNvbnN0O1xuXG5leHBvcnQgY29uc3QgZWFzaW5nTmFtZXMgPSBPYmplY3Qua2V5cyhFQVNJTkdTKTtcbiIsICIvLyBTbWFsbCBET00gaGVscGVycyBzaGFyZWQgYnkgY29tcG9uZW50cyBhbmQgc2NlbmVzIChicm93c2VyIG9ubHkpLlxuXG4vKiogU2V0IHRyYW5zZm9ybSBhbmQgb3BhY2l0eSB0b2dldGhlcjsgZnVsbHkgdHJhbnNwYXJlbnQgZWxlbWVudHMgYXJlIGFsc28gaGlkZGVuIHNvIHRoZXkgc2tpcCBwYWludC4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZihlbDogSFRNTEVsZW1lbnQgfCBTVkdFbGVtZW50LCB0cmFuc2Zvcm06IHN0cmluZywgb3BhY2l0eSA9IDEpOiB2b2lkIHtcbiAgZWwuc3R5bGUudHJhbnNmb3JtID0gdHJhbnNmb3JtO1xuICBlbC5zdHlsZS5vcGFjaXR5ID0gU3RyaW5nKG9wYWNpdHkpO1xuICAvLyBcIlwiIHJhdGhlciB0aGFuIFwidmlzaWJsZVwiLCBzbyBhIGhpZGRlbiBhbmNlc3RvciBzdGlsbCBoaWRlcyBpdFxuICBlbC5zdHlsZS52aXNpYmlsaXR5ID0gb3BhY2l0eSA8PSAwLjAwMSA/IFwiaGlkZGVuXCIgOiBcIlwiO1xufVxuXG4vKiogU2hvdyBvciBoaWRlIHdpdGhvdXQgdG91Y2hpbmcgdHJhbnNmb3JtLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNob3coZWw6IEhUTUxFbGVtZW50LCBvbjogYm9vbGVhbik6IHZvaWQgeyBlbC5zdHlsZS52aXNpYmlsaXR5ID0gb24gPyBcIlwiIDogXCJoaWRkZW5cIjsgfVxuXG4vKiogSW5qZWN0IGEgc3R5bGVzaGVldCBvbmNlIHBlciBkb2N1bWVudCAoY29tcG9uZW50cyBjYWxsIHRoaXMgZnJvbSB0aGVpciBzZXR1cCkuICovXG5leHBvcnQgZnVuY3Rpb24gZW5zdXJlU3R5bGUoaWQ6IHN0cmluZywgY3NzOiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gXCJ1bmRlZmluZWRcIiB8fCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgZG9sbHktc3R5bGUtJHtpZH1gKSkgcmV0dXJuO1xuICBjb25zdCBzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpO1xuICBzLmlkID0gYGRvbGx5LXN0eWxlLSR7aWR9YDtcbiAgcy50ZXh0Q29udGVudCA9IGNzcztcbiAgZG9jdW1lbnQuaGVhZC5hcHBlbmQocyk7XG59XG5cbi8qKiBDcmVhdGUgYW4gZWxlbWVudDogaChcImRpdlwiLCB7IGNsYXNzOiBcImNoaXBcIiwgc3R5bGU6IFwibGVmdDoxMHB4XCIgfSwgY2hpbGQsIFwidGV4dFwiKS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoPEsgZXh0ZW5kcyBrZXlvZiBIVE1MRWxlbWVudFRhZ05hbWVNYXA+KHRhZzogSywgYXR0cnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IG51bWJlciB8IHVuZGVmaW5lZD4gPSB7fSwgLi4uY2hpbGRyZW46IEFycmF5PE5vZGUgfCBzdHJpbmc+KTogSFRNTEVsZW1lbnRUYWdOYW1lTWFwW0tdIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZyk7XG4gIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKGF0dHJzKSkgaWYgKHYgIT09IHVuZGVmaW5lZCkgZWwuc2V0QXR0cmlidXRlKGssIFN0cmluZyh2KSk7XG4gIGZvciAoY29uc3QgYyBvZiBjaGlsZHJlbikgZWwuYXBwZW5kKGMpO1xuICByZXR1cm4gZWw7XG59XG5cbi8qKiBQYXJzZSBhbiBIVE1MIHN0cmluZyBpbnRvIGl0cyBmaXJzdCBlbGVtZW50LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGh0bWw8VCBleHRlbmRzIEhUTUxFbGVtZW50ID0gSFRNTEVsZW1lbnQ+KHM6IHN0cmluZyk6IFQge1xuICBjb25zdCB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIpO1xuICB0LmlubmVySFRNTCA9IHMudHJpbSgpO1xuICByZXR1cm4gdC5jb250ZW50LmZpcnN0RWxlbWVudENoaWxkIGFzIFQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVIdG1sKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzLnJlcGxhY2UoL1smPD5cIiddL2csIGMgPT4gKHsgXCImXCI6IFwiJmFtcDtcIiwgXCI8XCI6IFwiJmx0O1wiLCBcIj5cIjogXCImZ3Q7XCIsICdcIic6IFwiJnF1b3Q7XCIsIFwiJ1wiOiBcIiYjMzk7XCIgfSlbY10hKTtcbn1cblxubGV0IHN0YWdlRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5sZXQgc3RhZ2VTY2FsZSA9IDE7XG4vKiogQ2FsbGVkIGJ5IHRoZSBydW50aW1lIHdoZW4gdGhlIHN0YWdlIGlzIChyZSlmaXR0ZWQuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0U3RhZ2UoZWw6IEhUTUxFbGVtZW50LCBzY2FsZTogbnVtYmVyKTogdm9pZCB7IHN0YWdlRWwgPSBlbDsgc3RhZ2VTY2FsZSA9IHNjYWxlOyB9XG5leHBvcnQgY29uc3Qgc3RhZ2VTY2FsZUZhY3RvciA9ICgpOiBudW1iZXIgPT4gc3RhZ2VTY2FsZTtcblxuLyoqXG4gKiBXaGVyZSBhIHBvaW50IG9mIGFuIGVsZW1lbnQgY3VycmVudGx5IGlzLCBpbiBzdGFnZSBjb29yZGluYXRlcyAoZngsIGZ5IGFyZSBmcmFjdGlvbnMgb2YgaXRzIGJveCkuXG4gKiBNZWFzdXJlcyBsaXZlIGxheW91dCwgc28gaXQgZm9sbG93cyAzRCB0aWx0cyBhbmQgYW5pbWF0aW5nIHBhcmVudHM6IHVzZSBpdCB0byBhaW0gYSBjdXJzb3IuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdGFnZVBvaW50KGVsOiBFbGVtZW50LCBmeCA9IDAuNSwgZnkgPSAwLjUpOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgaWYgKCFzdGFnZUVsKSB0aHJvdyBuZXcgRXJyb3IoXCJzdGFnZVBvaW50KCk6IG5vIHN0YWdlIG1vdW50ZWRcIik7XG4gIGNvbnN0IHN0ID0gc3RhZ2VFbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSwgciA9IGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICByZXR1cm4gWyhyLmxlZnQgLSBzdC5sZWZ0ICsgci53aWR0aCAqIGZ4KSAvIHN0YWdlU2NhbGUsIChyLnRvcCAtIHN0LnRvcCArIHIuaGVpZ2h0ICogZnkpIC8gc3RhZ2VTY2FsZV07XG59XG5cbi8qKiBBbiBlbGVtZW50J3MgYm94IGluIHN0YWdlIGNvb3JkaW5hdGVzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN0YWdlUmVjdChlbDogRWxlbWVudCk6IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHc6IG51bWJlcjsgaDogbnVtYmVyIH0ge1xuICBpZiAoIXN0YWdlRWwpIHRocm93IG5ldyBFcnJvcihcInN0YWdlUmVjdCgpOiBubyBzdGFnZSBtb3VudGVkXCIpO1xuICBjb25zdCBzdCA9IHN0YWdlRWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksIHIgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgcmV0dXJuIHsgeDogKHIubGVmdCAtIHN0LmxlZnQpIC8gc3RhZ2VTY2FsZSwgeTogKHIudG9wIC0gc3QudG9wKSAvIHN0YWdlU2NhbGUsIHc6IHIud2lkdGggLyBzdGFnZVNjYWxlLCBoOiByLmhlaWdodCAvIHN0YWdlU2NhbGUgfTtcbn1cbiIsICIvLyBNYXNrZWQgdHlwZTogZWFjaCB3b3JkIChvciBjaGFyYWN0ZXIpIHJpc2VzIG91dCBvZiBpdHMgb3duIGNsaXAgYm94LiBcInx3b3JkfFwiIG1hcmtzIGFuIGFjY2VudCBzcGFuLlxuaW1wb3J0IHsgZW5zdXJlU3R5bGUsIGVzY2FwZUh0bWwgfSBmcm9tIFwiLi4vZG9tLnRzXCI7XG5pbXBvcnQgeyBleHBvT3V0LCBxdWFydEluT3V0LCB0eXBlIEVhc2luZyB9IGZyb20gXCIuLi9lYXNpbmcudHNcIjtcbmltcG9ydCB7IHByb2cgfSBmcm9tIFwiLi4vbWF0aC50c1wiO1xuXG5jb25zdCBDU1MgPSBgXG4uZG9sbHktd217ZGlzcGxheTppbmxpbmUtYmxvY2s7b3ZlcmZsb3c6aGlkZGVuO3ZlcnRpY2FsLWFsaWduOnRvcDtwYWRkaW5nOjAgLjAyZW0gLjE0ZW07bWFyZ2luOjAgLS4wMmVtIC0uMTRlbX1cbi5kb2xseS13aXtkaXNwbGF5OmlubGluZS1ibG9jazt3aWxsLWNoYW5nZTp0cmFuc2Zvcm19XG4uZG9sbHktYWNjZW50e2NvbG9yOnZhcigtLWMtYWNjZW50KX1gO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1hc2tlZE9wdGlvbnMge1xuICAvKiogU3BsaXQgaW50byBjaGFyYWN0ZXJzIGluc3RlYWQgb2Ygd29yZHMgKHByaWNlcywgbmFtZXMpLiAqL1xuICBjaGFycz86IGJvb2xlYW47XG4gIC8qKiBDbGFzcyBmb3IgfGFjY2VudGVkfCBwYXJ0cy4gKi9cbiAgYWNjZW50Q2xhc3M/OiBzdHJpbmc7XG4gIC8qKiBJbnNlcnQgYXQgdGhlIHN0YXJ0IG9mIHRoZSBlbGVtZW50IChrZWVwcyBleGlzdGluZyBjaGlsZHJlbiBzdWNoIGFzIGEgYmFkZ2UgYWZ0ZXIgdGhlIHRleHQpLiAqL1xuICBwcmVwZW5kPzogYm9vbGVhbjtcbn1cblxuLyoqIEZpbGwgYGVsYCB3aXRoIG1hc2tlZCB1bml0cyBhbmQgcmV0dXJuIHRoZW0gKHRoZSBzcGFucyB0aGF0IG1vdmUpLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1hc2tlZChlbDogSFRNTEVsZW1lbnQsIHRleHQ6IHN0cmluZywgb3B0czogTWFza2VkT3B0aW9ucyA9IHt9KTogSFRNTEVsZW1lbnRbXSB7XG4gIGVuc3VyZVN0eWxlKFwibWFza2VkXCIsIENTUyk7XG4gIGNvbnN0IHBhcnRzID0gdGV4dC5zcGxpdCgvKFxcfFtefF0qXFx8KS8pLmZpbHRlcihCb29sZWFuKTtcbiAgbGV0IG91dCA9IFwiXCI7XG4gIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgIGNvbnN0IGFjY2VudCA9IHBhcnQuc3RhcnRzV2l0aChcInxcIikgJiYgcGFydC5lbmRzV2l0aChcInxcIikgJiYgcGFydC5sZW5ndGggPiAxO1xuICAgIGNvbnN0IHMgPSBhY2NlbnQgPyBwYXJ0LnNsaWNlKDEsIC0xKSA6IHBhcnQ7XG4gICAgY29uc3QgdW5pdHMgPSBvcHRzLmNoYXJzID8gWy4uLnNdIDogcy5zcGxpdCgvKFxccyspLyk7XG4gICAgZm9yIChjb25zdCB1IG9mIHVuaXRzKSB7XG4gICAgICBpZiAodSA9PT0gXCJcIikgY29udGludWU7XG4gICAgICBpZiAoIW9wdHMuY2hhcnMgJiYgL15cXHMrJC8udGVzdCh1KSkgeyBvdXQgKz0gXCIgXCI7IGNvbnRpbnVlOyB9XG4gICAgICBjb25zdCBjbHMgPSBhY2NlbnQgPyBgICR7b3B0cy5hY2NlbnRDbGFzcyA/PyBcImRvbGx5LWFjY2VudFwifWAgOiBcIlwiO1xuICAgICAgb3V0ICs9IGA8c3BhbiBjbGFzcz1cImRvbGx5LXdtXCI+PHNwYW4gY2xhc3M9XCJkb2xseS13aSR7Y2xzfVwiPiR7dSA9PT0gXCIgXCIgPyBcIiZuYnNwO1wiIDogZXNjYXBlSHRtbCh1KX08L3NwYW4+PC9zcGFuPmA7XG4gICAgfVxuICB9XG4gIGVsLmluc2VydEFkamFjZW50SFRNTChvcHRzLnByZXBlbmQgPT09IGZhbHNlID8gXCJiZWZvcmVlbmRcIiA6IFwiYWZ0ZXJiZWdpblwiLCBvdXQpO1xuICByZXR1cm4gWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiLmRvbGx5LXdpXCIpXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUeXBlSW5PcHRpb25zIHtcbiAgLyoqIFNlY29uZHMgYmV0d2VlbiB1bml0cy4gV29yZHMgMC4wNVx1MjAxMzAuMDgsIGNoYXJhY3RlcnMgMC4wM1x1MjAxMzAuMDQ1LiAqL1xuICBzdGFnZ2VyPzogbnVtYmVyO1xuICAvKiogRW50cmFuY2UgZHVyYXRpb24gcGVyIHVuaXQuICovXG4gIGR1cj86IG51bWJlcjtcbiAgLyoqIEV4aXQgZHVyYXRpb24gcGVyIHVuaXQgKGV4aXRzIGFyZSBzaG9ydGVyIHRoYW4gZW50cmFuY2VzKS4gKi9cbiAgZXhpdER1cj86IG51bWJlcjtcbiAgLyoqIFRyYXZlbCBhcyBhICUgb2YgdGhlIHVuaXQncyBoZWlnaHQuIDE0MCBzbyBubyBzbGl2ZXIgcGVla3MgdW5kZXIgdGhlIG1hc2suICovXG4gIHJpc2U/OiBudW1iZXI7XG4gIC8qKiBEZWdyZWVzIG9mIHRpbHQgd2hpbGUgcmlzaW5nLiAqL1xuICByb3RhdGU/OiBudW1iZXI7XG4gIGVhc2U/OiBFYXNpbmc7XG4gIGV4aXRFYXNlPzogRWFzaW5nO1xufVxuXG4vKiogUmlzZSB1bml0cyBpbiBmcm9tIGJlbG93IGF0IGB0aW5gLCBhbmQgb3V0IHVwd2FyZHMgYXQgYHRvdXRgLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHR5cGVJbih1bml0czogSFRNTEVsZW1lbnRbXSwgdDogbnVtYmVyLCB0aW46IG51bWJlciwgdG91dCA9IEluZmluaXR5LCBvOiBUeXBlSW5PcHRpb25zID0ge30pOiB2b2lkIHtcbiAgY29uc3Qgc3RhZ2dlciA9IG8uc3RhZ2dlciA/PyAwLjA1LCBkdXIgPSBvLmR1ciA/PyAwLjc1LCBleGl0RHVyID0gby5leGl0RHVyID8/IDAuNSwgcmlzZSA9IG8ucmlzZSA/PyAxNDAsIHJvdCA9IG8ucm90YXRlID8/IDY7XG4gIGNvbnN0IGVpbiA9IG8uZWFzZSA/PyBleHBvT3V0LCBlb3V0ID0gby5leGl0RWFzZSA/PyBxdWFydEluT3V0O1xuICB1bml0cy5mb3JFYWNoKCh1LCBpKSA9PiB7XG4gICAgY29uc3QgcGluID0gZWluKHByb2codCwgdGluICsgaSAqIHN0YWdnZXIsIGR1cikpO1xuICAgIGNvbnN0IHBvdXQgPSBlb3V0KHByb2codCwgdG91dCArIGkgKiBzdGFnZ2VyICogMC42LCBleGl0RHVyKSk7XG4gICAgdS5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlWSgkeygxIC0gcGluKSAqIHJpc2UgLSBwb3V0ICogcmlzZX0lKSByb3RhdGUoJHsoMSAtIHBpbikgKiByb3R9ZGVnKWA7XG4gIH0pO1xufVxuXG4vKiogVGltZSB3aGVuIHRoZSBsYXN0IHVuaXQgaGFzIGZpbmlzaGVkIGVudGVyaW5nLiBMaW50J3MgcmVhZGluZy10aW1lIHJ1bGUgc3RhcnRzIGNvdW50aW5nIGhlcmUuICovXG5leHBvcnQgY29uc3QgdHlwZUluRG9uZSA9IChuOiBudW1iZXIsIHRpbjogbnVtYmVyLCBvOiBUeXBlSW5PcHRpb25zID0ge30pOiBudW1iZXIgPT4gdGluICsgKG4gLSAxKSAqIChvLnN0YWdnZXIgPz8gMC4wNSkgKyAoby5kdXIgPz8gMC43NSkgKiAwLjY7XG4iLCAiLy8gT2RvbWV0ZXI6IGRpZ2l0cyB0aGF0IGRpZmZlciByb2xsIHVwIGZyb20gdGhlIG9sZCBzdHJpbmcgdG8gdGhlIG5ldyBvbmUsIHJpZ2h0IHRvIGxlZnQuIFVzZSByb2xsKClcbi8vIGZvciBudW1iZXJzIGFuZCBzbGlkZSgpIGZvciBsYWJlbHMgKGEgcGVyLWNoYXJhY3RlciByb2xsIG9uIHRleHQgb2YgZGlmZmVyZW50IGxlbmd0aHMgbWlzYWxpZ25zKS5cbmltcG9ydCB7IGVuc3VyZVN0eWxlLCBlc2NhcGVIdG1sIH0gZnJvbSBcIi4uL2RvbS50c1wiO1xuaW1wb3J0IHsgZXhwb091dCB9IGZyb20gXCIuLi9lYXNpbmcudHNcIjtcbmltcG9ydCB7IGNsYW1wIH0gZnJvbSBcIi4uL21hdGgudHNcIjtcblxuY29uc3QgQ1NTID0gYFxuLmRvbGx5LXJse2Rpc3BsYXk6aW5saW5lLWJsb2NrO292ZXJmbG93OmhpZGRlbjtoZWlnaHQ6dmFyKC0tZG9sbHktbGgsMS43NWVtKTt2ZXJ0aWNhbC1hbGlnbjp0b3B9XG4uZG9sbHktcmw+c3BhbntkaXNwbGF5OmJsb2NrfVxuLmRvbGx5LXJsPnNwYW4+c3BhbntkaXNwbGF5OmJsb2NrO2hlaWdodDp2YXIoLS1kb2xseS1saCwxLjc1ZW0pfWA7XG5cbmNvbnN0IGNlbGwgPSAoYzogc3RyaW5nKSA9PiAoYyA9PT0gXCIgXCIgfHwgIWMgPyBcIiZuYnNwO1wiIDogZXNjYXBlSHRtbChjKSk7XG5cbi8qKiBIVE1MIGZvciB0aGUgcm9sbCBmcm9tIGEgdG8gYiBhdCBwcm9ncmVzcyBwICgwLi4xKS4gU2V0IHRoZSBsaW5lIGhlaWdodCB3aXRoIC0tZG9sbHktbGguICovXG5leHBvcnQgZnVuY3Rpb24gcm9sbChhOiBzdHJpbmcsIGI6IHN0cmluZywgcDogbnVtYmVyKTogc3RyaW5nIHtcbiAgZW5zdXJlU3R5bGUoXCJvZG9tZXRlclwiLCBDU1MpO1xuICBjb25zdCBuID0gTWF0aC5tYXgoYS5sZW5ndGgsIGIubGVuZ3RoKSwgQSA9IGEucGFkU3RhcnQobiwgXCIgXCIpLCBCID0gYi5wYWRTdGFydChuLCBcIiBcIik7XG4gIGxldCBodG1sID0gXCJcIjtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyBpKyspIHtcbiAgICBjb25zdCBjYSA9IEFbaV0gPT09IFwiIFwiID8gXCJcIiA6IEFbaV0sIGNiID0gQltpXSA9PT0gXCIgXCIgPyBcIlwiIDogQltpXTtcbiAgICBpZiAoY2EgPT09IGNiKSB7IGh0bWwgKz0gY2VsbChjYik7IGNvbnRpbnVlOyB9XG4gICAgY29uc3QgcSA9IGV4cG9PdXQoY2xhbXAocCAqIDEuNCAtIChuIC0gMSAtIGkpICogMC4wNSkpO1xuICAgIGlmIChxID49IDEpIHsgaHRtbCArPSBjZWxsKGNiKTsgY29udGludWU7IH1cbiAgICBodG1sICs9IGA8c3BhbiBjbGFzcz1cImRvbGx5LXJsXCI+PHNwYW4gc3R5bGU9XCJ0cmFuc2Zvcm06dHJhbnNsYXRlWSgkey1xICogNTB9JSlcIj48c3Bhbj4ke2NlbGwoY2EpfTwvc3Bhbj48c3Bhbj4ke2NlbGwoY2IpfTwvc3Bhbj48L3NwYW4+PC9zcGFuPmA7XG4gIH1cbiAgcmV0dXJuIGh0bWw7XG59XG5cbi8qKiBXaG9sZS1zdHJpbmcgc3dhcDogdGhlIG9sZCB0ZXh0IHNsaWRlcyB1cCBhbmQgb3V0IGFzIHRoZSBuZXcgb25lIHJpc2VzIGluLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNsaWRlKGE6IHN0cmluZywgYjogc3RyaW5nLCBwOiBudW1iZXIpOiBzdHJpbmcge1xuICBlbnN1cmVTdHlsZShcIm9kb21ldGVyXCIsIENTUyk7XG4gIGNvbnN0IHEgPSBleHBvT3V0KGNsYW1wKHApKTtcbiAgcmV0dXJuIHEgPj0gMSA/IGVzY2FwZUh0bWwoYikgOiBgPHNwYW4gY2xhc3M9XCJkb2xseS1ybFwiPjxzcGFuIHN0eWxlPVwidHJhbnNmb3JtOnRyYW5zbGF0ZVkoJHstcSAqIDUwfSUpXCI+PHNwYW4+JHtlc2NhcGVIdG1sKGEpfTwvc3Bhbj48c3Bhbj4ke2VzY2FwZUh0bWwoYil9PC9zcGFuPjwvc3Bhbj48L3NwYW4+YDtcbn1cblxuLyoqIFNldCBpbm5lckhUTUwgb25seSB3aGVuIGl0IGNoYW5nZWQsIHNvIHVuY2hhbmdlZCBmcmFtZXMgZG9uJ3QgcmVidWlsZCBET00gKGFuZCBrZWVwIGVsZW1lbnQgaWRlbnRpdHkpLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldEh0bWwoZWw6IEhUTUxFbGVtZW50LCBodG1sOiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKChlbCBhcyBIVE1MRWxlbWVudCAmIHsgX19kb2xseUh0bWw/OiBzdHJpbmcgfSkuX19kb2xseUh0bWwgPT09IGh0bWwpIHJldHVybjtcbiAgZWwuaW5uZXJIVE1MID0gaHRtbDtcbiAgKGVsIGFzIEhUTUxFbGVtZW50ICYgeyBfX2RvbGx5SHRtbD86IHN0cmluZyB9KS5fX2RvbGx5SHRtbCA9IGh0bWw7XG59XG5cbi8qKiBDb3VudCBhIG51bWJlciBmcm9tIGEgdG8gYiB3aXRoIGFuIGVhc2luZzsgZm9ybWF0KCkgcmVuZGVycyBpdCAobG9jYWxlLCBjdXJyZW5jeVx1MjAyNikuICovXG5leHBvcnQgZnVuY3Rpb24gY291bnRVcChhOiBudW1iZXIsIGI6IG51bWJlciwgcDogbnVtYmVyLCBmb3JtYXQ6IChuOiBudW1iZXIpID0+IHN0cmluZyA9IG4gPT4gTWF0aC5yb3VuZChuKS50b1N0cmluZygpKTogc3RyaW5nIHtcbiAgcmV0dXJuIGZvcm1hdChhICsgKGIgLSBhKSAqIGV4cG9PdXQoY2xhbXAocCkpKTtcbn1cbiIsICIvLyBCYWRnZSwgY2hpcCBhbmQgY2FyZCBwcmltaXRpdmVzLCBwbHVzIHRoZSBwaHlzaWNhbCBlbnRyYW5jZXMgdGhleSB1c2UuIFN0eWxlcyByZWFkIHRoZW1lIHRva2Vucy5cbmltcG9ydCB7IGVuc3VyZVN0eWxlLCB0ZiB9IGZyb20gXCIuLi9kb20udHNcIjtcbmltcG9ydCB7IHNwcmluZywgdHlwZSBTcHJpbmdQYXJhbXMgfSBmcm9tIFwiLi4vc3ByaW5nLnRzXCI7XG5pbXBvcnQgeyBjbGFtcCwgbGVycCB9IGZyb20gXCIuLi9tYXRoLnRzXCI7XG5cbmNvbnN0IENTUyA9IGBcbi5kb2xseS1iYWRnZXtwb3NpdGlvbjphYnNvbHV0ZTt3aGl0ZS1zcGFjZTpub3dyYXA7YmFja2dyb3VuZDp2YXIoLS1jLWluayk7Y29sb3I6I2ZmZjtmb250OjYwMCAxOXB4LzEuNzUgdmFyKC0tZi11aSx2YXIoLS1mLWJvZHkpKTtwYWRkaW5nOjAgLjZlbTtcbiAgYm9yZGVyLXJhZGl1czp2YXIoLS1yLXNtKSB2YXIoLS1yLXNtKSB2YXIoLS1yLXNtKSAycHg7Ym94LXNoYWRvdzowIDZweCAxNnB4IC02cHggcmdiYSgxMCwxMiwxNiwuNDUpO3RyYW5zZm9ybS1vcmlnaW46MCAxMDAlfVxuLmRvbGx5LWNoaXB7cG9zaXRpb246YWJzb2x1dGU7YmFja2dyb3VuZDp2YXIoLS1jLXN1cmZhY2UpO2JvcmRlci1yYWRpdXM6dmFyKC0tci1sZyk7cGFkZGluZzoyMnB4IDMwcHggMjBweDtib3gtc2hhZG93OnZhcigtLXMtY2FyZCl9XG4uZG9sbHktY2FyZHtwb3NpdGlvbjphYnNvbHV0ZTtiYWNrZ3JvdW5kOnZhcigtLWMtc3VyZmFjZSk7Ym9yZGVyLXJhZGl1czp2YXIoLS1yLWxnKTtib3gtc2hhZG93OnZhcigtLXMtZmxvYXQpfVxuLmRvbGx5LWxhYmVse2Rpc3BsYXk6YmxvY2s7Zm9udDo2MDAgMTVweCB2YXIoLS1mLWJvZHkpO2xldHRlci1zcGFjaW5nOi4wOGVtO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTtjb2xvcjp2YXIoLS1jLW11dGVkKX1gO1xuXG5leHBvcnQgY29uc3QgcHJpbWl0aXZlc0NzcyA9ICgpOiB2b2lkID0+IGVuc3VyZVN0eWxlKFwicHJpbWl0aXZlc1wiLCBDU1MpO1xuXG4vKiogQSBiYWRnZSBlbGVtZW50IChkYXJrIHBpbGwgd2l0aCBhIHNoYXJwIGNvcm5lciBpdCBncm93cyBvdXQgb2YpLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJhZGdlKHRleHQ6IHN0cmluZywgY2xzID0gXCJcIik6IEhUTUxTcGFuRWxlbWVudCB7XG4gIHByaW1pdGl2ZXNDc3MoKTtcbiAgY29uc3QgYiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICBiLmNsYXNzTmFtZSA9IGBkb2xseS1iYWRnZSAke2Nsc31gLnRyaW0oKTtcbiAgYi50ZXh0Q29udGVudCA9IHRleHQ7XG4gIHJldHVybiBiO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBvcEluT3B0aW9ucyBleHRlbmRzIFBhcnRpYWw8eyBmcmVxOiBudW1iZXI7IHpldGE6IG51bWJlciB9PiB7XG4gIC8qKiBEZWdyZWVzIG9mIHJvdGF0aW9uIGl0IHNldHRsZXMgb3V0IG9mLiAqL1xuICByb3RhdGU/OiBudW1iZXI7XG4gIC8qKiBPcGFjaXR5IHJhbXAgZHVyYXRpb24uICovXG4gIGZhZGU/OiBudW1iZXI7XG4gIGV4dHJhPzogc3RyaW5nO1xufVxuXG4vKiogR3JvdyBvdXQgb2YgdGhlIHRyYW5zZm9ybSBvcmlnaW4gd2l0aCBhIHNwcmluZ3kgb3ZlcnNob290IChiYWRnZXM6IDIuMSBIeiwgXHUwM0I2IDAuNDIpLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBvcEluKGVsOiBIVE1MRWxlbWVudCwgdDogbnVtYmVyLCB0MDogbnVtYmVyLCBvOiBQb3BJbk9wdGlvbnMgPSB7fSk6IG51bWJlciB7XG4gIGNvbnN0IHMgPSBzcHJpbmcodCAtIHQwLCB7IGZyZXE6IG8uZnJlcSA/PyAyLjEsIHpldGE6IG8uemV0YSA/PyAwLjQyIH0pO1xuICB0ZihlbCwgYHNjYWxlKCR7dCA8IHQwID8gMCA6IE1hdGgubWF4KDAsIHMpfSkgcm90YXRlKCR7KDEgLSBjbGFtcChzKSkgKiAoby5yb3RhdGUgPz8gLTgpfWRlZykke28uZXh0cmEgPyBcIiBcIiArIG8uZXh0cmEgOiBcIlwifWAsIGNsYW1wKCh0IC0gdDApIC8gKG8uZmFkZSA/PyAwLjExKSkpO1xuICByZXR1cm4gcztcbn1cblxuLyoqXG4gKiBGbHkgaW4gZnJvbSBhbiBvZmZzZXQgb24gYSBzcHJpbmc6IHN0YXJ0cyBhdCBgc2NhbGUwYCwgcm90YXRlZCwgYGR4L2R5YCBhd2F5IChtb3Rpb24gZ3JhbW1hcjogMC43XG4gKiBzY2FsZSwgMjAwXHUyMDEzNDAwIHB4LCBcdTAwQjE5XHUwMEIwKS4gUmV0dXJucyB0aGUgc3ByaW5nIHZhbHVlIHNvIGNhbGxlcnMgY2FuIGNoYWluIHJlYWN0aW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZseUluKGVsOiBIVE1MRWxlbWVudCwgdDogbnVtYmVyLCB0MDogbnVtYmVyLCBvOiB7IGR4OiBudW1iZXI7IGR5OiBudW1iZXI7IHJvdGF0ZT86IG51bWJlcjsgc2NhbGUwPzogbnVtYmVyOyBzcHJpbmc/OiBTcHJpbmdQYXJhbXM7IGV4dHJhPzogc3RyaW5nOyBmYWRlPzogbnVtYmVyIH0pOiBudW1iZXIge1xuICBjb25zdCBzID0gc3ByaW5nKHQgLSB0MCwgby5zcHJpbmcgPz8geyBmcmVxOiAxLjI1LCB6ZXRhOiAwLjYyIH0pO1xuICB0ZihlbCwgYHRyYW5zbGF0ZSgke28uZHggKiAoMSAtIHMpfXB4LCR7by5keSAqICgxIC0gcyl9cHgpIHJvdGF0ZSgkeygxIC0gcykgKiAoby5yb3RhdGUgPz8gOSl9ZGVnKSBzY2FsZSgke2xlcnAoby5zY2FsZTAgPz8gMC43LCAxLCBzKX0pJHtvLmV4dHJhID8gXCIgXCIgKyBvLmV4dHJhIDogXCJcIn1gLCBjbGFtcCgodCAtIHQwKSAvIChvLmZhZGUgPz8gMC4yKSkpO1xuICByZXR1cm4gcztcbn1cblxuLyoqIEltcGFjdCByZWFjdGlvbjogYSBzaG9ydCBzcXVhc2ggd2hlbiBzb21ldGhpbmcgbGFuZHMgb24gdGhpcyBlbGVtZW50ICgzXHUyMDEzNCAlKS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsYW5kKHQ6IG51bWJlciwgdDA6IG51bWJlciwgYW1vdW50ID0gMC4wMzUpOiBudW1iZXIge1xuICBpZiAodCA8PSB0MCkgcmV0dXJuIDA7XG4gIHJldHVybiBNYXRoLnNpbihNYXRoLm1pbigxLCAodCAtIHQwKSAvIDAuMzUpICogTWF0aC5QSSkgKiBhbW91bnQgKiBNYXRoLmV4cCgtKHQgLSB0MCkgKiAzKTtcbn1cblxuLyoqIEdlbnRsZSBpZGxlIGJvYiwgYSBmZXcgcHgsIHBoYXNlLXNoaWZ0ZWQgcGVyIGl0ZW0gc28gaG9sZHMgbmV2ZXIgc2l0IHN0aWxsLiAqL1xuZXhwb3J0IGNvbnN0IGJvYiA9ICh0OiBudW1iZXIsIGk6IG51bWJlciwgYW1wID0gNCwgc3BlZWQgPSAxLjEpOiBudW1iZXIgPT4gTWF0aC5zaW4odCAqIHNwZWVkICsgaSAqIDEuOSkgKiBhbXA7XG4iLCAiLy8gQSBjdXJzb3IgdGhhdCBtb3ZlcyBvbiBjdXJ2ZWQgcGF0aHMgYmV0d2VlbiBsaXZlLW1lYXN1cmVkIHRhcmdldHMsIHNxdWFzaGVzIG9uIHByZXNzIGFuZCBzZW5kcyBvdXQgYVxuLy8gcmlwcGxlIG9uIGVhY2ggY2xpY2suIFRhcmdldHMgY2FuIGJlIGZ1bmN0aW9ucywgbWVhc3VyZWQgZXZlcnkgZnJhbWUsIHNvIHRoZSBjdXJzb3IgZm9sbG93cyB0aWx0aW5nIG9yXG4vLyBhbmltYXRpbmcgVUkuXG5pbXBvcnQgeyBlbnN1cmVTdHlsZSwgdGYgfSBmcm9tIFwiLi4vZG9tLnRzXCI7XG5pbXBvcnQgeyBjdWJpY0luT3V0LCBleHBvT3V0LCB0eXBlIEVhc2luZyB9IGZyb20gXCIuLi9lYXNpbmcudHNcIjtcbmltcG9ydCB7IGFyY0NvbnRyb2wsIGNsYW1wLCBwcm9nLCBxdWFkLCB0eXBlIFZlYzIgfSBmcm9tIFwiLi4vbWF0aC50c1wiO1xuXG5jb25zdCBDU1MgPSBgXG4uZG9sbHktY3Vyc29ye3Bvc2l0aW9uOmFic29sdXRlO2xlZnQ6MDt0b3A6MDt3aWR0aDoyNnB4O3otaW5kZXg6NTtmaWx0ZXI6ZHJvcC1zaGFkb3coMCA0cHggNnB4IHJnYmEoMCwwLDAsLjI1KSk7dHJhbnNmb3JtLW9yaWdpbjoycHggMnB4fVxuLmRvbGx5LXJpcHBsZXtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjA7dG9wOjA7d2lkdGg6NDBweDtoZWlnaHQ6NDBweDttYXJnaW46LTIwcHggMCAwIC0yMHB4O2JvcmRlci1yYWRpdXM6NTAlO2JvcmRlcjoycHggc29saWQgdmFyKC0tYy1hY2NlbnQpO3otaW5kZXg6NH1gO1xuXG5leHBvcnQgdHlwZSBUYXJnZXQgPSBWZWMyIHwgKCgpID0+IFZlYzIpO1xuZXhwb3J0IGludGVyZmFjZSBDdXJzb3JTdG9wIHsgdDogbnVtYmVyOyBhdDogVGFyZ2V0OyBlYXNlPzogRWFzaW5nOyBiZW5kPzogbnVtYmVyIH1cblxuZXhwb3J0IGludGVyZmFjZSBDdXJzb3JIYW5kbGUge1xuICBlbDogU1ZHU1ZHRWxlbWVudDtcbiAgcmlwcGxlOiBIVE1MRWxlbWVudDtcbiAgLyoqIFBvc2l0aW9uIGF0IHQgKHN0YWdlIGNvb3JkaW5hdGVzKSB3aXRob3V0IGRyYXdpbmcuICovXG4gIHBvcyh0OiBudW1iZXIpOiBbbnVtYmVyLCBudW1iZXJdO1xuICByZW5kZXIodDogbnVtYmVyKTogdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDdXJzb3JPcHRpb25zIHtcbiAgcGF0aDogQ3Vyc29yU3RvcFtdO1xuICBjbGlja3M/OiBudW1iZXJbXTtcbiAgLyoqIEZhZGUtaW4gc3RhcnRzIGF0IGBmcm9tYCAoMC4yNSBzKTsgdGhlIGZhZGUtb3V0IGVuZHMgYXQgYHRvYCAoMC40IHMpLiAqL1xuICBmcm9tPzogbnVtYmVyO1xuICB0bz86IG51bWJlcjtcbiAgZmlsbD86IHN0cmluZztcbiAgc3Ryb2tlPzogc3RyaW5nO1xufVxuXG5jb25zdCByZXNvbHZlID0gKHA6IFRhcmdldCk6IFZlYzIgPT4gKHR5cGVvZiBwID09PSBcImZ1bmN0aW9uXCIgPyBwKCkgOiBwKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnNvcihsYXllcjogSFRNTEVsZW1lbnQsIG86IEN1cnNvck9wdGlvbnMpOiBDdXJzb3JIYW5kbGUge1xuICBlbnN1cmVTdHlsZShcImN1cnNvclwiLCBDU1MpO1xuICBjb25zdCBucyA9IFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIjtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMobnMsIFwic3ZnXCIpO1xuICBlbC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcImRvbGx5LWN1cnNvclwiKTsgZWwuc2V0QXR0cmlidXRlKFwidmlld0JveFwiLCBcIjAgMCAyNiAzNlwiKTtcbiAgZWwuaW5uZXJIVE1MID0gYDxwYXRoIGQ9XCJNMiAydjI4bDcuNS03IDUgMTEgNS0yLjMtNS0xMC43SDI1elwiIGZpbGw9XCIke28uZmlsbCA/PyBcIiMxNDE2MWJcIn1cIiBzdHJva2U9XCIke28uc3Ryb2tlID8/IFwiI2ZmZlwifVwiIHN0cm9rZS13aWR0aD1cIjIuNFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIvPmA7XG4gIGNvbnN0IHJpcHBsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7IHJpcHBsZS5jbGFzc05hbWUgPSBcImRvbGx5LXJpcHBsZVwiO1xuICBsYXllci5hcHBlbmQoZWwsIHJpcHBsZSk7XG4gIGNvbnN0IGNsaWNrcyA9IG8uY2xpY2tzID8/IFtdO1xuICBjb25zdCBmcm9tID0gby5mcm9tID8/IG8ucGF0aFswXS50LCB0byA9IG8udG8gPz8gby5wYXRoW28ucGF0aC5sZW5ndGggLSAxXS50ICsgMC40O1xuXG4gIGNvbnN0IHBvcyA9ICh0OiBudW1iZXIpOiBbbnVtYmVyLCBudW1iZXJdID0+IHtcbiAgICBsZXQgcCA9IHJlc29sdmUoby5wYXRoWzBdLmF0KSBhcyBbbnVtYmVyLCBudW1iZXJdO1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgby5wYXRoLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBhID0gby5wYXRoW2kgLSAxXSwgYiA9IG8ucGF0aFtpXTtcbiAgICAgIGlmICh0ID49IGEudCkge1xuICAgICAgICBjb25zdCBBID0gcmVzb2x2ZShhLmF0KSwgQiA9IHJlc29sdmUoYi5hdCk7XG4gICAgICAgIGNvbnN0IGUgPSAoYi5lYXNlID8/IGN1YmljSW5PdXQpKHByb2codCwgYS50LCBiLnQgLSBhLnQpKTtcbiAgICAgICAgcCA9IHF1YWQoQSwgYXJjQ29udHJvbChBLCBCLCBiLmJlbmQgPz8gMC4yNSksIEIsIGUpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcDtcbiAgfTtcblxuICBjb25zdCByZW5kZXIgPSAodDogbnVtYmVyKTogdm9pZCA9PiB7XG4gICAgaWYgKHQgPCBmcm9tIHx8IHQgPiB0bykgeyB0ZihlbCwgXCJub25lXCIsIDApOyB0ZihyaXBwbGUsIFwibm9uZVwiLCAwKTsgcmV0dXJuOyB9XG4gICAgY29uc3QgcCA9IHBvcyh0KTtcbiAgICBjb25zdCBwcmVzcyA9IGNsaWNrcy5yZWR1Y2UoKG0sIHRjKSA9PiBNYXRoLm1heChtLCAxIC0gTWF0aC5hYnModCAtIHRjKSAvIDAuMDkpLCAwKTtcbiAgICBjb25zdCBmYWRlID0gY2xhbXAoKHQgLSBmcm9tKSAqIDQpICogKDEgLSBwcm9nKHQsIHRvIC0gMC40LCAwLjQpKTtcbiAgICB0ZihlbCwgYHRyYW5zbGF0ZSgke3BbMF19cHgsJHtwWzFdfXB4KSBzY2FsZSgkezEgLSAwLjE0ICogY2xhbXAocHJlc3MpfSlgLCBmYWRlKTtcbiAgICBjb25zdCByYyA9IGNsaWNrcy5maW5kKHRjID0+IHQgPj0gdGMgJiYgdCA8IHRjICsgMC41KTtcbiAgICBpZiAocmMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgcSA9IGV4cG9PdXQocHJvZyh0LCByYywgMC41KSk7XG4gICAgICB0ZihyaXBwbGUsIGB0cmFuc2xhdGUoJHtwWzBdfXB4LCR7cFsxXX1weCkgc2NhbGUoJHswLjMgKyBxICogMS4zfSlgLCAoMSAtIHEpICogMC44KTtcbiAgICB9IGVsc2UgdGYocmlwcGxlLCBcIm5vbmVcIiwgMCk7XG4gIH07XG4gIHJldHVybiB7IGVsLCByaXBwbGUsIHBvcywgcmVuZGVyIH07XG59XG4iLCAiLy8gVHlwaW5nIGludG8gYW4gaW5wdXQ6IGNoYXJhY3RlcnMgYXBwZWFyIG9uZSBwZXIga2V5c3Ryb2tlIGFuZCBkcm9wIGluIChzY2FsZSAxLjI1IFx1MjE5MiAxKTsgdGhlIGNhcmV0XG4vLyBibGlua3Mgb25seSB3aGlsZSBpZGxlLiBSZXR1cm5zIHRoZSB0eXBlZCBzdGF0ZSBzbyBzY2VuZXMgY2FuIHJlYWN0IChiYWRnZXMgdGhhdCB1cGRhdGUgcGVyIGtleSkuXG5pbXBvcnQgeyBlbnN1cmVTdHlsZSwgZXNjYXBlSHRtbCB9IGZyb20gXCIuLi9kb20udHNcIjtcbmltcG9ydCB7IGV4cG9PdXQgfSBmcm9tIFwiLi4vZWFzaW5nLnRzXCI7XG5pbXBvcnQgeyBjbGFtcCwgbGVycCwgcHJvZyB9IGZyb20gXCIuLi9tYXRoLnRzXCI7XG5cbmNvbnN0IENTUyA9IGBcbi5kb2xseS1jaHtkaXNwbGF5OmlubGluZS1ibG9ja31cbi5kb2xseS1jYXJldHtkaXNwbGF5OmlubGluZS1ibG9jazt3aWR0aDoycHg7aGVpZ2h0OjEuMDVlbTtiYWNrZ3JvdW5kOnZhcigtLWMtYWNjZW50KTt2ZXJ0aWNhbC1hbGlnbjotLjE1ZW07bWFyZ2luLWxlZnQ6MnB4fWA7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHlwaW5nT3B0aW9ucyB7XG4gIC8qKiBGaXJzdCBrZXlzdHJva2UuICovXG4gIHQwOiBudW1iZXI7XG4gIC8qKiBTZWNvbmRzIHBlciBrZXlzdHJva2UgKDAuMThcdTIwMTMwLjI1IHJlYWRzIGFzIGRlbGliZXJhdGUgdHlwaW5nKS4gKi9cbiAgZ2FwOiBudW1iZXI7XG4gIHRleHQ6IHN0cmluZztcbiAgLyoqIERpc3BsYXkgZm9ybWF0dGluZyBvZiB0aGUgdHlwZWQgdGV4dCAoZS5nLiB0aG91c2FuZHMgc2VwYXJhdG9ycykuICovXG4gIGZvcm1hdD86ICh0eXBlZDogc3RyaW5nKSA9PiBzdHJpbmc7XG4gIC8qKiBDYXJldCBzaG93biB3aGlsZSBmb2N1c2VkLiAqL1xuICBmb2N1c2VkPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUeXBpbmdTdGF0ZSB7XG4gIC8qKiBDaGFyYWN0ZXJzIHR5cGVkIHNvIGZhci4gKi9cbiAgbjogbnVtYmVyO1xuICB0eXBlZDogc3RyaW5nO1xuICAvKiogVGltZSBvZiB0aGUgbGF0ZXN0IGtleXN0cm9rZSAob3IgLUluZmluaXR5KS4gKi9cbiAgbGFzdDogbnVtYmVyO1xuICAvKiogSFRNTCBmb3IgdGhlIGNoYXJhY3RlcnMgcGx1cyBjYXJldC4gKi9cbiAgaHRtbDogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHlwaW5nKHQ6IG51bWJlciwgbzogVHlwaW5nT3B0aW9ucyk6IFR5cGluZ1N0YXRlIHtcbiAgZW5zdXJlU3R5bGUoXCJ0eXBpbmdcIiwgQ1NTKTtcbiAgY29uc3QgbiA9IGNsYW1wKE1hdGguZmxvb3IoKHQgLSBvLnQwKSAvIG8uZ2FwKSArIDEsIDAsIG8udGV4dC5sZW5ndGgpO1xuICBjb25zdCB0eXBlZCA9IG8udGV4dC5zbGljZSgwLCBuKSwgbGFzdCA9IG4gPyBvLnQwICsgKG4gLSAxKSAqIG8uZ2FwIDogLUluZmluaXR5O1xuICBjb25zdCBzaG93biA9IG8uZm9ybWF0ID8gby5mb3JtYXQodHlwZWQpIDogdHlwZWQ7XG4gIGNvbnN0IGNoYXJzID0gWy4uLnNob3duXS5tYXAoKGNoLCBpLCBhbGwpID0+IHtcbiAgICBjb25zdCBpc05ldyA9IGkgPT09IGFsbC5sZW5ndGggLSAxICYmIHQgLSBsYXN0IDwgMC4yNTtcbiAgICBjb25zdCBxID0gaXNOZXcgPyBleHBvT3V0KHByb2codCwgbGFzdCwgMC4yMikpIDogMTtcbiAgICByZXR1cm4gYDxzcGFuIGNsYXNzPVwiZG9sbHktY2hcIiBzdHlsZT1cInRyYW5zZm9ybTp0cmFuc2xhdGVZKCR7KDEgLSBxKSAqIC0xNH1weCkgc2NhbGUoJHtsZXJwKDEuMjUsIDEsIHEpfSk7b3BhY2l0eToke3F9XCI+JHtlc2NhcGVIdG1sKGNoKX08L3NwYW4+YDtcbiAgfSkuam9pbihcIlwiKTtcbiAgY29uc3QgY2FyZXQgPSBvLmZvY3VzZWQgJiYgKCh0ICogMS45KSAlIDEgPCAwLjU1IHx8IHQgLSBsYXN0IDwgMC41KSA/IGA8c3BhbiBjbGFzcz1cImRvbGx5LWNhcmV0XCI+PC9zcGFuPmAgOiBcIlwiO1xuICByZXR1cm4geyBuLCB0eXBlZCwgbGFzdCwgaHRtbDogY2hhcnMgKyBjYXJldCB9O1xufVxuIiwgIi8vIERlcHRoIGFuZCBmcmFtaW5nIGNvbXBvbmVudHM6IDNEIHRpbHRlZCBjYXJkcywgYSBwYXJhbGxheCBiYWNrZ3JvdW5kIGdyaWQsIGEgem9vbS1pbnRvLWVsZW1lbnRcbi8vIHRyYW5zaXRpb24sIGxvd2VyLXRoaXJkcyBhbmQgYW4gZW5kIGNhcmQuXG5pbXBvcnQgeyBlbnN1cmVTdHlsZSwgc3RhZ2VQb2ludCwgdGYgfSBmcm9tIFwiLi4vZG9tLnRzXCI7XG5pbXBvcnQgeyBwYXJhbGxheCwgdHlwZSBDYW1lcmFTdGF0ZSwgdHlwZSBWaWV3cG9ydCB9IGZyb20gXCIuLi9jYW1lcmEudHNcIjtcbmltcG9ydCB7IGN1YmljSW5PdXQsIGV4cG9PdXQsIHF1YXJ0SW5PdXQsIHNpbmVJbk91dCB9IGZyb20gXCIuLi9lYXNpbmcudHNcIjtcbmltcG9ydCB7IGNsYW1wLCBsZXJwLCBwcm9nIH0gZnJvbSBcIi4uL21hdGgudHNcIjtcbmltcG9ydCB7IHNwcmluZyB9IGZyb20gXCIuLi9zcHJpbmcudHNcIjtcbmltcG9ydCB7IG1hc2tlZCwgdHlwZUluIH0gZnJvbSBcIi4vdGV4dC50c1wiO1xuXG4vKipcbiAqIFRpbHRlZC1jYXJkIHRyYW5zZm9ybS4gQSBmbGF0IGNhcmQgcmVhZHMgYXMgYSBzY3JlZW5zaG90OyBhIHNsaWdodCAzRCBhbmdsZSByZWFkcyBhcyBhbiBvYmplY3RcbiAqIChtb3Rpb24gZ3JhbW1hcjogcGVyc3BlY3RpdmUgMTUwMHB4LCByb3RhdGVZIFx1MjIxMjM4XHUwMEIwIFx1MjE5MiBcdTIyMTIxMFx1MDBCMCwgZHJpZnRpbmcgdG8gXHUyMjEyNVx1MDBCMCkuXG4gKi9cbmV4cG9ydCBjb25zdCB0aWx0ID0gKHJ5OiBudW1iZXIsIHJ4ID0gMCwgcGVyc3BlY3RpdmUgPSAxNTAwLCBleHRyYSA9IFwiXCIpOiBzdHJpbmcgPT5cbiAgYHBlcnNwZWN0aXZlKCR7cGVyc3BlY3RpdmV9cHgpJHtleHRyYSA/IFwiIFwiICsgZXh0cmEgOiBcIlwifSByb3RhdGVZKCR7cnl9ZGVnKSByb3RhdGVYKCR7cnh9ZGVnKWA7XG5cbi8qKiBTd2luZyBhIGNhcmQgaW4gZnJvbSB0aGUgc2lkZSBvbiBhIHNwcmluZywgdGhlbiBkcmlmdCBpdHMgdGlsdCBhY3Jvc3MgdGhlIGhvbGQuICovXG5leHBvcnQgZnVuY3Rpb24gc3dpbmdJbihlbDogSFRNTEVsZW1lbnQsIHQ6IG51bWJlciwgdDA6IG51bWJlciwgbzogeyBkeD86IG51bWJlcjsgZnJvbT86IG51bWJlcjsgdG8/OiBudW1iZXI7IGRyaWZ0PzogbnVtYmVyOyBkcmlmdER1cj86IG51bWJlcjsgcng/OiBudW1iZXIgfSA9IHt9KTogdm9pZCB7XG4gIGNvbnN0IHAgPSBzcHJpbmcodCAtIHQwLCB7IGZyZXE6IDEuMCwgemV0YTogMC43IH0pO1xuICBjb25zdCBkcmlmdCA9IHNpbmVJbk91dChwcm9nKHQsIHQwICsgMC45NSwgby5kcmlmdER1ciA/PyA0LjUpKTtcbiAgY29uc3QgcnkgPSBsZXJwKG8uZnJvbSA/PyAtMzgsIG8udG8gPz8gLTEwLCBwKSArIGRyaWZ0ICogKG8uZHJpZnQgPz8gNSk7XG4gIHRmKGVsLCB0aWx0KHJ5LCAoby5yeCA/PyAyKSAtIGRyaWZ0ICogMiwgMTUwMCwgYHRyYW5zbGF0ZVgoJHsoMSAtIHApICogKG8uZHggPz8gNTIwKX1weClgKSwgY2xhbXAoKHQgLSB0MCkgKiA0KSk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgR3JpZE9wdGlvbnMgeyBnYXA/OiBudW1iZXI7IGRvdD86IG51bWJlcjsgY29sb3I/OiBzdHJpbmc7IGRlcHRoPzogbnVtYmVyIH1cblxuLyoqIEEgZmFpbnQgZG90IGdyaWQgYXQgYSBwYXJhbGxheCBkZXB0aCAoMC41ID0gaGFsZiBjYW1lcmEgc3BlZWQpLCB3aGljaCBtYWtlcyBjYW1lcmEgbW92ZXMgcmVhZGFibGUuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyYWxsYXhHcmlkKGxheWVyOiBIVE1MRWxlbWVudCwgbzogR3JpZE9wdGlvbnMgPSB7fSk6IChjYW06IENhbWVyYVN0YXRlLCBzdGFnZTogVmlld3BvcnQsIGV4dHJhWm9vbT86IG51bWJlcikgPT4gdm9pZCB7XG4gIGNvbnN0IGcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBjb25zdCBkb3QgPSBvLmRvdCA/PyAxLjMsIGdhcCA9IG8uZ2FwID8/IDI4LCBkZXB0aCA9IG8uZGVwdGggPz8gMC41O1xuICBnLnN0eWxlLmNzc1RleHQgPSBgcG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6LTJweDtiYWNrZ3JvdW5kLWltYWdlOnJhZGlhbC1ncmFkaWVudChjaXJjbGUsICR7by5jb2xvciA/PyBcIiNkM2Q4ZTFcIn0gJHtkb3R9cHgsIHRyYW5zcGFyZW50ICR7ZG90ICsgMC4zfXB4KWA7XG4gIGxheWVyLmFwcGVuZChnKTtcbiAgcmV0dXJuIChjYW0sIHN0YWdlLCBleHRyYVpvb20gPSAxKSA9PiB7XG4gICAgY29uc3QgYyA9IHBhcmFsbGF4KHsgLi4uY2FtLCB6b29tOiBjYW0uem9vbSAqIGV4dHJhWm9vbSB9LCBkZXB0aCwgc3RhZ2UpO1xuICAgIGNvbnN0IHMgPSBnYXAgKiBjLnpvb207XG4gICAgZy5zdHlsZS5iYWNrZ3JvdW5kU2l6ZSA9IGAke3N9cHggJHtzfXB4YDtcbiAgICBnLnN0eWxlLmJhY2tncm91bmRQb3NpdGlvbiA9IGAkey1jLnggKiBjLnpvb20gKyBzdGFnZS53aWR0aCAvIDJ9cHggJHstYy55ICogYy56b29tICsgc3RhZ2UuaGVpZ2h0IC8gMn1weGA7XG4gIH07XG59XG5cbi8qKlxuICogWm9vbSBpbnRvIGFuIGVsZW1lbnQgdW50aWwgaXRzIGZpbGwgY292ZXJzIHRoZSBzY3JlZW46IHRoZSBjbGVhbmVzdCB3YXkgaW50byBhbiBlbmQgY2FyZC4gQ2FsbCB3aXRoIHRoZVxuICogbGF5ZXIgdGhhdCBjb250YWlucyBgdGFyZ2V0YDsgcmV0dXJucyBwcm9ncmVzcyAoMC4uMSkuIE1lYXN1cmVzIHRoZSB0YXJnZXQgd2l0aCB0aGUgbGF5ZXIncyB0cmFuc2Zvcm1cbiAqIGNsZWFyZWQsIHRoZW4gYXBwbGllcyB0cmFuc2xhdGUgKyBleHBvbmVudGlhbCBzY2FsZSBhcm91bmQgaXQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB6b29tSW50byhsYXllcjogSFRNTEVsZW1lbnQsIHRhcmdldDogSFRNTEVsZW1lbnQsIHQ6IG51bWJlciwgdDA6IG51bWJlciwgdDE6IG51bWJlciwgbzogeyBtYXhTY2FsZT86IG51bWJlcjsgZmFkZVRleHQ/OiBudW1iZXI7IHN0YWdlPzogVmlld3BvcnQgfSA9IHt9KTogeyB6OiBudW1iZXI7IGNzczogc3RyaW5nOyBvcmlnaW46IHN0cmluZyB9IHtcbiAgY29uc3QgeiA9IHByb2codCwgdDAsIHQxIC0gdDApO1xuICBpZiAoeiA8PSAwKSByZXR1cm4geyB6LCBjc3M6IFwiXCIsIG9yaWdpbjogXCJcIiB9O1xuICBjb25zdCBXID0gby5zdGFnZT8ud2lkdGggPz8gMTI4MCwgSCA9IG8uc3RhZ2U/LmhlaWdodCA/PyA3MjA7XG4gIGxheWVyLnN0eWxlLnRyYW5zZm9ybSA9IFwibm9uZVwiOyB0YXJnZXQuc3R5bGUudHJhbnNmb3JtID0gXCJub25lXCI7XG4gIGNvbnN0IFtweCwgcHldID0gc3RhZ2VQb2ludCh0YXJnZXQsIDAuNSwgMC41KTtcbiAgY29uc3QgZSA9IHF1YXJ0SW5PdXQoeiksIHpzID0gTWF0aC5leHAoTWF0aC5sb2coby5tYXhTY2FsZSA/PyA2MCkgKiBNYXRoLnBvdyh6LCAyLjIpKTtcbiAgdGFyZ2V0LnN0eWxlLmNvbG9yID0gYHJnYmEoMjU1LDI1NSwyNTUsJHsxIC0gY2xhbXAoeiAqIChvLmZhZGVUZXh0ID8/IDMuNSkpfSlgO1xuICByZXR1cm4geyB6LCBjc3M6IGB0cmFuc2xhdGUoJHsoVyAvIDIgLSBweCkgKiBlfXB4LCR7KEggLyAyIC0gcHkpICogZX1weCkgc2NhbGUoJHt6c30pYCwgb3JpZ2luOiBgJHtweH1weCAke3B5fXB4YCB9O1xufVxuXG5jb25zdCBMVF9DU1MgPSBgXG4uZG9sbHktbHR7cG9zaXRpb246YWJzb2x1dGU7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6NnB4fVxuLmRvbGx5LWx0IC5iYXJ7cG9zaXRpb246YWJzb2x1dGU7bGVmdDotMThweDt0b3A6NnB4O2JvdHRvbTo2cHg7d2lkdGg6NXB4O2JvcmRlci1yYWRpdXM6M3B4O2JhY2tncm91bmQ6dmFyKC0tYy1hY2NlbnQpO3RyYW5zZm9ybS1vcmlnaW46NTAlIDB9XG4uZG9sbHktbHQgLnQxe2ZvbnQ6NzAwIDM0cHgvMS4xIHZhcigtLWYtZGlzcGxheSk7bGV0dGVyLXNwYWNpbmc6LS4wMmVtO2NvbG9yOnZhcigtLWMtZmcpfVxuLmRvbGx5LWx0IC50Mntmb250OjUwMCAyMHB4LzEuMyB2YXIoLS1mLWJvZHkpO2NvbG9yOnZhcigtLWMtbXV0ZWQpfWA7XG5cbi8qKiBMb3dlciB0aGlyZDogYW4gYWNjZW50IGJhciBkcmF3cyBkb3duLCB0aGVuIHRpdGxlIGFuZCBzdWJ0aXRsZSByaXNlIGluOyBsZWF2ZXMgdXB3YXJkcy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsb3dlclRoaXJkKGxheWVyOiBIVE1MRWxlbWVudCwgbzogeyB0aXRsZTogc3RyaW5nOyBzdWJ0aXRsZT86IHN0cmluZzsgeD86IG51bWJlcjsgeT86IG51bWJlciB9KTogKHQ6IG51bWJlciwgdGluOiBudW1iZXIsIHRvdXQ/OiBudW1iZXIpID0+IHZvaWQge1xuICBlbnN1cmVTdHlsZShcImxvd2VyLXRoaXJkXCIsIExUX0NTUyk7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTsgZWwuY2xhc3NOYW1lID0gXCJkb2xseS1sdFwiO1xuICBlbC5zdHlsZS5sZWZ0ID0gKG8ueCA/PyA5NikgKyBcInB4XCI7IGVsLnN0eWxlLnRvcCA9IChvLnkgPz8gNTYwKSArIFwicHhcIjtcbiAgY29uc3QgYmFyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImlcIik7IGJhci5jbGFzc05hbWUgPSBcImJhclwiO1xuICBjb25zdCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTsgYS5jbGFzc05hbWUgPSBcInQxXCI7XG4gIGNvbnN0IGIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpOyBiLmNsYXNzTmFtZSA9IFwidDJcIjtcbiAgZWwuYXBwZW5kKGJhciwgYSwgYik7IGxheWVyLmFwcGVuZChlbCk7XG4gIGNvbnN0IHVhID0gbWFza2VkKGEsIG8udGl0bGUpLCB1YiA9IG8uc3VidGl0bGUgPyBtYXNrZWQoYiwgby5zdWJ0aXRsZSkgOiBbXTtcbiAgcmV0dXJuICh0LCB0aW4sIHRvdXQgPSBJbmZpbml0eSkgPT4ge1xuICAgIGNvbnN0IHBpbiA9IGV4cG9PdXQocHJvZyh0LCB0aW4sIDAuNikpLCBwb3V0ID0gY3ViaWNJbk91dChwcm9nKHQsIHRvdXQgKyAwLjMsIDAuNCkpO1xuICAgIGJhci5zdHlsZS50cmFuc2Zvcm0gPSBgc2NhbGVZKCR7cGluICogKDEgLSBwb3V0KX0pYDtcbiAgICB0eXBlSW4odWEsIHQsIHRpbiArIDAuMSwgdG91dCwgeyBzdGFnZ2VyOiAwLjA2IH0pO1xuICAgIHR5cGVJbih1YiwgdCwgdGluICsgMC4zLCB0b3V0ICsgMC4wNSwgeyBzdGFnZ2VyOiAwLjA0IH0pO1xuICB9O1xufVxuXG5jb25zdCBFTkRfQ1NTID0gYFxuLmRvbGx5LWVuZHtwb3NpdGlvbjphYnNvbHV0ZTtpbnNldDowO2JhY2tncm91bmQ6dmFyKC0tYy1pbmspO2NvbG9yOiNmM2Y0Zjd9XG4uZG9sbHktZW5kIC5sb2dve3Bvc2l0aW9uOmFic29sdXRlO2xlZnQ6NTAlO3RvcDoyMSU7Zm9udDo3MDAgNjRweC8xLjc1IHZhcigtLWYtdWksdmFyKC0tZi1ib2R5KSk7cGFkZGluZzowIC40MmVtO2JvcmRlci1yYWRpdXM6MzBweCAzMHB4IDMwcHggNXB4O2JhY2tncm91bmQ6I2ZmZjtjb2xvcjp2YXIoLS1jLWluayk7dHJhbnNmb3JtLW9yaWdpbjo1MCUgNTAlfVxuLmRvbGx5LWVuZCAubmFtZXtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjA7cmlnaHQ6MDt0b3A6NDYlO3RleHQtYWxpZ246Y2VudGVyO21hcmdpbjowO3RyYW5zZm9ybS1vcmlnaW46NTAlIDA7Zm9udDo4MDAgMTE2cHgvMSB2YXIoLS1mLWRpc3BsYXkpO2xldHRlci1zcGFjaW5nOi0uMDRlbX1cbi5kb2xseS1lbmQgLnRhZ3twb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjA7cmlnaHQ6MDt0b3A6NjYlO3RleHQtYWxpZ246Y2VudGVyO21hcmdpbjowO3RyYW5zZm9ybS1vcmlnaW46NTAlIDA7Zm9udDo1MDAgMzRweCB2YXIoLS1mLWJvZHkpO2NvbG9yOiNhNWFiYjh9XG4uZG9sbHktZW5kIC50YWcgLmRvbGx5LWFjY2VudHtjb2xvcjp2YXIoLS1jLWFjY2VudC1zb2Z0LCM4ZWEwZmYpfWA7XG5cbi8qKiBFbmQgY2FyZDogbG9nbyBzcHJpbmdzIGluLCB0aGUgbmFtZSB0eXBlcyBpbiBieSBjaGFyYWN0ZXIsIHRoZSB0YWdsaW5lIGJ5IHdvcmQ7IGEgc2xvdyBwdXNoLWluLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuZENhcmQobGF5ZXI6IEhUTUxFbGVtZW50LCBvOiB7IGxvZ286IHN0cmluZzsgbmFtZTogc3RyaW5nOyB0YWdsaW5lOiBzdHJpbmc7IGF0OiB7IGxvZ286IG51bWJlcjsgbmFtZTogbnVtYmVyOyB0YWc6IG51bWJlciB9OyBwdXNoRnJvbTogbnVtYmVyOyBwdXNoRHVyOiBudW1iZXIgfSk6IHsgZWw6IEhUTUxFbGVtZW50OyByZW5kZXIodDogbnVtYmVyKTogdm9pZCB9IHtcbiAgZW5zdXJlU3R5bGUoXCJlbmQtY2FyZFwiLCBFTkRfQ1NTKTtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpOyBlbC5jbGFzc05hbWUgPSBcImRvbGx5LWVuZFwiO1xuICBlbC5pbm5lckhUTUwgPSBgPGRpdiBjbGFzcz1cImxvZ29cIj48L2Rpdj48aDIgY2xhc3M9XCJuYW1lXCI+PC9oMj48cCBjbGFzcz1cInRhZ1wiPjwvcD5gO1xuICBsYXllci5hcHBlbmQoZWwpO1xuICBjb25zdCBsb2dvID0gZWwucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oXCIubG9nb1wiKSEsIG5hbWUgPSBlbC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihcIi5uYW1lXCIpISwgdGFnID0gZWwucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oXCIudGFnXCIpITtcbiAgbG9nby50ZXh0Q29udGVudCA9IG8ubG9nbztcbiAgY29uc3QgbmFtZUNoYXJzID0gbWFza2VkKG5hbWUsIG8ubmFtZSwgeyBjaGFyczogdHJ1ZSB9KSwgdGFnV29yZHMgPSBtYXNrZWQodGFnLCBvLnRhZ2xpbmUpO1xuICByZXR1cm4ge1xuICAgIGVsLFxuICAgIHJlbmRlcih0KSB7XG4gICAgICBjb25zdCBwdXNoID0gMSArIHNpbmVJbk91dChwcm9nKHQsIG8ucHVzaEZyb20sIG8ucHVzaER1cikpICogMC4wNTtcbiAgICAgIGNvbnN0IGxzID0gc3ByaW5nKHQgLSBvLmF0LmxvZ28sIHsgZnJlcTogMS41LCB6ZXRhOiAwLjUgfSk7XG4gICAgICBsb2dvLnN0eWxlLm1hcmdpbkxlZnQgPSAtbG9nby5vZmZzZXRXaWR0aCAvIDIgKyBcInB4XCI7XG4gICAgICB0Zihsb2dvLCBgc2NhbGUoJHtNYXRoLm1heCgwLCBscykgKiBwdXNofSkgcm90YXRlKCR7KDEgLSBscykgKiAtMTR9ZGVnKWAsIGNsYW1wKCh0IC0gby5hdC5sb2dvKSAqIDgpKTtcbiAgICAgIG5hbWUuc3R5bGUudHJhbnNmb3JtID0gdGFnLnN0eWxlLnRyYW5zZm9ybSA9IGBzY2FsZSgke3B1c2h9KWA7XG4gICAgICB0eXBlSW4obmFtZUNoYXJzLCB0LCBvLmF0Lm5hbWUsIEluZmluaXR5LCB7IHN0YWdnZXI6IDAuMDQsIGR1cjogMC44IH0pO1xuICAgICAgdHlwZUluKHRhZ1dvcmRzLCB0LCBvLmF0LnRhZywgSW5maW5pdHksIHsgc3RhZ2dlcjogMC4wNywgZHVyOiAwLjggfSk7XG4gICAgfSxcbiAgfTtcbn1cbiIsICIvLyBCcm93c2VyIHJ1bnRpbWU6IG1vdW50cyBhIFZpZGVvRGVmIGludG8gdGhlIHBhZ2UgYW5kIGV4cG9zZXMgdGhlIGZyYW1lIGNvbnRyYWN0IG9uIHdpbmRvdy5fX2RvbGx5LlxuLy8gVGhlIHJlbmRlcmVyLCB0aGUgcGxheWVyIGFuZCB0aGUgbGludGVyIG9ubHkgZXZlciB0YWxrIHRvIGEgc2NlbmUgZG9jdW1lbnQgdGhyb3VnaCB0aGlzIG9iamVjdC5cbmltcG9ydCB7IGFjdGl2ZVNjZW5lcywgYWxsTWFya2Vycywgd2l0aEFzcGVjdCwgdHlwZSBBc3BlY3QsIHR5cGUgU2NlbmVDb250ZXh0LCB0eXBlIFNjZW5lRGVmLCB0eXBlIFNjZW5lVGltZSwgdHlwZSBWaWRlb0RlZiB9IGZyb20gXCIuL3ZpZGVvLnRzXCI7XG5pbXBvcnQgeyBjYW1lcmFEaXNwbGFjZW1lbnQsIGNhbWVyYVRyYW5zZm9ybSwgdHlwZSBDYW1lcmFTdGF0ZSB9IGZyb20gXCIuL2NhbWVyYS50c1wiO1xuaW1wb3J0IHsgdGhlbWVDc3MgfSBmcm9tIFwiLi90aGVtZS50c1wiO1xuaW1wb3J0IHsgc2V0U3RhZ2UgfSBmcm9tIFwiLi9kb20udHNcIjtcbmltcG9ydCB7IHJuZywgc2VlZE9mIH0gZnJvbSBcIi4vbWF0aC50c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZyYW1lRWxlbWVudEluZm8ge1xuICBuYW1lOiBzdHJpbmc7XG4gIHNjZW5lOiBzdHJpbmcgfCBudWxsO1xuICByZWN0OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyB3OiBudW1iZXI7IGg6IG51bWJlciB9O1xuICBvcGFjaXR5OiBudW1iZXI7XG4gIHRleHQ/OiBzdHJpbmc7XG4gIC8qKiBSZW5kZXJlZCBmb250IHNpemUgaW4gc3RhZ2UgcHggKGluY2x1ZGVzIHRyYW5zZm9ybXMpLiAqL1xuICBmb250U2l6ZT86IG51bWJlcjtcbiAgY29sb3I/OiBzdHJpbmc7XG4gIGJhY2tncm91bmQ/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5zcGVjdFJlc3VsdCB7XG4gIHQ6IG51bWJlcjtcbiAgY2FtZXJhOiBDYW1lcmFTdGF0ZTtcbiAgc2NlbmVzOiBzdHJpbmdbXTtcbiAgZWxlbWVudHM6IEZyYW1lRWxlbWVudEluZm9bXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEb2xseU1ldGEge1xuICB0aXRsZTogc3RyaW5nO1xuICBmcHM6IG51bWJlcjtcbiAgZHVyYXRpb246IG51bWJlcjtcbiAgc3RhZ2U6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfTtcbiAgYnBtPzogbnVtYmVyO1xuICBiZWF0T2Zmc2V0PzogbnVtYmVyO1xuICBhc3BlY3Q6IEFzcGVjdDtcbiAgc2NlbmVzOiBBcnJheTx7IG5hbWU6IHN0cmluZzsgc3RhcnQ6IG51bWJlcjsgZW5kOiBudW1iZXI7IGZpbGU/OiBzdHJpbmcgfT47XG4gIG1hcmtlcnM6IEFycmF5PHsgbmFtZTogc3RyaW5nOyB0OiBudW1iZXI7IGtpbmQ/OiBzdHJpbmcgfT47XG4gIGF1ZGlvOiBOb25OdWxsYWJsZTxWaWRlb0RlZltcImF1ZGlvXCJdPjtcbiAgYmFja2dyb3VuZDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERvbGx5QXBpIHtcbiAgdmVyc2lvbjogMTtcbiAgbWV0YTogRG9sbHlNZXRhO1xuICByZWFkeTogUHJvbWlzZTxEb2xseU1ldGE+O1xuICByZW5kZXIodDogbnVtYmVyKTogdm9pZDtcbiAgLyoqIExhcmdlc3Qgb24tc2NyZWVuIGRpc3BsYWNlbWVudCAob3V0cHV0IHB4KSBvZiBhbnl0aGluZyB2aXNpYmxlIGJldHdlZW4gdDAgYW5kIHQxLiAqL1xuICBtb3Rpb24odDA6IG51bWJlciwgdDE6IG51bWJlcik6IHsgcHg6IG51bWJlcjsgY2FtZXJhOiBudW1iZXI7IGVsZW1lbnQ6IHN0cmluZyB8IG51bGwgfTtcbiAgaW5zcGVjdCh0OiBudW1iZXIsIG9wdHM/OiB7IGFsbD86IGJvb2xlYW4gfSk6IEluc3BlY3RSZXN1bHQ7XG4gIC8qKiBSZWZpdCB0aGUgc3RhZ2UgdG8gdGhlIHdpbmRvdyAoY2FsbGVkIG9uIHJlc2l6ZSkuICovXG4gIGZpdCgpOiBudW1iZXI7XG59XG5cbmRlY2xhcmUgZ2xvYmFsIHsgaW50ZXJmYWNlIFdpbmRvdyB7IF9fZG9sbHk6IERvbGx5QXBpIH0gfVxuXG5leHBvcnQgY2xhc3MgRG9sbHlSZW5kZXJFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgc2NlbmU6IHN0cmluZzsgdDogbnVtYmVyO1xuICBjb25zdHJ1Y3RvcihzY2VuZTogc3RyaW5nLCB0OiBudW1iZXIsIGNhdXNlOiB1bmtub3duKSB7XG4gICAgY29uc3QgbXNnID0gY2F1c2UgaW5zdGFuY2VvZiBFcnJvciA/IGNhdXNlLm1lc3NhZ2UgOiBTdHJpbmcoY2F1c2UpO1xuICAgIHN1cGVyKGBzY2VuZSBcIiR7c2NlbmV9XCIgYXQgdD0ke3QudG9GaXhlZCgzKX1zOiAke21zZ31gKTtcbiAgICB0aGlzLm5hbWUgPSBcIkRvbGx5UmVuZGVyRXJyb3JcIjsgdGhpcy5zY2VuZSA9IHNjZW5lOyB0aGlzLnQgPSB0O1xuICAgIGlmIChjYXVzZSBpbnN0YW5jZW9mIEVycm9yICYmIGNhdXNlLnN0YWNrKSB0aGlzLnN0YWNrID0gYCR7dGhpcy5uYW1lfTogJHt0aGlzLm1lc3NhZ2V9XFxuJHtjYXVzZS5zdGFjay5zcGxpdChcIlxcblwiKS5zbGljZSgxKS5qb2luKFwiXFxuXCIpfWA7XG4gIH1cbn1cblxuY29uc3QgSURFTlRJVFkgPSAodzogbnVtYmVyLCBoOiBudW1iZXIpOiBDYW1lcmFTdGF0ZSA9PiAoeyB4OiB3IC8gMiwgeTogaCAvIDIsIHpvb206IDEsIHJvdGF0ZTogMCB9KTtcblxuLyoqXG4gKiBNYWtlIGV2ZXJ5IFwicmFuZG9tXCIgb3IgY2xvY2stcmVhZGluZyBsaWJyYXJ5IGNhbGwgYSBwdXJlIGZ1bmN0aW9uIG9mIHRoZSBmcmFtZSB0aW1lOiBNYXRoLnJhbmRvbSBpc1xuICogcmVzZWVkZWQgcGVyIHJlbmRlcih0KSwgYW5kIERhdGUubm93IC8gcGVyZm9ybWFuY2Uubm93IHJldHVybiB0aGUgc2NlbmUgdGltZS4gVGhpcmQtcGFydHkgY29kZSB0aGF0XG4gKiByZWFkcyB0aGVtIHRoZW4gcmVuZGVycyBpZGVudGljYWxseSBvbiBldmVyeSB3b3JrZXIuXG4gKi9cbmZ1bmN0aW9uIGZyZWV6ZUNsb2NrKCk6IHsgYXQodDogbnVtYmVyKTogdm9pZCB9IHtcbiAgbGV0IG5vdyA9IDAsIHJhbmQgPSBybmcoMSk7XG4gIGNvbnN0IGVwb2NoID0gRGF0ZS5VVEMoMjAyNiwgMCwgMSk7XG4gIE1hdGgucmFuZG9tID0gKCkgPT4gcmFuZCgpO1xuICBEYXRlLm5vdyA9ICgpID0+IGVwb2NoICsgbm93ICogMTAwMDtcbiAgcGVyZm9ybWFuY2Uubm93ID0gKCkgPT4gbm93ICogMTAwMDtcbiAgcmV0dXJuIHsgYXQodDogbnVtYmVyKSB7IG5vdyA9IHQ7IHJhbmQgPSBybmcoc2VlZE9mKHQudG9GaXhlZCg2KSkpOyB9IH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBtb3VudChpbnB1dDogVmlkZW9EZWYsIG9wdHM6IHsgYXNwZWN0PzogQXNwZWN0OyBhc3NldEJhc2U/OiBzdHJpbmcgfSA9IHt9KTogUHJvbWlzZTxEb2xseUFwaT4ge1xuICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKGxvY2F0aW9uLnNlYXJjaCk7XG4gIGNvbnN0IHYgPSB3aXRoQXNwZWN0KGlucHV0LCAocGFyYW1zLmdldChcImFzcGVjdFwiKSBhcyBBc3BlY3QgfCBudWxsKSA/PyBvcHRzLmFzcGVjdCk7XG4gIGNvbnN0IFcgPSB2LnN0YWdlLndpZHRoLCBIID0gdi5zdGFnZS5oZWlnaHQ7XG4gIGNvbnN0IGNsb2NrID0gZnJlZXplQ2xvY2soKTtcbiAgY29uc3QgYmcgPSB2LmJhY2tncm91bmQgPz8gdi50aGVtZS5jb2xvcnMuYmc7XG5cbiAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XG4gIHN0eWxlLnRleHRDb250ZW50ID0gYCR7dGhlbWVDc3Modi50aGVtZSwgb3B0cy5hc3NldEJhc2UgPz8gXCJcIil9XG5odG1sLGJvZHl7bWFyZ2luOjA7b3ZlcmZsb3c6aGlkZGVuO2JhY2tncm91bmQ6IzAwMH1cbip7Ym94LXNpemluZzpib3JkZXItYm94fVxuKiwqOjpiZWZvcmUsKjo6YWZ0ZXJ7YW5pbWF0aW9uLXBsYXktc3RhdGU6cGF1c2VkIWltcG9ydGFudDt0cmFuc2l0aW9uOm5vbmUhaW1wb3J0YW50fVxuI2RvbGx5LXN0YWdle3Bvc2l0aW9uOmFic29sdXRlO2xlZnQ6MDt0b3A6MDt3aWR0aDoke1d9cHg7aGVpZ2h0OiR7SH1weDtvdmVyZmxvdzpoaWRkZW47dHJhbnNmb3JtLW9yaWdpbjowIDA7YmFja2dyb3VuZDoke2JnfTtjb2xvcjp2YXIoLS1jLWZnKTtmb250LWZhbWlseTp2YXIoLS1mLWJvZHkpfVxuLmRvbGx5LWxheWVye3Bvc2l0aW9uOmFic29sdXRlO2xlZnQ6MDt0b3A6MDt3aWR0aDoke1d9cHg7aGVpZ2h0OiR7SH1weH1cbiNkb2xseS13b3JsZHt0cmFuc2Zvcm0tb3JpZ2luOjAgMDt6LWluZGV4OjEwfVxuI2RvbGx5LWh1ZHt6LWluZGV4OjIwfVxuLmRvbGx5LWN7cG9zaXRpb246YWJzb2x1dGU7bGVmdDowO3RvcDowO3dpZHRoOiR7V31weDtoZWlnaHQ6JHtIfXB4fWA7XG4gIGRvY3VtZW50LmhlYWQuYXBwZW5kKHN0eWxlKTtcbiAgY29uc3Qgc2hlZXRzID0gKHYudGhlbWUuZm9udENzcyA/PyBbXSkubWFwKGhyZWYgPT4gbmV3IFByb21pc2U8dm9pZD4oKHJlcywgcmVqKSA9PiB7XG4gICAgY29uc3QgbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaW5rXCIpOyBsLnJlbCA9IFwic3R5bGVzaGVldFwiOyBsLmhyZWYgPSBocmVmO1xuICAgIGwub25sb2FkID0gKCkgPT4gcmVzKCk7IGwub25lcnJvciA9ICgpID0+IHJlaihuZXcgRXJyb3IoYGZvbnQgc3R5bGVzaGVldCBmYWlsZWQgdG8gbG9hZDogJHtocmVmfWApKTtcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZChsKTtcbiAgfSkpO1xuXG4gIGNvbnN0IHN0YWdlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTsgc3RhZ2UuaWQgPSBcImRvbGx5LXN0YWdlXCI7XG4gIGNvbnN0IHdvcmxkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTsgd29ybGQuaWQgPSBcImRvbGx5LXdvcmxkXCI7IHdvcmxkLmNsYXNzTmFtZSA9IFwiZG9sbHktbGF5ZXJcIjtcbiAgY29uc3QgaHVkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTsgaHVkLmlkID0gXCJkb2xseS1odWRcIjsgaHVkLmNsYXNzTmFtZSA9IFwiZG9sbHktbGF5ZXJcIjtcbiAgc3RhZ2UuYXBwZW5kKHdvcmxkLCBodWQpO1xuICBkb2N1bWVudC5ib2R5LmFwcGVuZChzdGFnZSk7XG5cbiAgY29uc3QgZml0ID0gKCk6IG51bWJlciA9PiB7XG4gICAgY29uc3QgayA9IE1hdGgubWluKGlubmVyV2lkdGggLyBXLCBpbm5lckhlaWdodCAvIEgpO1xuICAgIHN0YWdlLnN0eWxlLnRyYW5zZm9ybSA9IGBzY2FsZSgke2t9KWA7XG4gICAgc3RhZ2Uuc3R5bGUubGVmdCA9IChpbm5lcldpZHRoIC0gVyAqIGspIC8gMiArIFwicHhcIjtcbiAgICBzdGFnZS5zdHlsZS50b3AgPSAoaW5uZXJIZWlnaHQgLSBIICogaykgLyAyICsgXCJweFwiO1xuICAgIHNldFN0YWdlKHN0YWdlLCBrKTtcbiAgICByZXR1cm4gaztcbiAgfTtcbiAgbGV0IHNjYWxlID0gZml0KCk7XG4gIGFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgKCkgPT4geyBzY2FsZSA9IGZpdCgpOyB9KTtcblxuICBjb25zdCBjYW1lcmEgPSAodDogbnVtYmVyKTogQ2FtZXJhU3RhdGUgPT4gKHYuY2FtZXJhID8gdi5jYW1lcmEodCkgOiBJREVOVElUWShXLCBIKSk7XG4gIGNvbnN0IG1hcmtlcnMgPSBhbGxNYXJrZXJzKHYpO1xuICBjb25zdCBzY3JlZW5zID0gbmV3IE1hcDxudW1iZXIsIEhUTUxFbGVtZW50PigpO1xuICBjb25zdCBzY3JlZW5MYXllciA9ICh6OiBudW1iZXIpOiBIVE1MRWxlbWVudCA9PiB7XG4gICAgbGV0IGwgPSBzY3JlZW5zLmdldCh6KTtcbiAgICBpZiAoIWwpIHsgbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7IGwuY2xhc3NOYW1lID0gXCJkb2xseS1sYXllclwiOyBsLnN0eWxlLnpJbmRleCA9IFN0cmluZyh6KTsgc3RhZ2UuYXBwZW5kKGwpOyBzY3JlZW5zLnNldCh6LCBsKTsgfVxuICAgIHJldHVybiBsO1xuICB9O1xuXG4gIGludGVyZmFjZSBNb3VudGVkIHsgZGVmOiBTY2VuZURlZiB8IG51bGw7IG5hbWU6IHN0cmluZzsgY3R4OiBTY2VuZUNvbnRleHQ7IGNvbnRhaW5lcnM6IEhUTUxFbGVtZW50W107IHZpc2libGU6IGJvb2xlYW4gfVxuICBjb25zdCBtYWtlQ3R4ID0gKG5hbWU6IHN0cmluZywgb3duZWQ6IEhUTUxFbGVtZW50W10pOiBTY2VuZUNvbnRleHQgPT4ge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IChwYXJlbnQ6IEhUTUxFbGVtZW50LCBsYXllcjogc3RyaW5nKTogSFRNTEVsZW1lbnQgPT4ge1xuICAgICAgY29uc3QgYyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICBjLmNsYXNzTmFtZSA9IFwiZG9sbHktY1wiOyBjLmRhdGFzZXQuc2NlbmUgPSBuYW1lOyBjLmRhdGFzZXQubGF5ZXIgPSBsYXllcjtcbiAgICAgIHBhcmVudC5hcHBlbmQoYyk7IG93bmVkLnB1c2goYyk7IHJldHVybiBjO1xuICAgIH07XG4gICAgbGV0IHc6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkLCBoZDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG4gICAgY29uc3QgY3R4OiBTY2VuZUNvbnRleHQgPSB7XG4gICAgICB2aWRlbzogdiwgc3RhZ2U6IHYuc3RhZ2UsIGFzcGVjdDogdi5hc3BlY3QgPz8gXCIxNjo5XCIsIHRoZW1lOiB2LnRoZW1lLFxuICAgICAgZ2V0IHdvcmxkKCkgeyByZXR1cm4gKHcgPz89IGNvbnRhaW5lcih3b3JsZCwgXCJ3b3JsZFwiKSk7IH0sXG4gICAgICBnZXQgaHVkKCkgeyByZXR1cm4gKGhkID8/PSBjb250YWluZXIoaHVkLCBcImh1ZFwiKSk7IH0sXG4gICAgICBsYXllcnM6IHsgc3RhZ2UsIHdvcmxkLCBodWQgfSxcbiAgICAgIHNjcmVlbjogKHo6IG51bWJlciwgbGF5ZXIgPSBgc2NyZWVuJHt6fWApID0+IGNvbnRhaW5lcihzY3JlZW5MYXllcih6KSwgbGF5ZXIpLFxuICAgICAgY2FtZXJhLFxuICAgICAgJDogKGlkOiBzdHJpbmcpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBjIG9mIG93bmVkKSB7IGNvbnN0IGVsID0gYy5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihgIyR7Q1NTLmVzY2FwZShpZCl9YCk7IGlmIChlbCkgcmV0dXJuIGVsOyB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgc2NlbmUgXCIke25hbWV9XCI6IG5vIGVsZW1lbnQgIyR7aWR9YCk7XG4gICAgICB9LFxuICAgICAgbWFya2VyOiAobTogc3RyaW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGZvdW5kID0gbWFya2Vycy5maW5kKHggPT4geC5uYW1lID09PSBtKTtcbiAgICAgICAgaWYgKCFmb3VuZCkgdGhyb3cgbmV3IEVycm9yKGBubyBtYXJrZXIgXCIke219XCIgKGhhdmU6ICR7bWFya2Vycy5tYXAoeCA9PiB4Lm5hbWUpLmpvaW4oXCIsIFwiKX0pYCk7XG4gICAgICAgIHJldHVybiBmb3VuZC50O1xuICAgICAgfSxcbiAgICB9O1xuICAgIHJldHVybiBjdHg7XG4gIH07XG5cbiAgY29uc3QgbW91bnRlZDogTW91bnRlZFtdID0gW107XG4gIGNvbnN0IHdvcmxkT3duZWQ6IEhUTUxFbGVtZW50W10gPSBbXTtcbiAgY29uc3Qgd29ybGRDdHggPSBtYWtlQ3R4KFwid29ybGRcIiwgd29ybGRPd25lZCk7XG4gIG1vdW50ZWQucHVzaCh7IGRlZjogbnVsbCwgbmFtZTogXCJ3b3JsZFwiLCBjdHg6IHdvcmxkQ3R4LCBjb250YWluZXJzOiB3b3JsZE93bmVkLCB2aXNpYmxlOiB0cnVlIH0pO1xuICBmb3IgKGNvbnN0IHMgb2Ygdi5zY2VuZXMpIHtcbiAgICBjb25zdCBvd25lZDogSFRNTEVsZW1lbnRbXSA9IFtdO1xuICAgIG1vdW50ZWQucHVzaCh7IGRlZjogcywgbmFtZTogcy5uYW1lLCBjdHg6IG1ha2VDdHgocy5uYW1lLCBvd25lZCksIGNvbnRhaW5lcnM6IG93bmVkLCB2aXNpYmxlOiB0cnVlIH0pO1xuICB9XG5cbiAgY29uc3QgdGltZSA9ICh0OiBudW1iZXIsIHM/OiBTY2VuZURlZik6IFNjZW5lVGltZSA9PiB7XG4gICAgY29uc3Qgc3RhcnQgPSBzPy5zdGFydCA/PyAwLCBlbmQgPSBzPy5lbmQgPz8gdi5kdXJhdGlvbjtcbiAgICByZXR1cm4geyB0LCBsb2NhbDogdCAtIHN0YXJ0LCBwcm9ncmVzczogTWF0aC5taW4oMSwgTWF0aC5tYXgoMCwgKHQgLSBzdGFydCkgLyAoZW5kIC0gc3RhcnQpKSksIHN0YXJ0LCBlbmQgfTtcbiAgfTtcblxuICBjb25zdCByZW5kZXIgPSAodDogbnVtYmVyKTogdm9pZCA9PiB7XG4gICAgY2xvY2suYXQodCk7XG4gICAgd29ybGQuc3R5bGUudHJhbnNmb3JtID0gY2FtZXJhVHJhbnNmb3JtKGNhbWVyYSh0KSwgdi5zdGFnZSk7XG4gICAgaWYgKHYud29ybGQ/LnJlbmRlcikge1xuICAgICAgdHJ5IHsgdi53b3JsZC5yZW5kZXIodGltZSh0KSwgd29ybGRDdHgpOyB9IGNhdGNoIChlKSB7IHRocm93IG5ldyBEb2xseVJlbmRlckVycm9yKFwid29ybGRcIiwgdCwgZSk7IH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBtIG9mIG1vdW50ZWQpIHtcbiAgICAgIGlmICghbS5kZWYpIGNvbnRpbnVlO1xuICAgICAgY29uc3Qgb24gPSB0ID49IG0uZGVmLnN0YXJ0ICYmIHQgPCBtLmRlZi5lbmQ7XG4gICAgICAvLyBkaXNwbGF5Om5vbmUsIG5vdCB2aXNpYmlsaXR5OmhpZGRlbjogYSBjaGlsZCB3aXRoIHZpc2liaWxpdHk6dmlzaWJsZSB3b3VsZCBzdGlsbCBzaG93IHRocm91Z2hcbiAgICAgIGlmIChvbiAhPT0gbS52aXNpYmxlKSB7IGZvciAoY29uc3QgYyBvZiBtLmNvbnRhaW5lcnMpIGMuc3R5bGUuZGlzcGxheSA9IG9uID8gXCJcIiA6IFwibm9uZVwiOyBtLnZpc2libGUgPSBvbjsgfVxuICAgICAgaWYgKCFvbikgY29udGludWU7XG4gICAgICB0cnkgeyBtLmRlZi5yZW5kZXIodGltZSh0LCBtLmRlZiksIG0uY3R4KTsgfSBjYXRjaCAoZSkgeyB0aHJvdyBuZXcgRG9sbHlSZW5kZXJFcnJvcihtLm5hbWUsIHQsIGUpOyB9XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IG1ldGE6IERvbGx5TWV0YSA9IHtcbiAgICB0aXRsZTogdi50aXRsZSwgZnBzOiB2LmZwcywgZHVyYXRpb246IHYuZHVyYXRpb24sIHN0YWdlOiB7IC4uLnYuc3RhZ2UgfSwgYnBtOiB2LmJwbSwgYmVhdE9mZnNldDogdi5iZWF0T2Zmc2V0LFxuICAgIGFzcGVjdDogdi5hc3BlY3QgPz8gXCIxNjo5XCIsIHNjZW5lczogdi5zY2VuZXMubWFwKHMgPT4gKHsgbmFtZTogcy5uYW1lLCBzdGFydDogcy5zdGFydCwgZW5kOiBzLmVuZCwgZmlsZTogcy5maWxlIH0pKSxcbiAgICBtYXJrZXJzLCBhdWRpbzogdi5hdWRpbyA/PyBbXSwgYmFja2dyb3VuZDogYmcsXG4gIH07XG5cbiAgY29uc3QgTEFZRVIgPSAvXihkb2xseS1zdGFnZXxkb2xseS13b3JsZHxkb2xseS1odWQpJC87XG4gIGNvbnN0IHRyYWNrZWQgPSAoKTogRWxlbWVudFtdID0+IFsuLi5zdGFnZS5xdWVyeVNlbGVjdG9yQWxsKFwiKlwiKV0uZmlsdGVyKGVsID0+XG4gICAgIUxBWUVSLnRlc3QoZWwuaWQpICYmICFlbC5jbGFzc0xpc3QuY29udGFpbnMoXCJkb2xseS1sYXllclwiKSAmJiAhZWwuY2xhc3NMaXN0LmNvbnRhaW5zKFwiZG9sbHktY1wiKSk7XG4gIGNvbnN0IHZpc2libGVCb3ggPSAoZWw6IEVsZW1lbnQpOiBET01SZWN0IHwgbnVsbCA9PiB7XG4gICAgaWYgKCFlbC5jaGVja1Zpc2liaWxpdHkoeyBvcGFjaXR5UHJvcGVydHk6IHRydWUsIHZpc2liaWxpdHlQcm9wZXJ0eTogdHJ1ZSB9KSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgciA9IGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHJldHVybiByLndpZHRoIHx8IHIuaGVpZ2h0ID8gciA6IG51bGw7XG4gIH07XG5cbiAgY29uc3QgbW90aW9uID0gKHQwOiBudW1iZXIsIHQxOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBzdCA9IHN0YWdlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIGNvbnN0IGluc2lkZSA9ICh4OiBudW1iZXIsIGhvcml6b250YWw6IGJvb2xlYW4pID0+IGhvcml6b250YWwgPyB4ID49IHN0LmxlZnQgLSAyICYmIHggPD0gc3QucmlnaHQgKyAyIDogeCA+PSBzdC50b3AgLSAyICYmIHggPD0gc3QuYm90dG9tICsgMjtcbiAgICByZW5kZXIodDApO1xuICAgIGNvbnN0IGEgPSBuZXcgTWFwPEVsZW1lbnQsIERPTVJlY3Q+KCk7XG4gICAgZm9yIChjb25zdCBlbCBvZiB0cmFja2VkKCkpIHsgY29uc3QgciA9IHZpc2libGVCb3goZWwpOyBpZiAocikgYS5zZXQoZWwsIHIpOyB9XG4gICAgcmVuZGVyKHQxKTtcbiAgICBsZXQgcHggPSAwLCB3aG86IEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgICBmb3IgKGNvbnN0IGVsIG9mIHRyYWNrZWQoKSkge1xuICAgICAgY29uc3QgcjAgPSBhLmdldChlbCk7IGlmICghcjApIGNvbnRpbnVlO1xuICAgICAgY29uc3QgcjEgPSB2aXNpYmxlQm94KGVsKTsgaWYgKCFyMSkgY29udGludWU7XG4gICAgICAvLyBvbmx5IGVkZ2VzIHRoYXQgYXJlIG9uIHNjcmVlbiBhdCBlaXRoZXIgZW5kIG9mIHRoZSBzaHV0dGVyIGNhbiBzaG93IGJsdXJcbiAgICAgIGNvbnN0IGQgPSBNYXRoLm1heChcbiAgICAgICAgaW5zaWRlKHIwLmxlZnQsIHRydWUpIHx8IGluc2lkZShyMS5sZWZ0LCB0cnVlKSA/IE1hdGguYWJzKHIxLmxlZnQgLSByMC5sZWZ0KSA6IDAsXG4gICAgICAgIGluc2lkZShyMC5yaWdodCwgdHJ1ZSkgfHwgaW5zaWRlKHIxLnJpZ2h0LCB0cnVlKSA/IE1hdGguYWJzKHIxLnJpZ2h0IC0gcjAucmlnaHQpIDogMCxcbiAgICAgICAgaW5zaWRlKHIwLnRvcCwgZmFsc2UpIHx8IGluc2lkZShyMS50b3AsIGZhbHNlKSA/IE1hdGguYWJzKHIxLnRvcCAtIHIwLnRvcCkgOiAwLFxuICAgICAgICBpbnNpZGUocjAuYm90dG9tLCBmYWxzZSkgfHwgaW5zaWRlKHIxLmJvdHRvbSwgZmFsc2UpID8gTWF0aC5hYnMocjEuYm90dG9tIC0gcjAuYm90dG9tKSA6IDApO1xuICAgICAgaWYgKGQgPiBweCkgeyBweCA9IGQ7IHdobyA9IGVsOyB9XG4gICAgfVxuICAgIGNvbnN0IGNhbSA9IGNhbWVyYURpc3BsYWNlbWVudChjYW1lcmEodDApLCBjYW1lcmEodDEpLCB2LnN0YWdlKSAqIHNjYWxlO1xuICAgIHJldHVybiB7IHB4OiBNYXRoLm1heChweCwgY2FtKSwgY2FtZXJhOiBjYW0sIGVsZW1lbnQ6IHdobyA/IGRlc2NyaWJlKHdobykgOiBudWxsIH07XG4gIH07XG5cbiAgY29uc3QgZGVzY3JpYmUgPSAoZWw6IEVsZW1lbnQpOiBzdHJpbmcgPT4ge1xuICAgIGNvbnN0IG4gPSAoZWwgYXMgSFRNTEVsZW1lbnQpLmRhdGFzZXQ/Lm5hbWUgPz8gKGVsLmlkID8gYCMke2VsLmlkfWAgOiBudWxsKTtcbiAgICBpZiAobikgcmV0dXJuIG47XG4gICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChsZXQgZTogRWxlbWVudCB8IG51bGwgPSBlbDsgZSAmJiBlICE9PSBzdGFnZSAmJiBwYXJ0cy5sZW5ndGggPCA0OyBlID0gZS5wYXJlbnRFbGVtZW50KSB7XG4gICAgICBpZiAoZS5pZCkgeyBwYXJ0cy51bnNoaWZ0KGAjJHtlLmlkfWApOyBicmVhazsgfVxuICAgICAgY29uc3QgY2xzID0gWy4uLmUuY2xhc3NMaXN0XS5maWx0ZXIoYyA9PiAhYy5zdGFydHNXaXRoKFwiZG9sbHktXCIpKVswXTtcbiAgICAgIHBhcnRzLnVuc2hpZnQoZS50YWdOYW1lLnRvTG93ZXJDYXNlKCkgKyAoY2xzID8gYC4ke2Nsc31gIDogXCJcIikpO1xuICAgIH1cbiAgICByZXR1cm4gcGFydHMuam9pbihcIiA+IFwiKTtcbiAgfTtcblxuICBjb25zdCBpbnNwZWN0ID0gKHQ6IG51bWJlciwgbzogeyBhbGw/OiBib29sZWFuIH0gPSB7fSk6IEluc3BlY3RSZXN1bHQgPT4ge1xuICAgIHJlbmRlcih0KTtcbiAgICBjb25zdCBzdCA9IHN0YWdlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIGNvbnN0IG91dDogRnJhbWVFbGVtZW50SW5mb1tdID0gW107XG4gICAgZm9yIChjb25zdCBlbCBvZiB0cmFja2VkKCkpIHtcbiAgICAgIGNvbnN0IHIgPSB2aXNpYmxlQm94KGVsKTsgaWYgKCFyKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IG93biA9IFsuLi5lbC5jaGlsZE5vZGVzXS5maWx0ZXIobiA9PiBuLm5vZGVUeXBlID09PSAzKS5tYXAobiA9PiBuLnRleHRDb250ZW50ID8/IFwiXCIpLmpvaW4oXCJcIikudHJpbSgpO1xuICAgICAgaWYgKCFvd24gJiYgIW8uYWxsKSBjb250aW51ZTtcbiAgICAgIGxldCBvcCA9IDE7XG4gICAgICBmb3IgKGxldCBlOiBFbGVtZW50IHwgbnVsbCA9IGVsOyBlICYmIGUgIT09IHN0YWdlOyBlID0gZS5wYXJlbnRFbGVtZW50KSBvcCAqPSArZ2V0Q29tcHV0ZWRTdHlsZShlKS5vcGFjaXR5O1xuICAgICAgY29uc3QgY3MgPSBnZXRDb21wdXRlZFN0eWxlKGVsKTtcbiAgICAgIGxldCBiZ2M6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgIGZvciAobGV0IGU6IEVsZW1lbnQgfCBudWxsID0gZWw7IGU7IGUgPSBlLnBhcmVudEVsZW1lbnQpIHtcbiAgICAgICAgY29uc3QgYiA9IGdldENvbXB1dGVkU3R5bGUoZSkuYmFja2dyb3VuZENvbG9yO1xuICAgICAgICBpZiAoYiAmJiBiICE9PSBcInRyYW5zcGFyZW50XCIgJiYgIS9yZ2JhXFwoW14pXSosXFxzKjBcXCkkLy50ZXN0KGIpKSB7IGJnYyA9IGI7IGJyZWFrOyB9XG4gICAgICAgIGlmIChlID09PSBzdGFnZSkgYnJlYWs7XG4gICAgICB9XG4gICAgICBjb25zdCBoZSA9IGVsIGFzIEhUTUxFbGVtZW50O1xuICAgICAgY29uc3QgcmF0aW8gPSBoZS5vZmZzZXRIZWlnaHQgPyByLmhlaWdodCAvIGhlLm9mZnNldEhlaWdodCA6IHNjYWxlO1xuICAgICAgb3V0LnB1c2goe1xuICAgICAgICBuYW1lOiBkZXNjcmliZShlbCksIHNjZW5lOiAoZWwuY2xvc2VzdChcIi5kb2xseS1jXCIpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LmRhdGFzZXQuc2NlbmUgPz8gbnVsbCxcbiAgICAgICAgcmVjdDogeyB4OiAoci5sZWZ0IC0gc3QubGVmdCkgLyBzY2FsZSwgeTogKHIudG9wIC0gc3QudG9wKSAvIHNjYWxlLCB3OiByLndpZHRoIC8gc2NhbGUsIGg6IHIuaGVpZ2h0IC8gc2NhbGUgfSxcbiAgICAgICAgb3BhY2l0eTogK29wLnRvRml4ZWQoMyksXG4gICAgICAgIC4uLihvd24gPyB7IHRleHQ6IG93biwgZm9udFNpemU6ICsocGFyc2VGbG9hdChjcy5mb250U2l6ZSkgKiByYXRpbyAvIHNjYWxlKS50b0ZpeGVkKDIpLCBjb2xvcjogY3MuY29sb3IsIGJhY2tncm91bmQ6IGJnYyA/PyBiZyB9IDoge30pLFxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB7IHQsIGNhbWVyYTogY2FtZXJhKHQpLCBzY2VuZXM6IGFjdGl2ZVNjZW5lcyh2LCB0KS5tYXAocyA9PiBzLm5hbWUpLCBlbGVtZW50czogb3V0IH07XG4gIH07XG5cbiAgY29uc3QgYXBpOiBEb2xseUFwaSA9IHsgdmVyc2lvbjogMSwgbWV0YSwgcmVhZHk6IG51bGwgYXMgdW5rbm93biBhcyBQcm9taXNlPERvbGx5TWV0YT4sIHJlbmRlciwgbW90aW9uLCBpbnNwZWN0LCBmaXQ6ICgpID0+IChzY2FsZSA9IGZpdCgpKSB9O1xuICB3aW5kb3cuX19kb2xseSA9IGFwaTtcblxuICBhcGkucmVhZHkgPSAoYXN5bmMgKCkgPT4ge1xuICAgIGlmICh2LndvcmxkPy5zZXR1cCkgYXdhaXQgdi53b3JsZC5zZXR1cCh3b3JsZEN0eCk7XG4gICAgZm9yIChjb25zdCBtIG9mIG1vdW50ZWQpIGlmIChtLmRlZj8uc2V0dXApIHtcbiAgICAgIHRyeSB7IGF3YWl0IG0uZGVmLnNldHVwKG0uY3R4KTsgfSBjYXRjaCAoZSkgeyB0aHJvdyBuZXcgRG9sbHlSZW5kZXJFcnJvcihtLm5hbWUsIDAsIGUpOyB9XG4gICAgfVxuICAgIGF3YWl0IFByb21pc2UuYWxsKHNoZWV0cyk7XG4gICAgY29uc3QgZmFjZXMgPSB2LnRoZW1lLmZvbnRGYWNlcyA/PyBbXTtcbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoZmFjZXMubWFwKGYgPT4gZG9jdW1lbnQuZm9udHMubG9hZChgJHtmLnN0eWxlID8/IFwibm9ybWFsXCJ9ICR7Zi53ZWlnaHQ/LnNwbGl0KFwiIFwiKVswXSA/PyBcIjQwMFwifSAzMnB4IFwiJHtmLmZhbWlseX1cImApLnRoZW4ociA9PiBbZiwgci5sZW5ndGhdIGFzIGNvbnN0KSkpO1xuICAgIGNvbnN0IG1pc3NpbmcgPSByZXN1bHRzLmZpbHRlcigoWywgbl0pID0+IG4gPT09IDApLm1hcCgoW2ZdKSA9PiBgJHtmLmZhbWlseX0gJHtmLndlaWdodCA/PyBcIlwifSAoJHtmLnNyYyA/PyBcImZyb20gZm9udENzc1wifSlgKTtcbiAgICBpZiAobWlzc2luZy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcihgZm9udHMgZmFpbGVkIHRvIGxvYWQ6ICR7bWlzc2luZy5qb2luKFwiOyBcIil9YCk7XG4gICAgYXdhaXQgZG9jdW1lbnQuZm9udHMucmVhZHk7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoWy4uLmRvY3VtZW50LmltYWdlc10ubWFwKGkgPT4gaS5kZWNvZGUoKS5jYXRjaCgoKSA9PiB7IHRocm93IG5ldyBFcnJvcihgaW1hZ2UgZmFpbGVkIHRvIGxvYWQ6ICR7aS5zcmN9YCk7IH0pKSk7XG4gICAgcmVuZGVyKDApO1xuICAgIHJldHVybiBtZXRhO1xuICB9KSgpO1xuICByZXR1cm4gYXBpO1xufVxuIiwgImltcG9ydCB7IGRlZmluZVRoZW1lIH0gZnJvbSBcIkBkb2xseS9jb3JlXCI7XG5cbi8vIFByaWNlIFBlZWsncyBicmFuZDogY29vbCBncmV5IHBhcGVyLCBuZWFyLWJsYWNrIGluaywgZWxlY3RyaWMgYmx1ZSBhY2NlbnQ7IEJyaWNvbGFnZSBHcm90ZXNxdWUgZm9yXG4vLyBoZWFkbGluZXMsIEluc3RydW1lbnQgU2FucyBmb3IgVUkgdGV4dCwgU2Vnb2UgVUkgZm9yIHRoZSBiYWRnZSAoYXMgdGhlIGV4dGVuc2lvbiBkcmF3cyBpdCkuXG5leHBvcnQgY29uc3QgdGhlbWUgPSBkZWZpbmVUaGVtZSh7XG4gIG5hbWU6IFwicHJpY2UtcGVla1wiLFxuICBjb2xvcnM6IHsgYmc6IFwiI2VlZjFmNlwiLCBmZzogXCIjMTQxNjFiXCIsIGFjY2VudDogXCIjMzM1NWZmXCIsIFwiYWNjZW50LXNvZnRcIjogXCIjOGVhMGZmXCIsIG11dGVkOiBcIiM4YTkwYTBcIiwgc3VyZmFjZTogXCIjZmZmZmZmXCIsIGluazogXCIjMTQxNjFiXCIsIGxpbmU6IFwiI2RmZTJlOFwiLCBncmlkOiBcIiNkM2Q4ZTFcIiB9LFxuICAvLyBwcmljZTogZ2x5cGhzIEluc3RydW1lbnQgU2FucyBsYWNrcyAoXHUyMEE5LCBcdTBFM0YsIFx1NEUwNykgZmFsbCBiYWNrIHRvIHRoZSBnZW5lcmljIHNhbnMtc2VyaWYsIGFzIG9uIHRoZSBzdG9yZSBwYWdlXG4gIGZvbnRzOiB7IGRpc3BsYXk6ICdcIkJyaWNvbGFnZSBHcm90ZXNxdWVcIiwgc2Fucy1zZXJpZicsIGJvZHk6ICdcIkluc3RydW1lbnQgU2Fuc1wiLCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWYnLCBwcmljZTogJ1wiSW5zdHJ1bWVudCBTYW5zXCIsIHNhbnMtc2VyaWYnLCB1aTogJ1wiU2Vnb2UgVUlcIiwgXCJJbnN0cnVtZW50IFNhbnNcIiwgc2Fucy1zZXJpZicgfSxcbiAgLy8gVE9ETyhzZWxmLWhvc3QpOiB2ZW5kb3IgdGhlc2UgT0ZMIGZvbnRzIGludG8gZm9udHMvIHNvIHJlbmRlcnMgbmV2ZXIgdG91Y2ggdGhlIG5ldHdvcmsuXG4gIGZvbnRDc3M6IFtcImh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20vY3NzMj9mYW1pbHk9QnJpY29sYWdlK0dyb3Rlc3F1ZTpvcHN6LHdnaHRAMTIuLjk2LDUwMDsxMi4uOTYsNzAwOzEyLi45Niw4MDAmZmFtaWx5PUluc3RydW1lbnQrU2Fuczp3Z2h0QDQwMDs1MDA7NjAwOzcwMCZkaXNwbGF5PWJsb2NrXCJdLFxuICBmb250RmFjZXM6IFtcbiAgICB7IGZhbWlseTogXCJCcmljb2xhZ2UgR3JvdGVzcXVlXCIsIHdlaWdodDogXCI4MDBcIiB9LCB7IGZhbWlseTogXCJCcmljb2xhZ2UgR3JvdGVzcXVlXCIsIHdlaWdodDogXCI3MDBcIiB9LFxuICAgIHsgZmFtaWx5OiBcIkluc3RydW1lbnQgU2Fuc1wiLCB3ZWlnaHQ6IFwiNTAwXCIgfSwgeyBmYW1pbHk6IFwiSW5zdHJ1bWVudCBTYW5zXCIsIHdlaWdodDogXCI2MDBcIiB9LCB7IGZhbWlseTogXCJJbnN0cnVtZW50IFNhbnNcIiwgd2VpZ2h0OiBcIjcwMFwiIH0sXG4gIF0sXG4gIHJhZGlpOiB7IHNtOiA4LCBtZDogMTQsIGxnOiAyMiB9LFxuICBzaGFkb3dzOiB7XG4gICAgY2FyZDogXCIwIDI0cHggNDhweCAtMjhweCByZ2JhKDIwLDI0LDQwLC4zNSksIDAgMCAwIDFweCByZ2JhKDIwLDI0LDQwLC4wNSlcIixcbiAgICBmbG9hdDogXCIwIDUwcHggOTBweCAtNDBweCByZ2JhKDIwLDI0LDQwLC41KSwgMCAwIDAgMXB4IHJnYmEoMjAsMjQsNDAsLjA2KVwiLFxuICB9LFxufSk7XG4iLCAiLy8gUHJpY2UgUGVlazogcHJvZHVjdCBsb2dpYywgYmVhdCB0aW1pbmdzIGFuZCB0aGUgc3R5bGVzIGV2ZXJ5IHNjZW5lIHNoYXJlcy5cbmltcG9ydCB7IGVuc3VyZVN0eWxlIH0gZnJvbSBcIkBkb2xseS9jb3JlXCI7XG5cbi8vIFNhbWUgRVVSLWJhc2VkIHJhdGVzIGFuZCBEYW5pc2ggZm9ybWF0dGluZyBhcyB0aGUgZXh0ZW5zaW9uLCBzbyBldmVyeSBudW1iZXIgb24gc2NyZWVuIGlzIHJlYWwuXG5leHBvcnQgY29uc3QgUjogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHsgRVVSOiAxLCBES0s6IDcuNDc0OCwgS1JXOiAxNDk5LjAxLCBVU0Q6IDEuMTI1MywgR0JQOiAwLjg0Mzg1LCBKUFk6IDE3Ny44MiwgQ05ZOiA3LjUyNCwgQ0hGOiAwLjkyNzIsIFRIQjogMzcuNjAyIH07XG5jb25zdCBkayA9IChuOiBudW1iZXIsIGQgPSAwKSA9PiBuLnRvTG9jYWxlU3RyaW5nKFwiZGEtREtcIiwgeyBtaW5pbXVtRnJhY3Rpb25EaWdpdHM6IGQsIG1heGltdW1GcmFjdGlvbkRpZ2l0czogZCB9KTtcbmNvbnN0IEZNVDogUmVjb3JkPHN0cmluZywgeyBwcmU/OiBzdHJpbmc7IHN1Zj86IHN0cmluZyB9PiA9IHsgREtLOiB7IHN1ZjogXCIga3IuXCIgfSwgRVVSOiB7IHByZTogXCJcdTIwQUNcIiB9LCBVU0Q6IHsgcHJlOiBcIiRcIiB9LCBHQlA6IHsgcHJlOiBcIlx1MDBBM1wiIH0gfTtcbmV4cG9ydCBmdW5jdGlvbiBtb25leSh2OiBudW1iZXIsIGMgPSBcIkRLS1wiKTogc3RyaW5nIHtcbiAgY29uc3QgZiA9IEZNVFtjXTsgbGV0IG51bTogc3RyaW5nLCBzYyA9IFwiXCI7XG4gIGlmICh2ID49IDFlOSkgeyBudW0gPSBkayh2IC8gMWU5LCAxKTsgc2MgPSBcIiBtaWEuXCI7IH0gZWxzZSBpZiAodiA+PSAxZTgpIHsgbnVtID0gZGsodiAvIDFlNiwgMCk7IHNjID0gXCIgbWlvLlwiOyB9XG4gIGVsc2UgaWYgKHYgPj0gMWU2KSB7IG51bSA9IGRrKHYgLyAxZTYsIDEpOyBzYyA9IFwiIG1pby5cIjsgfSBlbHNlIGlmICh2ID49IDEwKSBudW0gPSBkayhNYXRoLnJvdW5kKHYpKTsgZWxzZSBudW0gPSBkayh2LCAyKTtcbiAgcmV0dXJuIGYucHJlID8gYCR7Zi5wcmV9JHtudW19JHtzY31gIDogYCR7bnVtfSR7c2N9JHtmLnN1Zn1gO1xufVxuZXhwb3J0IGNvbnN0IGNvbnYgPSAodjogbnVtYmVyLCBmcm9tOiBzdHJpbmcsIHRvID0gXCJES0tcIik6IHN0cmluZyA9PiBtb25leSh2IC8gUltmcm9tXSAqIFJbdG9dLCB0byk7XG5cbi8vIEJlYXQgZ3JpZDogMTIwIEJQTSwgb25lIGJlYXQgPSAwLjUgcy5cbmV4cG9ydCBjb25zdCBUX1JFRUwgPSBbNy4yNSwgOS4yNSwgMTEuMjUsIDEzLjI1XTtcbmV4cG9ydCBjb25zdCBSRUVMX1ggPSAyMTkwLCBSRUVMX1kwID0gMzMwLCBSRUVMX0dBUCA9IDI1MDtcbmV4cG9ydCBjb25zdCBUX0QgPSB7IHBvcEluOiAxMy41NSwgY3Vyc29ySW46IDE0LjMsIGF0U2VsOiAxNS4wLCBvcGVuOiAxNS4xLCBnbGlkZTogMTUuNjUsIHBpY2s6IDE2LjMsIGN1cnNvck91dDogMTcuNCB9O1xuZXhwb3J0IGNvbnN0IFRfRSA9IHsgZG9sbHk6IDE5LjAsIHpvb206IDI0LjE1LCB6b29tRW5kOiAyNS4zNSB9O1xuZXhwb3J0IGNvbnN0IFRfRiA9IHsgbG9nbzogMjUuNSwgbmFtZTogMjUuOCwgdGFnOiAyNi4zNSB9O1xuXG5leHBvcnQgZnVuY3Rpb24gc2hhcmVkU3R5bGVzKCk6IHZvaWQge1xuICBlbnN1cmVTdHlsZShcInByaWNlLXBlZWtcIiwgYFxuI2RvbGx5LXN0YWdle2ZvbnQtdmFyaWFudC1udW1lcmljOnRhYnVsYXItbnVtc31cbi5wcC1oe3Bvc2l0aW9uOmFic29sdXRlO21hcmdpbjowO2ZvbnQ6ODAwIDc2cHgvMC45OCB2YXIoLS1mLWRpc3BsYXkpO2xldHRlci1zcGFjaW5nOi0uMDM1ZW07Y29sb3I6dmFyKC0tYy1mZyl9XG4ucHAtYWJze3Bvc2l0aW9uOmFic29sdXRlfVxuLnBwLW1hcmt7cG9zaXRpb246YWJzb2x1dGU7bGVmdDo4MHB4O2JvdHRvbTo1NnB4O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEycHg7Zm9udDo3MDAgMjRweCB2YXIoLS1mLWRpc3BsYXkpO2xldHRlci1zcGFjaW5nOi0uMDFlbX1cbi5wcC1tYXJrIGl7ZGlzcGxheTppbmxpbmUtYmxvY2s7YmFja2dyb3VuZDp2YXIoLS1jLWluayk7Y29sb3I6I2ZmZjtmb250OjcwMCAxNXB4LzEuNzUgdmFyKC0tZi11aSk7Zm9udC1zdHlsZTpub3JtYWw7cGFkZGluZzowIC41NWVtO2JvcmRlci1yYWRpdXM6N3B4IDdweCA3cHggMXB4fVxuLmRvbGx5LWJhZGdle2xldHRlci1zcGFjaW5nOjB9XG4uZG9sbHktY2hpcCAuY2l0eXtkaXNwbGF5OmJsb2NrO21hcmdpbi10b3A6OHB4O2ZvbnQ6NjAwIDE1cHggdmFyKC0tZi1ib2R5KTtsZXR0ZXItc3BhY2luZzouMDhlbTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7Y29sb3I6dmFyKC0tYy1tdXRlZCl9XG4uZG9sbHktY2hpcCAucHt3aGl0ZS1zcGFjZTpub3dyYXA7cG9zaXRpb246cmVsYXRpdmU7ZGlzcGxheTppbmxpbmUtYmxvY2s7bWFyZ2luLXRvcDoxMHB4O2ZvbnQ6NzAwIDQ0cHgvMS4xIHZhcigtLWYtcHJpY2UpO2xldHRlci1zcGFjaW5nOi0uMDJlbX1cbi5kb2xseS1jaGlwIC5wIC5kb2xseS1iYWRnZXt0b3A6LTMwcHg7cmlnaHQ6LTM0cHh9XG4ucHAtaXRlbXtwb3NpdGlvbjphYnNvbHV0ZTt0cmFuc2Zvcm0tb3JpZ2luOjAgNTAlfVxuLnBwLWl0ZW0gLncsLnBwLXllbiAud3twb3NpdGlvbjpyZWxhdGl2ZTtkaXNwbGF5OmlubGluZS1ibG9jaztmb250OjcwMCA5MnB4LzEuMDUgdmFyKC0tZi1wcmljZSk7bGV0dGVyLXNwYWNpbmc6LS4wM2VtO3doaXRlLXNwYWNlOm5vd3JhcH1cbi5wcC1pdGVtIC53IC5kb2xseS1iYWRnZSwucHAteWVuIC53IC5kb2xseS1iYWRnZXt0b3A6LTM0cHg7cmlnaHQ6LTQ2cHg7Zm9udC1zaXplOjI4cHh9XG4ucHAteWVuIC53IC5kb2xseS1iYWRnZXt0cmFuc2Zvcm0tb3JpZ2luOjUwJSAxMDAlfVxuLnBwLWl0ZW0gLm5vdGV7ZGlzcGxheTpibG9jazttYXJnaW4tdG9wOjE0cHg7Zm9udDo2MDAgMTZweCB2YXIoLS1mLWJvZHkpO2xldHRlci1zcGFjaW5nOi4wOGVtO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTtjb2xvcjp2YXIoLS1jLW11dGVkKX1cbi5wcC15ZW57cG9zaXRpb246YWJzb2x1dGU7dHJhbnNmb3JtLW9yaWdpbjowIDUwJTt3aGl0ZS1zcGFjZTpub3dyYXB9XG5gKTtcbn1cbiIsICIvLyBBIFx1MDBCNyBcIlNob3BwaW5nIGFicm9hZD9cIiBTZW91bCdzIHByaWNlIHJvbGxzIGluIGF0IGFuIGV4dHJlbWUgY2xvc2UtdXA7IHRoZSBjYW1lcmEgcHVsbHMgYmFjayBhcyB0aGVcbi8vIG90aGVyIGNoaXBzIGZseSBpbi4gQiBcdTAwQjcgXCJFdmVyeSBwcmljZSwgaW4geW91ciBjdXJyZW5jeS5cIiBCYWRnZXMgbGFuZCBvbiBhIGJlYXQgY2FzY2FkZS5cbmltcG9ydCB7IGJhZGdlLCBib2IsIGNsYW1wLCBkZWZpbmVTY2VuZSwgbGFuZCwgbGVycCwgbWFza2VkLCBwb3BJbiwgcHJpbWl0aXZlc0Nzcywgc3ByaW5nLCB0ZiwgdHlwZUluIH0gZnJvbSBcIkBkb2xseS9jb3JlXCI7XG5pbXBvcnQgeyBjb252IH0gZnJvbSBcIi4uL3NoYXJlZC50c1wiO1xuXG5jb25zdCBDSElQUzogQXJyYXk8W2NpdHk6IHN0cmluZywgc2hvd246IHN0cmluZywgdmFsdWU6IG51bWJlciwgY3VyOiBzdHJpbmcsIHg6IG51bWJlciwgeTogbnVtYmVyXT4gPSBbXG4gIFtcIlNlb3VsXCIsIFwiXHUyMEE5MSw1MDAsMDAwXCIsIDE1MDAwMDAsIFwiS1JXXCIsIDYwMCwgNjJdLFxuICBbXCJOZXcgWW9ya1wiLCBcIiQyNDlcIiwgMjQ5LCBcIlVTRFwiLCAxMDQwLCAxMTZdLFxuICBbXCJCZXJsaW5cIiwgXCIxOSw5OSBcdTIwQUNcIiwgMTkuOTksIFwiRVVSXCIsIDY0MCwgMjU4XSxcbiAgW1wiVG9reW9cIiwgXCJcdTAwQTU0Miw4MDBcIiwgNDI4MDAsIFwiSlBZXCIsIDk2MCwgMzE0XSxcbiAgW1wiTG9uZG9uXCIsIFwiXHUwMEEzMjE5XCIsIDIxOSwgXCJHQlBcIiwgNjYwLCA0NTJdLFxuICBbXCJCYW5na29rXCIsIFwiXHUwRTNGOCw0OTBcIiwgODQ5MCwgXCJUSEJcIiwgMTAwMCwgNTAwXSxcbl07XG4vLyB3aGVyZSBlYWNoIGNoaXAgZmxpZXMgaW4gZnJvbSAocmVsYXRpdmUpLCBhbmQgdGhlIGJlYXQgaXRzIGJhZGdlIGxhbmRzIG9uXG5jb25zdCBDSElQX0lOID0gW1swLCAwXSwgWzM4MCwgLTE2MF0sIFstMjYwLCA2MF0sIFszMjAsIDEyMF0sIFstMjAwLCAyNjBdLCBbMzAwLCAzMDBdXTtcbmNvbnN0IFRfQ0hJUCA9IFswLCAxLjEsIDEuMjUsIDEuNCwgMS41NSwgMS43XTtcbmNvbnN0IFRfQkFER0UgPSBbMy41LCAzLjc1LCA0LjAsIDQuMjUsIDQuNSwgNC43NV07XG5cbmxldCBoZWFkQTogSFRNTEVsZW1lbnRbXSwgaGVhZEI6IEhUTUxFbGVtZW50W107XG5jb25zdCBjaGlwczogQXJyYXk8eyBlbDogSFRNTEVsZW1lbnQ7IGNoYXJzOiBIVE1MRWxlbWVudFtdOyBiYWRnZTogSFRNTEVsZW1lbnQgfT4gPSBbXTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lU2NlbmUuZnJvbShcInNjZW5lcy9wcmljZXMudHNcIiwge1xuICBuYW1lOiBcInByaWNlc1wiLFxuICBzdGFydDogMCxcbiAgZW5kOiA3LjQsXG4gIG1hcmtlcnM6IHsgXCJoZWFkLWFcIjogMi4wNSwgXCJoZWFkLWJcIjogMy4zLCBiYWRnZXM6IDMuNSB9LFxuICBzZXR1cChjdHgpIHtcbiAgICBwcmltaXRpdmVzQ3NzKCk7XG4gICAgY29uc3QgaEEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaDJcIik7IGhBLmNsYXNzTmFtZSA9IFwicHAtaFwiOyBoQS5zdHlsZS5jc3NUZXh0ID0gXCJsZWZ0OjgwcHg7dG9wOjE5MHB4O3dpZHRoOjQ3MHB4XCI7XG4gICAgY29uc3QgaEIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaDJcIik7IGhCLmNsYXNzTmFtZSA9IFwicHAtaFwiOyBoQi5zdHlsZS5jc3NUZXh0ID0gXCJsZWZ0OjgwcHg7dG9wOjE1MHB4O3dpZHRoOjUyMHB4XCI7XG4gICAgY3R4LndvcmxkLmFwcGVuZChoQSwgaEIpO1xuICAgIGhlYWRBID0gbWFza2VkKGhBLCBcIlNob3BwaW5nIHxhYnJvYWQ/fFwiKTtcbiAgICBoZWFkQiA9IG1hc2tlZChoQiwgXCJFdmVyeSBwcmljZSwgaW4gfHlvdXJ8IGN1cnJlbmN5LlwiKTtcbiAgICBmb3IgKGNvbnN0IFtjaXR5LCBzaG93biwgdiwgYywgeCwgeV0gb2YgQ0hJUFMpIHtcbiAgICAgIGNvbnN0IGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgIGVsLmNsYXNzTmFtZSA9IFwiZG9sbHktY2hpcFwiOyBlbC5zdHlsZS5sZWZ0ID0geCArIFwicHhcIjsgZWwuc3R5bGUudG9wID0geSArIFwicHhcIjtcbiAgICAgIGNvbnN0IHAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTsgcC5jbGFzc05hbWUgPSBcInBcIjtcbiAgICAgIGNvbnN0IGIgPSBiYWRnZShjb252KHYsIGMpKTsgcC5hcHBlbmQoYik7XG4gICAgICBjb25zdCBjaXR5RWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTsgY2l0eUVsLmNsYXNzTmFtZSA9IFwiY2l0eVwiOyBjaXR5RWwudGV4dENvbnRlbnQgPSBjaXR5O1xuICAgICAgZWwuYXBwZW5kKHAsIGNpdHlFbCk7XG4gICAgICBjdHgud29ybGQuYXBwZW5kKGVsKTtcbiAgICAgIGNoaXBzLnB1c2goeyBlbCwgY2hhcnM6IG1hc2tlZChwLCBzaG93biwgeyBjaGFyczogdHJ1ZSB9KSwgYmFkZ2U6IGIgfSk7XG4gICAgfVxuICB9LFxuICByZW5kZXIoeyB0IH0pIHtcbiAgICBjaGlwcy5mb3JFYWNoKCh7IGVsLCBjaGFycywgYmFkZ2U6IGIgfSwgaSkgPT4ge1xuICAgICAgY29uc3QgW2R4LCBkeV0gPSBDSElQX0lOW2ldO1xuICAgICAgY29uc3QgcyA9IGkgPT09IDAgPyAxIDogc3ByaW5nKHQgLSBUX0NISVBbaV0sIHsgZnJlcTogMS4yNSwgemV0YTogMC42MiB9KTtcbiAgICAgIGNvbnN0IGJ1bXAgPSAxICsgbGFuZCh0LCBUX0JBREdFW2ldKTtcbiAgICAgIGNvbnN0IHkgPSBib2IodCwgaSwgNCwgMS4xKSAqIGNsYW1wKHQgLSAyLjUpO1xuICAgICAgdGYoZWwsIGB0cmFuc2xhdGUoJHtkeCAqICgxIC0gcyl9cHgsJHtkeSAqICgxIC0gcykgKyB5fXB4KSByb3RhdGUoJHsoMSAtIHMpICogKGkgJSAyID8gOSA6IC05KX1kZWcpIHNjYWxlKCR7KGkgPT09IDAgPyAxIDogbGVycCgwLjcsIDEsIHMpKSAqIGJ1bXB9KWAsXG4gICAgICAgIGkgPT09IDAgPyBjbGFtcCh0ICogNikgOiBjbGFtcCgodCAtIFRfQ0hJUFtpXSkgKiA1KSk7XG4gICAgICB0eXBlSW4oY2hhcnMsIHQsIGkgPT09IDAgPyAwLjE1IDogVF9DSElQW2ldICsgMC4xLCBJbmZpbml0eSwgaSA9PT0gMCA/IHsgc3RhZ2dlcjogMC4wNDUsIGR1cjogMC44IH0gOiB7IHN0YWdnZXI6IDAuMDMsIGR1cjogMC42IH0pO1xuICAgICAgcG9wSW4oYiwgdCwgVF9CQURHRVtpXSk7XG4gICAgfSk7XG4gICAgdHlwZUluKGhlYWRBLCB0LCAyLjA1LCAzLjE1LCB7IHN0YWdnZXI6IDAuMDggfSk7XG4gICAgdHlwZUluKGhlYWRCLCB0LCAzLjMsIEluZmluaXR5LCB7IHN0YWdnZXI6IDAuMDYgfSk7XG4gIH0sXG59KTtcbiIsICIvLyBDIFx1MDBCNyBcIlJlYWRzIHByaWNlcyB0aGUgbG9jYWwgd2F5LlwiIEEgd2hpcC1wYW4gbGFuZHMgb24gYSByZWVsIG9mIGxvY2FsIGZvcm1hdHM7IHRoZSBjYW1lcmEgc3RlcHNcbi8vIGRvd24gaXQgaXRlbSBieSBpdGVtLCBhbmQgaXRlbXMgYXdheSBmcm9tIHRoZSBjZW50cmUgc2hyaW5rIGFuZCBkaW0uXG5pbXBvcnQgeyBiYWRnZSwgY2xhbXAsIGRlZmluZVNjZW5lLCBtYXNrZWQsIHBvcEluLCBwcm9nLCB0ZiwgdHlwZUluIH0gZnJvbSBcIkBkb2xseS9jb3JlXCI7XG5pbXBvcnQgeyBSRUVMX0dBUCwgUkVFTF9YLCBSRUVMX1kwLCBUX1JFRUwsIGNvbnYgfSBmcm9tIFwiLi4vc2hhcmVkLnRzXCI7XG5cbmNvbnN0IFJFRUw6IEFycmF5PFtzaG93bjogc3RyaW5nLCB2YWx1ZTogbnVtYmVyLCBjdXI6IHN0cmluZywgbm90ZTogc3RyaW5nXT4gPSBbXG4gIFtcIjNcdUM1QjUgNSwwMDBcdUI5Q0NcdUM2RDBcIiwgMzUwMDAwMDAwLCBcIktSV1wiLCBcIktvcmVhbiBcdUM1QjUgYW5kIFx1QjlDQ1wiXSxcbiAgW1wiM1x1NEUwN1x1NTE4NlwiLCAzMDAwMCwgXCJKUFlcIiwgXCJKYXBhbmVzZSBcdTRFMDdcIl0sXG4gIFtcIjE5LDk5IFx1MjBBQ1wiLCAxOS45OSwgXCJFVVJcIiwgXCJEZWNpbWFsIGNvbW1hXCJdLFxuXTtcblxubGV0IGhlYWQ6IEhUTUxFbGVtZW50W107XG5jb25zdCBpdGVtczogQXJyYXk8eyBlbDogSFRNTEVsZW1lbnQ7IGNoYXJzOiBIVE1MRWxlbWVudFtdOyBiYWRnZTogSFRNTEVsZW1lbnQgfT4gPSBbXTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lU2NlbmUuZnJvbShcInNjZW5lcy9yZWVsLnRzXCIsIHtcbiAgbmFtZTogXCJyZWVsXCIsXG4gIHN0YXJ0OiA2LjksXG4gIGVuZDogMTMuOCxcbiAgc2V0dXAoY3R4KSB7XG4gICAgY29uc3QgaEMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaDJcIik7IGhDLmNsYXNzTmFtZSA9IFwicHAtaFwiOyBoQy5zdHlsZS5jc3NUZXh0ID0gXCJsZWZ0OjgwcHg7dG9wOjIwMHB4O3dpZHRoOjQzMHB4XCI7XG4gICAgY3R4Lmh1ZC5hcHBlbmQoaEMpO1xuICAgIGhlYWQgPSBtYXNrZWQoaEMsIFwiUmVhZHMgcHJpY2VzIHRoZSB8bG9jYWx8IHdheS5cIik7XG4gICAgUkVFTC5mb3JFYWNoKChbc2hvd24sIHYsIGMsIG5vdGVdLCBpKSA9PiB7XG4gICAgICBjb25zdCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICBlbC5jbGFzc05hbWUgPSBcInBwLWl0ZW1cIjsgZWwuc3R5bGUubGVmdCA9IFJFRUxfWCArIFwicHhcIjsgZWwuc3R5bGUudG9wID0gUkVFTF9ZMCArIGkgKiBSRUVMX0dBUCAtIDcwICsgXCJweFwiO1xuICAgICAgY29uc3QgdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpOyB3LmNsYXNzTmFtZSA9IFwid1wiO1xuICAgICAgY29uc3QgYiA9IGJhZGdlKGNvbnYodiwgYykpOyB3LmFwcGVuZChiKTtcbiAgICAgIGNvbnN0IG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTsgbi5jbGFzc05hbWUgPSBcIm5vdGVcIjsgbi50ZXh0Q29udGVudCA9IG5vdGU7XG4gICAgICBlbC5hcHBlbmQodywgbik7XG4gICAgICBjdHgud29ybGQuYXBwZW5kKGVsKTtcbiAgICAgIGl0ZW1zLnB1c2goeyBlbCwgY2hhcnM6IG1hc2tlZCh3LCBzaG93biwgeyBjaGFyczogdHJ1ZSB9KSwgYmFkZ2U6IGIgfSk7XG4gICAgfSk7XG4gIH0sXG4gIHJlbmRlcih7IHQgfSwgY3R4KSB7XG4gICAgY29uc3QgY3kgPSBjdHguY2FtZXJhKHQpLnk7XG4gICAgaXRlbXMuZm9yRWFjaCgoeyBlbCwgY2hhcnMsIGJhZGdlOiBiIH0sIGkpID0+IHtcbiAgICAgIGNvbnN0IGQgPSAoUkVFTF9ZMCArIGkgKiBSRUVMX0dBUCAtIChjeSAtIDMwKSkgLyBSRUVMX0dBUDtcbiAgICAgIGNvbnN0IGsgPSBNYXRoLm1pbihNYXRoLmFicyhkKSwgMS42KTtcbiAgICAgIHRmKGVsLCBgc2NhbGUoJHsxIC0gMC4xNCAqIGt9KWAsIHQgPCBUX1JFRUxbaV0gLSAwLjMgPyAwIDogY2xhbXAoMSAtIDAuNyAqIGspICogKDEgLSBwcm9nKHQsIDEzLjIsIDAuNSkpKTtcbiAgICAgIHR5cGVJbihjaGFycywgdCwgVF9SRUVMW2ldIC0gMC4yNSwgSW5maW5pdHksIHsgc3RhZ2dlcjogMC4wMzUsIGR1cjogMC43IH0pO1xuICAgICAgcG9wSW4oYiwgdCwgVF9SRUVMW2ldICsgMC41KTtcbiAgICB9KTtcbiAgICB0eXBlSW4oaGVhZCwgdCwgNy40NSwgMTIuNzUsIHsgc3RhZ2dlcjogMC4wNyB9KTtcbiAgfSxcbn0pO1xuIiwgIi8vIEQgXHUwMEI3IFwiWW91ciBjdXJyZW5jeSwgeW91ciBjYWxsLlwiIFRoZSB5ZW4gKHRoZSByZWVsJ3MgbmV4dCBpdGVtKSBzbGlkZXMgbGVmdCBhcyB0aGUgcG9wdXAgc3dpbmdzIGluO1xuLy8gYSBjdXJzb3Igb3BlbnMgdGhlIGN1cnJlbmN5IG1lbnUgYW5kIHBpY2tzIEV1cm87IHRoZSB5ZW4ncyBiYWRnZSBmbGlwcyBmcm9tIGtyb25lciB0byBldXJvcy5cbmltcG9ydCB7XG4gIGJhZGdlLCBjbGFtcCwgY3ViaWNJbk91dCwgY3Vyc29yLCBkZWZpbmVTY2VuZSwgZXhwb091dCwgbGVycCwgbWFza2VkLCBwb3BJbiwgcHJvZywgc2V0SHRtbCwgc2xpZGUsIHNwcmluZywgc3RhZ2VQb2ludCwgc3dpbmdJbiwgdGYsIHR5cGVJbixcbiAgZW5zdXJlU3R5bGUsIHR5cGUgQ3Vyc29ySGFuZGxlLFxufSBmcm9tIFwiQGRvbGx5L2NvcmVcIjtcbmltcG9ydCB7IFJFRUxfR0FQLCBSRUVMX1gsIFJFRUxfWTAsIFRfRCwgVF9SRUVMLCBjb252IH0gZnJvbSBcIi4uL3NoYXJlZC50c1wiO1xuXG5jb25zdCBPUFRTID0gW1tcIkRLS1wiLCBcIkRhbmlzaCBrcm9uZVwiXSwgW1wiRVVSXCIsIFwiRXVyb1wiXSwgW1wiVVNEXCIsIFwiVVMgZG9sbGFyXCJdLCBbXCJHQlBcIiwgXCJCcml0aXNoIHBvdW5kXCJdLCBbXCJTRUtcIiwgXCJTd2VkaXNoIGtyb25hXCJdLCBbXCJOT0tcIiwgXCJOb3J3ZWdpYW4ga3JvbmVcIl1dO1xuXG5jb25zdCBDU1MgPSBgXG4ucHAtcG9we3Bvc2l0aW9uOmFic29sdXRlO3dpZHRoOjQwMHB4O2JhY2tncm91bmQ6I2ZmZjtib3JkZXItcmFkaXVzOjIwcHg7Ym94LXNoYWRvdzp2YXIoLS1zLWZsb2F0KTtmb250LWZhbWlseTp2YXIoLS1mLWJvZHkpO3RyYW5zZm9ybS1vcmlnaW46MCA1MCV9XG4ucHAtcG9wIGhlYWRlcntkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxNHB4O3BhZGRpbmc6MjBweCAyMnB4O2JvcmRlci1ib3R0b206MXB4IHNvbGlkICNlY2VlZjJ9XG4ucHAtcG9wIGhlYWRlciBpe2ZvbnQ6NzAwIDE1cHgvMS43NSB2YXIoLS1mLXVpKTtmb250LXN0eWxlOm5vcm1hbDtiYWNrZ3JvdW5kOnZhcigtLWMtaW5rKTtjb2xvcjojZmZmO3BhZGRpbmc6MCAuNTVlbTtib3JkZXItcmFkaXVzOjdweCA3cHggN3B4IDFweH1cbi5wcC1wb3AgaGVhZGVyIGJ7ZGlzcGxheTpibG9jaztmb250LXNpemU6MThweDtsaW5lLWhlaWdodDoxLjc1O2hlaWdodDoxLjc1ZW07b3ZlcmZsb3c6aGlkZGVufVxuLnBwLXBvcCBoZWFkZXIgc21hbGx7ZGlzcGxheTpibG9jaztjb2xvcjp2YXIoLS1jLW11dGVkKTtmb250LXNpemU6MTRweH1cbi5wcC1wb3AgLnJ7cG9zaXRpb246cmVsYXRpdmU7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtwYWRkaW5nOjE1cHggMjJweDtib3JkZXItYm90dG9tOjFweCBzb2xpZCAjZWNlZWYyO2ZvbnQtc2l6ZToxN3B4fVxuLnBwLXBvcCAucjpsYXN0LWNoaWxke2JvcmRlci1ib3R0b206MH1cbi5wcC1wb3AgLnNlbHtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWMtbGluZSk7Ym9yZGVyLXJhZGl1czo5cHg7cGFkZGluZzoycHggMTJweDtmb250LXNpemU6MTZweDtmb250LXdlaWdodDo2MDA7YmFja2dyb3VuZDojZmZmO2xpbmUtaGVpZ2h0OjEuNzV9XG4ucHAtcG9wIC5zZWwub3Blbntib3JkZXItY29sb3I6dmFyKC0tYy1hY2NlbnQpO2JveC1zaGFkb3c6MCAwIDAgNHB4IHJnYmEoNTEsODUsMjU1LC4xNSl9XG4ucHAtbWVudXtwb3NpdGlvbjphYnNvbHV0ZTtyaWdodDoyMnB4O3RvcDo1NHB4O3dpZHRoOjIzNnB4O2JhY2tncm91bmQ6I2ZmZjtib3JkZXItcmFkaXVzOjEycHg7cGFkZGluZzo2cHg7ei1pbmRleDoyO3RyYW5zZm9ybS1vcmlnaW46NzAlIDA7Ym94LXNoYWRvdzowIDI0cHggNDhweCAtMjBweCByZ2JhKDIwLDI0LDQwLC40KSwwIDAgMCAxcHggcmdiYSgyMCwyNCw0MCwuMDgpfVxuLnBwLW1lbnUgLm9wdHtwb3NpdGlvbjpyZWxhdGl2ZTtwYWRkaW5nOjhweCAxMHB4O2JvcmRlci1yYWRpdXM6OHB4O2ZvbnQtc2l6ZToxNXB4O2ZvbnQtd2VpZ2h0OjUwMDt6LWluZGV4OjF9XG4ucHAtbWVudSAub3B0IGJ7ZGlzcGxheTppbmxpbmUtYmxvY2s7d2lkdGg6NDJweDtmb250LXdlaWdodDo3MDB9XG4ucHAtbWVudSAub3B0Lmhpe2NvbG9yOiNmZmZ9XG4ucHAtbWVudSAucGlsbHtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjZweDtyaWdodDo2cHg7aGVpZ2h0OjM2cHg7Ym9yZGVyLXJhZGl1czo4cHg7YmFja2dyb3VuZDp2YXIoLS1jLWFjY2VudCl9XG4ucHAtdGd7d2lkdGg6NDRweDtoZWlnaHQ6MjZweDtib3JkZXItcmFkaXVzOjEzcHg7YmFja2dyb3VuZDp2YXIoLS1jLWluayk7cG9zaXRpb246cmVsYXRpdmV9XG4ucHAtdGc6OmFmdGVye2NvbnRlbnQ6XCJcIjtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6NHB4O3JpZ2h0OjRweDt3aWR0aDoxOHB4O2hlaWdodDoxOHB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6I2ZmZn1cbi5wcC10Zy5vZmZ7YmFja2dyb3VuZDojZDVkOGRlfS5wcC10Zy5vZmY6OmFmdGVye3JpZ2h0OmF1dG87bGVmdDo0cHh9YDtcblxubGV0IGhlYWQ6IEhUTUxFbGVtZW50W10sIHllbkNoYXJzOiBIVE1MRWxlbWVudFtdO1xubGV0IHllbjogSFRNTEVsZW1lbnQsIHllbkI6IEhUTUxFbGVtZW50LCBwb3BXcmFwOiBIVE1MRWxlbWVudCwgc2VsOiBIVE1MRWxlbWVudCwgcmF0ZUxpbmU6IEhUTUxFbGVtZW50LCBtZW51OiBIVE1MRWxlbWVudCwgcGlsbDogSFRNTEVsZW1lbnQ7XG5sZXQgb3B0czogSFRNTEVsZW1lbnRbXTtcbmxldCBjdXI6IEN1cnNvckhhbmRsZTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lU2NlbmUuZnJvbShcInNjZW5lcy9jb250cm9sLnRzXCIsIHtcbiAgbmFtZTogXCJjb250cm9sXCIsXG4gIHN0YXJ0OiAxMi45LFxuICBlbmQ6IDE5LjgsXG4gIG1hcmtlcnM6IHsgXCJwb3AtaW5cIjogMC42NSwgcGljazogMy40IH0sXG4gIHNldHVwKGN0eCkge1xuICAgIGVuc3VyZVN0eWxlKFwicHAtY29udHJvbFwiLCBDU1MpO1xuICAgIGNvbnN0IGhEID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImgyXCIpOyBoRC5jbGFzc05hbWUgPSBcInBwLWhcIjsgaEQuc3R5bGUuY3NzVGV4dCA9IFwibGVmdDo4MHB4O3RvcDo5NnB4O3dpZHRoOjYyMHB4XCI7XG4gICAgY3R4Lmh1ZC5hcHBlbmQoaEQpO1xuICAgIGhlYWQgPSBtYXNrZWQoaEQsIFwiWW91ciBjdXJyZW5jeSwgeW91ciBjYWxsLlwiKTtcblxuICAgIHllbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7IHllbi5jbGFzc05hbWUgPSBcInBwLXllblwiO1xuICAgIGNvbnN0IHcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTsgdy5jbGFzc05hbWUgPSBcIndcIjtcbiAgICB5ZW5CID0gYmFkZ2UoXCJcIik7IHcuYXBwZW5kKHllbkIpOyB5ZW4uYXBwZW5kKHcpO1xuICAgIGN0eC53b3JsZC5hcHBlbmQoeWVuKTtcbiAgICB5ZW5DaGFycyA9IG1hc2tlZCh3LCBcIlx1MDBBNTQyLDgwMFwiLCB7IGNoYXJzOiB0cnVlIH0pO1xuXG4gICAgcG9wV3JhcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7IHBvcFdyYXAuY2xhc3NOYW1lID0gXCJwcC1hYnNcIjsgcG9wV3JhcC5zdHlsZS5jc3NUZXh0ID0gXCJsZWZ0OjIzODBweDt0b3A6ODAwcHhcIjtcbiAgICBwb3BXcmFwLmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPVwicHAtcG9wXCI+XG4gICAgICA8aGVhZGVyPjxpPmtyLjwvaT48ZGl2PjxiIGNsYXNzPVwicmF0ZVwiPjwvYj48c21hbGw+RGFpbHkgRUNCIHJhdGU8L3NtYWxsPjwvZGl2PjwvaGVhZGVyPlxuICAgICAgPGRpdiBjbGFzcz1cInJcIj5Db252ZXJ0IHRvIDxzcGFuIGNsYXNzPVwic2VsXCI+PC9zcGFuPjxkaXYgY2xhc3M9XCJwcC1tZW51XCI+PGRpdiBjbGFzcz1cInBpbGxcIj48L2Rpdj4ke09QVFMubWFwKChbYywgbl0pID0+IGA8ZGl2IGNsYXNzPVwib3B0XCI+PGI+JHtjfTwvYj4ke259PC9kaXY+YCkuam9pbihcIlwiKX08L2Rpdj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJyXCI+T24gPHNwYW4gY2xhc3M9XCJwcC10Z1wiPjwvc3Bhbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJyXCI+T24gdGhpcyBzaXRlIDxzcGFuIGNsYXNzPVwicHAtdGdcIj48L3NwYW4+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiclwiPlNob3cgYWxsIHByaWNlcyA8c3BhbiBjbGFzcz1cInBwLXRnIG9mZlwiPjwvc3Bhbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJyXCI+QXJlYSAmYW1wOyB3ZWlnaHQgPHNwYW4gY2xhc3M9XCJwcC10Z1wiPjwvc3Bhbj48L2Rpdj48L2Rpdj5gO1xuICAgIGN0eC53b3JsZC5hcHBlbmQocG9wV3JhcCk7XG4gICAgc2VsID0gcG9wV3JhcC5xdWVyeVNlbGVjdG9yKFwiLnNlbFwiKSE7IHJhdGVMaW5lID0gcG9wV3JhcC5xdWVyeVNlbGVjdG9yKFwiLnJhdGVcIikhO1xuICAgIG1lbnUgPSBwb3BXcmFwLnF1ZXJ5U2VsZWN0b3IoXCIucHAtbWVudVwiKSE7IHBpbGwgPSBwb3BXcmFwLnF1ZXJ5U2VsZWN0b3IoXCIucGlsbFwiKSE7XG4gICAgb3B0cyA9IFsuLi5wb3BXcmFwLnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiLm9wdFwiKV07XG5cbiAgICAvLyB0YXJnZXRzIGFyZSBtZWFzdXJlZCBsaXZlIGV2ZXJ5IGZyYW1lLCBzbyB0aGUgY3Vyc29yIGZvbGxvd3MgdGhlIHRpbHRpbmcgcG9wdXBcbiAgICBjb25zdCBzZWxQID0gKCkgPT4gc3RhZ2VQb2ludChzZWwsIDAuNTUsIDAuNik7XG4gICAgY29uc3QgZXVyUCA9ICgpID0+IHN0YWdlUG9pbnQob3B0c1sxXSwgMC4zNSwgMC41NSk7XG4gICAgY3VyID0gY3Vyc29yKGN0eC5zY3JlZW4oMzAsIFwiY3Vyc29yXCIpLCB7XG4gICAgICBwYXRoOiBbXG4gICAgICAgIHsgdDogVF9ELmN1cnNvckluLCBhdDogWzEyNTAsIDY5MF0gfSwgeyB0OiBUX0QuYXRTZWwsIGF0OiBzZWxQIH0sIHsgdDogVF9ELmdsaWRlIC0gMC4xLCBhdDogc2VsUCB9LFxuICAgICAgICB7IHQ6IFRfRC5nbGlkZSArIDAuMywgYXQ6IGV1clAgfSwgeyB0OiBUX0QuY3Vyc29yT3V0LCBhdDogZXVyUCB9LFxuICAgICAgICB7IHQ6IDE4LjQsIGF0OiAoKSA9PiB7IGNvbnN0IFt4LCB5XSA9IGV1clAoKTsgcmV0dXJuIFt4ICsgMTUwLCB5ICsgMjEwXTsgfSB9LFxuICAgICAgXSxcbiAgICAgIGNsaWNrczogW1RfRC5vcGVuLCBUX0QucGlja10sIGZyb206IFRfRC5jdXJzb3JJbiwgdG86IDE4LjUsXG4gICAgfSk7XG4gIH0sXG4gIHJlbmRlcih7IHQgfSwgY3R4KSB7XG4gICAgY29uc3QgY3kgPSBjdHguY2FtZXJhKHQpLnk7XG4gICAgLy8gdGhlIHllbiBpcyB0aGUgcmVlbCdzIG5leHQgaXRlbTsgaXQgc2xpZGVzIGxlZnQgYXMgdGhlIHBvcHVwIHN3aW5ncyBpblxuICAgIHtcbiAgICAgIGNvbnN0IGFycml2ZSA9IFRfUkVFTFszXSwgc2wgPSBleHBvT3V0KHByb2codCwgMTMuNTUsIDEuMCkpO1xuICAgICAgY29uc3QgZCA9IChSRUVMX1kwICsgMyAqIFJFRUxfR0FQIC0gKGN5IC0gMzApKSAvIFJFRUxfR0FQLCBrID0gTWF0aC5taW4oTWF0aC5hYnMoZCksIDEuNik7XG4gICAgICB5ZW4uc3R5bGUubGVmdCA9IGxlcnAoUkVFTF9YLCAxNjkwLCBzbCkgKyBcInB4XCI7XG4gICAgICB5ZW4uc3R5bGUudG9wID0gbGVycChSRUVMX1kwICsgMyAqIFJFRUxfR0FQIC0gNzAsIDExNTAgLSA2MCwgc2wpICsgXCJweFwiO1xuICAgICAgdGYoeWVuLCBgc2NhbGUoJHsoMSAtIDAuMTQgKiBrKSAqIGxlcnAoMSwgMC45LCBzbCl9KWAsIHQgPCBhcnJpdmUgLSAwLjMgPyAwIDogMSAtIDAuNiAqIE1hdGgubWluKGssIDEuMikpO1xuICAgICAgdHlwZUluKHllbkNoYXJzLCB0LCBhcnJpdmUgLSAwLjI1LCBJbmZpbml0eSwgeyBzdGFnZ2VyOiAwLjAzNSwgZHVyOiAwLjcgfSk7XG4gICAgfVxuICAgIHR5cGVJbihoZWFkLCB0LCAxMy44LCBJbmZpbml0eSwgeyBzdGFnZ2VyOiAwLjA2IH0pO1xuICAgIHN3aW5nSW4ocG9wV3JhcCwgdCwgVF9ELnBvcEluKTtcblxuICAgIGNvbnN0IHBrID0gcHJvZyh0LCBUX0QucGljaywgMC41NSk7XG4gICAgc2V0SHRtbChzZWwsIHQgPCBUX0QucGljayA/IFwiREtLIFx1MDBCNyBEYW5pc2gga3JvbmUgXHUyNUJFXCIgOiBzbGlkZShcIkRLSyBcdTAwQjcgRGFuaXNoIGtyb25lIFx1MjVCRVwiLCBcIkVVUiBcdTAwQjcgRXVybyBcdTI1QkVcIiwgcGspKTtcbiAgICBjb25zdCByMCA9IGAxLjAwMCBcdTIwQTkgPSAke2NvbnYoMTAwMCwgXCJLUldcIil9YCwgcjEgPSBgMS4wMDAgXHUyMEE5ID0gJHtjb252KDEwMDAsIFwiS1JXXCIsIFwiRVVSXCIpfWA7XG4gICAgc2V0SHRtbChyYXRlTGluZSwgdCA8IFRfRC5waWNrID8gcjAgOiBzbGlkZShyMCwgcjEsIHBrKSk7XG5cbiAgICAvLyB0aGUgeWVuIGJhZGdlIGxhbmRzIGFzIERLSywgdGhlbiBmbGlwcyBvdmVyIHRvIEVVUiB3aGVuIHRoZSB1c2VyIHBpY2tzIGl0XG4gICAge1xuICAgICAgY29uc3QgdDAgPSBUX1JFRUxbM10gKyAwLjU7XG4gICAgICBpZiAodCA8IFRfRC5waWNrICsgMC4wNSkgeyB5ZW5CLnRleHRDb250ZW50ID0gY29udig0MjgwMCwgXCJKUFlcIik7IHBvcEluKHllbkIsIHQsIHQwKTsgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnN0IGYgPSAodCAtIFRfRC5waWNrIC0gMC4wNSkgLyAwLjUsIGhhbGYgPSBmIDwgMC41O1xuICAgICAgICB5ZW5CLnRleHRDb250ZW50ID0gaGFsZiA/IGNvbnYoNDI4MDAsIFwiSlBZXCIpIDogY29udig0MjgwMCwgXCJKUFlcIiwgXCJFVVJcIik7XG4gICAgICAgIGNvbnN0IGFuZyA9IGhhbGYgPyBmICogMiAqIDkwIDogbGVycCgtOTAsIDAsIHNwcmluZygoZiAtIDAuNSkgKiAwLjUsIHsgZnJlcTogMi4yLCB6ZXRhOiAwLjQ1IH0pKTtcbiAgICAgICAgdGYoeWVuQiwgYHBlcnNwZWN0aXZlKDUwMHB4KSByb3RhdGVYKCR7YW5nfWRlZylgLCAxKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gdGhlIG1lbnUgc3ByaW5ncyBvcGVuOyB0aGUgaGlnaGxpZ2h0IGlzIGEgcGlsbCB0aGF0IGdsaWRlcyBiZXR3ZWVuIHJvd3NcbiAgICBzZWwuY2xhc3NMaXN0LnRvZ2dsZShcIm9wZW5cIiwgdCA+PSBUX0Qub3BlbiAmJiB0IDwgVF9ELnBpY2sgKyAwLjE1KTtcbiAgICBpZiAodCA+PSBUX0Qub3BlbiAmJiB0IDwgVF9ELnBpY2sgKyAwLjMpIHtcbiAgICAgIGNvbnN0IHBpbiA9IHNwcmluZyh0IC0gVF9ELm9wZW4sIHsgZnJlcTogMi40LCB6ZXRhOiAwLjcgfSksIHBvdXQgPSBjdWJpY0luT3V0KHByb2codCwgVF9ELnBpY2sgKyAwLjA4LCAwLjIpKTtcbiAgICAgIHRmKG1lbnUsIGB0cmFuc2xhdGVZKCR7KDEgLSBwaW4pICogLTEwfXB4KSBzY2FsZSgke2xlcnAoMC45MiwgMSwgcGluKSAtIHBvdXQgKiAwLjA0fSlgLCBjbGFtcCgodCAtIFRfRC5vcGVuKSAqIDgpICogKDEgLSBwb3V0KSk7XG4gICAgICBvcHRzLmZvckVhY2goKG8sIGkpID0+IHsgY29uc3QgcSA9IGV4cG9PdXQocHJvZyh0LCBUX0Qub3BlbiArIDAuMDQgKyBpICogMC4wMzUsIDAuNCkpOyBvLnN0eWxlLnRyYW5zZm9ybSA9IGB0cmFuc2xhdGVZKCR7KDEgLSBxKSAqIC04fXB4KWA7IG8uc3R5bGUub3BhY2l0eSA9IFN0cmluZyhxKTsgfSk7XG4gICAgICBjb25zdCBncCA9IHNwcmluZyh0IC0gVF9ELmdsaWRlLCB7IGZyZXE6IDIuNiwgemV0YTogMC43NSB9KTtcbiAgICAgIGNvbnN0IHRvcCA9IGxlcnAob3B0c1swXS5vZmZzZXRUb3AsIG9wdHNbMV0ub2Zmc2V0VG9wLCBncCk7XG4gICAgICBwaWxsLnN0eWxlLnRvcCA9IHRvcCArIFwicHhcIjtcbiAgICAgIG9wdHMuZm9yRWFjaChvID0+IG8uY2xhc3NMaXN0LnRvZ2dsZShcImhpXCIsIE1hdGguYWJzKG8ub2Zmc2V0VG9wIC0gdG9wKSA8IDE4KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGhpZGRlbiBpbiBpdHMgY2xvc2VkIHBvc2UsIHNvIHRoZSBjdXJzb3IncyBsaXZlIHRhcmdldCBkb2Vzbid0IGp1bXAgd2hlbiB0aGUgbWVudSBnb2VzIGF3YXlcbiAgICAgIHRmKG1lbnUsIHQgPCBUX0Qub3BlbiA/IFwidHJhbnNsYXRlWSgtMTBweCkgc2NhbGUoMC45MilcIiA6IFwidHJhbnNsYXRlWSgwcHgpIHNjYWxlKDAuOTYpXCIsIDApO1xuICAgICAgb3B0cy5mb3JFYWNoKG8gPT4geyBvLnN0eWxlLnRyYW5zZm9ybSA9IFwibm9uZVwiOyBvLnN0eWxlLm9wYWNpdHkgPSBcIjFcIjsgfSk7XG4gICAgfVxuICAgIGN1ci5yZW5kZXIodCk7XG4gIH0sXG59KTtcbiIsICIvLyBFIFx1MDBCNyBcIkV2ZW4gdGhlIG51bWJlcnMgeW91IHR5cGUuXCIgUmVhY2hlZCBieSBkb2xseWluZyB0aHJvdWdoIEQ7IHR5cGluZyBpbnRvIGEgcHJpY2UgZmlsdGVyIHVwZGF0ZXMgdGhlXG4vLyBiYWRnZSBwZXIga2V5c3Ryb2tlIChvZG9tZXRlciByb2xsKS4gRW5kcyBieSBkaXZpbmcgaW50byB0aGUgbGFzdCBiYWRnZSB1bnRpbCBpdHMgZGFyayBmaWxsIGlzIHRoZVxuLy8gc2NyZWVuLCB3aGljaCBiZWNvbWVzIHRoZSBlbmQgY2FyZCdzIGJhY2tncm91bmQuXG5pbXBvcnQgeyBiYWRnZSwgY2xhbXAsIGN1YmljSW5PdXQsIGRlZmluZVNjZW5lLCBlbnN1cmVTdHlsZSwgbGVycCwgbWFza2VkLCBwb3BJbiwgcHJvZywgcm9sbCwgc2luZUluT3V0LCB0ZiwgdHlwZUluLCB0eXBpbmcsIHpvb21JbnRvLCBzZXRIdG1sIH0gZnJvbSBcIkBkb2xseS9jb3JlXCI7XG5pbXBvcnQgeyBUX0UsIGNvbnYgfSBmcm9tIFwiLi4vc2hhcmVkLnRzXCI7XG5cbmNvbnN0IFRZUEUxID0geyB0MDogMjAuNDUsIGdhcDogMC4yLCB0ZXh0OiBcIjUwMDAwMFwiLCBjdXI6IFwiS1JXXCIsIGZvY3VzOiAyMC4xIH07XG5jb25zdCBUWVBFMiA9IHsgdDA6IDIyLjMsIGdhcDogMC4yMiwgdGV4dDogXCIxMjAwXCIsIGN1cjogXCJVU0RcIiwgZm9jdXM6IDIxLjk1IH07XG5cbmNvbnN0IENTUyA9IGBcbi5wcC1sZXtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjA7dG9wOjA7d2lkdGg6MTI4MHB4O2hlaWdodDo3MjBweH1cbi5wcC1mb3Jte3Bvc2l0aW9uOmFic29sdXRlO2JhY2tncm91bmQ6I2ZmZjtib3JkZXItcmFkaXVzOjIycHg7cGFkZGluZzozNHB4IDM4cHggNDBweDtib3gtc2hhZG93OnZhcigtLXMtZmxvYXQpO3RyYW5zZm9ybS1vcmlnaW46MCA1MCV9XG4ucHAtZm9ybSAubGFie2ZvbnQ6NjAwIDE2cHggdmFyKC0tZi1wcmljZSk7bGV0dGVyLXNwYWNpbmc6LjA4ZW07dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2NvbG9yOnZhcigtLWMtbXV0ZWQpfVxuLnBwLWZvcm0gLmxpbmV7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MThweDttYXJnaW4tdG9wOjE2cHg7Zm9udDo2MDAgMjhweCB2YXIoLS1mLXByaWNlKTtjb2xvcjojNWI2MTcwfVxuLnBwLWlucHtwb3NpdGlvbjpyZWxhdGl2ZTt3aWR0aDozMzBweDtoZWlnaHQ6NzhweDtib3JkZXItcmFkaXVzOjE0cHg7Ym9yZGVyOjJweCBzb2xpZCB2YXIoLS1jLWxpbmUpO2ZvbnQ6NjAwIDM2cHgvNzRweCB2YXIoLS1mLXByaWNlKTtjb2xvcjp2YXIoLS1jLWZnKTtwYWRkaW5nOjAgMjBweDt3aGl0ZS1zcGFjZTpub3dyYXB9XG4ucHAtaW5wLmZvY3Vze2JvcmRlci1jb2xvcjp2YXIoLS1jLWFjY2VudCk7Ym94LXNoYWRvdzowIDAgMCA1cHggcmdiYSg1MSw4NSwyNTUsLjE1KX1cbi5wcC1pbnAgLnByZXtjb2xvcjojOWFhMGFkO21hcmdpbi1yaWdodDo2cHh9XG4ucHAtaW5wIC5kb2xseS1jYXJldHtoZWlnaHQ6MzhweDt2ZXJ0aWNhbC1hbGlnbjotNnB4fVxuLnBwLWlucCAuZG9sbHktYmFkZ2V7dG9wOi0zNHB4O3JpZ2h0Oi0yNHB4O2ZvbnQtc2l6ZToyNHB4fWA7XG5cbmxldCBsRTogSFRNTEVsZW1lbnQsIGZvcm06IEhUTUxFbGVtZW50LCBoZWFkOiBIVE1MRWxlbWVudFtdO1xuY29uc3QgaW5wdXRzOiBBcnJheTx7IGVsOiBIVE1MRWxlbWVudDsgdGV4dDogSFRNTEVsZW1lbnQ7IGJhZGdlOiBIVE1MRWxlbWVudDsgazogdHlwZW9mIFRZUEUxIH0+ID0gW107XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZVNjZW5lLmZyb20oXCJzY2VuZXMvdHlwaW5nLnRzXCIsIHtcbiAgbmFtZTogXCJ0eXBpbmdcIixcbiAgc3RhcnQ6IDE5LjAsXG4gIGVuZDogMjUuNCxcbiAgc2V0dXAoY3R4KSB7XG4gICAgZW5zdXJlU3R5bGUoXCJwcC10eXBpbmdcIiwgQ1NTKTtcbiAgICBsRSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7IGxFLmNsYXNzTmFtZSA9IFwicHAtbGVcIjtcbiAgICBjdHguc2NyZWVuKDQwLCBcInR5cGluZ1wiKS5hcHBlbmQobEUpO1xuICAgIGNvbnN0IGhFID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImgyXCIpOyBoRS5jbGFzc05hbWUgPSBcInBwLWhcIjsgaEUuc3R5bGUuY3NzVGV4dCA9IFwibGVmdDo4MHB4O3RvcDoxNzBweDt3aWR0aDo1MDBweFwiO1xuICAgIGZvcm0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpOyBmb3JtLmNsYXNzTmFtZSA9IFwicHAtZm9ybVwiOyBmb3JtLnN0eWxlLmNzc1RleHQgPSBcImxlZnQ6NjQwcHg7dG9wOjE1MHB4O3dpZHRoOjU4MHB4XCI7XG4gICAgZm9ybS5pbm5lckhUTUwgPSBgPGRpdiBjbGFzcz1cImxhYlwiPlByaWNlIHJhbmdlIFx1MDBCNyBtaW48L2Rpdj48ZGl2IGNsYXNzPVwibGluZVwiPjxkaXYgY2xhc3M9XCJwcC1pbnBcIj48L2Rpdj5cdUM2RDA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJsYWJcIiBzdHlsZT1cIm1hcmdpbi10b3A6NDZweFwiPkJ1ZGdldDwvZGl2PjxkaXYgY2xhc3M9XCJsaW5lXCI+PGRpdiBjbGFzcz1cInBwLWlucFwiPjwvZGl2PjwvZGl2PmA7XG4gICAgbEUuYXBwZW5kKGhFLCBmb3JtKTtcbiAgICBoZWFkID0gbWFza2VkKGhFLCBcIkV2ZW4gdGhlIG51bWJlcnMgeW91IHx0eXBlLnxcIik7XG4gICAgZm9ybS5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIi5wcC1pbnBcIikuZm9yRWFjaCgoZWwsIGkpID0+IHtcbiAgICAgIGNvbnN0IGsgPSBpID09PSAwID8gVFlQRTEgOiBUWVBFMjtcbiAgICAgIGlmIChrLmN1ciA9PT0gXCJVU0RcIikgeyBjb25zdCBwcmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTsgcHJlLmNsYXNzTmFtZSA9IFwicHJlXCI7IHByZS50ZXh0Q29udGVudCA9IFwiJFwiOyBlbC5hcHBlbmQocHJlKTsgfVxuICAgICAgY29uc3QgdGV4dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpOyBlbC5hcHBlbmQodGV4dCk7XG4gICAgICBjb25zdCBiID0gYmFkZ2UoXCJcIik7IGVsLmFwcGVuZChiKTtcbiAgICAgIGlucHV0cy5wdXNoKHsgZWwsIHRleHQsIGJhZGdlOiBiLCBrIH0pO1xuICAgIH0pO1xuICB9LFxuICByZW5kZXIoeyB0IH0pIHtcbiAgICB0eXBlSW4oaGVhZCwgdCwgMTkuNTUsIEluZmluaXR5LCB7IHN0YWdnZXI6IDAuMDYgfSk7XG4gICAgLy8gaW5wdXRzIGFyZSBmaWxsZWQgYmVmb3JlIHRoZSBsYXllcidzIHRyYW5zZm9ybSBzbyB0aGUgem9vbSBjYW4gbWVhc3VyZSB0aGUgZmluYWwgYmFkZ2VcbiAgICBmb3IgKGNvbnN0IHsgZWwsIHRleHQsIGJhZGdlOiBiLCBrIH0gb2YgaW5wdXRzKSB7XG4gICAgICBjb25zdCBmb2N1c2VkID0gayA9PT0gVFlQRTEgPyB0ID49IGsuZm9jdXMgJiYgdCA8IFRZUEUyLmZvY3VzIDogdCA+PSBrLmZvY3VzO1xuICAgICAgZWwuY2xhc3NMaXN0LnRvZ2dsZShcImZvY3VzXCIsIGZvY3VzZWQpO1xuICAgICAgY29uc3Qgc3QgPSB0eXBpbmcodCwgeyB0MDogay50MCwgZ2FwOiBrLmdhcCwgdGV4dDogay50ZXh0LCBmb2N1c2VkLCBmb3JtYXQ6IGsuY3VyID09PSBcIlVTRFwiID8gcyA9PiBzLnJlcGxhY2UoL1xcQig/PShcXGR7M30pKyg/IVxcZCkpL2csIFwiLFwiKSA6IHVuZGVmaW5lZCB9KTtcbiAgICAgIHNldEh0bWwodGV4dCwgc3QuaHRtbCk7XG4gICAgICBpZiAoIXN0Lm4pIHsgdGYoYiwgXCJzY2FsZSgwKVwiLCAwKTsgY29udGludWU7IH1cbiAgICAgIGNvbnN0IG5vdyA9IGNvbnYoK3N0LnR5cGVkLCBrLmN1cik7XG4gICAgICBzZXRIdG1sKGIsIHN0Lm4gPiAxID8gcm9sbChjb252KCtrLnRleHQuc2xpY2UoMCwgc3QubiAtIDEpLCBrLmN1ciksIG5vdywgcHJvZyh0LCBzdC5sYXN0LCAwLjMpKSA6IG5vdyk7XG4gICAgICBpZiAoc3QubiA9PT0gMSkgcG9wSW4oYiwgdCwgay50MCwgeyBmcmVxOiAyLjMgfSk7XG4gICAgICBlbHNlIHsgY29uc3QgcSA9IHByb2codCwgc3QubGFzdCwgMC4zKTsgdGYoYiwgYHNjYWxlKCR7MSArIDAuMSAqIE1hdGguc2luKHEgKiBNYXRoLlBJKSAqICgxIC0gcSl9KWAsIDEpOyB9XG4gICAgfVxuICAgIC8vIGFycml2ZXMgZnJvbSBiZWhpbmQsIHRoZW4gdGhlIGNhbWVyYSBkaXZlcyBpbnRvIHRoZSBsYXN0IGJhZGdlIHVudGlsIGl0cyBkYXJrIGZpbGwgaXMgdGhlIHNjcmVlblxuICAgIGNvbnN0IGFyciA9IGN1YmljSW5PdXQocHJvZyh0LCBUX0UuZG9sbHkgKyAwLjEsIDAuOCkpO1xuICAgIGNvbnN0IGZ5ID0gc2luZUluT3V0KHByb2codCwgMTkuNiwgNSkpO1xuICAgIGZvcm0uc3R5bGUudHJhbnNmb3JtID0gYHBlcnNwZWN0aXZlKDE1MDBweCkgcm90YXRlWSgke2xlcnAoLTE2LCAtNSwgZnkpfWRlZykgcm90YXRlWCgke2xlcnAoNCwgMSwgZnkpfWRlZylgO1xuICAgIGxldCBjc3MgPSBgc2NhbGUoJHtsZXJwKDAuNjIsIDEsIGFycil9KWAsIG9yaWdpbiA9IFwiNjQwcHggMzYwcHhcIjtcbiAgICBjb25zdCB6ID0gem9vbUludG8obEUsIGlucHV0c1sxXS5iYWRnZSwgdCwgVF9FLnpvb20sIFRfRS56b29tRW5kLCB7IG1heFNjYWxlOiA2MCB9KTtcbiAgICBpZiAoei56ID4gMCkgeyBjc3MgPSB6LmNzczsgb3JpZ2luID0gei5vcmlnaW47IH1cbiAgICBsRS5zdHlsZS50cmFuc2Zvcm1PcmlnaW4gPSBvcmlnaW47XG4gICAgdGYobEUsIGNzcywgdCA8IFRfRS5kb2xseSArIDAuMSB8fCB0ID49IFRfRS56b29tRW5kID8gMCA6IGNsYW1wKGFyciAqIDEuNSkpO1xuICB9LFxufSk7XG4iLCAiLy8gRiBcdTAwQjcgRW5kIGNhcmQgb24gdGhlIGJhZGdlJ3MgZGFyayBmaWxsOiBsb2dvLCBuYW1lLCB0YWdsaW5lLCBhbmQgcHJpY2UgYmFkZ2VzIGZsb2F0aW5nIGluIHRocmVlIGRlcHRoXG4vLyBwbGFuZXMgd2l0aCBkZXB0aCBvZiBmaWVsZC5cbmltcG9ydCB7IGJhZGdlLCBjbGFtcCwgZGVmaW5lU2NlbmUsIGVuZENhcmQsIGVuc3VyZVN0eWxlLCBzcHJpbmcsIHRmIH0gZnJvbSBcIkBkb2xseS9jb3JlXCI7XG5pbXBvcnQgeyBUX0UsIFRfRiB9IGZyb20gXCIuLi9zaGFyZWQudHNcIjtcblxuLy8gW3RleHQsIHgsIHksIGRlcHRoIDAgZmFyIFx1MjAyNiAyIG5lYXJdXG5jb25zdCBGTE9BVFM6IEFycmF5PFtzdHJpbmcsIG51bWJlciwgbnVtYmVyLCBudW1iZXJdPiA9IFtbXCI3LjQ4MCBrci5cIiwgMTUwLCAxMjAsIDFdLCBbXCJcdTIwQUMyNDFcIiwgMTA1MCwgOTYsIDBdLCBbXCIxLjY1NCBrci5cIiwgMTA0MCwgNTkwLCAyXSwgW1wiJDI3MVwiLCAxOTAsIDU4MCwgMF0sXG4gIFtcIjEsNyBtaW8uIGtyLlwiLCA5NjAsIDI1MCwgMF0sIFtcIjE0OSBrci5cIiwgMTIwLCAzNDAsIDJdLCBbXCJcdTAwQTMyMDNcIiwgMTEzMCwgNDIwLCAxXSwgW1wiMS4yNjEga3IuXCIsIDMzMCwgNjQwLCAxXV07XG5cbmxldCBjYXJkOiBSZXR1cm5UeXBlPHR5cGVvZiBlbmRDYXJkPjtcbmNvbnN0IGZsb2F0czogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVTY2VuZS5mcm9tKFwic2NlbmVzL2VuZC50c1wiLCB7XG4gIG5hbWU6IFwiZW5kXCIsXG4gIHN0YXJ0OiAyNS4zMyxcbiAgZW5kOiAzMCxcbiAgc2V0dXAoY3R4KSB7XG4gICAgZW5zdXJlU3R5bGUoXCJwcC1lbmRcIiwgYC5kb2xseS1lbmQgLmRvbGx5LWJhZGdle2JhY2tncm91bmQ6IzI2MmEzMztjb2xvcjojYzljZGQ2O2JveC1zaGFkb3c6bm9uZTt0cmFuc2Zvcm0tb3JpZ2luOjUwJSA1MCV9YCk7XG4gICAgY2FyZCA9IGVuZENhcmQoY3R4LnNjcmVlbig2MCwgXCJlbmRcIiksIHsgbG9nbzogXCJrci5cIiwgbmFtZTogXCJQcmljZSBQZWVrXCIsIHRhZ2xpbmU6IFwiQW55IHByaWNlLCBpbiB8eW91cnwgY3VycmVuY3kuXCIsIGF0OiBUX0YsIHB1c2hGcm9tOiBUX0Uuem9vbUVuZCwgcHVzaER1cjogNC42NSB9KTtcbiAgICBmb3IgKGNvbnN0IFtzLCB4LCB5XSBvZiBGTE9BVFMpIHtcbiAgICAgIGNvbnN0IGIgPSBiYWRnZShzKTsgYi5zdHlsZS5sZWZ0ID0geCArIFwicHhcIjsgYi5zdHlsZS50b3AgPSB5ICsgXCJweFwiO1xuICAgICAgY2FyZC5lbC5pbnNlcnRCZWZvcmUoYiwgY2FyZC5lbC5maXJzdENoaWxkKTtcbiAgICAgIGZsb2F0cy5wdXNoKGIpO1xuICAgIH1cbiAgfSxcbiAgcmVuZGVyKHsgdCB9KSB7XG4gICAgY2FyZC5yZW5kZXIodCk7XG4gICAgRkxPQVRTLmZvckVhY2goKFssIHgsIHksIGRlcHRoXSwgaSkgPT4ge1xuICAgICAgY29uc3QgdDAgPSBUX0YudGFnICsgMC4xICsgaSAqIDAuMDksIHMgPSBzcHJpbmcodCAtIHQwLCB7IGZyZXE6IDEuMywgemV0YTogMC42IH0pO1xuICAgICAgY29uc3QgcGFyID0gWzAuNCwgMC44LCAxLjVdW2RlcHRoXSwgc2MgPSBbMC44LCAxLCAxLjU1XVtkZXB0aF07XG4gICAgICBjb25zdCBkeCA9ICh4IC0gNjQwKSAqICgxIC0gcykgKiAtMC40LCBkeSA9ICh5IC0gMzYwKSAqICgxIC0gcykgKiAtMC40O1xuICAgICAgY29uc3QgZHJpZnQgPSAodCAtIFRfRS56b29tRW5kKSAqIC0xNCAqIHBhcjtcbiAgICAgIGNvbnN0IGVsID0gZmxvYXRzW2ldO1xuICAgICAgZWwuc3R5bGUuZmlsdGVyID0gZGVwdGggPT09IDIgPyBcImJsdXIoM3B4KVwiIDogZGVwdGggPT09IDAgPyBcImJsdXIoMXB4KVwiIDogXCJub25lXCI7XG4gICAgICB0ZihlbCwgYHRyYW5zbGF0ZSgke2R4ICsgZHJpZnR9cHgsJHtkeSArIE1hdGguc2luKHQgKiAwLjggKyBpKSAqIDYgKiBwYXJ9cHgpIHNjYWxlKCR7c2MgKiBNYXRoLm1heCgwLCBzKX0pYCwgY2xhbXAoKHQgLSB0MCkgKiA0KSAqIFswLjQ1LCAwLjgsIDAuNTVdW2RlcHRoXSk7XG4gICAgfSk7XG4gIH0sXG59KTtcbiIsICIvLyBQcmljZSBQZWVrIHByb21vLCAzMCBzLiBPbmUgY29udGludW91cyB3b3JsZCBmaWxtZWQgYnkgYSB2aXJ0dWFsIGNhbWVyYTogbm8gc2xpZGUgY3V0cywgZXZlcnlcbi8vIHRyYW5zaXRpb24gaXMgYSBjYW1lcmEgbW92ZSAocHVsbC1iYWNrLCB3aGlwLXBhbiwgcmVlbCBzY3JvbGwsIGRvbGx5LXRocm91Z2gsIHpvb20gaW50byBhIGJhZGdlKS5cbi8vIFRpbWluZyBzaXRzIG9uIGEgMTIwIEJQTSBncmlkIChvbmUgYmVhdCA9IDAuNSBzKSBmb3IgYSBtdXNpYyBiZWQuXG5pbXBvcnQgeyBjYW1lcmEsIGN1YmljSW5PdXQsIGRlZmluZVZpZGVvLCBleHBvT3V0LCBwYXJhbGxheEdyaWQsIHByb2csIHF1YXJ0SW5PdXQsIHNpbmVJbk91dCwgdGYgfSBmcm9tIFwiQGRvbGx5L2NvcmVcIjtcbmltcG9ydCB7IHRoZW1lIH0gZnJvbSBcIi4vdGhlbWUudHNcIjtcbmltcG9ydCB7IFJFRUxfR0FQLCBUX0UsIHNoYXJlZFN0eWxlcyB9IGZyb20gXCIuL3NoYXJlZC50c1wiO1xuaW1wb3J0IHByaWNlcyBmcm9tIFwiLi9zY2VuZXMvcHJpY2VzLnRzXCI7XG5pbXBvcnQgcmVlbCBmcm9tIFwiLi9zY2VuZXMvcmVlbC50c1wiO1xuaW1wb3J0IGNvbnRyb2wgZnJvbSBcIi4vc2NlbmVzL2NvbnRyb2wudHNcIjtcbmltcG9ydCB0eXBpbmcgZnJvbSBcIi4vc2NlbmVzL3R5cGluZy50c1wiO1xuaW1wb3J0IGVuZCBmcm9tIFwiLi9zY2VuZXMvZW5kLnRzXCI7XG5cbmNvbnN0IHN0YWdlID0geyB3aWR0aDogMTI4MCwgaGVpZ2h0OiA3MjAgfTtcblxuLy8gd29ybGQgcG9pbnQgKHgsIHkpIHNpdHMgYXQgdGhlIHNjcmVlbiBjZW50cmUsIHpvb21lZCBieSBgem9vbWBcbmNvbnN0IGNhbSA9IGNhbWVyYSh7XG4gIHg6IFtbMCwgNzk1XSwgWzAuOTUsIDc5NV0sIFsyLjQ1LCA2NDAsIHF1YXJ0SW5PdXRdLCBbNi43LCA2NTAsIHNpbmVJbk91dF0sIFs3LjMsIDIyNDAsIHF1YXJ0SW5PdXRdXSxcbiAgeTogW1swLCAxMTJdLCBbMC45NSwgMTE2XSwgWzIuNDUsIDM2MCwgcXVhcnRJbk91dF0sIFs2LjcsIDM1Miwgc2luZUluT3V0XSwgWzcuMywgMzYwLCBxdWFydEluT3V0XSxcbiAgICBbOS4wLCAzNjBdLCBbOS41NSwgMzYwICsgUkVFTF9HQVAsIHF1YXJ0SW5PdXRdLCBbMTEuMCwgMzYwICsgUkVFTF9HQVBdLCBbMTEuNTUsIDM2MCArIDIgKiBSRUVMX0dBUCwgcXVhcnRJbk91dF0sXG4gICAgWzEzLjAsIDM2MCArIDIgKiBSRUVMX0dBUF0sIFsxMy42LCAzNjAgKyAzICogUkVFTF9HQVAsIHF1YXJ0SW5PdXRdLCBbMTksIDM3MCArIDMgKiBSRUVMX0dBUCwgc2luZUluT3V0XV0sXG4gIC8vIHB1bGwgYmFjayBmcm9tIHRoZSBleHRyZW1lIGNsb3NlLXVwLCB0aGVuIGEgc2xvdyBwdXNoLWluIG9uIGV2ZXJ5IGhvbGQgc28gdGhlIGZyYW1lIG5ldmVyIHNpdHMgc3RpbGxcbiAgem9vbTogW1swLCAyLjddLCBbMC45NSwgMi41NV0sIFsyLjQ1LCAxLCBxdWFydEluT3V0XSwgWzYuNywgMS4wNywgc2luZUluT3V0XSwgWzcuMCwgMS4wLCBxdWFydEluT3V0XSxcbiAgICBbMTMuMSwgMS4wNSwgc2luZUluT3V0XSwgWzEzLjYsIDEsIHF1YXJ0SW5PdXRdLCBbMTksIDEuMDYsIHNpbmVJbk91dF1dLFxufSwgc3RhZ2UpO1xuXG5sZXQgZ3JpZDogUmV0dXJuVHlwZTx0eXBlb2YgcGFyYWxsYXhHcmlkPjtcbmxldCBnbG93OiBIVE1MRWxlbWVudCwgbWFyazogSFRNTEVsZW1lbnQ7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZVZpZGVvKHtcbiAgdGl0bGU6IFwiUHJpY2UgUGVla1wiLFxuICBzdGFnZSwgZnBzOiA2MCwgZHVyYXRpb246IDMwLCBicG06IDEyMCwgdGhlbWUsIGNhbWVyYTogY2FtLFxuICB3b3JsZDoge1xuICAgIHNldHVwKGN0eCkge1xuICAgICAgc2hhcmVkU3R5bGVzKCk7XG4gICAgICBjb25zdCBiZyA9IGN0eC5zY3JlZW4oMCwgXCJiYWNrZ3JvdW5kXCIpO1xuICAgICAgZ3JpZCA9IHBhcmFsbGF4R3JpZChiZywgeyBnYXA6IDI4LCBkb3Q6IDEuMywgY29sb3I6IFwiI2QzZDhlMVwiLCBkZXB0aDogMC41IH0pO1xuICAgICAgZ2xvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICBnbG93LnN0eWxlLmNzc1RleHQgPSBcInBvc2l0aW9uOmFic29sdXRlO3dpZHRoOjkwMHB4O2hlaWdodDo5MDBweDttYXJnaW46LTQ1MHB4IDAgMCAtNDUwcHg7Ym9yZGVyLXJhZGl1czo1MCU7YmFja2dyb3VuZDpyYWRpYWwtZ3JhZGllbnQoY2xvc2VzdC1zaWRlLCByZ2JhKDI1NSwyNTUsMjU1LC44NSksIHJnYmEoMjU1LDI1NSwyNTUsMCkpXCI7XG4gICAgICBiZy5hcHBlbmQoZ2xvdyk7XG4gICAgICBtYXJrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgIG1hcmsuY2xhc3NOYW1lID0gXCJwcC1tYXJrXCI7XG4gICAgICBtYXJrLmlubmVySFRNTCA9IFwiPGk+a3IuPC9pPlByaWNlIFBlZWtcIjtcbiAgICAgIGN0eC5zY3JlZW4oNTAsIFwiYnJhbmRcIikuYXBwZW5kKG1hcmspO1xuICAgIH0sXG4gICAgcmVuZGVyKHsgdCB9LCBjdHgpIHtcbiAgICAgIGNvbnN0IGMgPSBjdHguY2FtZXJhKHQpO1xuICAgICAgLy8gRCBcdTIxOTIgRTogZG9sbHkgdGhyb3VnaCB0aGUgcG9wdXA7IHRoZSB3b3JsZCBncm93cyBhbmQgZmFkZXMgd2hpbGUgRSBhcnJpdmVzIGZyb20gYmVoaW5kXG4gICAgICBjb25zdCBkb2wgPSBjdWJpY0luT3V0KHByb2codCwgVF9FLmRvbGx5LCAwLjc1KSk7XG4gICAgICBjb25zdCB3cyA9IGMuem9vbSAqICgxICsgZG9sICogMS40KTtcbiAgICAgIGNvbnN0IHcgPSBjdHgubGF5ZXJzLndvcmxkO1xuICAgICAgdy5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlKDY0MHB4LDM2MHB4KSBzY2FsZSgke3dzfSkgdHJhbnNsYXRlKCR7LWMueH1weCwkey1jLnl9cHgpYDtcbiAgICAgIHcuc3R5bGUub3BhY2l0eSA9IFN0cmluZygxIC0gZG9sKTtcbiAgICAgIHcuc3R5bGUudmlzaWJpbGl0eSA9IGRvbCA+PSAxID8gXCJoaWRkZW5cIiA6IFwidmlzaWJsZVwiO1xuICAgICAgLy8gSFVEIGhlYWRsaW5lcyBsZWF2ZSB3aXRoIHRoZSB3b3JsZCBkdXJpbmcgdGhlIGRvbGx5XG4gICAgICBjdHgubGF5ZXJzLmh1ZC5zdHlsZS50cmFuc2Zvcm1PcmlnaW4gPSBcIjY0MHB4IDM2MHB4XCI7XG4gICAgICB0ZihjdHgubGF5ZXJzLmh1ZCwgYHNjYWxlKCR7MSArIGRvbCAqIDAuNX0pYCwgMSAtIGRvbCk7XG4gICAgICBncmlkKGMsIHN0YWdlLCAxICsgZG9sICogMS40KTtcbiAgICAgIGdsb3cuc3R5bGUubGVmdCA9IDY0MCArIE1hdGguc2luKHQgKiAwLjM1KSAqIDI2MCArIFwicHhcIjtcbiAgICAgIGdsb3cuc3R5bGUudG9wID0gMzMwICsgTWF0aC5jb3ModCAqIDAuMjcpICogMTQwICsgXCJweFwiO1xuICAgICAgdGYobWFyaywgYHRyYW5zbGF0ZVkoJHsoMSAtIGV4cG9PdXQocHJvZyh0LCAwLjYsIDAuOCkpKSAqIDIwfXB4KWAsIGV4cG9PdXQocHJvZyh0LCAwLjYsIDAuOCkpICogKDEgLSBwcm9nKHQsIFRfRS56b29tLCAwLjQpKSk7XG4gICAgfSxcbiAgfSxcbiAgc2NlbmVzOiBbcHJpY2VzLCByZWVsLCBjb250cm9sLCB0eXBpbmcsIGVuZF0sXG4gIG1hcmtlcnM6IFtcbiAgICB7IG5hbWU6IFwiaG9va1wiLCB0OiAwLCBraW5kOiBcImN1dFwiIH0sIHsgbmFtZTogXCJiYWRnZXNcIiwgdDogMy41LCBraW5kOiBcImJlYXRcIiB9LCB7IG5hbWU6IFwid2hpcFwiLCB0OiA2LjcsIGtpbmQ6IFwiY3V0XCIgfSxcbiAgICB7IG5hbWU6IFwicGljay1ldXJvXCIsIHQ6IDE2LjMsIGtpbmQ6IFwiYmVhdFwiIH0sIHsgbmFtZTogXCJkb2xseVwiLCB0OiAxOSwga2luZDogXCJjdXRcIiB9LCB7IG5hbWU6IFwiem9vbS1lbmRcIiwgdDogMjQuMTUsIGtpbmQ6IFwiY3V0XCIgfSxcbiAgXSxcbn0pO1xuIiwgImltcG9ydCB2aWRlbyBmcm9tIFwiQzovVXNlcnMvbWlra2UvRGVza3RvcC9Qcm9qZWN0cy9Qcm9tb1ZpZGVvUmVuZGVyZXIvZXhhbXBsZXMvcHJpY2UtcGVlay92aWRlby50c1wiO1xuaW1wb3J0IHsgbW91bnQgfSBmcm9tIFwiQGRvbGx5L2NvcmVcIjtcbndpbmRvdy5fX2RvbGx5TW91bnQgPSBtb3VudCh2aWRlbywgeyBhc3NldEJhc2U6IFwiL3Byb2plY3QvXCIgfSkuY2F0Y2goZSA9PiB7IHdpbmRvdy5fX2RvbGx5RXJyb3IgPSBTdHJpbmcoZSAmJiBlLnN0YWNrIHx8IGUpOyB0aHJvdyBlOyB9KTsiXSwKICAibWFwcGluZ3MiOiAiOztBQUdPLE1BQU0sUUFBUSxDQUFDLEdBQVcsSUFBSSxHQUFHLElBQUksTUFBYyxLQUFLLElBQUksR0FBRyxLQUFLLElBQUksR0FBRyxDQUFDLENBQUM7QUFFN0UsTUFBTSxPQUFPLENBQUMsR0FBVyxHQUFXLE1BQXNCLEtBQUssSUFBSSxLQUFLO0FBR3hFLE1BQU0sT0FBTyxDQUFDLEdBQVcsSUFBWSxNQUF1QixLQUFLLElBQUssS0FBSyxLQUFLLElBQUksSUFBSyxPQUFPLElBQUksTUFBTSxDQUFDO0FBZTNHLFdBQVMsS0FBSyxHQUFTLEdBQVMsR0FBUyxHQUE2QjtBQUMzRSxVQUFNLElBQUksSUFBSTtBQUNkLFdBQU8sQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLElBQUksSUFBSSxJQUFJLElBQUksRUFBRSxDQUFDLElBQUksSUFBSSxJQUFJLEVBQUUsQ0FBQyxHQUFHLElBQUksSUFBSSxFQUFFLENBQUMsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFLENBQUMsSUFBSSxJQUFJLElBQUksRUFBRSxDQUFDLENBQUM7QUFBQSxFQUN4RztBQVlPLFdBQVMsV0FBVyxHQUFTLEdBQVMsT0FBTyxNQUF3QjtBQUMxRSxXQUFPLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxPQUFPLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssSUFBSTtBQUFBLEVBQzVGO0FBTU8sV0FBUyxJQUFJLE1BQTRCO0FBQzlDLFFBQUksSUFBSSxTQUFTO0FBQ2pCLFdBQU8sTUFBTTtBQUNYLFVBQUssSUFBSSxlQUFnQjtBQUN6QixVQUFJLElBQUksS0FBSyxLQUFLLElBQUssTUFBTSxJQUFLLElBQUksQ0FBQztBQUN2QyxVQUFLLElBQUksS0FBSyxLQUFLLElBQUssTUFBTSxHQUFJLEtBQUssQ0FBQyxJQUFLO0FBQzdDLGVBQVMsSUFBSyxNQUFNLFFBQVMsS0FBSztBQUFBLElBQ3BDO0FBQUEsRUFDRjtBQUdPLFdBQVMsT0FBTyxHQUFtQjtBQUN4QyxRQUFJLElBQUk7QUFDUixhQUFTLElBQUksR0FBRyxJQUFJLEVBQUUsUUFBUSxJQUFLLEtBQUksS0FBSyxLQUFLLElBQUksRUFBRSxXQUFXLENBQUMsR0FBRyxRQUFVO0FBQ2hGLFdBQU8sTUFBTTtBQUFBLEVBQ2Y7OztBQ3ZETyxNQUFNLFNBQWlCLE9BQUs7QUFFNUIsTUFBTSxTQUFpQixPQUFLLElBQUksS0FBSyxJQUFLLElBQUksS0FBSyxLQUFNLENBQUM7QUFDMUQsTUFBTSxVQUFrQixPQUFLLEtBQUssSUFBSyxJQUFJLEtBQUssS0FBTSxDQUFDO0FBQ3ZELE1BQU0sWUFBb0IsT0FBSyxFQUFFLEtBQUssSUFBSSxLQUFLLEtBQUssQ0FBQyxJQUFJLEtBQUs7QUFFOUQsTUFBTSxTQUFpQixPQUFLLElBQUk7QUFDaEMsTUFBTSxVQUFrQixPQUFLLEtBQUssSUFBSSxNQUFNLElBQUk7QUFDaEQsTUFBTSxZQUFvQixPQUFNLElBQUksTUFBTSxJQUFJLElBQUksSUFBSSxLQUFLLEtBQUssSUFBSSxNQUFNLElBQUk7QUFFOUUsTUFBTSxVQUFrQixPQUFLLEtBQUs7QUFDbEMsTUFBTSxXQUFtQixPQUFLLEtBQUssSUFBSSxNQUFNO0FBQzdDLE1BQU0sYUFBcUIsT0FBTSxJQUFJLE1BQU0sSUFBSSxLQUFLLElBQUksS0FBSyxLQUFLLElBQUksTUFBTSxJQUFJO0FBRWhGLE1BQU0sVUFBa0IsT0FBSyxLQUFLO0FBQ2xDLE1BQU0sV0FBbUIsT0FBSyxLQUFLLElBQUksTUFBTTtBQUM3QyxNQUFNLGFBQXFCLE9BQU0sSUFBSSxNQUFNLElBQUksS0FBSyxJQUFJLEtBQUssS0FBSyxJQUFJLE1BQU0sSUFBSTtBQUVoRixNQUFNLFVBQWtCLE9BQUssS0FBSztBQUNsQyxNQUFNLFdBQW1CLE9BQUssS0FBSyxJQUFJLE1BQU07QUFDN0MsTUFBTSxhQUFxQixPQUFNLElBQUksTUFBTSxLQUFLLEtBQUssSUFBSSxLQUFLLEtBQUssSUFBSSxNQUFNLElBQUk7QUFFakYsTUFBTSxTQUFpQixPQUFNLEtBQUssSUFBSSxJQUFJLE1BQU0sS0FBSyxJQUFJO0FBQ3pELE1BQU0sVUFBa0IsT0FBTSxLQUFLLElBQUksSUFBSSxJQUFJLE1BQU0sTUFBTTtBQUMzRCxNQUFNLFlBQW9CLE9BQy9CLEtBQUssSUFBSSxJQUFJLEtBQUssSUFBSSxJQUFJLElBQUksTUFBTSxNQUFNLEtBQUssSUFBSSxNQUFNLEtBQUssSUFBSSxNQUFNLE1BQU0sSUFBSSxPQUFPO0FBRXBGLE1BQU0sVUFBa0IsT0FBSyxLQUFLLEtBQUssS0FBSyxJQUFJLE1BQU0sQ0FBQztBQUN2RCxNQUFNLFlBQW9CLE9BQy9CLElBQUksT0FBTyxJQUFJLEtBQUssS0FBSyxLQUFLLElBQUksTUFBTSxDQUFDLEtBQUssS0FBSyxLQUFLLEtBQUssS0FBSyxLQUFLLElBQUksTUFBTSxDQUFDLElBQUksS0FBSztBQUd0RixNQUFNLFVBQVUsQ0FBQyxJQUFJLFlBQW9CLE9BQUssS0FBSyxJQUFJLE1BQU0sSUFBSSxNQUFNLElBQUksS0FBSyxJQUFJLE1BQU07QUFNMUYsV0FBUyxZQUFZLElBQVksSUFBWSxJQUFZLElBQW9CO0FBQ2xGLFVBQU0sS0FBSyxJQUFJLElBQUksS0FBSyxLQUFLLEtBQUssTUFBTSxJQUFJLEtBQUssSUFBSSxLQUFLO0FBQzFELFVBQU0sS0FBSyxJQUFJLElBQUksS0FBSyxLQUFLLEtBQUssTUFBTSxJQUFJLEtBQUssSUFBSSxLQUFLO0FBQzFELFVBQU0sS0FBSyxDQUFDLFFBQWdCLEtBQUssSUFBSSxNQUFNLElBQUksTUFBTTtBQUNyRCxVQUFNLEtBQUssQ0FBQyxRQUFnQixLQUFLLElBQUksTUFBTSxJQUFJLE1BQU07QUFDckQsVUFBTSxLQUFLLENBQUMsT0FBZSxJQUFJLEtBQUssSUFBSSxJQUFJLE1BQU0sSUFBSTtBQUN0RCxXQUFPLE9BQUs7QUFDVixVQUFJLEtBQUssRUFBRyxRQUFPO0FBQ25CLFVBQUksS0FBSyxFQUFHLFFBQU87QUFDbkIsVUFBSSxJQUFJO0FBQ1IsZUFBUyxJQUFJLEdBQUcsSUFBSSxHQUFHLEtBQUs7QUFDMUIsY0FBTSxJQUFJLEdBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUM7QUFDN0IsWUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLEtBQU0sUUFBTyxHQUFHLENBQUM7QUFDbkMsWUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLEtBQU07QUFDeEIsYUFBSyxJQUFJO0FBQUEsTUFDWDtBQUNBLFVBQUksS0FBSyxHQUFHLEtBQUs7QUFBRyxVQUFJO0FBQ3hCLGVBQVMsSUFBSSxHQUFHLElBQUksSUFBSSxLQUFLO0FBQzNCLGNBQU0sSUFBSSxHQUFHLENBQUM7QUFDZCxZQUFJLEtBQUssSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFNO0FBQzVCLFlBQUksSUFBSSxFQUFHLE1BQUs7QUFBQSxZQUFRLE1BQUs7QUFDN0IsYUFBSyxLQUFLLE1BQU07QUFBQSxNQUNsQjtBQUNBLGFBQU8sR0FBRyxDQUFDO0FBQUEsSUFDYjtBQUFBLEVBQ0Y7QUFHTyxNQUFNLGdCQUFnQixZQUFZLE1BQU0sS0FBSyxLQUFLLENBQUM7QUFFbkQsTUFBTSxVQUFVO0FBQUEsSUFDckI7QUFBQSxJQUFRO0FBQUEsSUFBUTtBQUFBLElBQVM7QUFBQSxJQUFXO0FBQUEsSUFBUTtBQUFBLElBQVM7QUFBQSxJQUFXO0FBQUEsSUFBUztBQUFBLElBQVU7QUFBQSxJQUNuRjtBQUFBLElBQVM7QUFBQSxJQUFVO0FBQUEsSUFBWTtBQUFBLElBQVM7QUFBQSxJQUFVO0FBQUEsSUFBWTtBQUFBLElBQVE7QUFBQSxJQUFTO0FBQUEsSUFBVztBQUFBLElBQVM7QUFBQSxJQUNuRyxTQUFTLFFBQVE7QUFBQSxJQUFHO0FBQUEsRUFDdEI7QUFLTyxNQUFNLE9BQU8sQ0FBQyxHQUFvQyxXQUFtQixlQUMxRSxPQUFPLE1BQU0sYUFBYSxJQUFJLElBQUksUUFBUSxDQUFDLElBQUk7OztBQzFFakQsV0FBUyxPQUFPLElBQWtCLENBQUMsR0FBNEM7QUFDN0UsUUFBSSxlQUFlLEdBQUc7QUFDcEIsWUFBTSxJQUFJLEVBQUUsUUFBUTtBQUNwQixZQUFNLElBQUksS0FBSyxLQUFLLEVBQUUsWUFBWSxDQUFDO0FBQ25DLGFBQU8sRUFBRSxHQUFHLE1BQU0sRUFBRSxXQUFXLElBQUksS0FBSyxLQUFLLEVBQUUsWUFBWSxDQUFDLElBQUksSUFBSSxFQUFFLFlBQVksRUFBRTtBQUFBLElBQ3RGO0FBQ0EsV0FBTyxFQUFFLEdBQUcsSUFBSSxLQUFLLE1BQU0sRUFBRSxRQUFRLE1BQU0sTUFBTSxFQUFFLFFBQVEsS0FBSyxJQUFJLEVBQUUsWUFBWSxFQUFFO0FBQUEsRUFDdEY7QUFPTyxXQUFTLE9BQU8sR0FBVyxTQUF1QixDQUFDLEdBQVc7QUFDbkUsUUFBSSxLQUFLLEVBQUcsUUFBTztBQUNuQixVQUFNLEVBQUUsR0FBRyxNQUFNLEdBQUcsSUFBSSxPQUFPLE1BQU07QUFFckMsUUFBSTtBQUNKLFFBQUksT0FBTyxHQUFHO0FBQ1osWUFBTSxLQUFLLElBQUksS0FBSyxLQUFLLElBQUksT0FBTyxJQUFJO0FBQ3hDLFlBQU0sSUFBSSxJQUFJLEtBQUssS0FBSyxPQUFPLElBQUksS0FBSztBQUN4QyxVQUFJLEtBQUssSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLEtBQUssSUFBSSxLQUFLLElBQUksS0FBSyxDQUFDLElBQUksSUFBSSxLQUFLLElBQUksS0FBSyxDQUFDO0FBQUEsSUFDM0UsV0FBVyxTQUFTLEdBQUc7QUFDckIsWUFBTSxJQUFJLElBQUksSUFBSSxLQUFLLElBQUk7QUFDM0IsVUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUk7QUFBQSxJQUNsQyxPQUFPO0FBQ0wsWUFBTSxJQUFJLElBQUksS0FBSyxLQUFLLE9BQU8sT0FBTyxDQUFDO0FBQ3ZDLFlBQU0sS0FBSyxDQUFDLE9BQU8sSUFBSSxHQUFHLEtBQUssQ0FBQyxPQUFPLElBQUk7QUFDM0MsWUFBTSxNQUFNLEtBQUssS0FBSyxPQUFPLEtBQUssS0FBSyxLQUFLLEtBQUs7QUFDakQsVUFBSSxLQUFLLEtBQUssSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLEtBQUssSUFBSSxLQUFLLENBQUM7QUFBQSxJQUNsRDtBQUNBLFdBQU8sSUFBSTtBQUFBLEVBQ2I7OztBQ2xDTyxXQUFTLEtBQUssR0FBVyxJQUFvQixXQUFtQixZQUFvQjtBQUN6RixRQUFJLENBQUMsR0FBRyxPQUFRLE9BQU0sSUFBSSxNQUFNLHFCQUFxQjtBQUNyRCxRQUFJLEtBQUssR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFHLFFBQU8sR0FBRyxDQUFDLEVBQUUsQ0FBQztBQUNqQyxhQUFTLElBQUksR0FBRyxJQUFJLEdBQUcsUUFBUSxLQUFLO0FBQ2xDLFVBQUksSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUc7QUFDaEIsY0FBTSxDQUFDLElBQUksRUFBRSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQztBQUM5QyxlQUFPLEtBQUssSUFBSSxJQUFJLEtBQUssR0FBRyxRQUFRLEVBQUUsS0FBSyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUMsQ0FBQztBQUFBLE1BQzdEO0FBQUEsSUFDRjtBQUNBLFdBQU8sR0FBRyxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUM7QUFBQSxFQUM1Qjs7O0FDQ08sV0FBUyxPQUFPLFFBQXNCQSxRQUEyQjtBQUN0RSxVQUFNLEtBQUtBLE9BQU0sUUFBUSxHQUFHLEtBQUtBLE9BQU0sU0FBUztBQUNoRCxXQUFPLFFBQU07QUFBQSxNQUNYLEdBQUcsT0FBTyxHQUFHLFNBQVMsS0FBSyxHQUFHLE9BQU8sQ0FBQyxJQUFJO0FBQUEsTUFDMUMsR0FBRyxPQUFPLEdBQUcsU0FBUyxLQUFLLEdBQUcsT0FBTyxDQUFDLElBQUk7QUFBQSxNQUMxQyxNQUFNLE9BQU8sTUFBTSxTQUFTLEtBQUssR0FBRyxPQUFPLElBQUksSUFBSTtBQUFBLE1BQ25ELFFBQVEsT0FBTyxRQUFRLFNBQVMsS0FBSyxHQUFHLE9BQU8sTUFBTSxJQUFJO0FBQUEsSUFDM0Q7QUFBQSxFQUNGO0FBK0VPLFdBQVMsZ0JBQWdCLEdBQWdCQyxRQUFpQixZQUFZLEdBQVc7QUFDdEYsVUFBTSxJQUFJLEVBQUUsU0FBUyxXQUFXLEVBQUUsTUFBTSxTQUFTO0FBQ2pELFdBQU8sYUFBYUEsT0FBTSxRQUFRLENBQUMsTUFBTUEsT0FBTSxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxPQUFPLFNBQVMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO0FBQUEsRUFDM0g7QUFHTyxXQUFTLGNBQWMsR0FBZ0JBLFFBQWlCLEdBQTJCO0FBQ3hGLFVBQU0sTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7QUFDeEQsVUFBTSxJQUFLLEVBQUUsU0FBUyxLQUFLLEtBQU0sS0FBSyxNQUFNLEtBQUssSUFBSSxDQUFDLEdBQUcsTUFBTSxLQUFLLElBQUksQ0FBQztBQUN6RSxXQUFPLENBQUNBLE9BQU0sUUFBUSxJQUFJLEtBQUssTUFBTSxLQUFLLEtBQUtBLE9BQU0sU0FBUyxJQUFJLEtBQUssTUFBTSxLQUFLLEdBQUc7QUFBQSxFQUN2RjtBQUdPLFdBQVMsY0FBYyxHQUFnQkEsUUFBaUIsR0FBMkI7QUFDeEYsVUFBTSxJQUFLLENBQUMsRUFBRSxTQUFTLEtBQUssS0FBTSxLQUFLLE1BQU0sS0FBSyxJQUFJLENBQUMsR0FBRyxNQUFNLEtBQUssSUFBSSxDQUFDO0FBQzFFLFVBQU0sS0FBSyxFQUFFLENBQUMsSUFBSUEsT0FBTSxRQUFRLEdBQUcsS0FBSyxFQUFFLENBQUMsSUFBSUEsT0FBTSxTQUFTO0FBQzlELFVBQU0sS0FBSyxLQUFLLE1BQU0sS0FBSyxLQUFLLEtBQUssS0FBSyxNQUFNLEtBQUs7QUFDckQsV0FBTyxDQUFDLEVBQUUsSUFBSSxLQUFLLEVBQUUsTUFBTSxFQUFFLElBQUksS0FBSyxFQUFFLElBQUk7QUFBQSxFQUM5QztBQU1PLFdBQVMsU0FBUyxHQUFnQixPQUFlQSxRQUE4QjtBQUNwRixVQUFNLEtBQUtBLE9BQU0sUUFBUSxHQUFHLEtBQUtBLE9BQU0sU0FBUztBQUNoRCxXQUFPLEVBQUUsR0FBRyxNQUFNLEVBQUUsSUFBSSxNQUFNLE9BQU8sR0FBRyxNQUFNLEVBQUUsSUFBSSxNQUFNLE9BQU8sTUFBTSxLQUFLLEVBQUUsT0FBTyxLQUFLLE9BQU8sUUFBUSxFQUFFLFNBQVMsTUFBTTtBQUFBLEVBQzVIO0FBTU8sV0FBUyxtQkFBbUIsR0FBZ0IsR0FBZ0JBLFFBQXlCO0FBQzFGLFVBQU0sTUFBYyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQ0EsT0FBTSxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUdBLE9BQU0sTUFBTSxHQUFHLENBQUNBLE9BQU0sT0FBT0EsT0FBTSxNQUFNLEdBQUcsQ0FBQ0EsT0FBTSxRQUFRLEdBQUdBLE9BQU0sU0FBUyxDQUFDLENBQUM7QUFDbEksUUFBSSxJQUFJO0FBQ1IsZUFBVyxLQUFLLEtBQUs7QUFDbkIsWUFBTSxJQUFJLGNBQWMsR0FBR0EsUUFBTyxDQUFDLEdBQUcsSUFBSSxjQUFjLEdBQUdBLFFBQU8sQ0FBQztBQUNuRSxVQUFJLEtBQUssSUFBSSxHQUFHLEtBQUssTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQUEsSUFDdEQ7QUFDQSxXQUFPO0FBQUEsRUFDVDs7O0FDdERPLFdBQVMsWUFBWSxLQUF5QjtBQUNuRCxRQUFJLEVBQUUsSUFBSSxNQUFNLElBQUksT0FBUSxPQUFNLElBQUksTUFBTSxVQUFVLElBQUksSUFBSSxXQUFXLElBQUksR0FBRywwQkFBMEIsSUFBSSxLQUFLLEdBQUc7QUFDdEgsV0FBTztBQUFBLEVBQ1Q7QUFFQSxjQUFZLE9BQU8sQ0FBQyxNQUFjLFNBQTZCLEVBQUUsR0FBRyxZQUFZLEdBQUcsR0FBRyxLQUFLO0FBRXBGLFdBQVMsWUFBWSxLQUF5QjtBQUNuRCxVQUFNLFFBQVEsb0JBQUksSUFBWTtBQUM5QixlQUFXLEtBQUssSUFBSSxRQUFRO0FBQzFCLFVBQUksTUFBTSxJQUFJLEVBQUUsSUFBSSxFQUFHLE9BQU0sSUFBSSxNQUFNLFVBQVUsSUFBSSxLQUFLLDRCQUE0QixFQUFFLElBQUksR0FBRztBQUMvRixZQUFNLElBQUksRUFBRSxJQUFJO0FBQ2hCLFVBQUksRUFBRSxRQUFRLEtBQUssRUFBRSxNQUFNLElBQUksV0FBVyxLQUFNLE9BQU0sSUFBSSxNQUFNLFVBQVUsRUFBRSxJQUFJLE9BQU8sRUFBRSxLQUFLLEtBQUssRUFBRSxHQUFHLG1DQUE4QixJQUFJLFFBQVEsSUFBSTtBQUFBLElBQ3hKO0FBQ0EsV0FBTztBQUFBLEVBQ1Q7QUFHTyxXQUFTLFdBQVcsR0FBdUI7QUFDaEQsVUFBTSxNQUFnQixDQUFDLEdBQUksRUFBRSxXQUFXLENBQUMsQ0FBRTtBQUMzQyxlQUFXLEtBQUssRUFBRSxRQUFRO0FBQ3hCLFVBQUksS0FBSyxFQUFFLE1BQU0sRUFBRSxNQUFNLEdBQUcsRUFBRSxPQUFPLE1BQU0sTUFBTSxDQUFDO0FBQ2xELGlCQUFXLENBQUMsR0FBRyxFQUFFLEtBQUssT0FBTyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUMsRUFBRyxLQUFJLEtBQUssRUFBRSxNQUFNLEdBQUcsRUFBRSxJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsRUFBRSxRQUFRLElBQUksTUFBTSxPQUFPLENBQUM7QUFBQSxJQUMzSDtBQUNBLFdBQU8sSUFBSSxLQUFLLENBQUMsR0FBRyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFBQSxFQUNyQztBQUdPLFdBQVMsYUFBYSxHQUFhLElBQVksS0FBSyxJQUFnQjtBQUN6RSxXQUFPLEVBQUUsT0FBTyxPQUFPLE9BQUssTUFBTSxFQUFFLFNBQVMsS0FBSyxFQUFFLEdBQUc7QUFBQSxFQUN6RDtBQUtPLFdBQVMsV0FBVyxHQUFhLFFBQXNDO0FBQzVFLFFBQUksQ0FBQyxVQUFVLFlBQVksRUFBRSxVQUFVLFFBQVMsUUFBTztBQUN2RCxVQUFNLElBQUksRUFBRSxXQUFXLE1BQU07QUFDN0IsUUFBSSxDQUFDLEVBQUcsT0FBTSxJQUFJLE1BQU0sVUFBVSxFQUFFLEtBQUssOEJBQThCLE1BQU0sbUJBQW1CLE1BQU0sSUFBSTtBQUMxRyxXQUFPLEVBQUUsR0FBRyxHQUFHLEdBQUcsR0FBRyxPQUFPO0FBQUEsRUFDOUI7OztBQ2xITyxXQUFTLFlBQVksR0FBaUI7QUFBRSxXQUFPO0FBQUEsRUFBRztBQUdsRCxXQUFTLFNBQVMsR0FBVSxPQUFPLElBQVk7QUFDcEQsVUFBTSxPQUFpQixDQUFDO0FBQ3hCLGVBQVcsQ0FBQyxHQUFHLENBQUMsS0FBSyxPQUFPLFFBQVEsRUFBRSxNQUFNLEVBQUcsTUFBSyxLQUFLLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUN4RSxlQUFXLENBQUMsR0FBRyxDQUFDLEtBQUssT0FBTyxRQUFRLEVBQUUsS0FBSyxFQUFHLEtBQUksRUFBRyxNQUFLLEtBQUssT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQzlFLGVBQVcsQ0FBQyxHQUFHLENBQUMsS0FBSyxPQUFPLFFBQVEsRUFBRSxLQUFLLEVBQUcsTUFBSyxLQUFLLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSTtBQUN6RSxlQUFXLENBQUMsR0FBRyxDQUFDLEtBQUssT0FBTyxRQUFRLEVBQUUsT0FBTyxFQUFHLE1BQUssS0FBSyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDekUsZUFBVyxDQUFDLEdBQUcsQ0FBQyxLQUFLLE9BQU8sUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDLEVBQUcsTUFBSyxLQUFLLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUM3RSxVQUFNLFNBQVMsRUFBRSxhQUFhLENBQUMsR0FBRyxPQUFPLE9BQUssRUFBRSxHQUFHLEVBQUUsSUFBSSxPQUFLO0FBQzVELFVBQUksQ0FBQyxFQUFFLElBQUssUUFBTztBQUNuQixZQUFNLE1BQU0sc0JBQXNCLEtBQUssRUFBRSxHQUFHLElBQUksRUFBRSxNQUFNLE9BQU8sRUFBRTtBQUNqRSxhQUFPLDJCQUEyQixFQUFFLE1BQU0sY0FBYyxHQUFHLGtCQUFrQixFQUFFLFVBQVUsS0FBSyxlQUFlLEVBQUUsU0FBUyxRQUFRLElBQUksRUFBRSxVQUFVLGdCQUFnQixFQUFFLE9BQU8sTUFBTSxFQUFFO0FBQUEsSUFDbkwsQ0FBQztBQUNELFdBQU8sR0FBRyxNQUFNLEtBQUssSUFBSSxDQUFDO0FBQUEsUUFBVyxLQUFLLEtBQUssR0FBRyxDQUFDO0FBQUEsRUFDckQ7OztBQ2tGTyxNQUFNLGNBQWMsT0FBTyxLQUFLLE9BQU87OztBQ25IdkMsV0FBUyxHQUFHLElBQThCLFdBQW1CLFVBQVUsR0FBUztBQUNyRixPQUFHLE1BQU0sWUFBWTtBQUNyQixPQUFHLE1BQU0sVUFBVSxPQUFPLE9BQU87QUFFakMsT0FBRyxNQUFNLGFBQWEsV0FBVyxPQUFRLFdBQVc7QUFBQSxFQUN0RDtBQU1PLFdBQVMsWUFBWSxJQUFZLEtBQW1CO0FBQ3pELFFBQUksT0FBTyxhQUFhLGVBQWUsU0FBUyxlQUFlLGVBQWUsRUFBRSxFQUFFLEVBQUc7QUFDckYsVUFBTSxJQUFJLFNBQVMsY0FBYyxPQUFPO0FBQ3hDLE1BQUUsS0FBSyxlQUFlLEVBQUU7QUFDeEIsTUFBRSxjQUFjO0FBQ2hCLGFBQVMsS0FBSyxPQUFPLENBQUM7QUFBQSxFQUN4QjtBQWlCTyxXQUFTLFdBQVcsR0FBbUI7QUFDNUMsV0FBTyxFQUFFLFFBQVEsWUFBWSxRQUFNLEVBQUUsS0FBSyxTQUFTLEtBQUssUUFBUSxLQUFLLFFBQVEsS0FBSyxVQUFVLEtBQUssUUFBUSxHQUFHLENBQUMsQ0FBRTtBQUFBLEVBQ2pIO0FBRUEsTUFBSSxVQUE4QjtBQUNsQyxNQUFJLGFBQWE7QUFFVixXQUFTLFNBQVMsSUFBaUIsT0FBcUI7QUFBRSxjQUFVO0FBQUksaUJBQWE7QUFBQSxFQUFPO0FBTzVGLFdBQVMsV0FBVyxJQUFhLEtBQUssS0FBSyxLQUFLLEtBQXVCO0FBQzVFLFFBQUksQ0FBQyxRQUFTLE9BQU0sSUFBSSxNQUFNLGdDQUFnQztBQUM5RCxVQUFNLEtBQUssUUFBUSxzQkFBc0IsR0FBRyxJQUFJLEdBQUcsc0JBQXNCO0FBQ3pFLFdBQU8sRUFBRSxFQUFFLE9BQU8sR0FBRyxPQUFPLEVBQUUsUUFBUSxNQUFNLGFBQWEsRUFBRSxNQUFNLEdBQUcsTUFBTSxFQUFFLFNBQVMsTUFBTSxVQUFVO0FBQUEsRUFDdkc7OztBQ2xEQSxNQUFNQyxPQUFNO0FBQUE7QUFBQTtBQUFBO0FBZUwsV0FBUyxPQUFPLElBQWlCLE1BQWNDLFFBQXNCLENBQUMsR0FBa0I7QUFDN0YsZ0JBQVksVUFBVUQsSUFBRztBQUN6QixVQUFNLFFBQVEsS0FBSyxNQUFNLGFBQWEsRUFBRSxPQUFPLE9BQU87QUFDdEQsUUFBSSxNQUFNO0FBQ1YsZUFBVyxRQUFRLE9BQU87QUFDeEIsWUFBTSxTQUFTLEtBQUssV0FBVyxHQUFHLEtBQUssS0FBSyxTQUFTLEdBQUcsS0FBSyxLQUFLLFNBQVM7QUFDM0UsWUFBTSxJQUFJLFNBQVMsS0FBSyxNQUFNLEdBQUcsRUFBRSxJQUFJO0FBQ3ZDLFlBQU0sUUFBUUMsTUFBSyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxNQUFNLE9BQU87QUFDbkQsaUJBQVcsS0FBSyxPQUFPO0FBQ3JCLFlBQUksTUFBTSxHQUFJO0FBQ2QsWUFBSSxDQUFDQSxNQUFLLFNBQVMsUUFBUSxLQUFLLENBQUMsR0FBRztBQUFFLGlCQUFPO0FBQUs7QUFBQSxRQUFVO0FBQzVELGNBQU0sTUFBTSxTQUFTLElBQUlBLE1BQUssZUFBZSxjQUFjLEtBQUs7QUFDaEUsZUFBTywrQ0FBK0MsR0FBRyxLQUFLLE1BQU0sTUFBTSxXQUFXLFdBQVcsQ0FBQyxDQUFDO0FBQUEsTUFDcEc7QUFBQSxJQUNGO0FBQ0EsT0FBRyxtQkFBbUJBLE1BQUssWUFBWSxRQUFRLGNBQWMsY0FBYyxHQUFHO0FBQzlFLFdBQU8sQ0FBQyxHQUFHLEdBQUcsaUJBQThCLFdBQVcsQ0FBQztBQUFBLEVBQzFEO0FBa0JPLFdBQVMsT0FBTyxPQUFzQixHQUFXLEtBQWEsT0FBTyxVQUFVLElBQW1CLENBQUMsR0FBUztBQUNqSCxVQUFNLFVBQVUsRUFBRSxXQUFXLE1BQU0sTUFBTSxFQUFFLE9BQU8sTUFBTSxVQUFVLEVBQUUsV0FBVyxLQUFLLE9BQU8sRUFBRSxRQUFRLEtBQUssTUFBTSxFQUFFLFVBQVU7QUFDNUgsVUFBTSxNQUFNLEVBQUUsUUFBUSxTQUFTLE9BQU8sRUFBRSxZQUFZO0FBQ3BELFVBQU0sUUFBUSxDQUFDLEdBQUcsTUFBTTtBQUN0QixZQUFNLE1BQU0sSUFBSSxLQUFLLEdBQUcsTUFBTSxJQUFJLFNBQVMsR0FBRyxDQUFDO0FBQy9DLFlBQU0sT0FBTyxLQUFLLEtBQUssR0FBRyxPQUFPLElBQUksVUFBVSxLQUFLLE9BQU8sQ0FBQztBQUM1RCxRQUFFLE1BQU0sWUFBWSxlQUFlLElBQUksT0FBTyxPQUFPLE9BQU8sSUFBSSxjQUFjLElBQUksT0FBTyxHQUFHO0FBQUEsSUFDOUYsQ0FBQztBQUFBLEVBQ0g7OztBQ3pEQSxNQUFNQyxPQUFNO0FBQUE7QUFBQTtBQUFBO0FBS1osTUFBTSxPQUFPLENBQUMsTUFBZSxNQUFNLE9BQU8sQ0FBQyxJQUFJLFdBQVcsV0FBVyxDQUFDO0FBRy9ELFdBQVMsS0FBSyxHQUFXLEdBQVcsR0FBbUI7QUFDNUQsZ0JBQVksWUFBWUEsSUFBRztBQUMzQixVQUFNLElBQUksS0FBSyxJQUFJLEVBQUUsUUFBUSxFQUFFLE1BQU0sR0FBRyxJQUFJLEVBQUUsU0FBUyxHQUFHLEdBQUcsR0FBRyxJQUFJLEVBQUUsU0FBUyxHQUFHLEdBQUc7QUFDckYsUUFBSSxPQUFPO0FBQ1gsYUFBUyxJQUFJLEdBQUcsSUFBSSxHQUFHLEtBQUs7QUFDMUIsWUFBTSxLQUFLLEVBQUUsQ0FBQyxNQUFNLE1BQU0sS0FBSyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxNQUFNLE1BQU0sS0FBSyxFQUFFLENBQUM7QUFDakUsVUFBSSxPQUFPLElBQUk7QUFBRSxnQkFBUSxLQUFLLEVBQUU7QUFBRztBQUFBLE1BQVU7QUFDN0MsWUFBTSxJQUFJLFFBQVEsTUFBTSxJQUFJLE9BQU8sSUFBSSxJQUFJLEtBQUssSUFBSSxDQUFDO0FBQ3JELFVBQUksS0FBSyxHQUFHO0FBQUUsZ0JBQVEsS0FBSyxFQUFFO0FBQUc7QUFBQSxNQUFVO0FBQzFDLGNBQVEsNERBQTRELENBQUMsSUFBSSxFQUFFLGFBQWEsS0FBSyxFQUFFLENBQUMsZ0JBQWdCLEtBQUssRUFBRSxDQUFDO0FBQUEsSUFDMUg7QUFDQSxXQUFPO0FBQUEsRUFDVDtBQUdPLFdBQVMsTUFBTSxHQUFXLEdBQVcsR0FBbUI7QUFDN0QsZ0JBQVksWUFBWUEsSUFBRztBQUMzQixVQUFNLElBQUksUUFBUSxNQUFNLENBQUMsQ0FBQztBQUMxQixXQUFPLEtBQUssSUFBSSxXQUFXLENBQUMsSUFBSSw0REFBNEQsQ0FBQyxJQUFJLEVBQUUsYUFBYSxXQUFXLENBQUMsQ0FBQyxnQkFBZ0IsV0FBVyxDQUFDLENBQUM7QUFBQSxFQUM1SjtBQUdPLFdBQVMsUUFBUSxJQUFpQixNQUFvQjtBQUMzRCxRQUFLLEdBQThDLGdCQUFnQixLQUFNO0FBQ3pFLE9BQUcsWUFBWTtBQUNmLElBQUMsR0FBOEMsY0FBYztBQUFBLEVBQy9EOzs7QUNuQ0EsTUFBTUMsT0FBTTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFPTCxNQUFNLGdCQUFnQixNQUFZLFlBQVksY0FBY0EsSUFBRztBQUcvRCxXQUFTLE1BQU0sTUFBYyxNQUFNLElBQXFCO0FBQzdELGtCQUFjO0FBQ2QsVUFBTSxJQUFJLFNBQVMsY0FBYyxNQUFNO0FBQ3ZDLE1BQUUsWUFBWSxlQUFlLEdBQUcsR0FBRyxLQUFLO0FBQ3hDLE1BQUUsY0FBYztBQUNoQixXQUFPO0FBQUEsRUFDVDtBQVdPLFdBQVMsTUFBTSxJQUFpQixHQUFXLElBQVksSUFBa0IsQ0FBQyxHQUFXO0FBQzFGLFVBQU0sSUFBSSxPQUFPLElBQUksSUFBSSxFQUFFLE1BQU0sRUFBRSxRQUFRLEtBQUssTUFBTSxFQUFFLFFBQVEsS0FBSyxDQUFDO0FBQ3RFLE9BQUcsSUFBSSxTQUFTLElBQUksS0FBSyxJQUFJLEtBQUssSUFBSSxHQUFHLENBQUMsQ0FBQyxhQUFhLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRSxVQUFVLEdBQUcsT0FBTyxFQUFFLFFBQVEsTUFBTSxFQUFFLFFBQVEsRUFBRSxJQUFJLE9BQU8sSUFBSSxPQUFPLEVBQUUsUUFBUSxLQUFLLENBQUM7QUFDakssV0FBTztBQUFBLEVBQ1Q7QUFhTyxXQUFTLEtBQUssR0FBVyxJQUFZLFNBQVMsT0FBZTtBQUNsRSxRQUFJLEtBQUssR0FBSSxRQUFPO0FBQ3BCLFdBQU8sS0FBSyxJQUFJLEtBQUssSUFBSSxJQUFJLElBQUksTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFLElBQUksU0FBUyxLQUFLLElBQUksRUFBRSxJQUFJLE1BQU0sQ0FBQztBQUFBLEVBQzNGO0FBR08sTUFBTSxNQUFNLENBQUMsR0FBVyxHQUFXLE1BQU0sR0FBRyxRQUFRLFFBQWdCLEtBQUssSUFBSSxJQUFJLFFBQVEsSUFBSSxHQUFHLElBQUk7OztBQ2hEM0csTUFBTUMsT0FBTTtBQUFBO0FBQUE7QUF5QlosTUFBTSxVQUFVLENBQUMsTUFBcUIsT0FBTyxNQUFNLGFBQWEsRUFBRSxJQUFJO0FBRS9ELFdBQVMsT0FBTyxPQUFvQixHQUFnQztBQUN6RSxnQkFBWSxVQUFVQSxJQUFHO0FBQ3pCLFVBQU0sS0FBSztBQUNYLFVBQU0sS0FBSyxTQUFTLGdCQUFnQixJQUFJLEtBQUs7QUFDN0MsT0FBRyxhQUFhLFNBQVMsY0FBYztBQUFHLE9BQUcsYUFBYSxXQUFXLFdBQVc7QUFDaEYsT0FBRyxZQUFZLHVEQUF1RCxFQUFFLFFBQVEsU0FBUyxhQUFhLEVBQUUsVUFBVSxNQUFNO0FBQ3hILFVBQU0sU0FBUyxTQUFTLGNBQWMsS0FBSztBQUFHLFdBQU8sWUFBWTtBQUNqRSxVQUFNLE9BQU8sSUFBSSxNQUFNO0FBQ3ZCLFVBQU0sU0FBUyxFQUFFLFVBQVUsQ0FBQztBQUM1QixVQUFNLE9BQU8sRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLEVBQUUsR0FBRyxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLFNBQVMsQ0FBQyxFQUFFLElBQUk7QUFFL0UsVUFBTSxNQUFNLENBQUMsTUFBZ0M7QUFDM0MsVUFBSSxJQUFJLFFBQVEsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFO0FBQzVCLGVBQVMsSUFBSSxHQUFHLElBQUksRUFBRSxLQUFLLFFBQVEsS0FBSztBQUN0QyxjQUFNLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHLElBQUksRUFBRSxLQUFLLENBQUM7QUFDckMsWUFBSSxLQUFLLEVBQUUsR0FBRztBQUNaLGdCQUFNLElBQUksUUFBUSxFQUFFLEVBQUUsR0FBRyxJQUFJLFFBQVEsRUFBRSxFQUFFO0FBQ3pDLGdCQUFNLEtBQUssRUFBRSxRQUFRLFlBQVksS0FBSyxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDeEQsY0FBSSxLQUFLLEdBQUcsV0FBVyxHQUFHLEdBQUcsRUFBRSxRQUFRLElBQUksR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNwRDtBQUFBLE1BQ0Y7QUFDQSxhQUFPO0FBQUEsSUFDVDtBQUVBLFVBQU0sU0FBUyxDQUFDLE1BQW9CO0FBQ2xDLFVBQUksSUFBSSxRQUFRLElBQUksSUFBSTtBQUFFLFdBQUcsSUFBSSxRQUFRLENBQUM7QUFBRyxXQUFHLFFBQVEsUUFBUSxDQUFDO0FBQUc7QUFBQSxNQUFRO0FBQzVFLFlBQU0sSUFBSSxJQUFJLENBQUM7QUFDZixZQUFNLFFBQVEsT0FBTyxPQUFPLENBQUMsR0FBRyxPQUFPLEtBQUssSUFBSSxHQUFHLElBQUksS0FBSyxJQUFJLElBQUksRUFBRSxJQUFJLElBQUksR0FBRyxDQUFDO0FBQ2xGLFlBQU0sT0FBTyxPQUFPLElBQUksUUFBUSxDQUFDLEtBQUssSUFBSSxLQUFLLEdBQUcsS0FBSyxLQUFLLEdBQUc7QUFDL0QsU0FBRyxJQUFJLGFBQWEsRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxhQUFhLElBQUksT0FBTyxNQUFNLEtBQUssQ0FBQyxLQUFLLElBQUk7QUFDL0UsWUFBTSxLQUFLLE9BQU8sS0FBSyxRQUFNLEtBQUssTUFBTSxJQUFJLEtBQUssR0FBRztBQUNwRCxVQUFJLE9BQU8sUUFBVztBQUNwQixjQUFNLElBQUksUUFBUSxLQUFLLEdBQUcsSUFBSSxHQUFHLENBQUM7QUFDbEMsV0FBRyxRQUFRLGFBQWEsRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxhQUFhLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxLQUFLLEdBQUc7QUFBQSxNQUNwRixNQUFPLElBQUcsUUFBUSxRQUFRLENBQUM7QUFBQSxJQUM3QjtBQUNBLFdBQU8sRUFBRSxJQUFJLFFBQVEsS0FBSyxPQUFPO0FBQUEsRUFDbkM7OztBQ2pFQSxNQUFNQyxPQUFNO0FBQUE7QUFBQTtBQTBCTCxXQUFTLE9BQU8sR0FBVyxHQUErQjtBQUMvRCxnQkFBWSxVQUFVQSxJQUFHO0FBQ3pCLFVBQU0sSUFBSSxNQUFNLEtBQUssT0FBTyxJQUFJLEVBQUUsTUFBTSxFQUFFLEdBQUcsSUFBSSxHQUFHLEdBQUcsRUFBRSxLQUFLLE1BQU07QUFDcEUsVUFBTSxRQUFRLEVBQUUsS0FBSyxNQUFNLEdBQUcsQ0FBQyxHQUFHLE9BQU8sSUFBSSxFQUFFLE1BQU0sSUFBSSxLQUFLLEVBQUUsTUFBTTtBQUN0RSxVQUFNLFFBQVEsRUFBRSxTQUFTLEVBQUUsT0FBTyxLQUFLLElBQUk7QUFDM0MsVUFBTSxRQUFRLENBQUMsR0FBRyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxRQUFRO0FBQzNDLFlBQU0sUUFBUSxNQUFNLElBQUksU0FBUyxLQUFLLElBQUksT0FBTztBQUNqRCxZQUFNLElBQUksUUFBUSxRQUFRLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJO0FBQ2pELGFBQU8sdURBQXVELElBQUksS0FBSyxHQUFHLGFBQWEsS0FBSyxNQUFNLEdBQUcsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLFdBQVcsRUFBRSxDQUFDO0FBQUEsSUFDMUksQ0FBQyxFQUFFLEtBQUssRUFBRTtBQUNWLFVBQU0sUUFBUSxFQUFFLFlBQWEsSUFBSSxNQUFPLElBQUksUUFBUSxJQUFJLE9BQU8sT0FBTyxzQ0FBc0M7QUFDNUcsV0FBTyxFQUFFLEdBQUcsT0FBTyxNQUFNLE1BQU0sUUFBUSxNQUFNO0FBQUEsRUFDL0M7OztBQy9CTyxNQUFNLE9BQU8sQ0FBQyxJQUFZLEtBQUssR0FBRyxjQUFjLE1BQU0sUUFBUSxPQUNuRSxlQUFlLFdBQVcsTUFBTSxRQUFRLE1BQU0sUUFBUSxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRTtBQUduRixXQUFTLFFBQVEsSUFBaUIsR0FBVyxJQUFZLElBQWlHLENBQUMsR0FBUztBQUN6SyxVQUFNLElBQUksT0FBTyxJQUFJLElBQUksRUFBRSxNQUFNLEdBQUssTUFBTSxJQUFJLENBQUM7QUFDakQsVUFBTSxRQUFRLFVBQVUsS0FBSyxHQUFHLEtBQUssTUFBTSxFQUFFLFlBQVksR0FBRyxDQUFDO0FBQzdELFVBQU0sS0FBSyxLQUFLLEVBQUUsUUFBUSxLQUFLLEVBQUUsTUFBTSxLQUFLLENBQUMsSUFBSSxTQUFTLEVBQUUsU0FBUztBQUNyRSxPQUFHLElBQUksS0FBSyxLQUFLLEVBQUUsTUFBTSxLQUFLLFFBQVEsR0FBRyxNQUFNLGVBQWUsSUFBSSxNQUFNLEVBQUUsTUFBTSxJQUFJLEtBQUssR0FBRyxPQUFPLElBQUksTUFBTSxDQUFDLENBQUM7QUFBQSxFQUNqSDtBQUtPLFdBQVMsYUFBYSxPQUFvQixJQUFpQixDQUFDLEdBQW9FO0FBQ3JJLFVBQU0sSUFBSSxTQUFTLGNBQWMsS0FBSztBQUN0QyxVQUFNLE1BQU0sRUFBRSxPQUFPLEtBQUssTUFBTSxFQUFFLE9BQU8sSUFBSSxRQUFRLEVBQUUsU0FBUztBQUNoRSxNQUFFLE1BQU0sVUFBVSx5RUFBeUUsRUFBRSxTQUFTLFNBQVMsSUFBSSxHQUFHLG1CQUFtQixNQUFNLEdBQUc7QUFDbEosVUFBTSxPQUFPLENBQUM7QUFDZCxXQUFPLENBQUNDLE1BQUtDLFFBQU8sWUFBWSxNQUFNO0FBQ3BDLFlBQU0sSUFBSSxTQUFTLEVBQUUsR0FBR0QsTUFBSyxNQUFNQSxLQUFJLE9BQU8sVUFBVSxHQUFHLE9BQU9DLE1BQUs7QUFDdkUsWUFBTSxJQUFJLE1BQU0sRUFBRTtBQUNsQixRQUFFLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxNQUFNLENBQUM7QUFDcEMsUUFBRSxNQUFNLHFCQUFxQixHQUFHLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBT0EsT0FBTSxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU9BLE9BQU0sU0FBUyxDQUFDO0FBQUEsSUFDdkc7QUFBQSxFQUNGO0FBT08sV0FBUyxTQUFTLE9BQW9CLFFBQXFCLEdBQVcsSUFBWSxJQUFZLElBQWdFLENBQUMsR0FBK0M7QUFDbk4sVUFBTSxJQUFJLEtBQUssR0FBRyxJQUFJLEtBQUssRUFBRTtBQUM3QixRQUFJLEtBQUssRUFBRyxRQUFPLEVBQUUsR0FBRyxLQUFLLElBQUksUUFBUSxHQUFHO0FBQzVDLFVBQU0sSUFBSSxFQUFFLE9BQU8sU0FBUyxNQUFNLElBQUksRUFBRSxPQUFPLFVBQVU7QUFDekQsVUFBTSxNQUFNLFlBQVk7QUFBUSxXQUFPLE1BQU0sWUFBWTtBQUN6RCxVQUFNLENBQUMsSUFBSSxFQUFFLElBQUksV0FBVyxRQUFRLEtBQUssR0FBRztBQUM1QyxVQUFNLElBQUksV0FBVyxDQUFDLEdBQUcsS0FBSyxLQUFLLElBQUksS0FBSyxJQUFJLEVBQUUsWUFBWSxFQUFFLElBQUksS0FBSyxJQUFJLEdBQUcsR0FBRyxDQUFDO0FBQ3BGLFdBQU8sTUFBTSxRQUFRLG9CQUFvQixJQUFJLE1BQU0sS0FBSyxFQUFFLFlBQVksSUFBSSxDQUFDO0FBQzNFLFdBQU8sRUFBRSxHQUFHLEtBQUssY0FBYyxJQUFJLElBQUksTUFBTSxDQUFDLE9BQU8sSUFBSSxJQUFJLE1BQU0sQ0FBQyxhQUFhLEVBQUUsS0FBSyxRQUFRLEdBQUcsRUFBRSxNQUFNLEVBQUUsS0FBSztBQUFBLEVBQ3BIO0FBMEJBLE1BQU0sVUFBVTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFRVCxXQUFTLFFBQVEsT0FBb0IsR0FBc0w7QUFDaE8sZ0JBQVksWUFBWSxPQUFPO0FBQy9CLFVBQU0sS0FBSyxTQUFTLGNBQWMsS0FBSztBQUFHLE9BQUcsWUFBWTtBQUN6RCxPQUFHLFlBQVk7QUFDZixVQUFNLE9BQU8sRUFBRTtBQUNmLFVBQU0sT0FBTyxHQUFHLGNBQTJCLE9BQU8sR0FBSSxPQUFPLEdBQUcsY0FBMkIsT0FBTyxHQUFJLE1BQU0sR0FBRyxjQUEyQixNQUFNO0FBQ2hKLFNBQUssY0FBYyxFQUFFO0FBQ3JCLFVBQU0sWUFBWSxPQUFPLE1BQU0sRUFBRSxNQUFNLEVBQUUsT0FBTyxLQUFLLENBQUMsR0FBRyxXQUFXLE9BQU8sS0FBSyxFQUFFLE9BQU87QUFDekYsV0FBTztBQUFBLE1BQ0w7QUFBQSxNQUNBLE9BQU8sR0FBRztBQUNSLGNBQU0sT0FBTyxJQUFJLFVBQVUsS0FBSyxHQUFHLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxJQUFJO0FBQzdELGNBQU0sS0FBSyxPQUFPLElBQUksRUFBRSxHQUFHLE1BQU0sRUFBRSxNQUFNLEtBQUssTUFBTSxJQUFJLENBQUM7QUFDekQsYUFBSyxNQUFNLGFBQWEsQ0FBQyxLQUFLLGNBQWMsSUFBSTtBQUNoRCxXQUFHLE1BQU0sU0FBUyxLQUFLLElBQUksR0FBRyxFQUFFLElBQUksSUFBSSxhQUFhLElBQUksTUFBTSxHQUFHLFFBQVEsT0FBTyxJQUFJLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQztBQUNwRyxhQUFLLE1BQU0sWUFBWSxJQUFJLE1BQU0sWUFBWSxTQUFTLElBQUk7QUFDMUQsZUFBTyxXQUFXLEdBQUcsRUFBRSxHQUFHLE1BQU0sVUFBVSxFQUFFLFNBQVMsTUFBTSxLQUFLLElBQUksQ0FBQztBQUNyRSxlQUFPLFVBQVUsR0FBRyxFQUFFLEdBQUcsS0FBSyxVQUFVLEVBQUUsU0FBUyxNQUFNLEtBQUssSUFBSSxDQUFDO0FBQUEsTUFDckU7QUFBQSxJQUNGO0FBQUEsRUFDRjs7O0FDckRPLE1BQU0sbUJBQU4sY0FBK0IsTUFBTTtBQUFBLElBQzFDO0FBQUEsSUFBZTtBQUFBLElBQ2YsWUFBWSxPQUFlLEdBQVcsT0FBZ0I7QUFDcEQsWUFBTSxNQUFNLGlCQUFpQixRQUFRLE1BQU0sVUFBVSxPQUFPLEtBQUs7QUFDakUsWUFBTSxVQUFVLEtBQUssVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDLE1BQU0sR0FBRyxFQUFFO0FBQ3RELFdBQUssT0FBTztBQUFvQixXQUFLLFFBQVE7QUFBTyxXQUFLLElBQUk7QUFDN0QsVUFBSSxpQkFBaUIsU0FBUyxNQUFNLE1BQU8sTUFBSyxRQUFRLEdBQUcsS0FBSyxJQUFJLEtBQUssS0FBSyxPQUFPO0FBQUEsRUFBSyxNQUFNLE1BQU0sTUFBTSxJQUFJLEVBQUUsTUFBTSxDQUFDLEVBQUUsS0FBSyxJQUFJLENBQUM7QUFBQSxJQUN2STtBQUFBLEVBQ0Y7QUFFQSxNQUFNLFdBQVcsQ0FBQyxHQUFXLE9BQTRCLEVBQUUsR0FBRyxJQUFJLEdBQUcsR0FBRyxJQUFJLEdBQUcsTUFBTSxHQUFHLFFBQVEsRUFBRTtBQU9sRyxXQUFTLGNBQXVDO0FBQzlDLFFBQUksTUFBTSxHQUFHLE9BQU8sSUFBSSxDQUFDO0FBQ3pCLFVBQU0sUUFBUSxLQUFLLElBQUksTUFBTSxHQUFHLENBQUM7QUFDakMsU0FBSyxTQUFTLE1BQU0sS0FBSztBQUN6QixTQUFLLE1BQU0sTUFBTSxRQUFRLE1BQU07QUFDL0IsZ0JBQVksTUFBTSxNQUFNLE1BQU07QUFDOUIsV0FBTyxFQUFFLEdBQUcsR0FBVztBQUFFLFlBQU07QUFBRyxhQUFPLElBQUksT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFBQSxJQUFHLEVBQUU7QUFBQSxFQUN4RTtBQUVBLGlCQUFzQixNQUFNLE9BQWlCQyxRQUFnRCxDQUFDLEdBQXNCO0FBQ2xILFVBQU0sU0FBUyxJQUFJLGdCQUFnQixTQUFTLE1BQU07QUFDbEQsVUFBTSxJQUFJLFdBQVcsT0FBUSxPQUFPLElBQUksUUFBUSxLQUF1QkEsTUFBSyxNQUFNO0FBQ2xGLFVBQU0sSUFBSSxFQUFFLE1BQU0sT0FBTyxJQUFJLEVBQUUsTUFBTTtBQUNyQyxVQUFNLFFBQVEsWUFBWTtBQUMxQixVQUFNLEtBQUssRUFBRSxjQUFjLEVBQUUsTUFBTSxPQUFPO0FBRTFDLFVBQU0sUUFBUSxTQUFTLGNBQWMsT0FBTztBQUM1QyxVQUFNLGNBQWMsR0FBRyxTQUFTLEVBQUUsT0FBT0EsTUFBSyxhQUFhLEVBQUUsQ0FBQztBQUFBO0FBQUE7QUFBQTtBQUFBLG9EQUlaLENBQUMsYUFBYSxDQUFDLHNEQUFzRCxFQUFFO0FBQUEsb0RBQ3ZFLENBQUMsYUFBYSxDQUFDO0FBQUE7QUFBQTtBQUFBLGdEQUduQixDQUFDLGFBQWEsQ0FBQztBQUM3RCxhQUFTLEtBQUssT0FBTyxLQUFLO0FBQzFCLFVBQU0sVUFBVSxFQUFFLE1BQU0sV0FBVyxDQUFDLEdBQUcsSUFBSSxVQUFRLElBQUksUUFBYyxDQUFDLEtBQUssUUFBUTtBQUNqRixZQUFNLElBQUksU0FBUyxjQUFjLE1BQU07QUFBRyxRQUFFLE1BQU07QUFBYyxRQUFFLE9BQU87QUFDekUsUUFBRSxTQUFTLE1BQU0sSUFBSTtBQUFHLFFBQUUsVUFBVSxNQUFNLElBQUksSUFBSSxNQUFNLG1DQUFtQyxJQUFJLEVBQUUsQ0FBQztBQUNsRyxlQUFTLEtBQUssT0FBTyxDQUFDO0FBQUEsSUFDeEIsQ0FBQyxDQUFDO0FBRUYsVUFBTUMsU0FBUSxTQUFTLGNBQWMsS0FBSztBQUFHLElBQUFBLE9BQU0sS0FBSztBQUN4RCxVQUFNLFFBQVEsU0FBUyxjQUFjLEtBQUs7QUFBRyxVQUFNLEtBQUs7QUFBZSxVQUFNLFlBQVk7QUFDekYsVUFBTSxNQUFNLFNBQVMsY0FBYyxLQUFLO0FBQUcsUUFBSSxLQUFLO0FBQWEsUUFBSSxZQUFZO0FBQ2pGLElBQUFBLE9BQU0sT0FBTyxPQUFPLEdBQUc7QUFDdkIsYUFBUyxLQUFLLE9BQU9BLE1BQUs7QUFFMUIsVUFBTSxNQUFNLE1BQWM7QUFDeEIsWUFBTSxJQUFJLEtBQUssSUFBSSxhQUFhLEdBQUcsY0FBYyxDQUFDO0FBQ2xELE1BQUFBLE9BQU0sTUFBTSxZQUFZLFNBQVMsQ0FBQztBQUNsQyxNQUFBQSxPQUFNLE1BQU0sUUFBUSxhQUFhLElBQUksS0FBSyxJQUFJO0FBQzlDLE1BQUFBLE9BQU0sTUFBTSxPQUFPLGNBQWMsSUFBSSxLQUFLLElBQUk7QUFDOUMsZUFBU0EsUUFBTyxDQUFDO0FBQ2pCLGFBQU87QUFBQSxJQUNUO0FBQ0EsUUFBSSxRQUFRLElBQUk7QUFDaEIscUJBQWlCLFVBQVUsTUFBTTtBQUFFLGNBQVEsSUFBSTtBQUFBLElBQUcsQ0FBQztBQUVuRCxVQUFNQyxVQUFTLENBQUMsTUFBNEIsRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLElBQUksU0FBUyxHQUFHLENBQUM7QUFDbEYsVUFBTSxVQUFVLFdBQVcsQ0FBQztBQUM1QixVQUFNLFVBQVUsb0JBQUksSUFBeUI7QUFDN0MsVUFBTSxjQUFjLENBQUMsTUFBMkI7QUFDOUMsVUFBSSxJQUFJLFFBQVEsSUFBSSxDQUFDO0FBQ3JCLFVBQUksQ0FBQyxHQUFHO0FBQUUsWUFBSSxTQUFTLGNBQWMsS0FBSztBQUFHLFVBQUUsWUFBWTtBQUFlLFVBQUUsTUFBTSxTQUFTLE9BQU8sQ0FBQztBQUFHLFFBQUFELE9BQU0sT0FBTyxDQUFDO0FBQUcsZ0JBQVEsSUFBSSxHQUFHLENBQUM7QUFBQSxNQUFHO0FBQzFJLGFBQU87QUFBQSxJQUNUO0FBR0EsVUFBTSxVQUFVLENBQUMsTUFBYyxVQUF1QztBQUNwRSxZQUFNLFlBQVksQ0FBQyxRQUFxQixVQUErQjtBQUNyRSxjQUFNLElBQUksU0FBUyxjQUFjLEtBQUs7QUFDdEMsVUFBRSxZQUFZO0FBQVcsVUFBRSxRQUFRLFFBQVE7QUFBTSxVQUFFLFFBQVEsUUFBUTtBQUNuRSxlQUFPLE9BQU8sQ0FBQztBQUFHLGNBQU0sS0FBSyxDQUFDO0FBQUcsZUFBTztBQUFBLE1BQzFDO0FBQ0EsVUFBSSxHQUE0QjtBQUNoQyxZQUFNLE1BQW9CO0FBQUEsUUFDeEIsT0FBTztBQUFBLFFBQUcsT0FBTyxFQUFFO0FBQUEsUUFBTyxRQUFRLEVBQUUsVUFBVTtBQUFBLFFBQVEsT0FBTyxFQUFFO0FBQUEsUUFDL0QsSUFBSSxRQUFRO0FBQUUsaUJBQVEsTUFBTSxVQUFVLE9BQU8sT0FBTztBQUFBLFFBQUk7QUFBQSxRQUN4RCxJQUFJLE1BQU07QUFBRSxpQkFBUSxPQUFPLFVBQVUsS0FBSyxLQUFLO0FBQUEsUUFBSTtBQUFBLFFBQ25ELFFBQVEsRUFBRSxPQUFBQSxRQUFPLE9BQU8sSUFBSTtBQUFBLFFBQzVCLFFBQVEsQ0FBQyxHQUFXLFFBQVEsU0FBUyxDQUFDLE9BQU8sVUFBVSxZQUFZLENBQUMsR0FBRyxLQUFLO0FBQUEsUUFDNUUsUUFBQUM7QUFBQSxRQUNBLEdBQUcsQ0FBQyxPQUFlO0FBQ2pCLHFCQUFXLEtBQUssT0FBTztBQUFFLGtCQUFNLEtBQUssRUFBRSxjQUEyQixJQUFJLElBQUksT0FBTyxFQUFFLENBQUMsRUFBRTtBQUFHLGdCQUFJLEdBQUksUUFBTztBQUFBLFVBQUk7QUFDM0csZ0JBQU0sSUFBSSxNQUFNLFVBQVUsSUFBSSxrQkFBa0IsRUFBRSxFQUFFO0FBQUEsUUFDdEQ7QUFBQSxRQUNBLFFBQVEsQ0FBQyxNQUFjO0FBQ3JCLGdCQUFNLFFBQVEsUUFBUSxLQUFLLE9BQUssRUFBRSxTQUFTLENBQUM7QUFDNUMsY0FBSSxDQUFDLE1BQU8sT0FBTSxJQUFJLE1BQU0sY0FBYyxDQUFDLFlBQVksUUFBUSxJQUFJLE9BQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxJQUFJLENBQUMsR0FBRztBQUM3RixpQkFBTyxNQUFNO0FBQUEsUUFDZjtBQUFBLE1BQ0Y7QUFDQSxhQUFPO0FBQUEsSUFDVDtBQUVBLFVBQU0sVUFBcUIsQ0FBQztBQUM1QixVQUFNLGFBQTRCLENBQUM7QUFDbkMsVUFBTSxXQUFXLFFBQVEsU0FBUyxVQUFVO0FBQzVDLFlBQVEsS0FBSyxFQUFFLEtBQUssTUFBTSxNQUFNLFNBQVMsS0FBSyxVQUFVLFlBQVksWUFBWSxTQUFTLEtBQUssQ0FBQztBQUMvRixlQUFXLEtBQUssRUFBRSxRQUFRO0FBQ3hCLFlBQU0sUUFBdUIsQ0FBQztBQUM5QixjQUFRLEtBQUssRUFBRSxLQUFLLEdBQUcsTUFBTSxFQUFFLE1BQU0sS0FBSyxRQUFRLEVBQUUsTUFBTSxLQUFLLEdBQUcsWUFBWSxPQUFPLFNBQVMsS0FBSyxDQUFDO0FBQUEsSUFDdEc7QUFFQSxVQUFNLE9BQU8sQ0FBQyxHQUFXLE1BQTRCO0FBQ25ELFlBQU0sUUFBUSxHQUFHLFNBQVMsR0FBRyxNQUFNLEdBQUcsT0FBTyxFQUFFO0FBQy9DLGFBQU8sRUFBRSxHQUFHLE9BQU8sSUFBSSxPQUFPLFVBQVUsS0FBSyxJQUFJLEdBQUcsS0FBSyxJQUFJLElBQUksSUFBSSxVQUFVLE1BQU0sTUFBTSxDQUFDLEdBQUcsT0FBTyxJQUFJO0FBQUEsSUFDNUc7QUFFQSxVQUFNLFNBQVMsQ0FBQyxNQUFvQjtBQUNsQyxZQUFNLEdBQUcsQ0FBQztBQUNWLFlBQU0sTUFBTSxZQUFZLGdCQUFnQkEsUUFBTyxDQUFDLEdBQUcsRUFBRSxLQUFLO0FBQzFELFVBQUksRUFBRSxPQUFPLFFBQVE7QUFDbkIsWUFBSTtBQUFFLFlBQUUsTUFBTSxPQUFPLEtBQUssQ0FBQyxHQUFHLFFBQVE7QUFBQSxRQUFHLFNBQVMsR0FBRztBQUFFLGdCQUFNLElBQUksaUJBQWlCLFNBQVMsR0FBRyxDQUFDO0FBQUEsUUFBRztBQUFBLE1BQ3BHO0FBQ0EsaUJBQVcsS0FBSyxTQUFTO0FBQ3ZCLFlBQUksQ0FBQyxFQUFFLElBQUs7QUFDWixjQUFNLEtBQUssS0FBSyxFQUFFLElBQUksU0FBUyxJQUFJLEVBQUUsSUFBSTtBQUV6QyxZQUFJLE9BQU8sRUFBRSxTQUFTO0FBQUUscUJBQVcsS0FBSyxFQUFFLFdBQVksR0FBRSxNQUFNLFVBQVUsS0FBSyxLQUFLO0FBQVEsWUFBRSxVQUFVO0FBQUEsUUFBSTtBQUMxRyxZQUFJLENBQUMsR0FBSTtBQUNULFlBQUk7QUFBRSxZQUFFLElBQUksT0FBTyxLQUFLLEdBQUcsRUFBRSxHQUFHLEdBQUcsRUFBRSxHQUFHO0FBQUEsUUFBRyxTQUFTLEdBQUc7QUFBRSxnQkFBTSxJQUFJLGlCQUFpQixFQUFFLE1BQU0sR0FBRyxDQUFDO0FBQUEsUUFBRztBQUFBLE1BQ3JHO0FBQUEsSUFDRjtBQUVBLFVBQU0sT0FBa0I7QUFBQSxNQUN0QixPQUFPLEVBQUU7QUFBQSxNQUFPLEtBQUssRUFBRTtBQUFBLE1BQUssVUFBVSxFQUFFO0FBQUEsTUFBVSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU07QUFBQSxNQUFHLEtBQUssRUFBRTtBQUFBLE1BQUssWUFBWSxFQUFFO0FBQUEsTUFDbkcsUUFBUSxFQUFFLFVBQVU7QUFBQSxNQUFRLFFBQVEsRUFBRSxPQUFPLElBQUksUUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLE9BQU8sRUFBRSxPQUFPLEtBQUssRUFBRSxLQUFLLE1BQU0sRUFBRSxLQUFLLEVBQUU7QUFBQSxNQUNsSDtBQUFBLE1BQVMsT0FBTyxFQUFFLFNBQVMsQ0FBQztBQUFBLE1BQUcsWUFBWTtBQUFBLElBQzdDO0FBRUEsVUFBTSxRQUFRO0FBQ2QsVUFBTSxVQUFVLE1BQWlCLENBQUMsR0FBR0QsT0FBTSxpQkFBaUIsR0FBRyxDQUFDLEVBQUUsT0FBTyxRQUN2RSxDQUFDLE1BQU0sS0FBSyxHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUcsVUFBVSxTQUFTLGFBQWEsS0FBSyxDQUFDLEdBQUcsVUFBVSxTQUFTLFNBQVMsQ0FBQztBQUNsRyxVQUFNLGFBQWEsQ0FBQyxPQUFnQztBQUNsRCxVQUFJLENBQUMsR0FBRyxnQkFBZ0IsRUFBRSxpQkFBaUIsTUFBTSxvQkFBb0IsS0FBSyxDQUFDLEVBQUcsUUFBTztBQUNyRixZQUFNLElBQUksR0FBRyxzQkFBc0I7QUFDbkMsYUFBTyxFQUFFLFNBQVMsRUFBRSxTQUFTLElBQUk7QUFBQSxJQUNuQztBQUVBLFVBQU0sU0FBUyxDQUFDLElBQVksT0FBZTtBQUN6QyxZQUFNLEtBQUtBLE9BQU0sc0JBQXNCO0FBQ3ZDLFlBQU0sU0FBUyxDQUFDLEdBQVcsZUFBd0IsYUFBYSxLQUFLLEdBQUcsT0FBTyxLQUFLLEtBQUssR0FBRyxRQUFRLElBQUksS0FBSyxHQUFHLE1BQU0sS0FBSyxLQUFLLEdBQUcsU0FBUztBQUM1SSxhQUFPLEVBQUU7QUFDVCxZQUFNLElBQUksb0JBQUksSUFBc0I7QUFDcEMsaUJBQVcsTUFBTSxRQUFRLEdBQUc7QUFBRSxjQUFNLElBQUksV0FBVyxFQUFFO0FBQUcsWUFBSSxFQUFHLEdBQUUsSUFBSSxJQUFJLENBQUM7QUFBQSxNQUFHO0FBQzdFLGFBQU8sRUFBRTtBQUNULFVBQUksS0FBSyxHQUFHLE1BQXNCO0FBQ2xDLGlCQUFXLE1BQU0sUUFBUSxHQUFHO0FBQzFCLGNBQU0sS0FBSyxFQUFFLElBQUksRUFBRTtBQUFHLFlBQUksQ0FBQyxHQUFJO0FBQy9CLGNBQU0sS0FBSyxXQUFXLEVBQUU7QUFBRyxZQUFJLENBQUMsR0FBSTtBQUVwQyxjQUFNLElBQUksS0FBSztBQUFBLFVBQ2IsT0FBTyxHQUFHLE1BQU0sSUFBSSxLQUFLLE9BQU8sR0FBRyxNQUFNLElBQUksSUFBSSxLQUFLLElBQUksR0FBRyxPQUFPLEdBQUcsSUFBSSxJQUFJO0FBQUEsVUFDL0UsT0FBTyxHQUFHLE9BQU8sSUFBSSxLQUFLLE9BQU8sR0FBRyxPQUFPLElBQUksSUFBSSxLQUFLLElBQUksR0FBRyxRQUFRLEdBQUcsS0FBSyxJQUFJO0FBQUEsVUFDbkYsT0FBTyxHQUFHLEtBQUssS0FBSyxLQUFLLE9BQU8sR0FBRyxLQUFLLEtBQUssSUFBSSxLQUFLLElBQUksR0FBRyxNQUFNLEdBQUcsR0FBRyxJQUFJO0FBQUEsVUFDN0UsT0FBTyxHQUFHLFFBQVEsS0FBSyxLQUFLLE9BQU8sR0FBRyxRQUFRLEtBQUssSUFBSSxLQUFLLElBQUksR0FBRyxTQUFTLEdBQUcsTUFBTSxJQUFJO0FBQUEsUUFBQztBQUM1RixZQUFJLElBQUksSUFBSTtBQUFFLGVBQUs7QUFBRyxnQkFBTTtBQUFBLFFBQUk7QUFBQSxNQUNsQztBQUNBLFlBQU1FLE9BQU0sbUJBQW1CRCxRQUFPLEVBQUUsR0FBR0EsUUFBTyxFQUFFLEdBQUcsRUFBRSxLQUFLLElBQUk7QUFDbEUsYUFBTyxFQUFFLElBQUksS0FBSyxJQUFJLElBQUlDLElBQUcsR0FBRyxRQUFRQSxNQUFLLFNBQVMsTUFBTSxTQUFTLEdBQUcsSUFBSSxLQUFLO0FBQUEsSUFDbkY7QUFFQSxVQUFNLFdBQVcsQ0FBQyxPQUF3QjtBQUN4QyxZQUFNLElBQUssR0FBbUIsU0FBUyxTQUFTLEdBQUcsS0FBSyxJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ3RFLFVBQUksRUFBRyxRQUFPO0FBQ2QsWUFBTSxRQUFrQixDQUFDO0FBQ3pCLGVBQVMsSUFBb0IsSUFBSSxLQUFLLE1BQU1GLFVBQVMsTUFBTSxTQUFTLEdBQUcsSUFBSSxFQUFFLGVBQWU7QUFDMUYsWUFBSSxFQUFFLElBQUk7QUFBRSxnQkFBTSxRQUFRLElBQUksRUFBRSxFQUFFLEVBQUU7QUFBRztBQUFBLFFBQU87QUFDOUMsY0FBTSxNQUFNLENBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRSxPQUFPLE9BQUssQ0FBQyxFQUFFLFdBQVcsUUFBUSxDQUFDLEVBQUUsQ0FBQztBQUNuRSxjQUFNLFFBQVEsRUFBRSxRQUFRLFlBQVksS0FBSyxNQUFNLElBQUksR0FBRyxLQUFLLEdBQUc7QUFBQSxNQUNoRTtBQUNBLGFBQU8sTUFBTSxLQUFLLEtBQUs7QUFBQSxJQUN6QjtBQUVBLFVBQU0sVUFBVSxDQUFDLEdBQVcsSUFBdUIsQ0FBQyxNQUFxQjtBQUN2RSxhQUFPLENBQUM7QUFDUixZQUFNLEtBQUtBLE9BQU0sc0JBQXNCO0FBQ3ZDLFlBQU0sTUFBMEIsQ0FBQztBQUNqQyxpQkFBVyxNQUFNLFFBQVEsR0FBRztBQUMxQixjQUFNLElBQUksV0FBVyxFQUFFO0FBQUcsWUFBSSxDQUFDLEVBQUc7QUFDbEMsY0FBTSxNQUFNLENBQUMsR0FBRyxHQUFHLFVBQVUsRUFBRSxPQUFPLE9BQUssRUFBRSxhQUFhLENBQUMsRUFBRSxJQUFJLE9BQUssRUFBRSxlQUFlLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxLQUFLO0FBQ3pHLFlBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFLO0FBQ3BCLFlBQUksS0FBSztBQUNULGlCQUFTLElBQW9CLElBQUksS0FBSyxNQUFNQSxRQUFPLElBQUksRUFBRSxjQUFlLE9BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO0FBQ25HLGNBQU0sS0FBSyxpQkFBaUIsRUFBRTtBQUM5QixZQUFJO0FBQ0osaUJBQVMsSUFBb0IsSUFBSSxHQUFHLElBQUksRUFBRSxlQUFlO0FBQ3ZELGdCQUFNLElBQUksaUJBQWlCLENBQUMsRUFBRTtBQUM5QixjQUFJLEtBQUssTUFBTSxpQkFBaUIsQ0FBQyxzQkFBc0IsS0FBSyxDQUFDLEdBQUc7QUFBRSxrQkFBTTtBQUFHO0FBQUEsVUFBTztBQUNsRixjQUFJLE1BQU1BLE9BQU87QUFBQSxRQUNuQjtBQUNBLGNBQU0sS0FBSztBQUNYLGNBQU0sUUFBUSxHQUFHLGVBQWUsRUFBRSxTQUFTLEdBQUcsZUFBZTtBQUM3RCxZQUFJLEtBQUs7QUFBQSxVQUNQLE1BQU0sU0FBUyxFQUFFO0FBQUEsVUFBRyxPQUFRLEdBQUcsUUFBUSxVQUFVLEdBQTBCLFFBQVEsU0FBUztBQUFBLFVBQzVGLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxHQUFHLFFBQVEsT0FBTyxJQUFJLEVBQUUsTUFBTSxHQUFHLE9BQU8sT0FBTyxHQUFHLEVBQUUsUUFBUSxPQUFPLEdBQUcsRUFBRSxTQUFTLE1BQU07QUFBQSxVQUM1RyxTQUFTLENBQUMsR0FBRyxRQUFRLENBQUM7QUFBQSxVQUN0QixHQUFJLE1BQU0sRUFBRSxNQUFNLEtBQUssVUFBVSxFQUFFLFdBQVcsR0FBRyxRQUFRLElBQUksUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLE9BQU8sR0FBRyxPQUFPLFlBQVksT0FBTyxHQUFHLElBQUksQ0FBQztBQUFBLFFBQ3RJLENBQUM7QUFBQSxNQUNIO0FBQ0EsYUFBTyxFQUFFLEdBQUcsUUFBUUMsUUFBTyxDQUFDLEdBQUcsUUFBUSxhQUFhLEdBQUcsQ0FBQyxFQUFFLElBQUksT0FBSyxFQUFFLElBQUksR0FBRyxVQUFVLElBQUk7QUFBQSxJQUM1RjtBQUVBLFVBQU0sTUFBZ0IsRUFBRSxTQUFTLEdBQUcsTUFBTSxPQUFPLE1BQXVDLFFBQVEsUUFBUSxTQUFTLEtBQUssTUFBTyxRQUFRLElBQUksRUFBRztBQUM1SSxXQUFPLFVBQVU7QUFFakIsUUFBSSxTQUFTLFlBQVk7QUFDdkIsVUFBSSxFQUFFLE9BQU8sTUFBTyxPQUFNLEVBQUUsTUFBTSxNQUFNLFFBQVE7QUFDaEQsaUJBQVcsS0FBSyxRQUFTLEtBQUksRUFBRSxLQUFLLE9BQU87QUFDekMsWUFBSTtBQUFFLGdCQUFNLEVBQUUsSUFBSSxNQUFNLEVBQUUsR0FBRztBQUFBLFFBQUcsU0FBUyxHQUFHO0FBQUUsZ0JBQU0sSUFBSSxpQkFBaUIsRUFBRSxNQUFNLEdBQUcsQ0FBQztBQUFBLFFBQUc7QUFBQSxNQUMxRjtBQUNBLFlBQU0sUUFBUSxJQUFJLE1BQU07QUFDeEIsWUFBTSxRQUFRLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDcEMsWUFBTSxVQUFVLE1BQU0sUUFBUSxJQUFJLE1BQU0sSUFBSSxPQUFLLFNBQVMsTUFBTSxLQUFLLEdBQUcsRUFBRSxTQUFTLFFBQVEsSUFBSSxFQUFFLFFBQVEsTUFBTSxHQUFHLEVBQUUsQ0FBQyxLQUFLLEtBQUssVUFBVSxFQUFFLE1BQU0sR0FBRyxFQUFFLEtBQUssT0FBSyxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQVUsQ0FBQyxDQUFDO0FBQ3hMLFlBQU0sVUFBVSxRQUFRLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLE1BQU0sQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLEVBQUUsTUFBTSxJQUFJLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxPQUFPLGNBQWMsR0FBRztBQUM1SCxVQUFJLFFBQVEsT0FBUSxPQUFNLElBQUksTUFBTSx5QkFBeUIsUUFBUSxLQUFLLElBQUksQ0FBQyxFQUFFO0FBQ2pGLFlBQU0sU0FBUyxNQUFNO0FBQ3JCLFlBQU0sUUFBUSxJQUFJLENBQUMsR0FBRyxTQUFTLE1BQU0sRUFBRSxJQUFJLE9BQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxNQUFNO0FBQUUsY0FBTSxJQUFJLE1BQU0seUJBQXlCLEVBQUUsR0FBRyxFQUFFO0FBQUEsTUFBRyxDQUFDLENBQUMsQ0FBQztBQUMvSCxhQUFPLENBQUM7QUFDUixhQUFPO0FBQUEsSUFDVCxHQUFHO0FBQ0gsV0FBTztBQUFBLEVBQ1Q7OztBQzNSTyxNQUFNLFFBQVEsWUFBWTtBQUFBLElBQy9CLE1BQU07QUFBQSxJQUNOLFFBQVEsRUFBRSxJQUFJLFdBQVcsSUFBSSxXQUFXLFFBQVEsV0FBVyxlQUFlLFdBQVcsT0FBTyxXQUFXLFNBQVMsV0FBVyxLQUFLLFdBQVcsTUFBTSxXQUFXLE1BQU0sVUFBVTtBQUFBO0FBQUEsSUFFNUssT0FBTyxFQUFFLFNBQVMscUNBQXFDLE1BQU0sNkNBQTZDLE9BQU8saUNBQWlDLElBQUksNENBQTRDO0FBQUE7QUFBQSxJQUVsTSxTQUFTLENBQUMsbUtBQW1LO0FBQUEsSUFDN0ssV0FBVztBQUFBLE1BQ1QsRUFBRSxRQUFRLHVCQUF1QixRQUFRLE1BQU07QUFBQSxNQUFHLEVBQUUsUUFBUSx1QkFBdUIsUUFBUSxNQUFNO0FBQUEsTUFDakcsRUFBRSxRQUFRLG1CQUFtQixRQUFRLE1BQU07QUFBQSxNQUFHLEVBQUUsUUFBUSxtQkFBbUIsUUFBUSxNQUFNO0FBQUEsTUFBRyxFQUFFLFFBQVEsbUJBQW1CLFFBQVEsTUFBTTtBQUFBLElBQ3pJO0FBQUEsSUFDQSxPQUFPLEVBQUUsSUFBSSxHQUFHLElBQUksSUFBSSxJQUFJLEdBQUc7QUFBQSxJQUMvQixTQUFTO0FBQUEsTUFDUCxNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0YsQ0FBQzs7O0FDaEJNLE1BQU0sSUFBNEIsRUFBRSxLQUFLLEdBQUcsS0FBSyxRQUFRLEtBQUssU0FBUyxLQUFLLFFBQVEsS0FBSyxTQUFTLEtBQUssUUFBUSxLQUFLLE9BQU8sS0FBSyxRQUFRLEtBQUssT0FBTztBQUMzSixNQUFNLEtBQUssQ0FBQyxHQUFXLElBQUksTUFBTSxFQUFFLGVBQWUsU0FBUyxFQUFFLHVCQUF1QixHQUFHLHVCQUF1QixFQUFFLENBQUM7QUFDakgsTUFBTSxNQUFzRCxFQUFFLEtBQUssRUFBRSxLQUFLLE9BQU8sR0FBRyxLQUFLLEVBQUUsS0FBSyxTQUFJLEdBQUcsS0FBSyxFQUFFLEtBQUssSUFBSSxHQUFHLEtBQUssRUFBRSxLQUFLLE9BQUksRUFBRTtBQUNySSxXQUFTLE1BQU0sR0FBVyxJQUFJLE9BQWU7QUFDbEQsVUFBTSxJQUFJLElBQUksQ0FBQztBQUFHLFFBQUksS0FBYSxLQUFLO0FBQ3hDLFFBQUksS0FBSyxLQUFLO0FBQUUsWUFBTSxHQUFHLElBQUksS0FBSyxDQUFDO0FBQUcsV0FBSztBQUFBLElBQVMsV0FBVyxLQUFLLEtBQUs7QUFBRSxZQUFNLEdBQUcsSUFBSSxLQUFLLENBQUM7QUFBRyxXQUFLO0FBQUEsSUFBUyxXQUN0RyxLQUFLLEtBQUs7QUFBRSxZQUFNLEdBQUcsSUFBSSxLQUFLLENBQUM7QUFBRyxXQUFLO0FBQUEsSUFBUyxXQUFXLEtBQUssR0FBSSxPQUFNLEdBQUcsS0FBSyxNQUFNLENBQUMsQ0FBQztBQUFBLFFBQVEsT0FBTSxHQUFHLEdBQUcsQ0FBQztBQUN4SCxXQUFPLEVBQUUsTUFBTSxHQUFHLEVBQUUsR0FBRyxHQUFHLEdBQUcsR0FBRyxFQUFFLEtBQUssR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRztBQUFBLEVBQzVEO0FBQ08sTUFBTSxPQUFPLENBQUMsR0FBVyxNQUFjLEtBQUssVUFBa0IsTUFBTSxJQUFJLEVBQUUsSUFBSSxJQUFJLEVBQUUsRUFBRSxHQUFHLEVBQUU7QUFHM0YsTUFBTSxTQUFTLENBQUMsTUFBTSxNQUFNLE9BQU8sS0FBSztBQUN4QyxNQUFNLFNBQVM7QUFBZixNQUFxQixVQUFVO0FBQS9CLE1BQW9DLFdBQVc7QUFDL0MsTUFBTSxNQUFNLEVBQUUsT0FBTyxPQUFPLFVBQVUsTUFBTSxPQUFPLElBQU0sTUFBTSxNQUFNLE9BQU8sT0FBTyxNQUFNLE1BQU0sV0FBVyxLQUFLO0FBQy9HLE1BQU0sTUFBTSxFQUFFLE9BQU8sSUFBTSxNQUFNLE9BQU8sU0FBUyxNQUFNO0FBQ3ZELE1BQU0sTUFBTSxFQUFFLE1BQU0sTUFBTSxNQUFNLE1BQU0sS0FBSyxNQUFNO0FBRWpELFdBQVMsZUFBcUI7QUFDbkMsZ0JBQVksY0FBYztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLENBZ0IzQjtBQUFBLEVBQ0Q7OztBQ25DQSxNQUFNLFFBQWdHO0FBQUEsSUFDcEcsQ0FBQyxTQUFTLG1CQUFjLE1BQVMsT0FBTyxLQUFLLEVBQUU7QUFBQSxJQUMvQyxDQUFDLFlBQVksUUFBUSxLQUFLLE9BQU8sTUFBTSxHQUFHO0FBQUEsSUFDMUMsQ0FBQyxVQUFVLGdCQUFXLE9BQU8sT0FBTyxLQUFLLEdBQUc7QUFBQSxJQUM1QyxDQUFDLFNBQVMsY0FBVyxPQUFPLE9BQU8sS0FBSyxHQUFHO0FBQUEsSUFDM0MsQ0FBQyxVQUFVLFdBQVEsS0FBSyxPQUFPLEtBQUssR0FBRztBQUFBLElBQ3ZDLENBQUMsV0FBVyxlQUFVLE1BQU0sT0FBTyxLQUFNLEdBQUc7QUFBQSxFQUM5QztBQUVBLE1BQU0sVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksR0FBRyxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDLEtBQUssR0FBRyxDQUFDO0FBQ3JGLE1BQU0sU0FBUyxDQUFDLEdBQUcsS0FBSyxNQUFNLEtBQUssTUFBTSxHQUFHO0FBQzVDLE1BQU0sVUFBVSxDQUFDLEtBQUssTUFBTSxHQUFLLE1BQU0sS0FBSyxJQUFJO0FBRWhELE1BQUk7QUFBSixNQUEwQjtBQUMxQixNQUFNLFFBQThFLENBQUM7QUFFckYsTUFBTyxpQkFBUSxZQUFZLEtBQUssb0JBQW9CO0FBQUEsSUFDbEQsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsS0FBSztBQUFBLElBQ0wsU0FBUyxFQUFFLFVBQVUsTUFBTSxVQUFVLEtBQUssUUFBUSxJQUFJO0FBQUEsSUFDdEQsTUFBTSxLQUFLO0FBQ1Qsb0JBQWM7QUFDZCxZQUFNLEtBQUssU0FBUyxjQUFjLElBQUk7QUFBRyxTQUFHLFlBQVk7QUFBUSxTQUFHLE1BQU0sVUFBVTtBQUNuRixZQUFNLEtBQUssU0FBUyxjQUFjLElBQUk7QUFBRyxTQUFHLFlBQVk7QUFBUSxTQUFHLE1BQU0sVUFBVTtBQUNuRixVQUFJLE1BQU0sT0FBTyxJQUFJLEVBQUU7QUFDdkIsY0FBUSxPQUFPLElBQUksb0JBQW9CO0FBQ3ZDLGNBQVEsT0FBTyxJQUFJLGtDQUFrQztBQUNyRCxpQkFBVyxDQUFDLE1BQU0sT0FBTyxHQUFHLEdBQUcsR0FBRyxDQUFDLEtBQUssT0FBTztBQUM3QyxjQUFNLEtBQUssU0FBUyxjQUFjLEtBQUs7QUFDdkMsV0FBRyxZQUFZO0FBQWMsV0FBRyxNQUFNLE9BQU8sSUFBSTtBQUFNLFdBQUcsTUFBTSxNQUFNLElBQUk7QUFDMUUsY0FBTSxJQUFJLFNBQVMsY0FBYyxNQUFNO0FBQUcsVUFBRSxZQUFZO0FBQ3hELGNBQU0sSUFBSSxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUM7QUFBRyxVQUFFLE9BQU8sQ0FBQztBQUN2QyxjQUFNLFNBQVMsU0FBUyxjQUFjLE1BQU07QUFBRyxlQUFPLFlBQVk7QUFBUSxlQUFPLGNBQWM7QUFDL0YsV0FBRyxPQUFPLEdBQUcsTUFBTTtBQUNuQixZQUFJLE1BQU0sT0FBTyxFQUFFO0FBQ25CLGNBQU0sS0FBSyxFQUFFLElBQUksT0FBTyxPQUFPLEdBQUcsT0FBTyxFQUFFLE9BQU8sS0FBSyxDQUFDLEdBQUcsT0FBTyxFQUFFLENBQUM7QUFBQSxNQUN2RTtBQUFBLElBQ0Y7QUFBQSxJQUNBLE9BQU8sRUFBRSxFQUFFLEdBQUc7QUFDWixZQUFNLFFBQVEsQ0FBQyxFQUFFLElBQUksT0FBTyxPQUFPLEVBQUUsR0FBRyxNQUFNO0FBQzVDLGNBQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxRQUFRLENBQUM7QUFDMUIsY0FBTSxJQUFJLE1BQU0sSUFBSSxJQUFJLE9BQU8sSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFLE1BQU0sTUFBTSxNQUFNLEtBQUssQ0FBQztBQUN4RSxjQUFNLE9BQU8sSUFBSSxLQUFLLEdBQUcsUUFBUSxDQUFDLENBQUM7QUFDbkMsY0FBTSxJQUFJLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxJQUFJLE1BQU0sSUFBSSxHQUFHO0FBQzNDO0FBQUEsVUFBRztBQUFBLFVBQUksYUFBYSxNQUFNLElBQUksRUFBRSxNQUFNLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxJQUFJLE1BQU0sSUFBSSxJQUFJLElBQUksR0FBRyxlQUFlLE1BQU0sSUFBSSxJQUFJLEtBQUssS0FBSyxHQUFHLENBQUMsS0FBSyxJQUFJO0FBQUEsVUFDaEosTUFBTSxJQUFJLE1BQU0sSUFBSSxDQUFDLElBQUksT0FBTyxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUM7QUFBQSxRQUFDO0FBQ3JELGVBQU8sT0FBTyxHQUFHLE1BQU0sSUFBSSxPQUFPLE9BQU8sQ0FBQyxJQUFJLEtBQUssVUFBVSxNQUFNLElBQUksRUFBRSxTQUFTLE9BQU8sS0FBSyxJQUFJLElBQUksRUFBRSxTQUFTLE1BQU0sS0FBSyxJQUFJLENBQUM7QUFDakksY0FBTSxHQUFHLEdBQUcsUUFBUSxDQUFDLENBQUM7QUFBQSxNQUN4QixDQUFDO0FBQ0QsYUFBTyxPQUFPLEdBQUcsTUFBTSxNQUFNLEVBQUUsU0FBUyxLQUFLLENBQUM7QUFDOUMsYUFBTyxPQUFPLEdBQUcsS0FBSyxVQUFVLEVBQUUsU0FBUyxLQUFLLENBQUM7QUFBQSxJQUNuRDtBQUFBLEVBQ0YsQ0FBQzs7O0FDckRELE1BQU0sT0FBeUU7QUFBQSxJQUM3RSxDQUFDLDZCQUFjLE1BQVcsT0FBTywwQkFBZ0I7QUFBQSxJQUNqRCxDQUFDLGlCQUFPLEtBQU8sT0FBTyxpQkFBWTtBQUFBLElBQ2xDLENBQUMsZ0JBQVcsT0FBTyxPQUFPLGVBQWU7QUFBQSxFQUMzQztBQUVBLE1BQUk7QUFDSixNQUFNLFFBQThFLENBQUM7QUFFckYsTUFBTyxlQUFRLFlBQVksS0FBSyxrQkFBa0I7QUFBQSxJQUNoRCxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxLQUFLO0FBQUEsSUFDTCxNQUFNLEtBQUs7QUFDVCxZQUFNLEtBQUssU0FBUyxjQUFjLElBQUk7QUFBRyxTQUFHLFlBQVk7QUFBUSxTQUFHLE1BQU0sVUFBVTtBQUNuRixVQUFJLElBQUksT0FBTyxFQUFFO0FBQ2pCLGFBQU8sT0FBTyxJQUFJLCtCQUErQjtBQUNqRCxXQUFLLFFBQVEsQ0FBQyxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksR0FBRyxNQUFNO0FBQ3ZDLGNBQU0sS0FBSyxTQUFTLGNBQWMsS0FBSztBQUN2QyxXQUFHLFlBQVk7QUFBVyxXQUFHLE1BQU0sT0FBTyxTQUFTO0FBQU0sV0FBRyxNQUFNLE1BQU0sVUFBVSxJQUFJLFdBQVcsS0FBSztBQUN0RyxjQUFNLElBQUksU0FBUyxjQUFjLE1BQU07QUFBRyxVQUFFLFlBQVk7QUFDeEQsY0FBTSxJQUFJLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQztBQUFHLFVBQUUsT0FBTyxDQUFDO0FBQ3ZDLGNBQU0sSUFBSSxTQUFTLGNBQWMsTUFBTTtBQUFHLFVBQUUsWUFBWTtBQUFRLFVBQUUsY0FBYztBQUNoRixXQUFHLE9BQU8sR0FBRyxDQUFDO0FBQ2QsWUFBSSxNQUFNLE9BQU8sRUFBRTtBQUNuQixjQUFNLEtBQUssRUFBRSxJQUFJLE9BQU8sT0FBTyxHQUFHLE9BQU8sRUFBRSxPQUFPLEtBQUssQ0FBQyxHQUFHLE9BQU8sRUFBRSxDQUFDO0FBQUEsTUFDdkUsQ0FBQztBQUFBLElBQ0g7QUFBQSxJQUNBLE9BQU8sRUFBRSxFQUFFLEdBQUcsS0FBSztBQUNqQixZQUFNLEtBQUssSUFBSSxPQUFPLENBQUMsRUFBRTtBQUN6QixZQUFNLFFBQVEsQ0FBQyxFQUFFLElBQUksT0FBTyxPQUFPLEVBQUUsR0FBRyxNQUFNO0FBQzVDLGNBQU0sS0FBSyxVQUFVLElBQUksWUFBWSxLQUFLLE9BQU87QUFDakQsY0FBTSxJQUFJLEtBQUssSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLEdBQUc7QUFDbkMsV0FBRyxJQUFJLFNBQVMsSUFBSSxPQUFPLENBQUMsS0FBSyxJQUFJLE9BQU8sQ0FBQyxJQUFJLE1BQU0sSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLEtBQUssSUFBSSxLQUFLLEdBQUcsTUFBTSxHQUFHLEVBQUU7QUFDeEcsZUFBTyxPQUFPLEdBQUcsT0FBTyxDQUFDLElBQUksTUFBTSxVQUFVLEVBQUUsU0FBUyxPQUFPLEtBQUssSUFBSSxDQUFDO0FBQ3pFLGNBQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxJQUFJLEdBQUc7QUFBQSxNQUM3QixDQUFDO0FBQ0QsYUFBTyxNQUFNLEdBQUcsTUFBTSxPQUFPLEVBQUUsU0FBUyxLQUFLLENBQUM7QUFBQSxJQUNoRDtBQUFBLEVBQ0YsQ0FBQzs7O0FDcENELE1BQU0sT0FBTyxDQUFDLENBQUMsT0FBTyxjQUFjLEdBQUcsQ0FBQyxPQUFPLE1BQU0sR0FBRyxDQUFDLE9BQU8sV0FBVyxHQUFHLENBQUMsT0FBTyxlQUFlLEdBQUcsQ0FBQyxPQUFPLGVBQWUsR0FBRyxDQUFDLE9BQU8saUJBQWlCLENBQUM7QUFFNUosTUFBTUUsT0FBTTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFtQlosTUFBSUM7QUFBSixNQUF5QjtBQUN6QixNQUFJO0FBQUosTUFBc0I7QUFBdEIsTUFBeUM7QUFBekMsTUFBK0Q7QUFBL0QsTUFBaUY7QUFBakYsTUFBd0c7QUFBeEcsTUFBMkg7QUFDM0gsTUFBSTtBQUNKLE1BQUk7QUFFSixNQUFPLGtCQUFRLFlBQVksS0FBSyxxQkFBcUI7QUFBQSxJQUNuRCxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxLQUFLO0FBQUEsSUFDTCxTQUFTLEVBQUUsVUFBVSxNQUFNLE1BQU0sSUFBSTtBQUFBLElBQ3JDLE1BQU0sS0FBSztBQUNULGtCQUFZLGNBQWNELElBQUc7QUFDN0IsWUFBTSxLQUFLLFNBQVMsY0FBYyxJQUFJO0FBQUcsU0FBRyxZQUFZO0FBQVEsU0FBRyxNQUFNLFVBQVU7QUFDbkYsVUFBSSxJQUFJLE9BQU8sRUFBRTtBQUNqQixNQUFBQyxRQUFPLE9BQU8sSUFBSSwyQkFBMkI7QUFFN0MsWUFBTSxTQUFTLGNBQWMsS0FBSztBQUFHLFVBQUksWUFBWTtBQUNyRCxZQUFNLElBQUksU0FBUyxjQUFjLE1BQU07QUFBRyxRQUFFLFlBQVk7QUFDeEQsYUFBTyxNQUFNLEVBQUU7QUFBRyxRQUFFLE9BQU8sSUFBSTtBQUFHLFVBQUksT0FBTyxDQUFDO0FBQzlDLFVBQUksTUFBTSxPQUFPLEdBQUc7QUFDcEIsaUJBQVcsT0FBTyxHQUFHLGNBQVcsRUFBRSxPQUFPLEtBQUssQ0FBQztBQUUvQyxnQkFBVSxTQUFTLGNBQWMsS0FBSztBQUFHLGNBQVEsWUFBWTtBQUFVLGNBQVEsTUFBTSxVQUFVO0FBQy9GLGNBQVEsWUFBWTtBQUFBO0FBQUEsd0dBRWdGLEtBQUssSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sdUJBQXVCLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsQ0FBQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBSzNLLFVBQUksTUFBTSxPQUFPLE9BQU87QUFDeEIsWUFBTSxRQUFRLGNBQWMsTUFBTTtBQUFJLGlCQUFXLFFBQVEsY0FBYyxPQUFPO0FBQzlFLGFBQU8sUUFBUSxjQUFjLFVBQVU7QUFBSSxhQUFPLFFBQVEsY0FBYyxPQUFPO0FBQy9FLGFBQU8sQ0FBQyxHQUFHLFFBQVEsaUJBQThCLE1BQU0sQ0FBQztBQUd4RCxZQUFNLE9BQU8sTUFBTSxXQUFXLEtBQUssTUFBTSxHQUFHO0FBQzVDLFlBQU0sT0FBTyxNQUFNLFdBQVcsS0FBSyxDQUFDLEdBQUcsTUFBTSxJQUFJO0FBQ2pELFlBQU0sT0FBTyxJQUFJLE9BQU8sSUFBSSxRQUFRLEdBQUc7QUFBQSxRQUNyQyxNQUFNO0FBQUEsVUFDSixFQUFFLEdBQUcsSUFBSSxVQUFVLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRTtBQUFBLFVBQUcsRUFBRSxHQUFHLElBQUksT0FBTyxJQUFJLEtBQUs7QUFBQSxVQUFHLEVBQUUsR0FBRyxJQUFJLFFBQVEsS0FBSyxJQUFJLEtBQUs7QUFBQSxVQUNqRyxFQUFFLEdBQUcsSUFBSSxRQUFRLEtBQUssSUFBSSxLQUFLO0FBQUEsVUFBRyxFQUFFLEdBQUcsSUFBSSxXQUFXLElBQUksS0FBSztBQUFBLFVBQy9ELEVBQUUsR0FBRyxNQUFNLElBQUksTUFBTTtBQUFFLGtCQUFNLENBQUMsR0FBRyxDQUFDLElBQUksS0FBSztBQUFHLG1CQUFPLENBQUMsSUFBSSxLQUFLLElBQUksR0FBRztBQUFBLFVBQUcsRUFBRTtBQUFBLFFBQzdFO0FBQUEsUUFDQSxRQUFRLENBQUMsSUFBSSxNQUFNLElBQUksSUFBSTtBQUFBLFFBQUcsTUFBTSxJQUFJO0FBQUEsUUFBVSxJQUFJO0FBQUEsTUFDeEQsQ0FBQztBQUFBLElBQ0g7QUFBQSxJQUNBLE9BQU8sRUFBRSxFQUFFLEdBQUcsS0FBSztBQUNqQixZQUFNLEtBQUssSUFBSSxPQUFPLENBQUMsRUFBRTtBQUV6QjtBQUNFLGNBQU0sU0FBUyxPQUFPLENBQUMsR0FBRyxLQUFLLFFBQVEsS0FBSyxHQUFHLE9BQU8sQ0FBRyxDQUFDO0FBQzFELGNBQU0sS0FBSyxVQUFVLElBQUksWUFBWSxLQUFLLE9BQU8sVUFBVSxJQUFJLEtBQUssSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLEdBQUc7QUFDeEYsWUFBSSxNQUFNLE9BQU8sS0FBSyxRQUFRLE1BQU0sRUFBRSxJQUFJO0FBQzFDLFlBQUksTUFBTSxNQUFNLEtBQUssVUFBVSxJQUFJLFdBQVcsSUFBSSxPQUFPLElBQUksRUFBRSxJQUFJO0FBQ25FLFdBQUcsS0FBSyxVQUFVLElBQUksT0FBTyxLQUFLLEtBQUssR0FBRyxLQUFLLEVBQUUsQ0FBQyxLQUFLLElBQUksU0FBUyxNQUFNLElBQUksSUFBSSxNQUFNLEtBQUssSUFBSSxHQUFHLEdBQUcsQ0FBQztBQUN4RyxlQUFPLFVBQVUsR0FBRyxTQUFTLE1BQU0sVUFBVSxFQUFFLFNBQVMsT0FBTyxLQUFLLElBQUksQ0FBQztBQUFBLE1BQzNFO0FBQ0EsYUFBT0EsT0FBTSxHQUFHLE1BQU0sVUFBVSxFQUFFLFNBQVMsS0FBSyxDQUFDO0FBQ2pELGNBQVEsU0FBUyxHQUFHLElBQUksS0FBSztBQUU3QixZQUFNLEtBQUssS0FBSyxHQUFHLElBQUksTUFBTSxJQUFJO0FBQ2pDLGNBQVEsS0FBSyxJQUFJLElBQUksT0FBTyxpQ0FBeUIsTUFBTSxnQ0FBd0Isd0JBQWdCLEVBQUUsQ0FBQztBQUN0RyxZQUFNLEtBQUssa0JBQWEsS0FBSyxLQUFNLEtBQUssQ0FBQyxJQUFJLEtBQUssa0JBQWEsS0FBSyxLQUFNLE9BQU8sS0FBSyxDQUFDO0FBQ3ZGLGNBQVEsVUFBVSxJQUFJLElBQUksT0FBTyxLQUFLLE1BQU0sSUFBSSxJQUFJLEVBQUUsQ0FBQztBQUd2RDtBQUNFLGNBQU0sS0FBSyxPQUFPLENBQUMsSUFBSTtBQUN2QixZQUFJLElBQUksSUFBSSxPQUFPLE1BQU07QUFBRSxlQUFLLGNBQWMsS0FBSyxPQUFPLEtBQUs7QUFBRyxnQkFBTSxNQUFNLEdBQUcsRUFBRTtBQUFBLFFBQUcsT0FDakY7QUFDSCxnQkFBTSxLQUFLLElBQUksSUFBSSxPQUFPLFFBQVEsS0FBSyxPQUFPLElBQUk7QUFDbEQsZUFBSyxjQUFjLE9BQU8sS0FBSyxPQUFPLEtBQUssSUFBSSxLQUFLLE9BQU8sT0FBTyxLQUFLO0FBQ3ZFLGdCQUFNLE1BQU0sT0FBTyxJQUFJLElBQUksS0FBSyxLQUFLLEtBQUssR0FBRyxRQUFRLElBQUksT0FBTyxLQUFLLEVBQUUsTUFBTSxLQUFLLE1BQU0sS0FBSyxDQUFDLENBQUM7QUFDL0YsYUFBRyxNQUFNLDhCQUE4QixHQUFHLFFBQVEsQ0FBQztBQUFBLFFBQ3JEO0FBQUEsTUFDRjtBQUVBLFVBQUksVUFBVSxPQUFPLFFBQVEsS0FBSyxJQUFJLFFBQVEsSUFBSSxJQUFJLE9BQU8sSUFBSTtBQUNqRSxVQUFJLEtBQUssSUFBSSxRQUFRLElBQUksSUFBSSxPQUFPLEtBQUs7QUFDdkMsY0FBTSxNQUFNLE9BQU8sSUFBSSxJQUFJLE1BQU0sRUFBRSxNQUFNLEtBQUssTUFBTSxJQUFJLENBQUMsR0FBRyxPQUFPLFdBQVcsS0FBSyxHQUFHLElBQUksT0FBTyxNQUFNLEdBQUcsQ0FBQztBQUMzRyxXQUFHLE1BQU0sZUFBZSxJQUFJLE9BQU8sR0FBRyxhQUFhLEtBQUssTUFBTSxHQUFHLEdBQUcsSUFBSSxPQUFPLElBQUksS0FBSyxPQUFPLElBQUksSUFBSSxRQUFRLENBQUMsS0FBSyxJQUFJLEtBQUs7QUFDOUgsYUFBSyxRQUFRLENBQUMsR0FBRyxNQUFNO0FBQUUsZ0JBQU0sSUFBSSxRQUFRLEtBQUssR0FBRyxJQUFJLE9BQU8sT0FBTyxJQUFJLE9BQU8sR0FBRyxDQUFDO0FBQUcsWUFBRSxNQUFNLFlBQVksZUFBZSxJQUFJLEtBQUssRUFBRTtBQUFPLFlBQUUsTUFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLFFBQUcsQ0FBQztBQUMxSyxjQUFNLEtBQUssT0FBTyxJQUFJLElBQUksT0FBTyxFQUFFLE1BQU0sS0FBSyxNQUFNLEtBQUssQ0FBQztBQUMxRCxjQUFNLE1BQU0sS0FBSyxLQUFLLENBQUMsRUFBRSxXQUFXLEtBQUssQ0FBQyxFQUFFLFdBQVcsRUFBRTtBQUN6RCxhQUFLLE1BQU0sTUFBTSxNQUFNO0FBQ3ZCLGFBQUssUUFBUSxPQUFLLEVBQUUsVUFBVSxPQUFPLE1BQU0sS0FBSyxJQUFJLEVBQUUsWUFBWSxHQUFHLElBQUksRUFBRSxDQUFDO0FBQUEsTUFDOUUsT0FBTztBQUVMLFdBQUcsTUFBTSxJQUFJLElBQUksT0FBTyxrQ0FBa0MsK0JBQStCLENBQUM7QUFDMUYsYUFBSyxRQUFRLE9BQUs7QUFBRSxZQUFFLE1BQU0sWUFBWTtBQUFRLFlBQUUsTUFBTSxVQUFVO0FBQUEsUUFBSyxDQUFDO0FBQUEsTUFDMUU7QUFDQSxVQUFJLE9BQU8sQ0FBQztBQUFBLElBQ2Q7QUFBQSxFQUNGLENBQUM7OztBQ3JIRCxNQUFNLFFBQVEsRUFBRSxJQUFJLE9BQU8sS0FBSyxLQUFLLE1BQU0sVUFBVSxLQUFLLE9BQU8sT0FBTyxLQUFLO0FBQzdFLE1BQU0sUUFBUSxFQUFFLElBQUksTUFBTSxLQUFLLE1BQU0sTUFBTSxRQUFRLEtBQUssT0FBTyxPQUFPLE1BQU07QUFFNUUsTUFBTUMsT0FBTTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQVdaLE1BQUk7QUFBSixNQUFxQjtBQUFyQixNQUF3Q0M7QUFDeEMsTUFBTSxTQUE2RixDQUFDO0FBRXBHLE1BQU8saUJBQVEsWUFBWSxLQUFLLG9CQUFvQjtBQUFBLElBQ2xELE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLEtBQUs7QUFBQSxJQUNMLE1BQU0sS0FBSztBQUNULGtCQUFZLGFBQWFELElBQUc7QUFDNUIsV0FBSyxTQUFTLGNBQWMsS0FBSztBQUFHLFNBQUcsWUFBWTtBQUNuRCxVQUFJLE9BQU8sSUFBSSxRQUFRLEVBQUUsT0FBTyxFQUFFO0FBQ2xDLFlBQU0sS0FBSyxTQUFTLGNBQWMsSUFBSTtBQUFHLFNBQUcsWUFBWTtBQUFRLFNBQUcsTUFBTSxVQUFVO0FBQ25GLGFBQU8sU0FBUyxjQUFjLEtBQUs7QUFBRyxXQUFLLFlBQVk7QUFBVyxXQUFLLE1BQU0sVUFBVTtBQUN2RixXQUFLLFlBQVk7QUFBQTtBQUVqQixTQUFHLE9BQU8sSUFBSSxJQUFJO0FBQ2xCLE1BQUFDLFFBQU8sT0FBTyxJQUFJLDhCQUE4QjtBQUNoRCxXQUFLLGlCQUE4QixTQUFTLEVBQUUsUUFBUSxDQUFDLElBQUksTUFBTTtBQUMvRCxjQUFNLElBQUksTUFBTSxJQUFJLFFBQVE7QUFDNUIsWUFBSSxFQUFFLFFBQVEsT0FBTztBQUFFLGdCQUFNLE1BQU0sU0FBUyxjQUFjLE1BQU07QUFBRyxjQUFJLFlBQVk7QUFBTyxjQUFJLGNBQWM7QUFBSyxhQUFHLE9BQU8sR0FBRztBQUFBLFFBQUc7QUFDakksY0FBTSxPQUFPLFNBQVMsY0FBYyxNQUFNO0FBQUcsV0FBRyxPQUFPLElBQUk7QUFDM0QsY0FBTSxJQUFJLE1BQU0sRUFBRTtBQUFHLFdBQUcsT0FBTyxDQUFDO0FBQ2hDLGVBQU8sS0FBSyxFQUFFLElBQUksTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDO0FBQUEsTUFDdkMsQ0FBQztBQUFBLElBQ0g7QUFBQSxJQUNBLE9BQU8sRUFBRSxFQUFFLEdBQUc7QUFDWixhQUFPQSxPQUFNLEdBQUcsT0FBTyxVQUFVLEVBQUUsU0FBUyxLQUFLLENBQUM7QUFFbEQsaUJBQVcsRUFBRSxJQUFJLE1BQU0sT0FBTyxHQUFHLEVBQUUsS0FBSyxRQUFRO0FBQzlDLGNBQU0sVUFBVSxNQUFNLFFBQVEsS0FBSyxFQUFFLFNBQVMsSUFBSSxNQUFNLFFBQVEsS0FBSyxFQUFFO0FBQ3ZFLFdBQUcsVUFBVSxPQUFPLFNBQVMsT0FBTztBQUNwQyxjQUFNLEtBQUssT0FBTyxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksS0FBSyxFQUFFLEtBQUssTUFBTSxFQUFFLE1BQU0sU0FBUyxRQUFRLEVBQUUsUUFBUSxRQUFRLE9BQUssRUFBRSxRQUFRLHlCQUF5QixHQUFHLElBQUksT0FBVSxDQUFDO0FBQ3hKLGdCQUFRLE1BQU0sR0FBRyxJQUFJO0FBQ3JCLFlBQUksQ0FBQyxHQUFHLEdBQUc7QUFBRSxhQUFHLEdBQUcsWUFBWSxDQUFDO0FBQUc7QUFBQSxRQUFVO0FBQzdDLGNBQU0sTUFBTSxLQUFLLENBQUMsR0FBRyxPQUFPLEVBQUUsR0FBRztBQUNqQyxnQkFBUSxHQUFHLEdBQUcsSUFBSSxJQUFJLEtBQUssS0FBSyxDQUFDLEVBQUUsS0FBSyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsR0FBRyxLQUFLLEtBQUssR0FBRyxHQUFHLE1BQU0sR0FBRyxDQUFDLElBQUksR0FBRztBQUNyRyxZQUFJLEdBQUcsTUFBTSxFQUFHLE9BQU0sR0FBRyxHQUFHLEVBQUUsSUFBSSxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQUEsYUFDMUM7QUFBRSxnQkFBTSxJQUFJLEtBQUssR0FBRyxHQUFHLE1BQU0sR0FBRztBQUFHLGFBQUcsR0FBRyxTQUFTLElBQUksTUFBTSxLQUFLLElBQUksSUFBSSxLQUFLLEVBQUUsS0FBSyxJQUFJLEVBQUUsS0FBSyxDQUFDO0FBQUEsUUFBRztBQUFBLE1BQzNHO0FBRUEsWUFBTSxNQUFNLFdBQVcsS0FBSyxHQUFHLElBQUksUUFBUSxLQUFLLEdBQUcsQ0FBQztBQUNwRCxZQUFNLEtBQUssVUFBVSxLQUFLLEdBQUcsTUFBTSxDQUFDLENBQUM7QUFDckMsV0FBSyxNQUFNLFlBQVksK0JBQStCLEtBQUssS0FBSyxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0IsS0FBSyxHQUFHLEdBQUcsRUFBRSxDQUFDO0FBQ3JHLFVBQUksTUFBTSxTQUFTLEtBQUssTUFBTSxHQUFHLEdBQUcsQ0FBQyxLQUFLLFNBQVM7QUFDbkQsWUFBTSxJQUFJLFNBQVMsSUFBSSxPQUFPLENBQUMsRUFBRSxPQUFPLEdBQUcsSUFBSSxNQUFNLElBQUksU0FBUyxFQUFFLFVBQVUsR0FBRyxDQUFDO0FBQ2xGLFVBQUksRUFBRSxJQUFJLEdBQUc7QUFBRSxjQUFNLEVBQUU7QUFBSyxpQkFBUyxFQUFFO0FBQUEsTUFBUTtBQUMvQyxTQUFHLE1BQU0sa0JBQWtCO0FBQzNCLFNBQUcsSUFBSSxLQUFLLElBQUksSUFBSSxRQUFRLE9BQU8sS0FBSyxJQUFJLFVBQVUsSUFBSSxNQUFNLE1BQU0sR0FBRyxDQUFDO0FBQUEsSUFDNUU7QUFBQSxFQUNGLENBQUM7OztBQy9ERCxNQUFNLFNBQWtEO0FBQUEsSUFBQyxDQUFDLGFBQWEsS0FBSyxLQUFLLENBQUM7QUFBQSxJQUFHLENBQUMsYUFBUSxNQUFNLElBQUksQ0FBQztBQUFBLElBQUcsQ0FBQyxhQUFhLE1BQU0sS0FBSyxDQUFDO0FBQUEsSUFBRyxDQUFDLFFBQVEsS0FBSyxLQUFLLENBQUM7QUFBQSxJQUMzSixDQUFDLGdCQUFnQixLQUFLLEtBQUssQ0FBQztBQUFBLElBQUcsQ0FBQyxXQUFXLEtBQUssS0FBSyxDQUFDO0FBQUEsSUFBRyxDQUFDLFdBQVEsTUFBTSxLQUFLLENBQUM7QUFBQSxJQUFHLENBQUMsYUFBYSxLQUFLLEtBQUssQ0FBQztBQUFBLEVBQUM7QUFFN0csTUFBSTtBQUNKLE1BQU0sU0FBd0IsQ0FBQztBQUUvQixNQUFPLGNBQVEsWUFBWSxLQUFLLGlCQUFpQjtBQUFBLElBQy9DLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLEtBQUs7QUFBQSxJQUNMLE1BQU0sS0FBSztBQUNULGtCQUFZLFVBQVUsb0dBQW9HO0FBQzFILGFBQU8sUUFBUSxJQUFJLE9BQU8sSUFBSSxLQUFLLEdBQUcsRUFBRSxNQUFNLE9BQU8sTUFBTSxjQUFjLFNBQVMsa0NBQWtDLElBQUksS0FBSyxVQUFVLElBQUksU0FBUyxTQUFTLEtBQUssQ0FBQztBQUNuSyxpQkFBVyxDQUFDLEdBQUcsR0FBRyxDQUFDLEtBQUssUUFBUTtBQUM5QixjQUFNLElBQUksTUFBTSxDQUFDO0FBQUcsVUFBRSxNQUFNLE9BQU8sSUFBSTtBQUFNLFVBQUUsTUFBTSxNQUFNLElBQUk7QUFDL0QsYUFBSyxHQUFHLGFBQWEsR0FBRyxLQUFLLEdBQUcsVUFBVTtBQUMxQyxlQUFPLEtBQUssQ0FBQztBQUFBLE1BQ2Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxPQUFPLEVBQUUsRUFBRSxHQUFHO0FBQ1osV0FBSyxPQUFPLENBQUM7QUFDYixhQUFPLFFBQVEsQ0FBQyxDQUFDLEVBQUUsR0FBRyxHQUFHLEtBQUssR0FBRyxNQUFNO0FBQ3JDLGNBQU0sS0FBSyxJQUFJLE1BQU0sTUFBTSxJQUFJLE1BQU0sSUFBSSxPQUFPLElBQUksSUFBSSxFQUFFLE1BQU0sS0FBSyxNQUFNLElBQUksQ0FBQztBQUNoRixjQUFNLE1BQU0sQ0FBQyxLQUFLLEtBQUssR0FBRyxFQUFFLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUksRUFBRSxLQUFLO0FBQzdELGNBQU0sTUFBTSxJQUFJLFFBQVEsSUFBSSxLQUFLLE1BQU0sTUFBTSxJQUFJLFFBQVEsSUFBSSxLQUFLO0FBQ2xFLGNBQU0sU0FBUyxJQUFJLElBQUksV0FBVyxNQUFNO0FBQ3hDLGNBQU0sS0FBSyxPQUFPLENBQUM7QUFDbkIsV0FBRyxNQUFNLFNBQVMsVUFBVSxJQUFJLGNBQWMsVUFBVSxJQUFJLGNBQWM7QUFDMUUsV0FBRyxJQUFJLGFBQWEsS0FBSyxLQUFLLE1BQU0sS0FBSyxLQUFLLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxJQUFJLEdBQUcsYUFBYSxLQUFLLEtBQUssSUFBSSxHQUFHLENBQUMsQ0FBQyxLQUFLLE9BQU8sSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sS0FBSyxJQUFJLEVBQUUsS0FBSyxDQUFDO0FBQUEsTUFDN0osQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGLENBQUM7OztBQ3pCRCxNQUFNLFFBQVEsRUFBRSxPQUFPLE1BQU0sUUFBUSxJQUFJO0FBR3pDLE1BQU0sTUFBTSxPQUFPO0FBQUEsSUFDakIsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDLE1BQU0sS0FBSyxVQUFVLEdBQUcsQ0FBQyxLQUFLLEtBQUssU0FBUyxHQUFHLENBQUMsS0FBSyxNQUFNLFVBQVUsQ0FBQztBQUFBLElBQ2xHLEdBQUc7QUFBQSxNQUFDLENBQUMsR0FBRyxHQUFHO0FBQUEsTUFBRyxDQUFDLE1BQU0sR0FBRztBQUFBLE1BQUcsQ0FBQyxNQUFNLEtBQUssVUFBVTtBQUFBLE1BQUcsQ0FBQyxLQUFLLEtBQUssU0FBUztBQUFBLE1BQUcsQ0FBQyxLQUFLLEtBQUssVUFBVTtBQUFBLE1BQzlGLENBQUMsR0FBSyxHQUFHO0FBQUEsTUFBRyxDQUFDLE1BQU0sTUFBTSxVQUFVLFVBQVU7QUFBQSxNQUFHLENBQUMsSUFBTSxNQUFNLFFBQVE7QUFBQSxNQUFHLENBQUMsT0FBTyxNQUFNLElBQUksVUFBVSxVQUFVO0FBQUEsTUFDOUcsQ0FBQyxJQUFNLE1BQU0sSUFBSSxRQUFRO0FBQUEsTUFBRyxDQUFDLE1BQU0sTUFBTSxJQUFJLFVBQVUsVUFBVTtBQUFBLE1BQUcsQ0FBQyxJQUFJLE1BQU0sSUFBSSxVQUFVLFNBQVM7QUFBQSxJQUFDO0FBQUE7QUFBQSxJQUV6RyxNQUFNO0FBQUEsTUFBQyxDQUFDLEdBQUcsR0FBRztBQUFBLE1BQUcsQ0FBQyxNQUFNLElBQUk7QUFBQSxNQUFHLENBQUMsTUFBTSxHQUFHLFVBQVU7QUFBQSxNQUFHLENBQUMsS0FBSyxNQUFNLFNBQVM7QUFBQSxNQUFHLENBQUMsR0FBSyxHQUFLLFVBQVU7QUFBQSxNQUNqRyxDQUFDLE1BQU0sTUFBTSxTQUFTO0FBQUEsTUFBRyxDQUFDLE1BQU0sR0FBRyxVQUFVO0FBQUEsTUFBRyxDQUFDLElBQUksTUFBTSxTQUFTO0FBQUEsSUFBQztBQUFBLEVBQ3pFLEdBQUcsS0FBSztBQUVSLE1BQUk7QUFDSixNQUFJO0FBQUosTUFBdUI7QUFFdkIsTUFBTyxnQkFBUSxZQUFZO0FBQUEsSUFDekIsT0FBTztBQUFBLElBQ1A7QUFBQSxJQUFPLEtBQUs7QUFBQSxJQUFJLFVBQVU7QUFBQSxJQUFJLEtBQUs7QUFBQSxJQUFLO0FBQUEsSUFBTyxRQUFRO0FBQUEsSUFDdkQsT0FBTztBQUFBLE1BQ0wsTUFBTSxLQUFLO0FBQ1QscUJBQWE7QUFDYixjQUFNLEtBQUssSUFBSSxPQUFPLEdBQUcsWUFBWTtBQUNyQyxlQUFPLGFBQWEsSUFBSSxFQUFFLEtBQUssSUFBSSxLQUFLLEtBQUssT0FBTyxXQUFXLE9BQU8sSUFBSSxDQUFDO0FBQzNFLGVBQU8sU0FBUyxjQUFjLEtBQUs7QUFDbkMsYUFBSyxNQUFNLFVBQVU7QUFDckIsV0FBRyxPQUFPLElBQUk7QUFDZCxlQUFPLFNBQVMsY0FBYyxLQUFLO0FBQ25DLGFBQUssWUFBWTtBQUNqQixhQUFLLFlBQVk7QUFDakIsWUFBSSxPQUFPLElBQUksT0FBTyxFQUFFLE9BQU8sSUFBSTtBQUFBLE1BQ3JDO0FBQUEsTUFDQSxPQUFPLEVBQUUsRUFBRSxHQUFHLEtBQUs7QUFDakIsY0FBTSxJQUFJLElBQUksT0FBTyxDQUFDO0FBRXRCLGNBQU0sTUFBTSxXQUFXLEtBQUssR0FBRyxJQUFJLE9BQU8sSUFBSSxDQUFDO0FBQy9DLGNBQU0sS0FBSyxFQUFFLFFBQVEsSUFBSSxNQUFNO0FBQy9CLGNBQU0sSUFBSSxJQUFJLE9BQU87QUFDckIsVUFBRSxNQUFNLFlBQVksZ0NBQWdDLEVBQUUsZUFBZSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO0FBQ25GLFVBQUUsTUFBTSxVQUFVLE9BQU8sSUFBSSxHQUFHO0FBQ2hDLFVBQUUsTUFBTSxhQUFhLE9BQU8sSUFBSSxXQUFXO0FBRTNDLFlBQUksT0FBTyxJQUFJLE1BQU0sa0JBQWtCO0FBQ3ZDLFdBQUcsSUFBSSxPQUFPLEtBQUssU0FBUyxJQUFJLE1BQU0sR0FBRyxLQUFLLElBQUksR0FBRztBQUNyRCxhQUFLLEdBQUcsT0FBTyxJQUFJLE1BQU0sR0FBRztBQUM1QixhQUFLLE1BQU0sT0FBTyxNQUFNLEtBQUssSUFBSSxJQUFJLElBQUksSUFBSSxNQUFNO0FBQ25ELGFBQUssTUFBTSxNQUFNLE1BQU0sS0FBSyxJQUFJLElBQUksSUFBSSxJQUFJLE1BQU07QUFDbEQsV0FBRyxNQUFNLGVBQWUsSUFBSSxRQUFRLEtBQUssR0FBRyxLQUFLLEdBQUcsQ0FBQyxLQUFLLEVBQUUsT0FBTyxRQUFRLEtBQUssR0FBRyxLQUFLLEdBQUcsQ0FBQyxLQUFLLElBQUksS0FBSyxHQUFHLElBQUksTUFBTSxHQUFHLEVBQUU7QUFBQSxNQUM5SDtBQUFBLElBQ0Y7QUFBQSxJQUNBLFFBQVEsQ0FBQyxnQkFBUSxjQUFNLGlCQUFTLGdCQUFRLFdBQUc7QUFBQSxJQUMzQyxTQUFTO0FBQUEsTUFDUCxFQUFFLE1BQU0sUUFBUSxHQUFHLEdBQUcsTUFBTSxNQUFNO0FBQUEsTUFBRyxFQUFFLE1BQU0sVUFBVSxHQUFHLEtBQUssTUFBTSxPQUFPO0FBQUEsTUFBRyxFQUFFLE1BQU0sUUFBUSxHQUFHLEtBQUssTUFBTSxNQUFNO0FBQUEsTUFDbkgsRUFBRSxNQUFNLGFBQWEsR0FBRyxNQUFNLE1BQU0sT0FBTztBQUFBLE1BQUcsRUFBRSxNQUFNLFNBQVMsR0FBRyxJQUFJLE1BQU0sTUFBTTtBQUFBLE1BQUcsRUFBRSxNQUFNLFlBQVksR0FBRyxPQUFPLE1BQU0sTUFBTTtBQUFBLElBQ2pJO0FBQUEsRUFDRixDQUFDOzs7QUNqRUQsU0FBTyxlQUFlLE1BQU0sZUFBTyxFQUFFLFdBQVcsWUFBWSxDQUFDLEVBQUUsTUFBTSxPQUFLO0FBQUUsV0FBTyxlQUFlLE9BQU8sS0FBSyxFQUFFLFNBQVMsQ0FBQztBQUFHLFVBQU07QUFBQSxFQUFHLENBQUM7IiwKICAibmFtZXMiOiBbInN0YWdlIiwgInN0YWdlIiwgIkNTUyIsICJvcHRzIiwgIkNTUyIsICJDU1MiLCAiQ1NTIiwgIkNTUyIsICJjYW0iLCAic3RhZ2UiLCAib3B0cyIsICJzdGFnZSIsICJjYW1lcmEiLCAiY2FtIiwgIkNTUyIsICJoZWFkIiwgIkNTUyIsICJoZWFkIl0KfQo=
