// Storyboard: an optional intermediate representation of a video's structure (scenes, durations,
// on-screen text, voice-over lines, beats), reviewed before any motion is written. Plain JSON so a
// human can read it and an agent can generate it from a brief. Validation is hand-written (no deps)
// and returns every problem with a JSON path, not just the first.
import { EASINGS } from "./easing.ts";

export interface StoryboardScene {
  name: string;
  /** Seconds. Either duration or start+end; scenes are laid end to end when start is omitted. */
  start?: number;
  duration: number;
  /** What the viewer should take away (one idea per beat). */
  idea: string;
  /** On-screen text (headlines ≤ 9 words). */
  text?: string[];
  /** Voice-over line for this scene. */
  vo?: string;
  /** How the camera gets here from the previous scene. */
  transition?: "cut" | "whip" | "pull-back" | "push" | "dolly-through" | "zoom-into" | "match-cut" | "reel" | "continuity";
  /** Hero element / visual. */
  visual?: string;
  /** Named beats inside the scene, seconds from its start. */
  beats?: Record<string, number>;
}

export interface Storyboard {
  $schema?: string;
  title: string;
  /** What the video is for (store listing, launch tweet, YouTube…). */
  purpose?: string;
  aspect?: "16:9" | "9:16" | "1:1" | "4:5";
  fps?: number;
  bpm?: number;
  brand?: { colors?: Record<string, string>; fonts?: Record<string, string> };
  scenes: StoryboardScene[];
}

export interface Problem { path: string; message: string; severity: "error" | "warn" }

const TRANSITIONS = ["cut", "whip", "pull-back", "push", "dolly-through", "zoom-into", "match-cut", "reel", "continuity"];

/** Words a viewer can read per second of on-screen time (with 0.5 s to notice the text). */
export const readingTime = (text: string): number => 0.5 + text.trim().split(/\s+/).filter(Boolean).length / 3;

export function validateStoryboard(sb: unknown): { ok: boolean; problems: Problem[]; timeline: Array<{ name: string; start: number; end: number }> } {
  const problems: Problem[] = [];
  const err = (path: string, message: string) => problems.push({ path, message, severity: "error" });
  const warn = (path: string, message: string) => problems.push({ path, message, severity: "warn" });
  const timeline: Array<{ name: string; start: number; end: number }> = [];
  if (!sb || typeof sb !== "object") { err("$", "storyboard must be an object"); return { ok: false, problems, timeline }; }
  const s = sb as Partial<Storyboard>;
  if (typeof s.title !== "string" || !s.title) err("$.title", "title is required");
  if (s.aspect && !["16:9", "9:16", "1:1", "4:5"].includes(s.aspect)) err("$.aspect", `aspect must be 16:9, 9:16, 1:1 or 4:5 (got ${s.aspect})`);
  if (s.fps !== undefined && ![24, 25, 30, 50, 60].includes(s.fps)) warn("$.fps", `unusual fps ${s.fps}`);
  if (!Array.isArray(s.scenes) || !s.scenes.length) { err("$.scenes", "at least one scene is required"); return { ok: false, problems, timeline }; }
  let cursor = 0;
  const names = new Set<string>();
  s.scenes.forEach((sc, i) => {
    const p = `$.scenes[${i}]`;
    if (!sc || typeof sc !== "object") { err(p, "scene must be an object"); return; }
    if (typeof sc.name !== "string" || !/^[a-z][a-z0-9-]*$/.test(sc.name)) err(`${p}.name`, "name must be kebab-case (a-z, 0-9, -)");
    else if (names.has(sc.name)) err(`${p}.name`, `duplicate scene name "${sc.name}"`);
    else names.add(sc.name);
    if (typeof sc.duration !== "number" || !(sc.duration > 0)) err(`${p}.duration`, "duration must be a positive number of seconds");
    if (typeof sc.idea !== "string" || !sc.idea) err(`${p}.idea`, "idea is required: what should the viewer take away?");
    if (sc.transition && !TRANSITIONS.includes(sc.transition)) err(`${p}.transition`, `transition must be one of ${TRANSITIONS.join(", ")}`);
    const start = typeof sc.start === "number" ? sc.start : cursor;
    if (typeof sc.start === "number" && sc.start < cursor - 1.5) warn(`${p}.start`, `overlaps the previous scene by ${(cursor - sc.start).toFixed(2)} s`);
    const dur = typeof sc.duration === "number" ? sc.duration : 0;
    timeline.push({ name: sc.name, start, end: start + dur });
    cursor = start + dur;
    (sc.text ?? []).forEach((txt, j) => {
      const words = txt.trim().split(/\s+/).length;
      if (words > 9) warn(`${p}.text[${j}]`, `${words} words; headlines read best at ≤ 9`);
      const need = readingTime(txt);
      if (dur && need > dur) err(`${p}.text[${j}]`, `needs ~${need.toFixed(1)} s to read but the scene is ${dur} s`);
    });
    if (sc.vo) {
      const secs = sc.vo.trim().split(/\s+/).length / 2.5; // 150 wpm
      if (dur && secs > dur + 0.25) err(`${p}.vo`, `voice-over needs ~${secs.toFixed(1)} s at 150 wpm but the scene is ${dur} s`);
    }
    for (const [b, t] of Object.entries(sc.beats ?? {})) if (typeof t !== "number" || t < 0 || t > dur) err(`${p}.beats.${b}`, `beat must be within 0–${dur} s`);
  });
  const total = cursor;
  if (total > 60) warn("$.scenes", `total ${total.toFixed(1)} s; promos work best at 15–60 s`);
  if (s.scenes[0] && (s.scenes[0].duration ?? 0) > 3) warn("$.scenes[0].duration", "the first scene is the hook: land it within 2–3 s");
  return { ok: !problems.some(p => p.severity === "error"), problems, timeline };
}

/** JSON Schema for editors and agents (kept in sync with the interfaces above). */
export const storyboardSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "dolly storyboard",
  type: "object",
  required: ["title", "scenes"],
  properties: {
    title: { type: "string" },
    purpose: { type: "string" },
    aspect: { enum: ["16:9", "9:16", "1:1", "4:5"] },
    fps: { type: "number" },
    bpm: { type: "number" },
    brand: { type: "object" },
    scenes: {
      type: "array", minItems: 1,
      items: {
        type: "object", required: ["name", "duration", "idea"],
        properties: {
          name: { type: "string", pattern: "^[a-z][a-z0-9-]*$" },
          start: { type: "number" }, duration: { type: "number", exclusiveMinimum: 0 },
          idea: { type: "string" }, text: { type: "array", items: { type: "string" } }, vo: { type: "string" },
          transition: { enum: TRANSITIONS }, visual: { type: "string" },
          beats: { type: "object", additionalProperties: { type: "number" } },
        },
      },
    },
  },
} as const;

export const easingNames = Object.keys(EASINGS);
