// The render orchestrator: plan sample counts from motion, render frames in parallel (reusing cached
// ones), and stream them in order into ffmpeg. Returns per-stage timings so bottlenecks are measured.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Session, runQueue, type SessionOptions } from "./session.ts";
import { DEFAULT_BLUR, sampleCounts, shutterSeconds, smearVector, subTimes, frameTime, type BlurSettings, type MotionSample } from "./frames.ts";
import { PRESETS, startEncoder, muxAudio, type Preset } from "./encode.ts";

export interface RenderOptions extends SessionOptions {
  out?: string;
  fps?: number;
  from?: number;
  to?: number;
  preset?: Preset;
  /** false = no motion blur (one sample per frame). */
  blur?: Partial<BlurSettings> | false;
  cache?: boolean;
  /** Frames per work item. */
  chunk?: number;
  /** Mux the video's audio tracks (if any). */
  audio?: boolean;
  onProgress?: (p: Progress) => void;
  /** Reuse an open session (bench, diff). */
  session?: Session;
}

export interface Progress { stage: "plan" | "render"; done: number; total: number; elapsedMs: number }

export interface RenderResult {
  out: string;
  frames: number;
  fps: number;
  width: number;
  height: number;
  workers: number;
  preset: Preset;
  wallMs: number;
  stages: {
    buildMs: number; startMs: number; planMs: number; renderMs: number; encodeTailMs: number; muxMs: number;
    /** Sum over workers of time in frame() (render + capture + transfer). */
    captureMsTotal: number;
  };
  cache: { hits: number; misses: number };
  blur: null | { shutter: number; gap: number; nmax: number; samples: number; histogram: Record<string, number>; maxMotionPx: number; cappedFrames: number; smearedFrames: number };
  throughput: { outputFps: number; subframesPerSec: number };
}

const frameKeyCacheFile = (dir: string, key: string) => path.join(dir, key.slice(0, 2), `${key}.png`);

