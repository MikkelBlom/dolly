// Badge, chip and card primitives, plus the physical entrances they use. Styles read theme tokens.
import { ensureStyle, tf } from "../dom.ts";
import { spring, type SpringParams } from "../spring.ts";
import { clamp, lerp } from "../math.ts";

const CSS = `
.dolly-badge{position:absolute;white-space:nowrap;background:var(--c-ink);color:#fff;font:600 19px/1.75 var(--f-ui,var(--f-body));padding:0 .6em;
  border-radius:var(--r-sm) var(--r-sm) var(--r-sm) 2px;box-shadow:0 6px 16px -6px rgba(10,12,16,.45);transform-origin:0 100%}
.dolly-chip{position:absolute;background:var(--c-surface);border-radius:var(--r-lg);padding:22px 30px 20px;box-shadow:var(--s-card)}
.dolly-card{position:absolute;background:var(--c-surface);border-radius:var(--r-lg);box-shadow:var(--s-float)}
.dolly-label{display:block;font:600 15px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--c-muted)}`;

export const primitivesCss = (): void => ensureStyle("primitives", CSS);

/** A badge element (dark pill with a sharp corner it grows out of). */
export function badge(text: string, cls = ""): HTMLSpanElement {
  primitivesCss();
  const b = document.createElement("span");
  b.className = `dolly-badge ${cls}`.trim();
  b.textContent = text;
  return b;
}

export interface PopInOptions extends Partial<{ freq: number; zeta: number }> {
  /** Degrees of rotation it settles out of. */
  rotate?: number;
  /** Opacity ramp duration. */
  fade?: number;
  extra?: string;
}

/** Grow out of the transform origin with a springy overshoot (badges: 2.1 Hz, ζ 0.42). */
export function popIn(el: HTMLElement, t: number, t0: number, o: PopInOptions = {}): number {
  const s = spring(t - t0, { freq: o.freq ?? 2.1, zeta: o.zeta ?? 0.42 });
  tf(el, `scale(${t < t0 ? 0 : Math.max(0, s)}) rotate(${(1 - clamp(s)) * (o.rotate ?? -8)}deg)${o.extra ? " " + o.extra : ""}`, clamp((t - t0) / (o.fade ?? 0.11)));
  return s;
}

/**
 * Fly in from an offset on a spring: starts at `scale0`, rotated, `dx/dy` away (motion grammar: 0.7
 * scale, 200–400 px, ±9°). Returns the spring value so callers can chain reactions.
 */
export function flyIn(el: HTMLElement, t: number, t0: number, o: { dx: number; dy: number; rotate?: number; scale0?: number; spring?: SpringParams; extra?: string; fade?: number }): number {
  const s = spring(t - t0, o.spring ?? { freq: 1.25, zeta: 0.62 });
  tf(el, `translate(${o.dx * (1 - s)}px,${o.dy * (1 - s)}px) rotate(${(1 - s) * (o.rotate ?? 9)}deg) scale(${lerp(o.scale0 ?? 0.7, 1, s)})${o.extra ? " " + o.extra : ""}`, clamp((t - t0) / (o.fade ?? 0.2)));
  return s;
}

/** Impact reaction: a short squash when something lands on this element (3–4 %). */
export function land(t: number, t0: number, amount = 0.035): number {
  if (t <= t0) return 0;
  return Math.sin(Math.min(1, (t - t0) / 0.35) * Math.PI) * amount * Math.exp(-(t - t0) * 3);
}

/** Gentle idle bob, a few px, phase-shifted per item so holds never sit still. */
export const bob = (t: number, i: number, amp = 4, speed = 1.1): number => Math.sin(t * speed + i * 1.9) * amp;
