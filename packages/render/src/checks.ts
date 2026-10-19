// Measurement and verification: `bench` reports frames/s per stage so bottlenecks are measured, not
// guessed; `determinism` renders frames twice, in different orders on different workers, and diffs them.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { Session, runQueue } from "./session.ts";
import { screenshot } from "./browser.ts";
import { DEFAULT_BLUR, shutterSeconds, subTimes } from "./frames.ts";
import { PRESETS, type Preset } from "./encode.ts";

export interface BenchResult {
  machine: { cpus: number; workers: number; width: number; height: number; browser: string };
  stages: Array<{ stage: string; fps: number; msPerFrame: number; note: string }>;
}

const spread = (n: number, dur: number) => Array.from({ length: n }, (_, i) => +((i + 0.5) * dur / n).toFixed(4));

export async function bench(s: Session, o: { frames?: number; outDir: string }): Promise<BenchResult> {
  const N = o.frames ?? 240;
  const dur = s.meta.duration, fps = s.meta.fps;
  const ts = spread(N, dur);
  const stages: BenchResult["stages"] = [];
  const add = (stage: string, frames: number, ms: number, note: string) =>
    stages.push({ stage, fps: +(frames / (ms / 1000)).toFixed(1), msPerFrame: +(ms / frames).toFixed(2), note });

  // per-stage costs inside one worker, serially (no contention)
  const w0 = s.workers[0];
  let rMs = 0, cMs = 0, bytes = 0;
  for (const t of ts.slice(0, 60)) {
    const a = performance.now(); await w0.evaluate(`__dolly.render(${t})`);
    const b = performance.now(); const png = await screenshot(w0.page(), "png");
    rMs += b - a; cMs += performance.now() - b; bytes += png.length;
  }
  add("render(t) in page, 1 worker", 60, rMs, "DOM updates + style/layout triggered by the scene's render");
  add("capture PNG, 1 worker", 60, cMs, `raster + PNG encode in Chromium + base64 over CDP; ${(bytes / 60 / 1024).toFixed(0)} KB/frame`);

  // plan: motion measurement throughput
  const half = shutterSeconds(fps, DEFAULT_BLUR.shutter) / 2;
  let a = performance.now();
  await runQueue(s.workers, ts, async (w, t) => { await w.motion(Math.max(0, t - half), t + half); });
  add(`plan (motion), ${s.workers.length} workers`, N, performance.now() - a, "two renders + layout reads per frame");

  // parallel capture without and with blur
  const frames: Buffer[] = new Array(N);
  a = performance.now();
  await runQueue(s.workers, ts, async (w, t, i) => { frames[i] = await w.frame([t]); });
  add(`capture 1 sample, ${s.workers.length} workers`, N, performance.now() - a, "plain scene page");
  await Promise.all(s.workers.map(w => w.warmHost()));
  for (const n of [8, 32]) {
    if (n > (s.o.nmax ?? 32)) continue;
    const k = Math.max(s.workers.length * 4, Math.round(N / (n / 4)));
    a = performance.now();
    await runQueue(s.workers, ts.slice(0, k), async (w, t) => { await w.frame(subTimes(t * fps, n, fps, 180)); });
    const ms = performance.now() - a;
    add(`capture ${n} samples (compositor blur), ${s.workers.length} workers`, k, ms, `${Math.round(k * n / (ms / 1000))} sub-frames/s`);
  }

  // encode: the captured PNGs through ffmpeg, as fast as it will take them
  fs.mkdirSync(o.outDir, { recursive: true });
  for (const preset of ["youtube", "draft"] as Preset[]) {
    const out = path.join(o.outDir, `bench-${preset}.${PRESETS[preset].ext}`);
    const p = PRESETS[preset];
    a = performance.now();
    await new Promise<void>((res, rej) => {
      const ff = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-c:v", "png", "-framerate", String(fps), "-i", "-",
        ...(p.vf ? ["-vf", p.vf] : []), ...p.args(fps), out], { stdio: ["pipe", "ignore", "inherit"] });
      ff.on("close", c => c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)));
      (async () => { for (const f of frames) if (!ff.stdin.write(f)) await new Promise(r => ff.stdin.once("drain", r)); ff.stdin.end(); })();
    });
    add(`encode ${preset} (PNG decode + ${p.args(fps)[1]})`, N, performance.now() - a, "ffmpeg reading PNGs from a pipe");
  }
  return { machine: { cpus: (await import("node:os")).availableParallelism(), workers: s.workers.length, width: s.width, height: s.height, browser: s.workers[0] ? "chrome-headless-shell" : "" }, stages };
}