export async function render(o: RenderOptions): Promise<RenderResult> {
  const t0 = performance.now();
  const s = o.session ?? await Session.open(o);
  try {
    const meta = s.meta;
    const fps = o.fps ?? meta.fps;
    const from = o.from ?? 0, to = Math.min(o.to ?? meta.duration, meta.duration);
    const F = Math.round((to - from) * fps);
    if (F <= 0) throw new Error(`nothing to render: from ${from}s to ${to}s`);
    const preset: Preset = o.preset ?? "youtube";
    const blur: BlurSettings | null = o.blur === false ? null : { ...DEFAULT_BLUR, ...(o.blur ?? {}) };
    const out = path.resolve(o.out ?? path.join(s.build.dir, "out", `${path.basename(s.build.dir)}.${PRESETS[preset].ext}`));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const useCache = o.cache !== false;
    const cacheDir = s.cacheDir;
    const chunk = o.chunk ?? 30;

    // 1. plan: motion per frame → sample count
    let counts = new Array<number>(F).fill(1), planMs = 0, motion: number[] = [];
    let plan: MotionSample[] = [];
    let smears: Array<[number, number] | null> = new Array(F).fill(null);
    if (blur) {
      const a = performance.now();
      const half = shutterSeconds(fps, blur.shutter) / 2;
      plan = new Array<MotionSample>(F);
      const planFile = path.join(cacheDir, "..", `plan2-${s.build.globalHash.slice(0, 12)}-${hashScenes(s)}-${fps}-${s.width}x${s.height}-${blur.shutter}-${from}-${to}.json`);
      if (useCache && fs.existsSync(planFile)) plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
      else {
        const chunks = chunked(F, 60);
        let done = 0;
        await runQueue(s.workers, chunks, async (w, [c0, c1]) => {
          for (let f = c0; f < c1; f++) {
            const t = frameTime(f, fps, from);
            const m = await w.motion(Math.max(0, t - half), t + half);
            plan[f] = { px: m.px, camera: m.camera, vx: m.cameraVec[0], vy: m.cameraVec[1] };
          }
          done += c1 - c0;
          o.onProgress?.({ stage: "plan", done, total: F, elapsedMs: performance.now() - t0 });
        });
        fs.writeFileSync(planFile, JSON.stringify(plan));
      }
      motion = plan.map(m => m.px);
      counts = sampleCounts(motion, blur);
      smears = plan.map((m, f) => smearVector(m, counts[f], blur));
      planMs = performance.now() - a;
      if (counts.some(n => n > 1)) await Promise.all(s.workers.map(w => w.warmHost()));
    }

    // 2. keys and cache hits
    const shutter = blur?.shutter ?? 0;
    const times = counts.map((n, f) => subTimes(f, n, fps, shutter || 180, from));
    const keys = times.map((ts, f) => s.keyFor(frameTime(f, fps, from), ts, fps, shutter || 180, smears[f]));
    const cached = keys.map(k => useCache && fs.existsSync(frameKeyCacheFile(cacheDir, k)));
    const todo = keys.map((_, f) => f).filter(f => !cached[f]);

    // 3. render + encode, in order through a bounded reorder buffer
    const enc = startEncoder({ out, fps, preset, width: s.width, height: s.height });
    const ready = new Map<number, Buffer>();
    let nextWrite = 0, writing = Promise.resolve();
    const WINDOW = Math.max(120, s.workers.length * chunk * 2);
    const waiters: Array<() => void> = [];
    const flush = () => {
      writing = writing.then(async () => {
        while (nextWrite < F) {
          let buf = ready.get(nextWrite);
          if (!buf && cached[nextWrite]) buf = fs.readFileSync(frameKeyCacheFile(cacheDir, keys[nextWrite]));
          if (!buf) break;
          ready.delete(nextWrite);
          await enc.write(buf);
          nextWrite++;
          while (waiters.length) waiters.shift()!();
        }
      });
      return writing;
    };
    let captureMs = 0, done = F - todo.length;
    const ra = performance.now();
    await flush();
    const items = chunked(todo.length, chunk).map(([a, b]) => todo.slice(a, b));
    await runQueue(s.workers, items, async (w, fs_) => {
      for (const f of fs_) {
        while (f - nextWrite > WINDOW) await new Promise<void>(r => waiters.push(r));
        const a = performance.now();
        let png: Buffer;
        try { png = await w.frame(times[f], "png", smears[f]); }
        catch (e) { throw new Error(`frame ${f} (t=${frameTime(f, fps, from).toFixed(3)}s, scene ${s.sceneAt(frameTime(f, fps, from))}): ${(e as Error).message}`); }
        captureMs += performance.now() - a;
        if (useCache) { const file = frameKeyCacheFile(cacheDir, keys[f]); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.promises.writeFile(file, png).catch(() => {}); }
        ready.set(f, png);
        done++;
        o.onProgress?.({ stage: "render", done, total: F, elapsedMs: performance.now() - t0 });
        void flush();
      }
    });
    await flush();
    const renderMs = performance.now() - ra;
    const ta = performance.now();
    await enc.end();
    const encodeTailMs = performance.now() - ta;
    if (nextWrite !== F) throw new Error(`internal: wrote ${nextWrite} of ${F} frames`);

    // 4. audio
    let muxMs = 0;
    const tracks = (meta.audio ?? []) as Array<{ src: string; start?: number; gain?: number; role?: string }>;
    if (o.audio !== false && tracks.length && !PRESETS[preset].alpha) {
      const a = performance.now();
      const tmp = out.replace(/(\.\w+)$/, ".noaudio$1");
      fs.renameSync(out, tmp);
      await muxAudio({ video: tmp, out, duration: to - from, tracks: tracks.map(t => ({ ...t, path: path.resolve(s.build.dir, t.src), start: (t.start ?? 0) - from })) });
      fs.rmSync(tmp);
      muxMs = performance.now() - a;
    }

    const wallMs = performance.now() - t0;
    const sub = counts.reduce((x, y) => x + y, 0);
    const hist: Record<string, number> = {};
    for (const n of counts) hist[n] = (hist[n] ?? 0) + 1;
    return {
      out, frames: F, fps, width: s.width, height: s.height, workers: s.workers.length, preset, wallMs,
      stages: { buildMs: s.timings.buildMs, startMs: s.timings.startMs, planMs, renderMs, encodeTailMs, muxMs, captureMsTotal: captureMs },
      cache: { hits: F - todo.length, misses: todo.length },
      blur: blur ? { shutter: blur.shutter, gap: blur.gap, nmax: blur.nmax, samples: sub, histogram: hist, maxMotionPx: Math.max(0, ...motion), cappedFrames: counts.filter(n => n >= blur.nmax).length, smearedFrames: smears.filter(Boolean).length } : null,
      throughput: { outputFps: (todo.length || F) / (renderMs / 1000), subframesPerSec: todo.reduce((x, f) => x + counts[f], 0) / (renderMs / 1000) },
    };
  } finally {
    if (!o.session) s.close();
  }
}

function chunked(n: number, size: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i += size) out.push([i, Math.min(n, i + size)]);
  return out;
}

function hashScenes(s: Session): string {
  return crypto.createHash("sha1").update(JSON.stringify(s.build.sceneHashes)).digest("hex").slice(0, 12);
}
