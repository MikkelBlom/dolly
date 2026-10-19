// Depth and framing components: 3D tilted cards, a parallax background grid, a zoom-into-element
// transition, lower-thirds and an end card.
import { ensureStyle, stagePoint, tf } from "../dom.ts";
import { parallax, type CameraState, type Viewport } from "../camera.ts";
import { cubicInOut, expoOut, quartInOut, sineInOut } from "../easing.ts";
import { clamp, lerp, prog } from "../math.ts";
import { spring } from "../spring.ts";
import { masked, typeIn } from "./text.ts";

/**
 * Tilted-card transform. A flat card reads as a screenshot; a slight 3D angle reads as an object
 * (motion grammar: perspective 1500px, rotateY −38° → −10°, drifting to −5°).
 */
export const tilt = (ry: number, rx = 0, perspective = 1500, extra = ""): string =>
  `perspective(${perspective}px)${extra ? " " + extra : ""} rotateY(${ry}deg) rotateX(${rx}deg)`;

/** Swing a card in from the side on a spring, then drift its tilt across the hold. */
export function swingIn(el: HTMLElement, t: number, t0: number, o: { dx?: number; from?: number; to?: number; drift?: number; driftDur?: number; rx?: number } = {}): void {
  const p = spring(t - t0, { freq: 1.0, zeta: 0.7 });
  const drift = sineInOut(prog(t, t0 + 0.95, o.driftDur ?? 4.5));
  const ry = lerp(o.from ?? -38, o.to ?? -10, p) + drift * (o.drift ?? 5);
  tf(el, tilt(ry, (o.rx ?? 2) - drift * 2, 1500, `translateX(${(1 - p) * (o.dx ?? 520)}px)`), clamp((t - t0) * 4));
}

export interface GridOptions { gap?: number; dot?: number; color?: string; depth?: number }

/** A faint dot grid at a parallax depth (0.5 = half camera speed), which makes camera moves readable. */
export function parallaxGrid(layer: HTMLElement, o: GridOptions = {}): (cam: CameraState, stage: Viewport, extraZoom?: number) => void {
  const g = document.createElement("div");
  const dot = o.dot ?? 1.3, gap = o.gap ?? 28, depth = o.depth ?? 0.5;
  g.style.cssText = `position:absolute;inset:-2px;background-image:radial-gradient(circle, ${o.color ?? "#d3d8e1"} ${dot}px, transparent ${dot + 0.3}px)`;
  layer.append(g);
  return (cam, stage, extraZoom = 1) => {
    const c = parallax({ ...cam, zoom: cam.zoom * extraZoom }, depth, stage);
    const s = gap * c.zoom;
    g.style.backgroundSize = `${s}px ${s}px`;
    g.style.backgroundPosition = `${-c.x * c.zoom + stage.width / 2}px ${-c.y * c.zoom + stage.height / 2}px`;
  };
}

/**
 * Zoom into an element until its fill covers the screen: the cleanest way into an end card. Call with the
 * layer that contains `target`; returns progress (0..1). Measures the target with the layer's transform
 * cleared, then applies translate + exponential scale around it.
 */
export function zoomInto(layer: HTMLElement, target: HTMLElement, t: number, t0: number, t1: number, o: { maxScale?: number; fadeText?: number; stage?: Viewport } = {}): { z: number; css: string; origin: string } {
  const z = prog(t, t0, t1 - t0);
  // reset what the zoom changes, so frames before it don't inherit a later frame's state
  if (z <= 0) { target.style.color = ""; return { z, css: "", origin: "" }; }
  const W = o.stage?.width ?? 1280, H = o.stage?.height ?? 720;
  layer.style.transform = "none"; target.style.transform = "none";
  const [px, py] = stagePoint(target, 0.5, 0.5);
  const e = quartInOut(z), zs = Math.exp(Math.log(o.maxScale ?? 60) * Math.pow(z, 2.2));
  target.style.color = `rgba(255,255,255,${1 - clamp(z * (o.fadeText ?? 3.5))})`;
  return { z, css: `translate(${(W / 2 - px) * e}px,${(H / 2 - py) * e}px) scale(${zs})`, origin: `${px}px ${py}px` };
}

