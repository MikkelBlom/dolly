// Player UI. Drives the scene document's window.__dolly directly (same origin), so playback is the real
// renderer at full speed. Everything an agent needs is also on window.player (seek, play, overlays…).
import type { DollyApi, DollyMeta, InspectResult } from "@dolly/core";

type Overlay = "safe" | "grid" | "bounds" | "camera" | "paths" | "heat";
interface Track { name: string; url: string; buffer: AudioBuffer | null; start: number; role: string; gain: number; peaks: Float32Array | null }

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const frame = $<HTMLIFrameElement>("frame"), overlay = $<HTMLCanvasElement>("overlay"), tl = $<HTMLCanvasElement>("timeline");
const viewport = $("viewport"), statusEl = $("status"), errorEl = $("error");

const q = new URLSearchParams(location.search);
const state = {
  t: +(q.get("t") ?? 0),
  playing: false,
  rate: +(q.get("rate") ?? 1),
  loop: parseLoop(q.get("loop")),
  aspect: q.get("aspect") ?? "",
  overlays: new Set<Overlay>((q.get("ov") ?? "").split(",").filter(Boolean) as Overlay[]),
  snap: q.get("snap") === "1",
};
let meta: DollyMeta | null = null;
let dolly: DollyApi | null = null;
let heat: Float32Array | null = null; // blur samples per 1/30 s
let inspectCache: { t: number; r: InspectResult } | null = null;
let pathsCache: { t: number; paths: Map<string, Array<[number, number]>> } | null = null;
const tracks: Track[] = [];
let audioCtx: AudioContext | null = null;
let sources: AudioBufferSourceNode[] = [];

function parseLoop(s: string | null): { a: number; b: number } | null {
  const m = s?.match(/^([\d.]+)-([\d.]+)$/);
  return m && +m[2] > +m[1] ? { a: +m[1], b: +m[2] } : null;
}

// ---------- scene frame ----------
function loadFrame(): void {
  const params = new URLSearchParams({ v: String(Date.now()) });
  if (state.aspect) params.set("aspect", state.aspect);
  frame.src = `/frame.html?${params}`;
}

frame.addEventListener("load", async () => {
  const w = frame.contentWindow as (Window & { __dolly?: DollyApi; __dollyMount?: Promise<DollyApi>; __dollyError?: string }) | null;
  try {
    for (let i = 0; i < 200 && !w?.__dollyMount; i++) await new Promise(r => setTimeout(r, 10));
    if (!w?.__dollyMount) throw new Error("the scene document did not start (see the browser console)");
    const api = await w.__dollyMount;
    meta = await api.ready;
    dolly = api;
    showError(null);
    $("title").textContent = meta.title;
    if (!state.aspect) ($<HTMLSelectElement>("aspect")).value = meta.aspect;
    layout();
    inspectCache = pathsCache = null;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    api.fit();
    computeHeat();
    loadProjectAudio();
    draw(true);
    statusEl.textContent = `${meta.scenes.length} scenes · ${meta.duration} s · ${meta.fps} fps`;
    statusEl.className = "";
  } catch (e) {
    showError(w?.__dollyError ?? String((e as Error).message ?? e));
  }
});

function showError(msg: string | null): void {
  errorEl.style.display = msg ? "block" : "none";
  errorEl.textContent = msg ?? "";
  if (msg) { statusEl.textContent = "error"; statusEl.className = "err"; }
}

// fit the viewport to the main area, keeping the stage aspect
function layout(): void {
  if (!meta) return;
  const main = viewport.parentElement!;
  const W = main.clientWidth - 24, H = main.clientHeight - 24;
  const ar = meta.stage.width / meta.stage.height;
  const w = Math.max(160, Math.min(W, H * ar)), h = w / ar;
  viewport.style.width = `${w}px`; viewport.style.height = `${h}px`;
  const dpr = devicePixelRatio || 1;
  overlay.width = w * dpr; overlay.height = h * dpr;
  tl.width = tl.clientWidth * dpr; tl.height = tl.clientHeight * dpr;
  requestAnimationFrame(() => { dolly?.fit(); inspectCache = pathsCache = null; draw(true); });
}
addEventListener("resize", layout);

