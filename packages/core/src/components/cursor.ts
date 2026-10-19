// A cursor that moves on curved paths between live-measured targets, squashes on press and sends out a
// ripple on each click. Targets can be functions, measured every frame, so the cursor follows tilting or
// animating UI.
import { ensureStyle, tf } from "../dom.ts";
import { cubicInOut, ease, expoOut, type Easing, type EasingName } from "../easing.ts";
import { arcControl, clamp, prog, quad, type Vec2 } from "../math.ts";

const CSS = `
.dolly-cursor{position:absolute;left:0;top:0;width:26px;z-index:5;filter:drop-shadow(0 4px 6px rgba(0,0,0,.25));transform-origin:2px 2px}
.dolly-ripple{position:absolute;left:0;top:0;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:2px solid var(--c-accent);z-index:4}`;

export type Target = Vec2 | (() => Vec2);
/** One stop of the path: arrive at `at` by time t (ease: a function or a name like "quartInOut"). */
export interface CursorStop { t: number; at: Target; ease?: Easing | EasingName; bend?: number }

export interface CursorHandle {
  el: SVGSVGElement;
  ripple: HTMLElement;
  /** Position at t (stage coordinates) without drawing. */
  pos(t: number): [number, number];
  render(t: number): void;
}

export interface CursorOptions {
  path: CursorStop[];
  clicks?: number[];
  /** Fade-in starts at `from` (0.25 s); the fade-out ends at `to` (0.4 s). */
  from?: number;
  to?: number;
  fill?: string;
  stroke?: string;
}

const resolve = (p: Target): Vec2 => (typeof p === "function" ? p() : p);

export function cursor(layer: HTMLElement, o: CursorOptions): CursorHandle {
  ensureStyle("cursor", CSS);
  const ns = "http://www.w3.org/2000/svg";
  const el = document.createElementNS(ns, "svg");
  el.setAttribute("class", "dolly-cursor"); el.setAttribute("viewBox", "0 0 26 36");
  el.innerHTML = `<path d="M2 2v28l7.5-7 5 11 5-2.3-5-10.7H25z" fill="${o.fill ?? "#14161b"}" stroke="${o.stroke ?? "#fff"}" stroke-width="2.4" stroke-linejoin="round"/>`;
  const ripple = document.createElement("div"); ripple.className = "dolly-ripple";
  layer.append(el, ripple);
  const clicks = o.clicks ?? [];
  const from = o.from ?? o.path[0].t, to = o.to ?? o.path[o.path.length - 1].t + 0.4;

  const pos = (t: number): [number, number] => {
    let p = resolve(o.path[0].at) as [number, number];
    for (let i = 1; i < o.path.length; i++) {
      const a = o.path[i - 1], b = o.path[i];
      if (t >= a.t) {
        const A = resolve(a.at), B = resolve(b.at);
        const e = ease(b.ease, cubicInOut)(prog(t, a.t, b.t - a.t));
        p = quad(A, arcControl(A, B, b.bend ?? 0.25), B, e);
      }
    }
    return p;
  };

  const render = (t: number): void => {
    if (t < from || t > to) { tf(el, "none", 0); tf(ripple, "none", 0); return; }
    const p = pos(t);
    const press = clicks.reduce((m, tc) => Math.max(m, 1 - Math.abs(t - tc) / 0.09), 0);
    const fade = clamp((t - from) * 4) * (1 - prog(t, to - 0.4, 0.4));
    tf(el, `translate(${p[0]}px,${p[1]}px) scale(${1 - 0.14 * clamp(press)})`, fade);
    const rc = clicks.find(tc => t >= tc && t < tc + 0.5);
    if (rc !== undefined) {
      const q = expoOut(prog(t, rc, 0.5));
      tf(ripple, `translate(${p[0]}px,${p[1]}px) scale(${0.3 + q * 1.3})`, (1 - q) * 0.8);
    } else tf(ripple, "none", 0);
  };
  return { el, ripple, pos, render };
}
