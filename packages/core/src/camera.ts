// A virtual camera over a world plane. The camera state names the world point at the centre of the
// screen, the zoom and a roll angle. Moves are built from keyframe tracks so the whole camera path is a
// pure function of t (which also makes it inspectable: the player draws it, lint checks its speed and
// the renderer turns its velocity into motion-blur sample counts).
import { keys, type Key } from "./keys.ts";
import type { Easing, EasingName } from "./easing.ts";
import type { Vec2 } from "./math.ts";

export interface CameraState { x: number; y: number; zoom: number; rotate: number }

export interface Rect { x: number; y: number; w: number; h: number }

export interface Viewport { width: number; height: number }

/** Keyframe tracks for each camera property. Missing tracks hold their default. */
export interface CameraTracks { x?: Key[]; y?: Key[]; zoom?: Key[]; rotate?: Key[] }

export type CameraFn = (t: number) => CameraState;

/** Build a camera from keyframe tracks. Default framing: the stage centre at zoom 1. */
export function camera(tracks: CameraTracks, stage: Viewport): CameraFn {
  const cx = stage.width / 2, cy = stage.height / 2;
  return t => ({
    x: tracks.x?.length ? keys(t, tracks.x) : cx,
    y: tracks.y?.length ? keys(t, tracks.y) : cy,
    zoom: tracks.zoom?.length ? keys(t, tracks.zoom) : 1,
    rotate: tracks.rotate?.length ? keys(t, tracks.rotate) : 0,
  });
}

/**
 * Fluent builder for camera paths in shot language. Each call appends keys; times are absolute.
 *   cameraPath(stage).at(0, { x: 795, y: 112, zoom: 2.7 })
 *     .pullBack(0.95, 2.45, { x: 640, y: 360, zoom: 1 })
 *     .whip(6.7, 7.3, { x: 2240 })
 *     .push(7.3, 9, 0.05)
 *     .build()
 */
export class CameraPath {
  readonly tracks: Required<CameraTracks> = { x: [], y: [], zoom: [], rotate: [] };
  private stage: Viewport;
  constructor(stage: Viewport) { this.stage = stage; }

  private last(prop: keyof CameraState): number {
    const tr = this.tracks[prop];
    if (tr.length) return tr[tr.length - 1][1];
    return prop === "x" ? this.stage.width / 2 : prop === "y" ? this.stage.height / 2 : prop === "zoom" ? 1 : 0;
  }

  private add(prop: keyof CameraState, t: number, v: number, e?: Easing | EasingName): void {
    const tr = this.tracks[prop];
    if (tr.length && t < tr[tr.length - 1][0]) throw new Error(`camera: key for "${prop}" at ${t}s is before the previous key at ${tr[tr.length - 1][0]}s`);
    tr.push(e ? [t, v, e] : [t, v]);
  }

  /** Set the camera at time t (a hold point; the move into it uses `ease`). */
  at(t: number, s: Partial<CameraState>, ease?: Easing | EasingName): this {
    for (const k of ["x", "y", "zoom", "rotate"] as const) if (s[k] !== undefined) this.add(k, t, s[k]!, ease);
    return this;
  }

  /** Hold every property from its last value until t (keeps a later move from starting early). */
  hold(t: number): this {
    for (const k of ["x", "y", "zoom", "rotate"] as const) if (this.tracks[k].length) this.add(k, t, this.last(k));
    return this;
  }

  /** A move from t0 to t1. Properties not given stay where they are. */
  move(t0: number, t1: number, to: Partial<CameraState>, ease: Easing | EasingName = "quartInOut"): this {
    for (const k of ["x", "y", "zoom", "rotate"] as const) {
      if (to[k] === undefined) continue;
      this.add(k, t0, this.last(k));
      this.add(k, t1, to[k]!, ease);
    }
    return this;
  }