// ---------- playback ----------
let last = performance.now();
function tick(now: number): void {
  const dt = (now - last) / 1000; last = now;
  if (state.playing && meta) {
    let t = state.t + dt * state.rate;
    const a = state.loop?.a ?? 0, b = state.loop?.b ?? meta.duration;
    if (t >= b) { t = a + ((t - a) % (b - a)); restartAudio(t); }
    state.t = Math.min(t, meta.duration - 1e-6);
    draw();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function seek(t: number, scrubAudio = false): void {
  if (!meta) return;
  state.t = Math.max(0, Math.min(meta.duration - 1 / meta.fps / 2, t));
  if (state.playing) restartAudio(state.t);
  else if (scrubAudio) grain(state.t);
  draw(true);
  syncUrl();
}

function setPlaying(p: boolean): void {
  state.playing = p;
  $("play").textContent = p ? "❚❚" : "▶";
  if (p) { if (state.loop && (state.t < state.loop.a || state.t >= state.loop.b)) state.t = state.loop.a; restartAudio(state.t); }
  else { stopAudio(); syncUrl(); draw(true); }
}

// ---------- drawing ----------
const frameNo = (t: number) => Math.round(t * (meta?.fps ?? 60));
const sceneAt = (t: number) => meta?.scenes.filter(s => t >= s.start && t < s.end).map(s => s.name).join(" + ") || "world";

function draw(full = false): void {
  if (!dolly || !meta) return;
  try { dolly.render(state.t); showError(null); } catch (e) { showError(String((e as Error).message)); }
  $("tc").innerHTML = `${state.t.toFixed(3)} s <small>f${frameNo(state.t)} · ${sceneAt(state.t)}${state.loop ? ` · loop ${state.loop.a.toFixed(2)}–${state.loop.b.toFixed(2)}` : ""}</small>`;
  drawOverlay(full);
  drawTimeline();
}

function stageToView(): number { return overlay.width / (meta?.stage.width ?? 1); }

function drawOverlay(full: boolean): void {
  const g = overlay.getContext("2d")!;
  g.clearRect(0, 0, overlay.width, overlay.height);
  if (!meta || !dolly) return;
  const W = overlay.width, H = overlay.height, k = stageToView(), dpr = devicePixelRatio || 1;
  g.lineWidth = 1 * dpr;
  if (state.overlays.has("safe")) {
    for (const [f, dash, col] of [[0.93, [6, 4], "rgba(255,209,102,.7)"], [0.9, [], "rgba(255,209,102,.95)"]] as const) {
      g.setLineDash(dash.map(x => x * dpr)); g.strokeStyle = col;
      g.strokeRect(W * (1 - f) / 2, H * (1 - f) / 2, W * f, H * f);
    }
    g.setLineDash([]);
    label(g, "title safe 90 %", W * 0.05 + 4 * dpr, H * 0.05 + 12 * dpr, "rgba(255,209,102,.95)");
  }
  if (state.overlays.has("grid")) {
    g.strokeStyle = "rgba(255,255,255,.35)";
    for (const f of [1 / 3, 2 / 3]) { line(g, W * f, 0, W * f, H); line(g, 0, H * f, W, H * f); }
  }
  const needInspect = state.overlays.has("bounds") || state.overlays.has("camera") || state.overlays.has("heat");
  if (needInspect && (full || !state.playing || frameNo(state.t) % 4 === 0)) {
    if (!inspectCache || inspectCache.t !== state.t) inspectCache = { t: state.t, r: dolly.inspect(state.t) };
    dolly.render(state.t);
  }
  const ins = inspectCache?.r;
  if (state.overlays.has("bounds") && ins) {
    g.font = `${10 * dpr}px Segoe UI, sans-serif`;
    const seen = new Map<string, { x: number; y: number; w: number; h: number; name: string }>();
    for (const e of ins.elements) {
      const r = e.rect, cur = seen.get(e.key);
      if (!cur) seen.set(e.key, { ...r, name: e.group });
      else { const x = Math.min(cur.x, r.x), y = Math.min(cur.y, r.y); seen.set(e.key, { x, y, w: Math.max(cur.x + cur.w, r.x + r.w) - x, h: Math.max(cur.y + cur.h, r.y + r.h) - y, name: cur.name }); }
    }
    for (const b of seen.values()) {
      g.strokeStyle = "rgba(109,139,255,.9)"; g.strokeRect(b.x * k, b.y * k, b.w * k, b.h * k);
      label(g, b.name.split(" > ").slice(-1)[0], b.x * k + 2 * dpr, b.y * k - 3 * dpr, "rgba(109,139,255,1)");
    }
  }
  if (state.overlays.has("heat") && ins) {
    // velocity: how many blur samples this frame will get, and which text is moving fastest
    const h = 1 / meta.fps / 4;
    const m = dolly.motion(Math.max(0, state.t - h), state.t + h);
    dolly.render(state.t);
    const px1080 = m.px * (1080 / (overlay.height / dpr));
    const n = Math.min(32, 2 ** Math.ceil(Math.log2(Math.max(1, Math.ceil(px1080 / 1.5)))));
    g.fillStyle = heatColor(n, 0.85);
    g.fillRect(8 * dpr, H - 30 * dpr, 168 * dpr, 22 * dpr);
    label(g, `motion ${px1080.toFixed(1)} px/shutter · ${n}× blur`, 14 * dpr, H - 15 * dpr, "#000");
    if (m.element) label(g, `fastest: ${m.element}`, 184 * dpr, H - 15 * dpr, "rgba(255,255,255,.85)");
  }
  if (state.overlays.has("camera") && ins) {
    // where the camera centre travels, in the current frame's screen space
    const cam = ins.camera;
    const toScreen = (x: number, y: number): [number, number] => {
      const a = cam.rotate * Math.PI / 180, dx = (x - cam.x) * cam.zoom, dy = (y - cam.y) * cam.zoom;
      return [(meta!.stage.width / 2 + dx * Math.cos(a) - dy * Math.sin(a)) * k, (meta!.stage.height / 2 + dx * Math.sin(a) + dy * Math.cos(a)) * k];
    };
    const pts: Array<[number, number, number]> = [];
    for (let t = 0; t <= meta.duration; t += 0.1) { const c = dolly.inspect(t).camera; pts.push([...toScreen(c.x, c.y), t]); }
    dolly.render(state.t);
    g.strokeStyle = "rgba(255,122,122,.8)"; g.lineWidth = 2 * dpr;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    for (const [x, y, t] of pts) if (Math.abs(t - Math.round(t)) < 0.05) { g.fillStyle = "rgba(255,122,122,.9)"; g.fillRect(x - 2 * dpr, y - 2 * dpr, 4 * dpr, 4 * dpr); }
    g.strokeStyle = "#fff"; g.lineWidth = 1 * dpr;
    line(g, W / 2 - 8 * dpr, H / 2, W / 2 + 8 * dpr, H / 2); line(g, W / 2, H / 2 - 8 * dpr, W / 2, H / 2 + 8 * dpr);
    label(g, `camera x ${cam.x.toFixed(0)} y ${cam.y.toFixed(0)} zoom ${cam.zoom.toFixed(2)}${cam.rotate ? ` rot ${cam.rotate.toFixed(1)}°` : ""}`, W / 2 + 10 * dpr, H / 2 - 6 * dpr, "#fff");
  }
  if (state.overlays.has("paths") && !state.playing) {
    if (!pathsCache || pathsCache.t !== state.t) {
      const paths = new Map<string, Array<[number, number]>>();
      for (let dt = -1.5; dt <= 1.5001; dt += 0.1) {
        const t = state.t + dt; if (t < 0 || t > meta.duration) continue;
        const centres = new Map<string, { x: number; y: number; n: number }>();
        for (const e of dolly.inspect(t).elements) {
          const c = centres.get(e.key) ?? { x: 0, y: 0, n: 0 };
          c.x += e.rect.x + e.rect.w / 2; c.y += e.rect.y + e.rect.h / 2; c.n++; centres.set(e.key, c);
        }
        for (const [key, c] of centres) paths.set(key, [...(paths.get(key) ?? []), [c.x / c.n, c.y / c.n]]);
      }
      dolly.render(state.t);
      pathsCache = { t: state.t, paths };
    }
    g.strokeStyle = "rgba(124,255,178,.75)"; g.lineWidth = 1.5 * dpr;
    for (const p of pathsCache.paths.values()) {
      if (p.length < 2) continue;
      const moved = Math.hypot(p[p.length - 1][0] - p[0][0], p[p.length - 1][1] - p[0][1]);
      if (moved < 4) continue;
      g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k))); g.stroke();
    }
  }
}

