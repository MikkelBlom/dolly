// The authoring model. A video is a stage (design size), a timeline of scenes with named markers, an
// optional always-on "world" (background, camera, brand mark) and a theme. Every scene owns DOM it builds
// once in setup() and updates in render(t). render() must be pure: it sets every property it animates
// from t alone, so frames can be rendered out of order, in parallel and more than once.
//
// Scenes are only rendered inside [start, end]; outside it their containers are hidden. That contract
// is what lets the frame cache re-render only the frames a changed scene can affect.
import type { CameraFn, CameraState, Viewport } from "./camera.ts";
import type { Theme } from "./theme.ts";

export type Aspect = "16:9" | "9:16" | "1:1" | "4:5";

export interface Marker { name: string; t: number; kind?: "cut" | "beat" | "vo" | "note" }

export interface SceneTime {
  /** Global time in seconds. */
  t: number;
  /** Seconds since the scene's start. */
  local: number;
  /** 0..1 through the scene. */
  progress: number;
  start: number;
  end: number;
}

export interface Layer {
  /** Scene-owned container. Hidden while the scene is inactive. */
  el: HTMLElement;
}

export interface SceneContext {
  /** The video definition (stage size, fps, markers…). */
  video: VideoDef;
  stage: Viewport;
  aspect: Aspect;
  theme: Theme;
  /** Container inside the camera-moved world layer. */
  world: HTMLElement;
  /** Container in screen space, above the world (headlines that stay put while the camera moves). */
  hud: HTMLElement;
  /** Extra screen-space container at a z-order of your choice (e.g. a layer reached by a dolly). */
  screen(z: number, name?: string): HTMLElement;
  /** Camera state at t (identity if the video has no camera). */
  camera(t: number): CameraState;
  /** Find an element by id within this scene's containers (throws with the scene name if missing). */
  $(id: string): HTMLElement;
  /** Seconds of a marker by name (throws if it doesn't exist). */
  marker(name: string): number;
}

export interface SceneDef {
  name: string;
  start: number;
  end: number;
  /** Source file (filled in by the bundler) so the frame cache can tell which frames a change touches. */
  file?: string;
  setup?(ctx: SceneContext): void | Promise<void>;
  render(time: SceneTime, ctx: SceneContext): void;
  /** Markers inside this scene, relative to its start. */
  markers?: Record<string, number>;
}

export interface WorldDef {
  setup?(ctx: SceneContext): void | Promise<void>;
  /** Always rendered, before the scenes. */
  render?(time: SceneTime, ctx: SceneContext): void;
}

export interface VideoDef {
  title: string;
  /** Design size in CSS px. Output resolution is a render option; the stage scales to it. */
  stage: Viewport;
  fps: number;
  duration: number;
  /** Beat grid for markers, lint and the player's snap. */
  bpm?: number;
  /** Beat offset (seconds) of the first downbeat. */
  beatOffset?: number;
  aspect?: Aspect;
  theme: Theme;
  camera?: CameraFn;
  /** Stage background colour (behind everything). Defaults to the theme's bg. */
  background?: string;
  world?: WorldDef;
  scenes: SceneDef[];
  markers?: Marker[];
  /** Per-aspect overrides: a different stage size or scene list for 9:16, 1:1, 4:5. */
  variants?: Partial<Record<Aspect, Partial<Pick<VideoDef, "stage" | "scenes" | "camera" | "markers" | "world">>>>;
  /** Audio tracks for the player and the final mux. Paths relative to the project. */
  audio?: Array<{ src: string; start?: number; gain?: number; role?: "music" | "vo" | "sfx" }>;
}

export function defineScene(def: SceneDef): SceneDef {
  if (!(def.end > def.start)) throw new Error(`scene "${def.name}": end (${def.end}) must be after start (${def.start})`);
  return def;
}
/** Used by the bundler to stamp each scene with its source file. */
defineScene.from = (file: string, def: SceneDef): SceneDef => ({ ...defineScene(def), file });

export function defineVideo(def: VideoDef): VideoDef {
  const names = new Set<string>();
  for (const s of def.scenes) {
    if (names.has(s.name)) throw new Error(`video "${def.title}": two scenes are named "${s.name}"`);
    names.add(s.name);
    if (s.start < 0 || s.end > def.duration + 1e-9) throw new Error(`scene "${s.name}": [${s.start}, ${s.end}] is outside the video's 0–${def.duration} s`);
  }
  return def;
}

/** Scene markers made global, plus video markers and one "scene:<name>" marker per scene start. */
export function allMarkers(v: VideoDef): Marker[] {
  const out: Marker[] = [...(v.markers ?? [])];
  for (const s of v.scenes) {
    out.push({ name: s.name, t: s.start, kind: "cut" });
    for (const [n, dt] of Object.entries(s.markers ?? {})) out.push({ name: `${s.name}.${n}`, t: s.start + dt, kind: "note" });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Scenes active anywhere in [t0, t1] (inclusive start, exclusive end). */
export function activeScenes(v: VideoDef, t0: number, t1 = t0): SceneDef[] {
  return v.scenes.filter(s => t1 >= s.start && t0 < s.end);
}

export const beatTime = (v: VideoDef, beat: number): number => (v.beatOffset ?? 0) + (beat * 60) / (v.bpm ?? 120);

/** Apply an aspect variant's overrides. */
export function withAspect(v: VideoDef, aspect: Aspect | undefined): VideoDef {
  if (!aspect || aspect === (v.aspect ?? "16:9")) return v;
  const o = v.variants?.[aspect];
  if (!o) throw new Error(`video "${v.title}" has no layout for aspect ${aspect}; add variants["${aspect}"]`);
  return { ...v, ...o, aspect };
}
