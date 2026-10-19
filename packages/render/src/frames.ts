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

export interface MotionSample { px: number; camera: number; vx: number; vy: number }

/**
 * "Sample + smear": when a frame hits the sample cap and the copies would still be more than `gap` px
 * apart, blur each sample's world layer along the camera's direction by the gap between samples. Only
 * when the camera causes most of the motion (it smears the world layer, not screen-space overlays).
 */
export function smearVector(m: MotionSample, n: number, b: BlurSettings): [number, number] | null {
  if (n < b.nmax || m.px / n <= b.gap || m.camera < 0.8 * m.px) return null;
  const len = Math.hypot(m.vx, m.vy);
  if (len < 1e-6) return null; // zoom-dominated (dolly): no single direction
  return [+(m.vx / n).toFixed(3), +(m.vy / n).toFixed(3)];
}

/** Version of the capture pipeline, part of every cache key. 4: GPU memory budget raised (heavy blur dropped layers). 5: greyscale text AA. 6: no will-change on masked text (history-dependent raster scale). */
export const RENDERER = 6;

export interface KeyInputs {
  globalHash: string;
  /** Hashes of the scenes active during this frame's shutter interval. */
  sceneHashes: string[];
  t: number;
  times: number[];
  width: number;
  height: number;
  aspect?: string;
  smear?: [number, number] | null;
}

/** Cache key of one output frame: everything that can change its pixels. */
export function frameKey(k: KeyInputs): string {
  const h = crypto.createHash("sha1");
  // bump RENDERER when capture changes in a way that alters pixels (flags, host, blur maths)
  h.update(JSON.stringify([RENDERER, k.globalHash, [...k.sceneHashes].sort(), k.times.map(x => x.toFixed(9)), k.width, k.height, k.aspect ?? "", k.smear ?? null]));
  return h.digest("hex");
}
