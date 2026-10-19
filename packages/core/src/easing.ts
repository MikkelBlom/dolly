// Easing curves, p in 0..1 → 0..1. Names follow easings.net so they are easy to talk about.
// Motion grammar: entrances ease out (expoOut, cubicOut), exits ease in, moves within the frame ease
// in-out (quartInOut for camera moves), drifts use sineInOut, linear only for things that never stop.

export type Easing = (p: number) => number;

export const linear: Easing = p => p;

export const sineIn: Easing = p => 1 - Math.cos((p * Math.PI) / 2);
export const sineOut: Easing = p => Math.sin((p * Math.PI) / 2);
export const sineInOut: Easing = p => -(Math.cos(Math.PI * p) - 1) / 2;

export const quadIn: Easing = p => p * p;
export const quadOut: Easing = p => 1 - (1 - p) * (1 - p);
export const quadInOut: Easing = p => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

export const cubicIn: Easing = p => p ** 3;
export const cubicOut: Easing = p => 1 - (1 - p) ** 3;
export const cubicInOut: Easing = p => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);

export const quartIn: Easing = p => p ** 4;
export const quartOut: Easing = p => 1 - (1 - p) ** 4;
export const quartInOut: Easing = p => (p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2);

export const quintIn: Easing = p => p ** 5;
export const quintOut: Easing = p => 1 - (1 - p) ** 5;
export const quintInOut: Easing = p => (p < 0.5 ? 16 * p ** 5 : 1 - (-2 * p + 2) ** 5 / 2);

export const expoIn: Easing = p => (p <= 0 ? 0 : 2 ** (10 * p - 10));
export const expoOut: Easing = p => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));
export const expoInOut: Easing = p =>
  p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? 2 ** (20 * p - 10) / 2 : (2 - 2 ** (-20 * p + 10)) / 2;

export const circOut: Easing = p => Math.sqrt(1 - (p - 1) ** 2);
export const circInOut: Easing = p =>
  p < 0.5 ? (1 - Math.sqrt(1 - (2 * p) ** 2)) / 2 : (Math.sqrt(1 - (-2 * p + 2) ** 2) + 1) / 2;

/** Overshoots by `s` (1.70158 ≈ 10%) before settling. */
export const backOut = (s = 1.70158): Easing => p => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2;

/**
 * CSS cubic-bezier(x1, y1, x2, y2). Solves x(u) = p by Newton iterations with a bisection fallback;
 * accurate to ~1e-7, deterministic.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sy = (u: number) => ((ay * u + by) * u + cy) * u;
  const dx = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  return p => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let u = p;
    for (let i = 0; i < 8; i++) {
      const e = sx(u) - p, d = dx(u);
      if (Math.abs(e) < 1e-7) return sy(u);
      if (Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    let lo = 0, hi = 1; u = p;
    for (let i = 0; i < 40; i++) {
      const x = sx(u);
      if (Math.abs(x - p) < 1e-7) break;
      if (x < p) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
}

/** Material 3 "emphasized decelerate", a good default for large entrances. */
export const emphasizedOut = cubicBezier(0.05, 0.7, 0.1, 1);

export const EASINGS = {
  linear, sineIn, sineOut, sineInOut, quadIn, quadOut, quadInOut, cubicIn, cubicOut, cubicInOut,
  quartIn, quartOut, quartInOut, quintIn, quintOut, quintInOut, expoIn, expoOut, expoInOut, circOut, circInOut,
  backOut: backOut(), emphasizedOut,
} as const satisfies Record<string, Easing>;

export type EasingName = keyof typeof EASINGS;

/** Accept an easing function or its name (storyboards and keyframe JSON refer to easings by name). */
export const ease = (e: Easing | EasingName | undefined, fallback: Easing = cubicInOut): Easing =>
  typeof e === "function" ? e : e ? EASINGS[e] : fallback;