function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
function label(g: CanvasRenderingContext2D, s: string, x: number, y: number, col: string): void {
  const dpr = devicePixelRatio || 1;
  g.font = `600 ${10.5 * dpr}px Segoe UI, sans-serif`; g.fillStyle = col; g.fillText(s, x, y);
}
function heatColor(n: number, a = 1): string {
  return n <= 1 ? `rgba(60,64,74,${a})` : n <= 4 ? `rgba(80,130,255,${a})` : n <= 8 ? `rgba(90,210,200,${a})` : n <= 16 ? `rgba(255,200,70,${a})` : `rgba(255,90,80,${a})`;
}

// ---------- timeline ----------
const ROWS = { ruler: [0, 22], scenes: [24, 50], markers: [52, 70], heat: [72, 84], audio: [88, 168] } as const;
const PAD = 14;
const xOf = (t: number) => { const dpr = devicePixelRatio || 1; return PAD * dpr + (t / (meta?.duration ?? 1)) * (tl.width - 2 * PAD * dpr); };
const tOf = (x: number) => { const dpr = devicePixelRatio || 1; return ((x * dpr - PAD * dpr) / (tl.width - 2 * PAD * dpr)) * (meta?.duration ?? 1); };

function drawTimeline(): void {
  const g = tl.getContext("2d")!, dpr = devicePixelRatio || 1, W = tl.width, H = tl.height;
  g.clearRect(0, 0, W, H);
  if (!meta) return;
  const y = (r: readonly [number, number]) => [r[0] * dpr, (r[1] - r[0]) * dpr] as const;
  // loop range
  if (state.loop) { g.fillStyle = "rgba(109,139,255,.13)"; g.fillRect(xOf(state.loop.a), 0, xOf(state.loop.b) - xOf(state.loop.a), H); }
  // ruler: seconds + beats
  g.fillStyle = "#8b909c"; g.font = `${10 * dpr}px Segoe UI, sans-serif`;
  const beat = meta.bpm ? 60 / meta.bpm : 0;
  if (beat) for (let b = meta.beatOffset ?? 0; b <= meta.duration; b += beat) {
    const bar = Math.round((b - (meta.beatOffset ?? 0)) / beat) % 4 === 0;
    g.fillStyle = bar ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.12)"; g.fillRect(xOf(b), (bar ? 12 : 16) * dpr, 1 * dpr, (bar ? 10 : 6) * dpr);
  }
  for (let s = 0; s <= meta.duration; s++) {
    g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(xOf(s), 0, 1 * dpr, 8 * dpr);
    if (s % (meta.duration > 40 ? 5 : 1) === 0) { g.fillStyle = "#8b909c"; g.fillText(`${s}s`, xOf(s) + 3 * dpr, 9 * dpr); }
  }
  // scenes (overlaps drawn as two half-height bars)
  const [sy, sh] = y(ROWS.scenes);
  meta.scenes.forEach((s, i) => {
    const half = i % 2;
    g.fillStyle = half ? "#3a2a50" : "#2a3350";
    g.fillRect(xOf(s.start), sy + (half ? sh / 2 : 0), xOf(s.end) - xOf(s.start), sh / 2 - 1 * dpr);
    g.fillStyle = "#d8dbe2"; g.font = `600 ${10 * dpr}px Segoe UI, sans-serif`;
    g.fillText(s.name, xOf(s.start) + 4 * dpr, sy + (half ? sh / 2 : 0) + 9.5 * dpr);
  });
  // markers
  const [my, mh] = y(ROWS.markers);
  g.font = `${9.5 * dpr}px Segoe UI, sans-serif`;
  let labelEnd = -Infinity; // skip labels that would overlap the previous one (the diamond still shows)
  for (const m of [...meta.markers].sort((a, b) => a.t - b.t)) {
    if (meta.scenes.some(s => s.name === m.name && s.start === m.t)) continue;
    const x = xOf(m.t);
    g.fillStyle = m.kind === "cut" ? "#ff7a7a" : "#ffd166";
    g.beginPath(); g.moveTo(x, my); g.lineTo(x + 4 * dpr, my + 5 * dpr); g.lineTo(x, my + 10 * dpr); g.lineTo(x - 4 * dpr, my + 5 * dpr); g.fill();
    if (x + 6 * dpr > labelEnd) { g.fillStyle = "#b6bac4"; g.fillText(m.name, x + 6 * dpr, my + mh - 4 * dpr); labelEnd = x + 10 * dpr + g.measureText(m.name).width; }
  }
  // blur heat
  const [hy, hh] = y(ROWS.heat);
  if (heat) {
    const step = 1 / 30;
    for (let i = 0; i < heat.length; i++) if (heat[i] > 1) { g.fillStyle = heatColor(heat[i]); g.fillRect(xOf(i * step), hy, Math.max(1, xOf(step) - xOf(0)) + 0.5, hh); }
  } else { g.fillStyle = "#3a3e48"; g.fillText("measuring motion…", xOf(0), hy + 9 * dpr); }
  // audio
  const [ay, ah] = y(ROWS.audio);
  const laneH = tracks.length ? Math.min(26 * dpr, ah / tracks.length) : 0;
  tracks.forEach((tr, i) => {
    const top = ay + i * laneH;
    const x0 = xOf(tr.start), x1 = tr.buffer ? xOf(tr.start + tr.buffer.duration) : x0 + 40 * dpr;
    g.fillStyle = tr.role === "vo" ? "rgba(124,255,178,.13)" : "rgba(109,139,255,.13)"; g.fillRect(x0, top, x1 - x0, laneH - 2 * dpr);
    if (tr.peaks) {
      g.fillStyle = tr.role === "vo" ? "rgba(124,255,178,.7)" : "rgba(109,139,255,.7)";
      const n = tr.peaks.length, mid = top + laneH / 2;
      for (let p = 0; p < n; p++) { const x = x0 + (p / n) * (x1 - x0), a = tr.peaks[p] * (laneH / 2 - 2 * dpr); g.fillRect(x, mid - a, Math.max(1, (x1 - x0) / n), a * 2); }
    }
    g.fillStyle = "#d8dbe2"; g.fillText(`${tr.name} @ ${tr.start.toFixed(2)} s`, x0 + 4 * dpr, top + 10 * dpr);
  });
  if (!tracks.length) { g.fillStyle = "#4a4e58"; g.fillText("audio: none · drop music or VO files here", xOf(0), ay + 12 * dpr); }
  // playhead
  g.fillStyle = "#fff"; g.fillRect(xOf(state.t) - 0.5 * dpr, 0, 1.5 * dpr, H);
}

