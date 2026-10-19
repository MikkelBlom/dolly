// @dolly/lint: motion-grammar checks (docs/research-notes/05-motion-grammar.md). The scene graph is
// sampled over time through window.__dolly.inspect/motion; each rule reads those samples and reports
// findings with times, the scene and the element, plus a suggested fix. Thresholds are defaults that
// can be overridden per project.
import { contrast, readingTime } from "@dolly/core";
import { Session, runQueue } from "@dolly/render";

export type Severity = "error" | "warn" | "info";

export interface Finding {
  rule: string;
  severity: Severity;
  t0: number;
  t1: number;
  scene: string | null;
  element: string | null;
  message: string;
  fix?: string;
}

export interface LintOptions {
  /** Seconds between samples (default 0.05 = 20 per second). */
  step?: number;
  /** Rule overrides: false disables a rule; numbers replace its threshold. */
  rules?: Partial<Record<RuleId, false | number>>;
  /** Output height the video is judged at (text size). */
  outputHeight?: number;
}

export const RULES = {
  "text-reading-time": "On-screen text stays readable for at least 0.5 s + words/3 (≥ 0.8 s).",
  "safe-area-title": "Readable text sits inside the 90 % title-safe area.",
  "min-text-size": "Text is at least 22 px tall at 1080p (and ≥ 3 % of height for mobile, as info).",
  "contrast-wcag": "Text contrast against its background is ≥ 4.5:1 (3:1 for large text).",
  "static-span": "Something moves at least every 1.5 s (a still frame reads as a slideshow).",
  "simultaneous-entrances": "No more than 2 elements start entering in the same 50 ms (stagger them).",
  "cut-on-beat": "Scene changes land within 2 frames of the beat grid.",
  "cut-on-motion": "Scene changes happen while something is moving.",
  "hook-within-2s": "Something readable or moving is on screen by 2 s.",
  "end-card-duration": "The last scene (end card) holds 3–6 s.",
  "css-animation": "No CSS animations or transitions (they don't follow render(t) and break determinism).",
  "will-change": "No will-change: Chromium keeps such layers at the raster scale of their first paint, so sharpness depends on which frames rendered before.",
} as const;
export type RuleId = keyof typeof RULES;

interface Sample {
  t: number;
  motion: number;
  cameraMotion: number;
  elements: Array<{ key: string; group: string; scene: string | null; text?: string; opacity: number; shown: number; rect: { x: number; y: number; w: number; h: number }; fontSize?: number; color?: string; background?: string }>;
}

export interface LintResult { ok: boolean; errors: number; warnings: number; infos: number; samples: number; findings: Finding[] }

