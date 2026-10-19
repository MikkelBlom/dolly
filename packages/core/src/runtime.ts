// Browser runtime: mounts a VideoDef into the page and exposes the frame contract on window.__dolly.
// The renderer, the player and the linter only ever talk to a scene document through this object.
import { activeScenes, allMarkers, withAspect, type Aspect, type SceneContext, type SceneDef, type SceneTime, type VideoDef } from "./video.ts";
import { cameraDisplacement, cameraTransform, screenToWorld, worldToScreen, type CameraState } from "./camera.ts";
import { themeCss } from "./theme.ts";
import { setStage } from "./dom.ts";
import { rng, seedOf } from "./math.ts";

export interface FrameElementInfo {
  name: string;
  /** Text block this unit belongs to (masked words/characters share their heading's group). */
  group: string;
  /** Structural key of the group (child-index path), stable across workers. */
  key: string;
  scene: string | null;
  rect: { x: number; y: number; w: number; h: number };
  opacity: number;
  /** Fraction of the element visible inside its mask/clip parent (1 = fully shown). */
  shown: number;
  /** Part of a value-change transition (odometer roll, slide), not a resting state. */
  transient?: boolean;
  /** Inside [data-dolly-decor]: background texture (mock article text, old list items) the text rules skip. */
  decor?: boolean;
  text?: string;
  /** Rendered font size in stage px (includes transforms). */
  fontSize?: number;
  color?: string;
  background?: string;
}

export interface InspectResult {
  t: number;
  camera: CameraState;
  scenes: string[];
  elements: FrameElementInfo[];
}

export interface DollyMeta {
  title: string;
  fps: number;
  duration: number;
  stage: { width: number; height: number };
  bpm?: number;
  beatOffset?: number;
  aspect: Aspect;
  scenes: Array<{ name: string; start: number; end: number; file?: string }>;
  markers: Array<{ name: string; t: number; kind?: string }>;
  audio: NonNullable<VideoDef["audio"]>;
  background: string;
}

export interface DollyApi {
  version: 1;
  meta: DollyMeta;
  ready: Promise<DollyMeta>;
  render(t: number): void;
  /** Largest on-screen displacement (output px) of anything visible between t0 and t1. */
  motion(t0: number, t1: number): { px: number; camera: number; cameraVec: [number, number]; element: string | null };
  /**
   * Blur the camera-moved world layer along (dx, dy) output px ("sample + smear": fills the gaps between
   * motion-blur samples on fast camera moves). (0, 0) turns it off. Screen-space layers stay sharp.
   */
  setSmear(dx: number, dy: number): void;
  /**
   * Rendered state of every visible element (computed transform, opacity, colours, filter, text, box),
   * one line per element, for the current frame. Two renders of the same t must give identical lines;
   * the determinism check compares these rather than pixels (Chromium adds raster noise of its own).
   */
  fingerprint(): string[];
  inspect(t: number, opts?: { all?: boolean }): InspectResult;
  /** Refit the stage to the window (called on resize). */
  fit(): number;
}

declare global { interface Window { __dolly: DollyApi } }

export class DollyRenderError extends Error {
  scene: string; t: number;
  constructor(scene: string, t: number, cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`scene "${scene}" at t=${t.toFixed(3)}s: ${msg}`);
    this.name = "DollyRenderError"; this.scene = scene; this.t = t;
    if (cause instanceof Error && cause.stack) this.stack = `${this.name}: ${this.message}\n${cause.stack.split("\n").slice(1).join("\n")}`;
  }
}

const IDENTITY = (w: number, h: number): CameraState => ({ x: w / 2, y: h / 2, zoom: 1, rotate: 0 });

/**
 * Make every "random" or clock-reading library call a pure function of the frame time: Math.random is
 * reseeded per render(t), and Date.now / performance.now return the scene time. Third-party code that
 * reads them then renders identically on every worker.
 */
