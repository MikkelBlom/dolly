// A render session: the bundled project, its server and a pool of workers, shared by every command
// (render, still, sheet, bench, diff) so they all see frames exactly the same way.
import fs from "node:fs";
import path from "node:path";
import { buildProject, serve, type Build, type Server } from "./project.ts";
import { defaultWorkers, startPool, Worker } from "./pool.ts";
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
  /** Don't start browsers until a command needs them (ensureWorkers); the scene metadata comes from
   * the cache written by an earlier session on the same bundle. A fully cached render never starts any. */
  lazy?: boolean;
}

/** Bump when the shape of the cached scene metadata changes. */
const META_VERSION = 1;

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
    const a = performance.now();
    s.build = await buildProject(o.project);
    s.timings.buildMs = performance.now() - a;
    s.server = await serve(s.build);
    const meta = o.lazy ? s.readMeta() : null;
    if (meta) { s.meta = meta; s.fitSize(); return s; }
    try { await s.startWorkers(); } catch (e) { s.close(); throw e; }
    return s;
  }

  /** Output size: explicit, else 1080p on the stage's aspect. */
  private fitSize(): void {
    const st = this.meta.stage, long = 1920;
    this.width = this.o.width ?? (st.width >= st.height ? long : Math.round(long * st.width / st.height / 2) * 2);
    this.height = this.o.height ?? (st.width >= st.height ? Math.round(long * st.height / st.width / 2) * 2 : long);
  }

  private workerOptions() { return { baseUrl: this.server.url, width: this.width, height: this.height, nmax: this.o.nmax ?? 32, gpu: this.o.gpu, aspect: this.o.aspect }; }

  private async startWorkers(): Promise<void> {
    const a = performance.now();
    const n = Math.max(1, this.o.workers ?? defaultWorkers());
    if (!this.meta) {
      // probe one small worker for the stage size, then size the pool from it
      const probe = await startPool(1, { ...this.workerOptions(), width: 640, height: 360 });
      this.meta = probe[0].meta;
      this.writeMeta();
      this.fitSize();
      if (this.width === 640 && this.height === 360) this.workers = probe;
      else probe[0].close();
    }
    if (this.workers.length < n) this.workers.push(...(await startPool(n - this.workers.length, this.workerOptions())));
    this.timings.startMs += performance.now() - a;
  }

  /** Start the browsers of a lazy session (no-op when they are running). */
  async ensureWorkers(): Promise<void> { if (!this.workers.length) await this.startWorkers(); }

  /** Scene metadata is a function of the bundle, the assets and the aspect: cached per those. */
  private metaFile(): string {
    return path.join(this.build.dir, ".dolly", "cache", `meta${META_VERSION}-${this.build.globalHash.slice(0, 12)}-${this.build.bundleHash.slice(0, 12)}-${this.o.aspect ?? ""}.json`);
  }
  private readMeta(): any { try { return JSON.parse(fs.readFileSync(this.metaFile(), "utf8")); } catch { return null; } }
  private writeMeta(): void {
    try { fs.mkdirSync(path.dirname(this.metaFile()), { recursive: true }); fs.writeFileSync(this.metaFile(), JSON.stringify(this.meta)); } catch { /* a cache only */ }
  }

  /** A warm session (the daemon) stays open across commands: close() is a no-op, dispose() closes it. */
  keepAlive = false;
  private stale = false;

  /**
   * Bring a warm session up to date for the next command: rebuild the bundle (~40 ms) and reload every
   * worker's pages when the sources, the aspect, the output size or the blur host size changed. Pages
   * are fresh documents after a reload, as in a newly started browser.
   */
  async refresh(o: { width?: number; height?: number; aspect?: string; nmax?: number }): Promise<void> {
    let a = performance.now();
    const build = await buildProject(this.o.project);
    const changed = build.bundleHash !== this.build.bundleHash || build.globalHash !== this.build.globalHash;
    this.build = build;
    this.timings = { buildMs: performance.now() - a, startMs: 0 };
    a = performance.now();
    const aspectChanged = (o.aspect ?? undefined) !== this.o.aspect;
    const nmaxChanged = (o.nmax ?? 32) !== (this.o.nmax ?? 32);
    Object.assign(this.o, { width: o.width, height: o.height, aspect: o.aspect, nmax: o.nmax });
    const [w0, h0] = [this.width, this.height];
    try {
      // a browser that died since the last command is replaced
      for (let i = 0; i < this.workers.length; i++) if (!this.workers[i].alive) {
        this.workers[i].close();
        this.workers[i] = await new Worker(i, this.workerOptions()).start();
      }
      // a failed reload (a scene that throws) leaves the pages stale: the next refresh reloads them
      this.stale ||= changed || aspectChanged || nmaxChanged;
      if (changed || aspectChanged || this.stale) {
        this.stale = true;
        // the first worker reloads at the current size and reports the (possibly new) stage
        await this.workers[0].reload(this.workerOptions());
        this.meta = this.workers[0].meta;
        this.writeMeta();
        this.fitSize();
        const resized = this.width !== w0 || this.height !== h0;
        await Promise.all(this.workers.slice(resized ? 0 : 1).map(w => w.reload(this.workerOptions())));
      } else {
        this.fitSize();
        if (this.width !== w0 || this.height !== h0) { this.stale = true; await Promise.all(this.workers.map(w => w.reload(this.workerOptions()))); }
      }
      this.stale = false;
    } finally {
      this.timings.startMs = performance.now() - a;
    }
    for (const w of this.workers) w.drainLogs();
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

  close(): void { if (!this.keepAlive) this.dispose(); }
  dispose(): void { this.workers.forEach(w => w.close()); this.server?.close(); }
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