// ---------- heat (blur samples per frame, computed in idle slices) ----------
function computeHeat(): void {
  if (!dolly || !meta) return;
  const n = Math.ceil(meta.duration * 30), out = new Float32Array(n);
  const h = 1 / meta.fps / 4, scale = 1080 / (overlay.height / (devicePixelRatio || 1));
  let i = 0;
  heat = null;
  const slice = () => {
    if (!dolly || !meta) return;
    const end = Math.min(n, i + 40);
    for (; i < end; i++) { const t = i / 30; const m = dolly.motion(Math.max(0, t - h), t + h); out[i] = Math.min(32, 2 ** Math.ceil(Math.log2(Math.max(1, Math.ceil(m.px * scale / 1.5))))); }
    dolly.render(state.t);
    if (i < n) setTimeout(slice, 0); else { heat = out; draw(true); }
  };
  setTimeout(slice, 50);
}

// ---------- timeline interaction ----------
let drag: null | { kind: "scrub" } | { kind: "clip"; track: Track; dx: number } = null;
const snapT = (t: number, force = false): number => {
  if (!meta || (!state.snap && !force)) return t;
  const cands = [...(meta.bpm ? Array.from({ length: Math.ceil(meta.duration * meta.bpm / 60) + 1 }, (_, i) => (meta!.beatOffset ?? 0) + i * 60 / meta!.bpm!) : []), ...meta.markers.map(m => m.t)];
  let best = t, d = 0.12;
  for (const c of cands) if (Math.abs(c - t) < d) { d = Math.abs(c - t); best = c; }
  return best;
};
tl.addEventListener("mousedown", e => {
  if (!meta) return;
  const dpr = devicePixelRatio || 1, yy = e.offsetY * dpr / dpr;
  const t = tOf(e.offsetX);
  if (yy >= ROWS.audio[0]) {
    const laneH = Math.min(26, (ROWS.audio[1] - ROWS.audio[0]) / Math.max(1, tracks.length));
    const tr = tracks[Math.floor((yy - ROWS.audio[0]) / laneH)];
    if (tr) { drag = { kind: "clip", track: tr, dx: t - tr.start }; return; }
  }
  if (yy >= ROWS.markers[0] && yy < ROWS.markers[1]) {
    const m = meta.markers.reduce((b, x) => (Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b), meta.markers[0]);
    if (m && Math.abs(xOf(m.t) / dpr - e.offsetX) < 10) { seek(m.t); return; }
  }
  drag = { kind: "scrub" };
  seek(snapT(t, e.altKey), true);
});
addEventListener("mousemove", e => {
  if (!drag || !meta) return;
  const rect = tl.getBoundingClientRect();
  const t = tOf(e.clientX - rect.left);
  if (drag.kind === "scrub") seek(snapT(t, e.altKey), true);
  else { drag.track.start = +snapT(Math.max(-30, t - drag.dx), true).toFixed(3); drawTimeline(); }
});
addEventListener("mouseup", () => {
  if (drag?.kind === "clip") announceAudio();
  drag = null;
});
tl.addEventListener("dblclick", e => { if (e.offsetY >= ROWS.scenes[0] && e.offsetY < ROWS.scenes[1]) loopScene(tOf(e.offsetX)); });