export async function lint(s: Session, o: LintOptions = {}): Promise<LintResult> {
  const step = o.step ?? 0.05;
  const dur: number = s.meta.duration, fps: number = s.meta.fps;
  const W: number = s.meta.stage.width, H: number = s.meta.stage.height;
  const outH = o.outputHeight ?? 1080;
  const k = outH / H; // stage px → output px
  const on = (r: RuleId) => o.rules?.[r] !== false;
  const thr = (r: RuleId, d: number) => (typeof o.rules?.[r] === "number" ? (o.rules![r] as number) : d);
  const times = Array.from({ length: Math.floor(dur / step) }, (_, i) => +(i * step).toFixed(4));
  const samples: Sample[] = new Array(times.length);
  await runQueue(s.workers, times, async (w, t, i) => {
    const m = await w.motion(t, Math.min(dur, t + step));
    const ins = await w.evaluate<any>(`__dolly.inspect(${t})`);
    samples[i] = { t, motion: m.px / (s.width / W), cameraMotion: m.camera / (s.width / W), elements: ins.elements };
  });
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push({ ...f, t0: +f.t0.toFixed(2), t1: +f.t1.toFixed(2) });

  // --- text blocks over time ---
  interface Block { key: string; group: string; scene: string | null; text: string; spans: Array<[number, number]>; minFont: number; rects: Sample["elements"][number]["rect"][]; contrastMin: number; color?: string; bg?: string; firstT: number }
  const blocks = new Map<string, Block>();
  for (const smp of samples) {
    const byKey = new Map<string, Sample["elements"]>();
    for (const e of smp.elements) if (e.text) byKey.set(e.key, [...(byKey.get(e.key) ?? []), e]);
    for (const [key, units] of byKey) {
      const text = units.map(u => u.text).join(units.length > 1 && units.every(u => u.text!.length > 1) ? " " : "");
      const readableUnits = units.filter(u => u.opacity >= 0.6 && u.shown >= 0.6 && onScreen(u.rect, W, H) >= 0.5);
      const readable = readableUnits.length >= Math.ceil(units.length * 0.8);
      let b = blocks.get(key);
      if (!b) { b = { key, group: units[0].group, scene: units[0].scene, text, spans: [], minFont: Infinity, rects: [], contrastMin: Infinity, firstT: smp.t }; blocks.set(key, b); }
      if (text.length > b.text.length) b.text = text;
      if (!readable) continue;
      const last = b.spans[b.spans.length - 1];
      if (last && smp.t - last[1] <= step * 1.5) last[1] = smp.t; else b.spans.push([smp.t, smp.t]);
      for (const u of readableUnits) {
        if (u.fontSize) b.minFont = Math.min(b.minFont, u.fontSize);
        if (u.color && u.background && u.opacity >= 0.95) {
          try { const c = contrast(u.color, u.background); if (c < b.contrastMin) { b.contrastMin = c; b.color = u.color; b.bg = u.background; } } catch { /* unparsable colour */ }
        }
      }
      // union rect for safe-area checks
      const xs = readableUnits.map(u => u.rect);
      b.rects.push({ x: Math.min(...xs.map(r => r.x)), y: Math.min(...xs.map(r => r.y)), w: Math.max(...xs.map(r => r.x + r.w)) - Math.min(...xs.map(r => r.x)), h: Math.max(...xs.map(r => r.y + r.h)) - Math.min(...xs.map(r => r.y)) });
    }
  }

  for (const b of blocks.values()) {
    if (!b.spans.length) continue;
    const words = b.text.trim().split(/\s+/).filter(Boolean).length;
    const longest = b.spans.reduce((m, sp) => Math.max(m, sp[1] - sp[0] + step), 0);
    const endsAtEnd = b.spans.some(sp => sp[1] >= dur - step * 2);
    const need = Math.max(thr("text-reading-time", 0.8), readingTime(b.text));
    if (on("text-reading-time") && longest < need && !endsAtEnd && b.text.length > 1) {
      const sp = b.spans.reduce((m, x) => (x[1] - x[0] > m[1] - m[0] ? x : m));
      add({ rule: "text-reading-time", severity: longest < need * 0.7 ? "error" : "warn", t0: sp[0], t1: sp[1] + step, scene: b.scene, element: b.group,
        message: `"${clip(b.text)}" (${words} words) is readable for ${longest.toFixed(2)} s; it needs ~${need.toFixed(1)} s`, fix: `hold it ${(need - longest).toFixed(1)} s longer or cut words` });
    }
    if (on("min-text-size") && Number.isFinite(b.minFont)) {
      const px = b.minFont * k;
      if (px < thr("min-text-size", 22)) add({ rule: "min-text-size", severity: "warn", t0: b.spans[0][0], t1: b.spans[0][1], scene: b.scene, element: b.group, message: `"${clip(b.text)}" is ${px.toFixed(1)} px tall at ${outH}p (min 22)`, fix: "scale it up or drop it" });
      else if (px < outH * 0.03) add({ rule: "min-text-size", severity: "info", t0: b.spans[0][0], t1: b.spans[0][1], scene: b.scene, element: b.group, message: `"${clip(b.text)}" is ${px.toFixed(1)} px at ${outH}p, under 3 % of height: small on a phone`, fix: "fine for labels; enlarge if it carries the message" });
    }
    if (on("contrast-wcag") && Number.isFinite(b.contrastMin)) {
      const large = b.minFont * k >= outH * 0.045;
      const need = large ? 3 : thr("contrast-wcag", 4.5);
      if (b.contrastMin < need) add({ rule: "contrast-wcag", severity: b.contrastMin < need * 0.75 ? "error" : "warn", t0: b.spans[0][0], t1: b.spans[0][1], scene: b.scene, element: b.group,
        message: `"${clip(b.text)}" contrast ${b.contrastMin.toFixed(2)}:1 (${b.color} on ${b.bg}); needs ${need}:1`, fix: "darken the text or lighten its background" });
    }
    if (on("safe-area-title")) {
      const m = 0.05;
      const out = b.rects.find(r => r.x < W * m || r.y < H * m || r.x + r.w > W * (1 - m) || r.y + r.h > H * (1 - m));
      if (out) add({ rule: "safe-area-title", severity: "warn", t0: b.spans[0][0], t1: b.spans[0][1], scene: b.scene, element: b.group,
        message: `"${clip(b.text)}" leaves the 90 % title-safe area (box ${Math.round(out.x)},${Math.round(out.y)} ${Math.round(out.w)}×${Math.round(out.h)} on ${W}×${H})`, fix: "move it inward" });
    }
  }

  // --- static spans ---
  if (on("static-span")) {
    const limit = thr("static-span", 1.5);
    let start: number | null = null;
    for (const smp of [...samples, { t: dur, motion: Infinity } as Sample]) {
      if (smp.motion < 0.5) start ??= smp.t;
      else if (start !== null) {
        if (smp.t - start > limit) add({ rule: "static-span", severity: "warn", t0: start, t1: smp.t, scene: s.sceneAt(start), element: null, message: `nothing moves for ${(smp.t - start).toFixed(1)} s`, fix: "add a slow push-in, drift or bob during the hold" });
        start = null;
      }
    }
  }

  // --- simultaneous entrances (per text block / element) ---
  if (on("simultaneous-entrances")) {
    const entered = new Map<number, Set<string>>();
    const seen = new Set<string>();
    samples.forEach((smp, i) => {
      const vis = new Set(smp.elements.filter(e => e.opacity > 0.05 && onScreen(e.rect, W, H) > 0.2).map(e => e.key));
      if (i === 0) { vis.forEach(k2 => seen.add(k2)); return; }
      for (const k2 of vis) if (!seen.has(k2)) { seen.add(k2); entered.set(i, (entered.get(i) ?? new Set()).add(k2)); }
    });
    const max = thr("simultaneous-entrances", 2);
    for (const [i, keys] of entered) if (keys.size > max && !isCut(s, samples[i].t, step)) {
      const names = [...keys].slice(0, 4).map(k2 => samples[i].elements.find(e => e.key === k2)?.group ?? k2);
      add({ rule: "simultaneous-entrances", severity: "info", t0: samples[i].t, t1: samples[i].t + step, scene: s.sceneAt(samples[i].t), element: names.join(", "), message: `${keys.size} elements appear in the same ${Math.round(step * 1000)} ms`, fix: "stagger them 30–80 ms apart" });
    }
  }

  // --- cuts ---
  const cuts = (s.scenes as Array<{ name: string; start: number }>).filter(sc => sc.start > 0).map(sc => ({ name: sc.name, t: sc.start }));
  if (on("cut-on-beat") && s.meta.bpm) {
    const beat = 60 / s.meta.bpm, off = s.meta.beatOffset ?? 0;
    for (const c of cuts) {
      const d = Math.abs(((c.t - off) / beat - Math.round((c.t - off) / beat)) * beat);
      if (d > thr("cut-on-beat", 2 / fps)) add({ rule: "cut-on-beat", severity: "info", t0: c.t, t1: c.t, scene: c.name, element: null, message: `scene "${c.name}" starts ${(d * 1000).toFixed(0)} ms off the ${s.meta.bpm} BPM grid`, fix: "move it to the nearest beat (or treat the scene boundary as an overlap, not a cut)" });
    }
  }
  if (on("cut-on-motion")) {
    for (const c of cuts) {
      const near = samples.filter(x => Math.abs(x.t - c.t) <= 0.15);
      if (near.length && Math.max(...near.map(x => x.motion)) < 1) add({ rule: "cut-on-motion", severity: "warn", t0: c.t - 0.15, t1: c.t + 0.15, scene: c.name, element: null, message: `scene "${c.name}" starts while nothing moves`, fix: "cut on action: start the next scene during a move" });
    }
  }
  if (on("hook-within-2s")) {
    const early = samples.filter(x => x.t <= 2);
    const moving = early.some(x => x.motion > 1);
    const readable = [...blocks.values()].some(b => b.spans.some(sp => sp[0] <= 2));
    if (!moving && !readable) add({ rule: "hook-within-2s", severity: "warn", t0: 0, t1: 2, scene: s.sceneAt(0), element: null, message: "nothing readable or moving in the first 2 s", fix: "open on the hook: motion and the first idea within 2 s" });
  }
  if (on("end-card-duration")) {
    const last = (s.scenes as Array<{ name: string; start: number; end: number }>).reduce((m, x) => (x.end > m.end ? x : m));
    const d = last.end - last.start;
    if (d < 3 || d > 6) add({ rule: "end-card-duration", severity: "info", t0: last.start, t1: last.end, scene: last.name, element: null, message: `last scene holds ${d.toFixed(1)} s (end cards read best at 3–6 s)` });
  }
  if (on("css-animation")) {
    const n = await s.workers[0].evaluate<number>(`[...document.querySelectorAll('#dolly-stage *')].filter(e => { const c = getComputedStyle(e); return c.animationName !== 'none' || (c.transitionDuration !== '0s' && c.transitionProperty !== 'none'); }).length`);
    if (n) add({ rule: "css-animation", severity: "warn", t0: 0, t1: dur, scene: null, element: `${n} elements`, message: `${n} elements declare CSS animations/transitions (frozen by the runtime, so they never play)`, fix: "drive them from render(t) instead" });
  }

  if (on("will-change")) {
    const n = await s.workers[0].evaluate<number>(`[...document.querySelectorAll('#dolly-stage *')].filter(e => getComputedStyle(e).willChange !== 'auto').length`);
    if (n) add({ rule: "will-change", severity: "error", t0: 0, t1: dur, scene: null, element: `${n} elements`, message: `${n} elements set will-change; their text/raster sharpness then depends on render order (non-deterministic frames)`, fix: "remove will-change" });
  }

  findings.sort((a, b) => a.t0 - b.t0 || a.rule.localeCompare(b.rule));
  const count = (sv: Severity) => findings.filter(f => f.severity === sv).length;
  return { ok: count("error") === 0, errors: count("error"), warnings: count("warn"), infos: count("info"), samples: samples.length, findings };
}

function onScreen(r: { x: number; y: number; w: number; h: number }, W: number, H: number): number {
  const ix = Math.max(0, Math.min(r.x + r.w, W) - Math.max(r.x, 0)), iy = Math.max(0, Math.min(r.y + r.h, H) - Math.max(r.y, 0));
  return r.w * r.h ? (ix * iy) / (r.w * r.h) : 0;
}

const isCut = (s: Session, t: number, step: number) => (s.scenes as Array<{ start: number }>).some(sc => Math.abs(sc.start - t) <= step * 1.5);
const clip = (x: string) => (x.length > 40 ? x.slice(0, 37) + "…" : x);
