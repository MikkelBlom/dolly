// Frame timing, adaptive sample counts and cache keys. Pure functions: every worker computes the same
// sub-frame times from integers, so a frame never depends on which worker rendered it.
import crypto from "node:crypto";

export interface BlurSettings {
  /** Shutter angle in degrees (180 = film standard). */
  shutter: number;
  /** Allowed gap in output px between sample copies before stepping shows (1.5 px is invisible). */
  gap: number;
  /** Most samples per frame (power of two). */
  nmax: number;
  /** Frames on each side whose motion also counts, so quality doesn't pump. */
  smooth: number;
}

export const DEFAULT_BLUR: BlurSettings = { shutter: 180, gap: 1.5, nmax: 32, smooth: 2 };

/** Seconds the shutter is open per frame. */
export const shutterSeconds = (fps: number, shutter: number): number => (shutter / 360) / fps;

/** Frame time, centred shutter (AE phase -90°, Blender "center on frame"). */
export const frameTime = (f: number, fps: number, start = 0): number => start + f / fps;

/** Stratified sub-frame times for n samples across the shutter, centred on frame f. */
export function subTimes(f: number, n: number, fps: number, shutter: number, start = 0): number[] {
  if (n <= 1) return [frameTime(f, fps, start)];
  const frac = shutter / 360;
  return Array.from({ length: n }, (_, i) => Math.max(0, start + (f + ((2 * i + 1) / (2 * n) - 0.5) * frac) / fps));
}

export const nextPow2 = (x: number): number => (x <= 1 ? 1 : 2 ** Math.ceil(Math.log2(x)));

/**
 * Samples for each frame from its on-screen motion L (output px per shutter interval):
 * N = nextPow2(ceil(L / gap)), capped at nmax, after taking the max of L over ±smooth frames.
 */
export function sampleCounts(motionPx: number[], b: BlurSettings): number[] {
  return motionPx.map((_, f) => {
    let L = 0;
    for (let k = Math.max(0, f - b.smooth); k <= Math.min(motionPx.length - 1, f + b.smooth); k++) L = Math.max(L, motionPx[k]);
    return Math.min(b.nmax, nextPow2(Math.ceil(L / b.gap)));
  });
}

export interface KeyInputs {
  globalHash: string;
  /** Hashes of the scenes active during this frame's shutter interval. */
  sceneHashes: string[];
  t: number;
  times: number[];
  width: number;
  height: number;
  aspect?: string;
}

/** Cache key of one output frame: everything that can change its pixels. */
export function frameKey(k: KeyInputs): string {
  const h = crypto.createHash("sha1");
  h.update(JSON.stringify([2, k.globalHash, [...k.sceneHashes].sort(), k.times.map(x => x.toFixed(9)), k.width, k.height, k.aspect ?? ""]));
  return h.digest("hex");
}