// ---------- loop, rate, aspect, overlays ----------
function loopScene(at = state.t): void {
  const s = meta?.scenes.find(x => at >= x.start && at < x.end);
  if (!s) return;
  state.loop = state.loop && state.loop.a === s.start && state.loop.b === s.end ? null : { a: s.start, b: s.end };
  draw(true); syncUrl();
}
let pendingIn: number | null = null;
function setIn(): void { pendingIn = state.t; state.loop = state.loop && state.loop.b > state.t ? { a: state.t, b: state.loop.b } : null; draw(true); syncUrl(); }
function setOut(): void { const a = state.loop?.a ?? pendingIn ?? 0; if (state.t > a) state.loop = { a, b: state.t }; draw(true); syncUrl(); }
function setRate(r: number): void { state.rate = r; ($<HTMLSelectElement>("rate")).value = String(r); if (state.playing) restartAudio(state.t); syncUrl(); }
function toggleOverlay(o: Overlay): void { state.overlays.has(o) ? state.overlays.delete(o) : state.overlays.add(o); inspectCache = pathsCache = null; syncButtons(); draw(true); syncUrl(); }
function syncButtons(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-ov]").forEach(b => b.classList.toggle("on", state.overlays.has(b.dataset.ov as Overlay)));
  $("snap").classList.toggle("on", state.snap);
  ($<HTMLSelectElement>("rate")).value = String(state.rate);
  if (state.aspect) ($<HTMLSelectElement>("aspect")).value = state.aspect;
}
let urlTimer = 0;
function syncUrl(): void {
  clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => {
    const p = new URLSearchParams();
    p.set("t", state.t.toFixed(3));
    if (state.loop) p.set("loop", `${state.loop.a.toFixed(3)}-${state.loop.b.toFixed(3)}`);
    if (state.rate !== 1) p.set("rate", String(state.rate));
    if (state.aspect) p.set("aspect", state.aspect);
    if (state.overlays.size) p.set("ov", [...state.overlays].join(","));
    if (state.snap) p.set("snap", "1");
    history.replaceState(null, "", `?${p}`);
  }, 150);
}