export interface DeterminismResult {
  ok: boolean;
  checked: number;
  /** Frames that differ. "mismatch": the rendered DOM state differs between the two renders (a scene
   * carries state between frames); `differences` names the elements and properties. "raster-noise": the
   * state is identical but Chromium's history-dependent raster left faint anti-aliasing differences. */
  mismatches: Array<{ t: number; samples: number; scene: string; a: string; b: string; diffPath?: string; meanAbs: number; changedPct: number; kind: "mismatch" | "raster-noise"; differences?: Array<{ a: string; b: string }> }>;
}

function decodeRgb(png: Buffer): Buffer {
  return spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { input: png, maxBuffer: 1 << 28 }).stdout;
}

/**
 * Render every time twice: once in ascending order on one worker, once in shuffled order on another.
 * A pure render(t) gives identical bytes; state carried between frames shows up as a mismatch.
 */
export async function determinism(s: Session, o: { times?: number[]; blur?: boolean; outDir: string }): Promise<DeterminismResult> {
  const fps = s.meta.fps;
  const times = o.times ?? spread(24, s.meta.duration);
  const half = shutterSeconds(fps, DEFAULT_BLUR.shutter) / 2;
  const plan = await Promise.all(times.map(async t => {
    if (!o.blur) return [t];
    const m = await s.workers[0].motion(Math.max(0, t - half), t + half);
    const n = Math.min(DEFAULT_BLUR.nmax, 2 ** Math.ceil(Math.log2(Math.max(1, Math.ceil(m.px / DEFAULT_BLUR.gap)))));
    return n > 1 ? subTimes(t * fps, n, fps, DEFAULT_BLUR.shutter) : [t];
  }));
  const wa = s.workers[0], wb = s.workers[1] ?? s.workers[0];
  const hash = (b: Buffer) => crypto.createHash("sha1").update(b).digest("hex");
  const A: Buffer[] = [], B: Buffer[] = new Array(times.length);
  const FA: string[][] = [], FB: string[][] = new Array(times.length);
  for (const ts of plan) { A.push(await wa.frame(ts)); FA.push(await wa.fingerprint(ts.length)); }
  const order = times.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = (i * 7919 + 13) % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  for (const i of order) { B[i] = await wb.frame(plan[i]); FB[i] = await wb.fingerprint(plan[i].length); }
  const mismatches: DeterminismResult["mismatches"] = [];
  fs.mkdirSync(o.outDir, { recursive: true });
  times.forEach((t, i) => {
    const a = hash(A[i]), b = hash(B[i]);
    if (a === b) return;
    const pa = path.join(o.outDir, `det-${t}-a.png`), pb = path.join(o.outDir, `det-${t}-b.png`);
    fs.writeFileSync(pa, A[i]); fs.writeFileSync(pb, B[i]);
    const diffPath = path.join(o.outDir, `det-${t}-diff.png`);
    spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", pa, "-i", pb, "-filter_complex", "[0]format=rgb24[x];[1]format=rgb24[y];[x][y]blend=all_mode=difference,lutrgb=r=val*8:g=val*8:b=val*8", diffPath]);
    const x = decodeRgb(A[i]), y = decodeRgb(B[i]);
    let sum = 0, changed = 0;
    for (let k = 0; k < x.length; k++) { const d = Math.abs(x[k] - y[k]); sum += d; if (d > 16) changed++; }
    const meanAbs = sum / x.length, changedPct = (changed / x.length) * 100;
    const differences: Array<{ a: string; b: string }> = [];
    const n = Math.max(FA[i].length, FB[i].length);
    for (let k = 0; k < n && differences.length < 5; k++) if (FA[i][k] !== FB[i][k]) differences.push({ a: FA[i][k] ?? "(missing)", b: FB[i][k] ?? "(missing)" });
    const kind = differences.length ? "mismatch" : "raster-noise";
    mismatches.push({ t, samples: plan[i].length, scene: s.sceneAt(t), a: a.slice(0, 10), b: b.slice(0, 10), diffPath, meanAbs: +meanAbs.toFixed(3), changedPct: +changedPct.toFixed(3), kind, ...(differences.length ? { differences } : {}) });
  });
  return { ok: !mismatches.some(m => m.kind === "mismatch"), checked: times.length, mismatches };
}