  /** Fast horizontal or vertical move between regions. Keep it 0.5–0.7 s; motion blur sells it. */
  whip(t0: number, t1: number, to: Partial<CameraState>): this { return this.move(t0, t1, to, "quartInOut"); }

  /** Reveal: start close and pull back to show the context. */
  pullBack(t0: number, t1: number, to: Partial<CameraState>): this { return this.move(t0, t1, to, "quartInOut"); }

  /** Slow push-in over a hold, so the frame never sits still (motion grammar: +5–7 % zoom). */
  push(t0: number, t1: number, amount = 0.06): this {
    this.add("zoom", t0, this.last("zoom"));
    this.add("zoom", t1, this.last("zoom") * (1 + amount), "sineInOut");
    return this;
  }

  /** Frame a world rect with padding (fraction of the viewport kept around it). */
  focus(t0: number, t1: number, rect: Rect, padding = 0.15, ease: Easing | EasingName = "quartInOut"): this {
    return this.move(t0, t1, fitRect(rect, this.stage, padding), ease);
  }

  build(): CameraFn { return camera(this.tracks, this.stage); }
}

export const cameraPath = (stage: Viewport): CameraPath => new CameraPath(stage);

/** Camera state that frames `rect` inside the viewport with `padding` on the tighter axis. */
export function fitRect(rect: Rect, stage: Viewport, padding = 0.15): CameraState {
  const zoom = Math.min(stage.width * (1 - padding) / rect.w, stage.height * (1 - padding) / rect.h);
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, zoom, rotate: 0 };
}

/** CSS transform that maps world coordinates to stage coordinates for this camera. */
export function cameraTransform(c: CameraState, stage: Viewport, extraZoom = 1): string {
  const r = c.rotate ? ` rotate(${c.rotate}deg)` : "";
  return `translate(${stage.width / 2}px,${stage.height / 2}px)${r} scale(${c.zoom * extraZoom}) translate(${-c.x}px,${-c.y}px)`;
}

/** World point → stage point. */
export function worldToScreen(c: CameraState, stage: Viewport, p: Vec2): [number, number] {
  const dx = (p[0] - c.x) * c.zoom, dy = (p[1] - c.y) * c.zoom;
  const a = (c.rotate * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  return [stage.width / 2 + dx * cos - dy * sin, stage.height / 2 + dx * sin + dy * cos];
}

/** Stage point → world point. */
export function screenToWorld(c: CameraState, stage: Viewport, p: Vec2): [number, number] {
  const a = (-c.rotate * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const sx = p[0] - stage.width / 2, sy = p[1] - stage.height / 2;
  const dx = sx * cos - sy * sin, dy = sx * sin + sy * cos;
  return [c.x + dx / c.zoom, c.y + dy / c.zoom];
}

/**
 * Camera for a parallax layer at `depth` (1 = the world plane, 0 = infinitely far, > 1 = nearer than the
 * world). It pans and zooms proportionally less (or more), which makes camera moves readable.
 */
export function parallax(c: CameraState, depth: number, stage: Viewport): CameraState {
  const cx = stage.width / 2, cy = stage.height / 2;
  return { x: cx + (c.x - cx) * depth, y: cy + (c.y - cy) * depth, zoom: 1 + (c.zoom - 1) * depth, rotate: c.rotate * depth };
}

/**
 * Largest on-screen displacement (stage px) of any screen point between two camera states, sampled at
 * the corners and centre. Rotation and zoom move the corners most; pans move every point equally.
 */
export function cameraDisplacement(a: CameraState, b: CameraState, stage: Viewport): number {
  const pts: Vec2[] = [[0, 0], [stage.width, 0], [0, stage.height], [stage.width, stage.height], [stage.width / 2, stage.height / 2]];
  let m = 0;
  for (const p of pts) {
    const w = screenToWorld(a, stage, p), q = worldToScreen(b, stage, w);
    m = Math.max(m, Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  return m;
}