$("play").onclick = () => setPlaying(!state.playing);
$("stepb").onclick = () => seek(state.t - 1 / (meta?.fps ?? 60));
$("stepf").onclick = () => seek(state.t + 1 / (meta?.fps ?? 60));
$<HTMLSelectElement>("rate").onchange = e => setRate(+(e.target as HTMLSelectElement).value);
$<HTMLSelectElement>("aspect").onchange = e => { state.aspect = (e.target as HTMLSelectElement).value; loadFrame(); syncUrl(); };
$("loopScene").onclick = () => loopScene();
$("loopIn").onclick = setIn; $("loopOut").onclick = setOut;
$("loopClear").onclick = () => { state.loop = null; draw(true); syncUrl(); };
$("snap").onclick = () => { state.snap = !state.snap; syncButtons(); syncUrl(); };
$("copy").onclick = () => { syncUrl(); setTimeout(() => navigator.clipboard?.writeText(location.href), 200); statusEl.textContent = "link copied"; };
document.querySelectorAll<HTMLButtonElement>("[data-ov]").forEach(b => (b.onclick = () => toggleOverlay(b.dataset.ov as Overlay)));

addEventListener("keydown", e => {
  if ((e.target as HTMLElement).tagName === "SELECT") return;
  const fps = meta?.fps ?? 60;
  const markers = (meta?.markers ?? []).map(m => m.t).sort((a, b) => a - b);
  const k = e.key;
  if (k === " ") { e.preventDefault(); setPlaying(!state.playing); }
  else if (k === "ArrowRight") seek(state.t + (e.shiftKey ? 1 : 1 / fps));
  else if (k === "ArrowLeft") seek(state.t - (e.shiftKey ? 1 : 1 / fps));
  else if (k === "Home") seek(state.loop?.a ?? 0);
  else if (k === "End") seek((state.loop?.b ?? meta?.duration ?? 0) - 1 / fps);
  else if (k === "]") { const n = markers.find(t => t > state.t + 1e-3); if (n !== undefined) seek(n); }
  else if (k === "[") { const p = [...markers].reverse().find(t => t < state.t - 1e-3); if (p !== undefined) seek(p); }
  else if (k === "l" || k === "L") loopScene();
  else if (k === "i" || k === "I") setIn();
  else if (k === "o" || k === "O") setOut();
  else if (k === "x" || k === "X") { state.loop = null; draw(true); syncUrl(); }
  else if (k >= "1" && k <= "5") setRate([0.1, 0.25, 0.5, 0.75, 1][+k - 1]);
  else {
    const ov: Record<string, Overlay> = { s: "safe", g: "grid", b: "bounds", c: "camera", m: "paths", h: "heat" };
    if (ov[k.toLowerCase()]) toggleOverlay(ov[k.toLowerCase()]);
  }
});

