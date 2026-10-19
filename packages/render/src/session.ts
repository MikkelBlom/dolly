// A render session: the bundled project, its server and a pool of workers, shared by every command
// (render, still, sheet, bench, diff) so they all see frames exactly the same way.
import fs from "node:fs";
import path from "node:path";
import { buildProject, serve, type Build, type Server } from "./project.ts";
import { defaultWorkers, startPool, type Worker } from "./pool.ts";
import { frameKey, shutterSeconds } from "./frames.ts";

export interface SessionOptions {
  project: string;
  width?: number;
  height?: number;
  workers?: number;
  /** Largest blur sample count the accumulation host is built for. */
  nmax?: number;
  aspect?: string;
  gpu?: boolean;
}

export interface SceneMeta { name: string; start: number; end: number; file?: string }

export class Session {
  build!: Build;
  server!: Server;
  workers: Worker[] = [];
  meta: any;
  width = 1920;
  height = 1080;
  o: SessionOptions;
  timings = { buildMs: 0, startMs: 0 };
  constructor(o: SessionOptions) { this.o = o; }

  static async open(o: SessionOptions): Promise<Session> {
    const s = new Session(o);
    let a = performance.now();
    s.build = await buildProject(o.project);
    s.timings.buildMs = performance.now() - a;
    s.server = await serve(s.build);
    a = performance.now();
    // size: explicit, else 1080p on the stage's aspect
    const n = Math.max(1, o.workers ?? defaultWorkers());
    try {
      const probe = await startPool(1, { baseUrl: s.server.url, width: 640, height: 360, nmax: o.nmax ?? 32, gpu: o.gpu, aspect: o.aspect });
      s.meta = probe[0].meta;
      const st = s.meta.stage;
      const long = 1920;
      s.width = o.width ?? (st.width >= st.height ? long : Math.round(long * st.width / st.height / 2) * 2);
      s.height = o.height ?? (st.width >= st.height ? Math.round(long * st.height / st.width / 2) * 2 : long);
      if (s.width === 640 && s.height === 360) { s.workers = probe; }
      else { probe[0].close(); }
      if (!s.workers.length) s.workers = await startPool(n, { baseUrl: s.server.url, width: s.width, height: s.height, nmax: o.nmax ?? 32, gpu: o.gpu, aspect: o.aspect });
      else if (n > 1) s.workers.push(...(await startPool(n - 1, { baseUrl: s.server.url, width: s.width, height: s.height, nmax: o.nmax ?? 32, gpu: o.gpu, aspect: o.aspect })));
    } catch (e) { s.close(); throw e; }
    s.timings.startMs = performance.now() - a;
    return s;
  }

  get scenes(): SceneMeta[] { return this.meta.scenes; }
  get cacheDir(): string { const d = path.join(this.build.dir, ".dolly", "cache", "frames"); fs.mkdirSync(d, { recursive: true }); return d; }

  /** Scene hashes for the scenes active anywhere in [t0, t1]. */
  activeHashes(t0: number, t1: number): string[] {
    return this.scenes.filter(s => t1 >= s.start && t0 < s.end).map(s => (s.file && this.build.sceneHashes[s.file]) || `inline:${s.name}`);
  }

  keyFor(t: number, times: number[], fps: number, shutter: number, smear?: [number, number] | null): string {
    const half = shutterSeconds(fps, shutter) / 2;
    return frameKey({ globalHash: this.build.globalHash, sceneHashes: this.activeHashes(t - half, t + half), t, times, width: this.width, height: this.height, aspect: this.o.aspect, smear });
  }

  /** Scene name(s) at t, for error messages and labels. */
  sceneAt(t: number): string { return this.scenes.filter(s => t >= s.start && t < s.end).map(s => s.name).join("+") || "world"; }

  close(): void { this.workers.forEach(w => w.close()); this.server?.close(); }
}

/**
 * Run tasks over the workers: a shared queue handed out in order, so all workers stay busy even when
 * frames cost very different amounts (blurred frames cost up to ~2× more).
 */
export async function runQueue<T>(workers: Worker[], items: T[], fn: (w: Worker, item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0, failed: unknown = null;
  await Promise.all(workers.map(async w => {
    while (!failed && next < items.length) {
      const i = next++;
      try { await fn(w, items[i], i); } catch (e) { failed ??= e; }
    }
  }));
  if (failed) throw failed;
}