const LT_CSS = `
.dolly-lt{position:absolute;display:flex;flex-direction:column;gap:6px}
.dolly-lt .bar{position:absolute;left:calc(var(--stage-h,720px)*-.025);top:6px;bottom:6px;width:calc(var(--stage-h,720px)*.007);border-radius:3px;background:var(--c-accent);transform-origin:50% 0}
.dolly-lt .t1{font:700 calc(var(--stage-h,720px)*.047)/1.1 var(--f-display);letter-spacing:-.02em;color:var(--c-fg)}
.dolly-lt .t2{font:500 calc(var(--stage-h,720px)*.028)/1.3 var(--f-body);color:var(--c-muted)}`;

/** Lower third: an accent bar draws down, then title and subtitle rise in; leaves upwards. */
export function lowerThird(layer: HTMLElement, o: { title: string; subtitle?: string; x?: number; y?: number }): (t: number, tin: number, tout?: number) => void {
  ensureStyle("lower-third", LT_CSS);
  const el = document.createElement("div"); el.className = "dolly-lt";
  el.style.left = (o.x ?? 96) + "px"; el.style.top = (o.y ?? 560) + "px";
  const bar = document.createElement("i"); bar.className = "bar";
  const a = document.createElement("div"); a.className = "t1";
  const b = document.createElement("div"); b.className = "t2";
  el.append(bar, a, b); layer.append(el);
  const ua = masked(a, o.title), ub = o.subtitle ? masked(b, o.subtitle) : [];
  return (t, tin, tout = Infinity) => {
    const pin = expoOut(prog(t, tin, 0.6)), pout = cubicInOut(prog(t, tout + 0.3, 0.4));
    bar.style.transform = `scaleY(${pin * (1 - pout)})`;
    typeIn(ua, t, tin + 0.1, tout, { stagger: 0.06 });
    typeIn(ub, t, tin + 0.3, tout + 0.05, { stagger: 0.04 });
  };
}

const END_CSS = `
.dolly-end{position:absolute;inset:0;background:var(--c-ink);color:#f3f4f7}
.dolly-end .logo{position:absolute;left:50%;top:21%;font:700 calc(var(--stage-h,720px)*.0889)/1.75 var(--f-ui,var(--f-body));padding:0 .42em;border-radius:.47em .47em .47em .08em;background:#fff;color:var(--c-ink);transform-origin:50% 50%}
.dolly-end .name{position:absolute;left:0;right:0;top:46%;text-align:center;margin:0;transform-origin:50% 0;font:800 calc(var(--stage-h,720px)*.161)/1 var(--f-display);letter-spacing:-.04em}
.dolly-end .tag{position:absolute;left:0;right:0;top:66%;text-align:center;margin:0;transform-origin:50% 0;font:500 calc(var(--stage-h,720px)*.047) var(--f-body);color:#a5abb8}
.dolly-end .tag .dolly-accent{color:var(--c-accent-soft,#8ea0ff)}`;

/** End card: logo springs in, the name types in by character, the tagline by word; a slow push-in. */
export function endCard(layer: HTMLElement, o: { logo: string; name: string; tagline: string; at: { logo: number; name: number; tag: number }; pushFrom: number; pushDur: number }): { el: HTMLElement; render(t: number): void } {
  ensureStyle("end-card", END_CSS);
  const el = document.createElement("div"); el.className = "dolly-end";
  el.innerHTML = `<div class="logo"></div><h2 class="name"></h2><p class="tag"></p>`;
  layer.append(el);
  const logo = el.querySelector<HTMLElement>(".logo")!, name = el.querySelector<HTMLElement>(".name")!, tag = el.querySelector<HTMLElement>(".tag")!;
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
    },
  };
}