// ---------- audio ----------
async function addTrack(name: string, url: string, start = 0, role?: string, gain = 1): Promise<void> {
  const tr: Track = { name, url, buffer: null, start, role: role ?? (/vo|voice|narrat/i.test(name) ? "vo" : "music"), gain, peaks: null };
  tracks.push(tr);
  drawTimeline();
  try {
    audioCtx ??= new AudioContext();
    const data = await (await fetch(url)).arrayBuffer();
    tr.buffer = await audioCtx.decodeAudioData(data);
    const ch = tr.buffer.getChannelData(0), n = 1500, per = Math.floor(ch.length / n), peaks = new Float32Array(n);
    for (let i = 0; i < n; i++) { let m = 0; for (let j = i * per; j < (i + 1) * per; j += 16) m = Math.max(m, Math.abs(ch[j])); peaks[i] = m; }
    tr.peaks = peaks;
  } catch (e) { statusEl.textContent = `audio ${name}: ${(e as Error).message}`; }
  drawTimeline();
}
let projectAudioLoaded = false;
function loadProjectAudio(): void {
  if (projectAudioLoaded || !meta) return;
  projectAudioLoaded = true;
  for (const a of meta.audio) void addTrack(a.src.split("/").pop()!, `/project/${a.src}`, a.start ?? 0, a.role, a.gain ?? 1);
}
function stopAudio(): void { for (const s of sources) { try { s.stop(); } catch { /* already stopped */ } } sources = []; }
function restartAudio(t: number): void {
  stopAudio();
  if (!audioCtx || !state.playing) return;
  void audioCtx.resume();
  for (const tr of tracks) {
    if (!tr.buffer) continue;
    const src = audioCtx.createBufferSource(), gain = audioCtx.createGain();
    src.buffer = tr.buffer; src.playbackRate.value = state.rate; gain.gain.value = tr.gain;
    src.connect(gain).connect(audioCtx.destination);
    const off = t - tr.start;
    if (off >= tr.buffer.duration) continue;
    if (off >= 0) src.start(audioCtx.currentTime, off); else src.start(audioCtx.currentTime - off / state.rate, 0);
    sources.push(src);
  }
}
// a short grain while scrubbing, so you can find a beat or a word by ear
function grain(t: number): void {
  if (!audioCtx) return;
  void audioCtx.resume();
  for (const tr of tracks) {
    if (!tr.buffer) continue;
    const off = t - tr.start; if (off < 0 || off >= tr.buffer.duration) continue;
    const src = audioCtx.createBufferSource(), gain = audioCtx.createGain();
    src.buffer = tr.buffer; gain.gain.setValueAtTime(tr.gain, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.08);
    src.connect(gain).connect(audioCtx.destination); src.start(audioCtx.currentTime, off, 0.08);
  }
}
function announceAudio(): void {
  const cfg = tracks.map(t => ({ src: t.url.startsWith("/project/") ? t.url.slice(9) : `audio/${t.name}`, start: t.start, role: t.role, ...(t.gain !== 1 ? { gain: t.gain } : {}) }));
  const snippet = `audio: ${JSON.stringify(cfg)}`;
  navigator.clipboard?.writeText(snippet).catch(() => {});
  statusEl.textContent = "audio placement copied: paste into defineVideo({ … })";
  (window as any).player.audioConfig = cfg;
}
const drop = $("drop");
addEventListener("dragover", e => { e.preventDefault(); drop.style.display = "grid"; });
addEventListener("dragleave", e => { if (!e.relatedTarget) drop.style.display = "none"; });
addEventListener("drop", e => {
  e.preventDefault(); drop.style.display = "none";
  for (const f of e.dataTransfer?.files ?? []) if (/audio|video/.test(f.type) || /\.(mp3|wav|m4a|ogg|flac)$/i.test(f.name)) void addTrack(f.name, URL.createObjectURL(f), snapT(state.t, true));
});