function freezeClock(): { at(t: number): void } {
  let now = 0, rand = rng(1);
  const epoch = Date.UTC(2026, 0, 1);
  Math.random = () => rand();
  Date.now = () => epoch + now * 1000;
  performance.now = () => now * 1000;
  return { at(t: number) { now = t; rand = rng(seedOf(t.toFixed(6))); } };
}

export async function mount(input: VideoDef, opts: { aspect?: Aspect; assetBase?: string } = {}): Promise<DollyApi> {
  const params = new URLSearchParams(location.search);
  const v = withAspect(input, (params.get("aspect") as Aspect | null) ?? opts.aspect);
  const W = v.stage.width, H = v.stage.height;
  const clock = freezeClock();
  const bg = v.background ?? v.theme.colors.bg;

  const style = document.createElement("style");
  style.textContent = `${themeCss(v.theme, opts.assetBase ?? "")}
html,body{margin:0;overflow:hidden;background:${bg === "transparent" ? "transparent" : "#000"}}
*{box-sizing:border-box}
*,*::before,*::after{animation-play-state:paused!important;transition:none!important}
#dolly-stage{--stage-w:${W}px;--stage-h:${H}px;position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;transform-origin:0 0;background:${bg};color:var(--c-fg);font-family:var(--f-body)}
.dolly-layer{position:absolute;left:0;top:0;width:${W}px;height:${H}px}
#dolly-world{transform-origin:0 0;z-index:10}
#dolly-hud{z-index:20}
.dolly-c{position:absolute;left:0;top:0;width:${W}px;height:${H}px}`;
  document.head.append(style);
  const sheets = (v.theme.fontCss ?? []).map(href => new Promise<void>((res, rej) => {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href;
    l.onload = () => res(); l.onerror = () => rej(new Error(`font stylesheet failed to load: ${href}`));
    document.head.append(l);
  }));

  const stage = document.createElement("div"); stage.id = "dolly-stage";
  const world = document.createElement("div"); world.id = "dolly-world"; world.className = "dolly-layer";
  const hud = document.createElement("div"); hud.id = "dolly-hud"; hud.className = "dolly-layer";
  stage.append(world, hud);
  document.body.append(stage);

  const fit = (): number => {
    const k = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `scale(${k})`;
    stage.style.left = (innerWidth - W * k) / 2 + "px";
    stage.style.top = (innerHeight - H * k) / 2 + "px";
    setStage(stage, k);
    return k;
  };
  let scale = fit();
  // a ResizeObserver also catches iframes resized by their parent, where no resize event may fire
  addEventListener("resize", () => { scale = fit(); });
  new ResizeObserver(() => { scale = fit(); }).observe(document.documentElement);

  const camera = (t: number): CameraState => (v.camera ? v.camera(t) : IDENTITY(W, H));
  const markers = allMarkers(v);
  const screens = new Map<number, HTMLElement>();
  const screenLayer = (z: number): HTMLElement => {
    let l = screens.get(z);
    if (!l) { l = document.createElement("div"); l.className = "dolly-layer"; l.style.zIndex = String(z); stage.append(l); screens.set(z, l); }
    return l;
  };

  interface Mounted { def: SceneDef | null; name: string; ctx: SceneContext; containers: HTMLElement[]; visible: boolean }
  const makeCtx = (name: string, owned: HTMLElement[]): SceneContext => {
    const container = (parent: HTMLElement, layer: string): HTMLElement => {
      const c = document.createElement("div");
      c.className = "dolly-c"; c.dataset.scene = name; c.dataset.layer = layer;
      parent.append(c); owned.push(c); return c;
    };
    let w: HTMLElement | undefined, hd: HTMLElement | undefined;
    const ctx: SceneContext = {
      video: v, stage: v.stage, aspect: v.aspect ?? "16:9", theme: v.theme,
      get world() { return (w ??= container(world, "world")); },
      get hud() { return (hd ??= container(hud, "hud")); },
      layers: { stage, world, hud },
      screen: (z: number, layer = `screen${z}`) => container(screenLayer(z), layer),
      camera,
      $: (id: string) => {
        for (const c of owned) { const el = c.querySelector<HTMLElement>(`#${CSS.escape(id)}`); if (el) return el; }
        throw new Error(`scene "${name}": no element #${id}`);
      },
      marker: (m: string) => {
        const found = markers.find(x => x.name === m);
        if (!found) throw new Error(`no marker "${m}" (have: ${markers.map(x => x.name).join(", ")})`);
        return found.t;
      },
    };
    return ctx;
  };

  const mounted: Mounted[] = [];
  const worldOwned: HTMLElement[] = [];
  const worldCtx = makeCtx("world", worldOwned);
  mounted.push({ def: null, name: "world", ctx: worldCtx, containers: worldOwned, visible: true });
  for (const s of v.scenes) {
    const owned: HTMLElement[] = [];
    mounted.push({ def: s, name: s.name, ctx: makeCtx(s.name, owned), containers: owned, visible: true });
  }

  const time = (t: number, s?: SceneDef): SceneTime => {
    const start = s?.start ?? 0, end = s?.end ?? v.duration;
    return { t, local: t - start, progress: Math.min(1, Math.max(0, (t - start) / (end - start))), start, end };
  };

  const render = (t: number): void => {
    clock.at(t);
    world.style.transform = cameraTransform(camera(t), v.stage);
    if (v.world?.render) {
      try { v.world.render(time(t), worldCtx); } catch (e) { throw new DollyRenderError("world", t, e); }
    }
    for (const m of mounted) {
      if (!m.def) continue;
      const on = t >= m.def.start && t < m.def.end;
      // display:none, not visibility:hidden: a child with visibility:visible would still show through
      if (on !== m.visible) { for (const c of m.containers) c.style.display = on ? "" : "none"; m.visible = on; }
      if (!on) continue;
      try { m.def.render(time(t, m.def), m.ctx); } catch (e) { throw new DollyRenderError(m.name, t, e); }
    }
  };

  const meta: DollyMeta = {
    title: v.title, fps: v.fps, duration: v.duration, stage: { ...v.stage }, bpm: v.bpm, beatOffset: v.beatOffset,
    aspect: v.aspect ?? "16:9", scenes: v.scenes.map(s => ({ name: s.name, start: s.start, end: s.end, file: s.file })),
    markers, audio: v.audio ?? [], background: bg,
  };

  const LAYER = /^(dolly-stage|dolly-world|dolly-hud)$/;
  const tracked = (): Element[] => [...stage.querySelectorAll("*")].filter(el =>
    !LAYER.test(el.id) && !el.classList.contains("dolly-layer") && !el.classList.contains("dolly-c"));
  const visibleBox = (el: Element): DOMRect | null => {
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return null;
    const r = el.getBoundingClientRect();
    return r.width || r.height ? r : null;
  };

  const motion = (t0: number, t1: number) => {
    const st = stage.getBoundingClientRect();
    const inside = (x: number, horizontal: boolean) => horizontal ? x >= st.left - 2 && x <= st.right + 2 : x >= st.top - 2 && x <= st.bottom + 2;
    render(t0);
    const a = new Map<Element, DOMRect>();
    for (const el of tracked()) { const r = visibleBox(el); if (r) a.set(el, r); }
    render(t1);
    let px = 0, who: Element | null = null;
    for (const el of tracked()) {
      const r0 = a.get(el); if (!r0) continue;
      const r1 = visibleBox(el); if (!r1) continue;
      // only edges that are on screen at either end of the shutter can show blur
      const d = Math.max(
        inside(r0.left, true) || inside(r1.left, true) ? Math.abs(r1.left - r0.left) : 0,
        inside(r0.right, true) || inside(r1.right, true) ? Math.abs(r1.right - r0.right) : 0,
        inside(r0.top, false) || inside(r1.top, false) ? Math.abs(r1.top - r0.top) : 0,
        inside(r0.bottom, false) || inside(r1.bottom, false) ? Math.abs(r1.bottom - r0.bottom) : 0);
      if (d > px) { px = d; who = el; }
    }
    const c0 = camera(t0), c1 = camera(t1);
    const cam = cameraDisplacement(c0, c1, v.stage) * scale;
    // screen motion of the world point under the screen centre: the pan direction
    const p = worldToScreen(c1, v.stage, [c0.x, c0.y]);
    const cameraVec: [number, number] = [(p[0] - W / 2) * scale, (p[1] - H / 2) * scale];
    return { px: Math.max(px, cam), camera: cam, cameraVec, element: who ? describe(who) : null };
  };

  const pathKey = (el: Element): string => {
    const idx: number[] = [];
    for (let e: Element | null = el; e && e !== stage; e = e.parentElement) idx.unshift(e.parentElement ? [...e.parentElement.children].indexOf(e) : 0);
    return idx.join(".");
  };

  const describe = (el: Element): string => {
    const n = (el as HTMLElement).dataset?.name ?? (el.id ? `#${el.id}` : null);
    if (n) return n;
    const parts: string[] = [];
    for (let e: Element | null = el; e && e !== stage && parts.length < 4; e = e.parentElement) {
      if (e.id) { parts.unshift(`#${e.id}`); break; }
      const cls = [...e.classList].filter(c => !c.startsWith("dolly-"))[0];
      parts.unshift(e.tagName.toLowerCase() + (cls ? `.${cls}` : ""));
    }
    return parts.join(" > ");
  };

  const inspect = (t: number, o: { all?: boolean } = {}): InspectResult => {
    render(t);
    const st = stage.getBoundingClientRect();
    const out: FrameElementInfo[] = [];
    for (const el of tracked()) {
      const r = visibleBox(el); if (!r) continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent ?? "").join("").trim();
      if (!own && !o.all && !(el as HTMLElement).dataset?.name) continue;
      let op = 1;
      for (let e: Element | null = el; e && e !== stage; e = e.parentElement) op *= +getComputedStyle(e).opacity;
      const cs = getComputedStyle(el);
      let bgc: string | undefined;
      for (let e: Element | null = el; e; e = e.parentElement) {
        const b = getComputedStyle(e).backgroundColor;
        if (b && b !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(b)) { bgc = b; break; }
        if (e === stage) break;
      }
      const he = el as HTMLElement;
      const ratio = he.offsetHeight ? r.height / he.offsetHeight : scale;
      // masked units: how much of the unit is inside its clip box (0 while it is still rising in)
      let shown = 1, group = describe(el), key = pathKey(el);
      if (el.classList.contains("dolly-wi") && el.parentElement) {
        const m = el.parentElement.getBoundingClientRect();
        const ix = Math.max(0, Math.min(r.right, m.right) - Math.max(r.left, m.left)), iy = Math.max(0, Math.min(r.bottom, m.bottom) - Math.max(r.top, m.top));
        shown = r.width * r.height ? (ix * iy) / (r.width * r.height) : 0;
        group = describe(el.parentElement.parentElement ?? el);
        key = pathKey(el.parentElement.parentElement ?? el);
      }
      out.push({
        name: describe(el), group, key, shown: +shown.toFixed(3), ...(el.closest(".dolly-rl") ? { transient: true } : {}), ...(el.closest("[data-dolly-decor]") ? { decor: true } : {}), scene: (el.closest(".dolly-c") as HTMLElement | null)?.dataset.scene ?? null,
        rect: { x: (r.left - st.left) / scale, y: (r.top - st.top) / scale, w: r.width / scale, h: r.height / scale },
        opacity: +op.toFixed(3),
        ...(own ? { text: own, fontSize: +(parseFloat(cs.fontSize) * ratio / scale).toFixed(2), color: cs.color, background: bgc ?? bg } : {}),
      });
    }
    return { t, camera: camera(t), scenes: activeScenes(v, t).map(s => s.name), elements: out };
  };

  // Smear: an SVG Gaussian blur on the world layer. The filter runs in the layer's own (world) units,
  // which the camera scales by zoom × stage scale, so the screen-space length is divided by both.
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.style.position = "absolute";
  const filter = document.createElementNS(NS, "filter");
  filter.id = "dolly-smear";
  // user-space region set per frame to what the camera sees: the world extends far beyond the layer's own
  // box (an objectBoundingBox region clips everything the camera has travelled to), and a huge fixed
  // region makes Chromium drop the layer altogether
  for (const [k, val] of [["filterUnits", "userSpaceOnUse"], ["color-interpolation-filters", "sRGB"]]) filter.setAttribute(k, val);
  const blurEl = document.createElementNS(NS, "feGaussianBlur");
  blurEl.setAttribute("stdDeviation", "0 0");
  filter.append(blurEl); svg.append(filter); document.body.append(svg);
  let smear: [number, number] = [0, 0], lastT = 0;
  const applySmear = (t: number) => {
    if (!smear[0] && !smear[1]) { if (world.style.filter) world.style.filter = ""; return; }
    // a box of length g has the variance of a Gaussian with sigma = g / sqrt(12)
    const c = camera(t), z = c.zoom * scale;
    const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(p => screenToWorld(c, v.stage, p as [number, number]));
    const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]);
    const mx = (Math.max(...xs) - Math.min(...xs)) * 0.1, my = (Math.max(...ys) - Math.min(...ys)) * 0.1;
    filter.setAttribute("x", String(Math.min(...xs) - mx)); filter.setAttribute("y", String(Math.min(...ys) - my));
    filter.setAttribute("width", String(Math.max(...xs) - Math.min(...xs) + 2 * mx)); filter.setAttribute("height", String(Math.max(...ys) - Math.min(...ys) + 2 * my));
    blurEl.setAttribute("stdDeviation", `${(Math.abs(smear[0]) / Math.sqrt(12) / z).toFixed(3)} ${(Math.abs(smear[1]) / Math.sqrt(12) / z).toFixed(3)}`);
    world.style.filter = "url(#dolly-smear)";
  };
  const renderAt = (t: number) => { lastT = t; render(t); applySmear(t); };
  const api: DollyApi = {
    version: 1, meta, ready: null as unknown as Promise<DollyMeta>, render: renderAt, motion, inspect, fit: () => (scale = fit()),
    setSmear: (dx: number, dy: number) => { smear = [dx, dy]; applySmear(lastT); },
    fingerprint: () => {
      const st = stage.getBoundingClientRect();
      const out: string[] = [];
      for (const el of stage.querySelectorAll("*")) {
        if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        const c = getComputedStyle(el), r = el.getBoundingClientRect();
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
        const box = [r.left - st.left, r.top - st.top, r.width, r.height].map(x => (x / scale).toFixed(2)).join(",");
        out.push(`${describe(el)} [${pathKey(el)}] box=${box} transform=${c.transform} opacity=${c.opacity} color=${c.color} bg=${c.backgroundColor} filter=${c.filter} clip=${c.clipPath}${own ? ` text=${JSON.stringify(own)}` : ""}`);
      }
      return out;
    },
  };
  window.__dolly = api;

  api.ready = (async () => {
    if (v.world?.setup) await v.world.setup(worldCtx);
    for (const m of mounted) if (m.def?.setup) {
      try { await m.def.setup(m.ctx); } catch (e) { throw new DollyRenderError(m.name, 0, e); }
    }
    await Promise.all(sheets);
    const faces = v.theme.fontFaces ?? [];
    const results = await Promise.all(faces.map(f => document.fonts.load(`${f.style ?? "normal"} ${f.weight?.split(" ")[0] ?? "400"} 32px "${f.family}"`).then(r => [f, r.length] as const)));
    const missing = results.filter(([, n]) => n === 0).map(([f]) => `${f.family} ${f.weight ?? ""} (${f.src ?? "from fontCss"})`);
    if (missing.length) throw new Error(`fonts failed to load: ${missing.join("; ")}`);
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.decode().catch(() => { throw new Error(`image failed to load: ${i.src}`); })));
    render(0);
    return meta;
  })();
  return api;
}
