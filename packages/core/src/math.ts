// Pure scalar helpers. Everything here is a function of its arguments only, so it runs the same in the
// browser, in Node (lint, tests) and on every render worker.

export const clamp = (x: number, a = 0, b = 1): number => Math.min(b, Math.max(a, x));

export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;

/** Progress of t through [t0, t0 + d], clamped to 0..1. A zero duration is a step at t0. */
export const prog = (t: number, t0: number, d: number): number => (d <= 0 ? (t >= t0 ? 1 : 0) : clamp((t - t0) / d));

/** Inverse lerp, unclamped. */
export const unlerp = (a: number, b: number, x: number): number => (b === a ? 0 : (x - a) / (b - a));

/** Map x from [a0, a1] to [b0, b1], clamped. */
export const remap = (x: number, a0: number, a1: number, b0: number, b1: number): number => lerp(b0, b1, clamp(unlerp(a0, a1, x)));

export type Vec2 = readonly [number, number];

export const lerp2 = (a: Vec2, b: Vec2, p: number): [number, number] => [lerp(a[0], b[0], p), lerp(a[1], b[1], p)];

export const dist = (a: Vec2, b: Vec2): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Point on a quadratic bezier. */
export function quad(a: Vec2, c: Vec2, b: Vec2, p: number): [number, number] {
  const q = 1 - p;
  return [q * q * a[0] + 2 * q * p * c[0] + p * p * b[0], q * q * a[1] + 2 * q * p * c[1] + p * p * b[1]];
}

/** Point on a cubic bezier. */
export function cubic(a: Vec2, c1: Vec2, c2: Vec2, b: Vec2, p: number): [number, number] {
  const q = 1 - p, w0 = q * q * q, w1 = 3 * q * q * p, w2 = 3 * q * p * p, w3 = p * p * p;
  return [w0 * a[0] + w1 * c1[0] + w2 * c2[0] + w3 * b[0], w0 * a[1] + w1 * c1[1] + w2 * c2[1] + w3 * b[1]];
}

/**
 * Control point that bends the straight path a→b sideways by `bend` × its length, giving the curved,
 * hand-moved paths a cursor should follow. Positive bends to the left of the direction of travel.
 */
export function arcControl(a: Vec2, b: Vec2, bend = 0.25): [number, number] {
  return [(a[0] + b[0]) / 2 - (b[1] - a[1]) * bend, (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend];
}

/**
 * Seeded PRNG (mulberry32). Scenes must never use Math.random: frames are rendered in parallel, out of
 * order and more than once, so every value has to come from the seed and the time.
 */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable hash of a string to a 32-bit seed (FNV-1a). */
export function seedOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Smooth value noise in [-1, 1], seeded, for drift and handheld wobble that stays a pure function of t. */
export function noise1(t: number, seed = 0): number {
  const i = Math.floor(t), f = t - i;
  const h = (n: number) => rng(seedOf(`${seed}:${n}`))() * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}

/** Round to a grid step (beats, frames). */
export const snap = (x: number, step: number): number => Math.round(x / step) * step;