// ---------- live reload ----------
const es = new EventSource("/events");
es.addEventListener("reload", e => { statusEl.textContent = `reloaded (${JSON.parse((e as MessageEvent).data).file})`; loadFrame(); });
es.addEventListener("error", e => { const d = (e as MessageEvent).data; if (d) showError(`build failed:\n${JSON.parse(d).message}`); });
es.addEventListener("hello", e => { const d = JSON.parse((e as MessageEvent).data); if (d.error) showError(`build failed:\n${d.error}`); });

// ---------- agent API ----------
(window as any).player = {
  seek: (t: number) => seek(t),
  play: () => setPlaying(true),
  pause: () => setPlaying(false),
  setRate,
  setLoop: (a: number, b: number) => { state.loop = b > a ? { a, b } : null; draw(true); syncUrl(); },
  loopScene: (name: string) => { const s = meta?.scenes.find(x => x.name === name); if (s) { state.loop = { a: s.start, b: s.end }; draw(true); syncUrl(); } },
  setOverlays: (list: Overlay[]) => { state.overlays = new Set(list); inspectCache = pathsCache = null; syncButtons(); draw(true); syncUrl(); },
  setAspect: (a: string) => { state.aspect = a; loadFrame(); syncUrl(); },
  state: () => ({ ...state, overlays: [...state.overlays], scene: sceneAt(state.t), frame: frameNo(state.t), duration: meta?.duration, heatReady: !!heat }),
  addAudio: (url: string, start = 0, role?: string) => addTrack(url.split("/").pop()!, url, start, role),
  audioConfig: null,
  heat: () => (heat ? Array.from(heat) : null),
};

syncButtons();
loadFrame();
