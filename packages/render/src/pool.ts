// Worker pool: one Chromium process per worker (tabs inside one browser share its compositor and
// serialise: 1×8 tabs = 38 fps vs 8×1 browsers = 76 fps, benchmarks.md). Each worker has a plain scene
// page for single-sample frames and, on demand, an accumulation host for motion-blurred ones.
import os from "node:os";
import { launch, openScene, screenshot, type Browser, type CdpSession } from "./browser.ts";

export interface WorkerOptions { baseUrl: string; width: number; height: number; nmax: number; gpu?: boolean; aspect?: string }

export class Worker {
  readonly id: number;
  private o: WorkerOptions;
  private browser!: Browser;
  private plain!: CdpSession;
  private host: CdpSession | null = null;
  private hostOpening: Promise<CdpSession> | null = null;
  meta: any;
  constructor(id: number, o: WorkerOptions) { this.id = id; this.o = o; }

  private q(): string { return this.o.aspect ? `?aspect=${this.o.aspect}` : ""; }

  async start(): Promise<this> {
    this.browser = await launch({ gpu: this.o.gpu, width: this.o.width, height: this.o.height });
    this.plain = await this.browser.newPage();
    this.meta = await openScene(this.plain, `${this.o.baseUrl}/frame.html${this.q()}`, this.o.width, this.o.height).catch(async e => {
      const detail = await this.plain.evaluate<string | undefined>("window.__dollyError").catch(() => undefined);
      throw new Error(detail ? detail.split("\n")[0] : e.message);
    });
    return this;
  }

  private async hostPage(): Promise<CdpSession> {
    if (this.host) return this.host;
    this.hostOpening ??= (async () => {
      const p = await this.browser.newPage();
      const sep = this.q() ? "&" : "?";
      await openScene(p, `${this.o.baseUrl}/host.html${this.q()}${sep}n=${this.o.nmax}`, this.o.width, this.o.height, "window.__host && window.__host.ready");
      this.host = p;
      return p;
    })();
    return this.hostOpening;
  }

  /** Warm the accumulation host so the first blurred frame doesn't pay for loading NMAX documents. */
  async warmHost(): Promise<void> { await this.hostPage(); }

  /** One output frame from explicit sub-frame times (1 time = no blur). */
  async frame(times: number[], format: "png" | "jpeg" = "png"): Promise<Buffer> {
    if (times.length === 1) {
      await this.plain.evaluate(`__dolly.render(${times[0]})`);
      return screenshot(this.plain, format);
    }
    const h = await this.hostPage();
    await h.evaluate(`__host.frame(${JSON.stringify(times)})`);
    return screenshot(h, format);
  }

  motion(t0: number, t1: number): Promise<{ px: number; camera: number; element: string | null }> {
    return this.plain.evaluate(`__dolly.motion(${t0}, ${t1})`);
  }

  evaluate<T>(expr: string): Promise<T> { return this.plain.evaluate<T>(expr); }

  page(): CdpSession { return this.plain; }

  /** A scratch tab in this worker's browser (contact-sheet composition, inspection). */
  newPage(): Promise<CdpSession> { return this.browser.newPage(); }

  close(): void { this.browser?.close(); }
}

/**
 * Default worker count: measured on the reference laptop (Core Ultra 9 285H, 16 cores), throughput rose
 * to 12 workers (107 fps) and flattened after (16 → 113). PNG encoding in Chromium is the bottleneck, so
 * this scales with cores: 3/4 of the logical cores, at least 1, at most 16.
 */
export function defaultWorkers(): number {
  return Math.max(1, Math.min(16, Math.round(os.availableParallelism() * 0.75)));
}

export async function startPool(n: number, o: WorkerOptions): Promise<Worker[]> {
  const ws = Array.from({ length: n }, (_, i) => new Worker(i, o));
  try { await Promise.all(ws.map(w => w.start())); }
  catch (e) { ws.forEach(w => w.close()); throw e; }
  return ws;
}
