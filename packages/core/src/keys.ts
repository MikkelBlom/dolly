// Keyframed values. A track is a list of [time, value, easing?]; the easing belongs to the segment that
// ENDS at that key (the move into it), which reads naturally: "at 2.45 s arrive at 640, quartInOut".
import { lerp, prog } from "./math.ts";
import { ease, type Easing, type EasingName, cubicInOut } from "./easing.ts";
import { spring, type SpringParams } from "./spring.ts";

export type Key = readonly [t: number, value: number, easing?: Easing | EasingName];

/** Evaluate a keyframe track at t. Holds the first value before the first key and the last after. */
export function keys(t: number, ks: readonly Key[], fallback: Easing = cubicInOut): number {
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

/** Times where a track's segments start moving: useful for cut-on-motion and lint. */
export function keyMoves(ks: readonly Key[]): Array<{ t0: number; t1: number; from: number; to: number }> {
  const out = [];
  for (let i = 1; i < ks.length; i++) if (ks[i][1] !== ks[i - 1][1]) out.push({ t0: ks[i - 1][0], t1: ks[i][0], from: ks[i - 1][1], to: ks[i][1] });
  return out;
}

export type Vec2Key = readonly [t: number, value: readonly [number, number], easing?: Easing | EasingName];

/** Keyframed 2D point (both components share timing and easing). */
export function keys2(t: number, ks: readonly Vec2Key[], fallback: Easing = cubicInOut): [number, number] {
  return [keys(t, ks.map(([k, v, e]) => [k, v[0], e] as Key), fallback), keys(t, ks.map(([k, v, e]) => [k, v[1], e] as Key), fallback)];
}

/** Value that springs from `from` to `to` starting at t0. */
export const springTo = (t: number, t0: number, from: number, to: number, params?: SpringParams): number =>
  lerp(from, to, spring(t - t0, params));

/**
 * Stagger: start time of item i of n. `each` seconds apart, or spread over `total` seconds;
 * `from` picks the order ("start", "end", "center" or an index the wave radiates from).
 */
export function stagger(i: number, n: number, opts: { each?: number; total?: number; from?: "start" | "end" | "center" | number } = {}): number {
  const each = opts.total !== undefined ? (n > 1 ? opts.total / (n - 1) : 0) : (opts.each ?? 0.05);
  const from = opts.from ?? "start";
  const origin = from === "start" ? 0 : from === "end" ? n - 1 : from === "center" ? (n - 1) / 2 : from;
  return Math.abs(i - origin) * each;
}
