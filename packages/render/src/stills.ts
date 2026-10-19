// Stills and contact sheets: the images an agent looks at. A sheet is an N×M grid of frames with the
// time, scene and frame number under each, composed in the browser (no font-path fiddling in ffmpeg).
import fs from "node:fs";
import path from "node:path";
import { Session, runQueue } from "./session.ts";
import { DEFAULT_BLUR, sampleCounts, shutterSeconds, subTimes } from "./frames.ts";
import { screenshot } from "./browser.ts";

export interface StillOptions { times: number[]; outDir: string; blur?: boolean; prefix?: string; format?: "png" | "jpeg" }

export interface Still { t: number; path: string; scene: string; samples: number }

/** Render frames at the given times. With blur, the sample count comes from the motion at that time. */
export async function stills(s: Session, o: StillOptions): Promise<Still[]> {
  fs.mkdirSync(o.outDir, { recursive: true });
  const fps = s.meta.fps;
  const out: Still[] = new Array(o.times.length);
  await runQueue(s.workers, o.times, async (w, t, i) => {
    let n = 1;
    if (o.blur) {
      const half = shutterSeconds(fps, DEFAULT_BLUR.shutter) / 2;
      const m = await w.motion(Math.max(0, t - half), t + half);
      n = sampleCounts([m.px], { ...DEFAULT_BLUR, smooth: 0 })[0];
    }
    const f = t * fps;
    const times = n > 1 ? subTimes(f, n, fps, DEFAULT_BLUR.shutter) : [t];
    const buf = await w.frame(times, o.format ?? "png");
    const file = path.join(o.outDir, `${o.prefix ?? "still"}-${t.toFixed(2).replace(".", "_")}.${o.format === "jpeg" ? "jpg" : "png"}`);
    fs.writeFileSync(file, buf);
    out[i] = { t, path: file, scene: s.sceneAt(t), samples: n };
  });
  return out;
}

export interface SheetOptions {
  from?: number; to?: number;
  cols?: number; rows?: number;
  /** Explicit times instead of an even spread. */
  times?: number[];
  out: string;
  /** Width of each cell in px. */
  cellWidth?: number;
  blur?: boolean;
  title?: string;
}

export interface Sheet { path: string; times: number[]; cells: Array<{ t: number; scene: string; frame: number }>; width: number; height: number }

/** Contact sheet: frames spread evenly across [from, to] (cell centres), labelled. */
export async function sheet(s: Session, o: SheetOptions): Promise<Sheet> {
  const cols = o.cols ?? 4, rows = o.rows ?? 3;
  const from = o.from ?? 0, to = o.to ?? s.meta.duration;
  const n = o.times?.length ?? cols * rows;
  const times = o.times ?? Array.from({ length: n }, (_, i) => +(from + (to - from) * (i + 0.5) / n).toFixed(3));
  const tmp = path.join(path.dirname(o.out), `.sheet-${process.pid}`);
  const shots = await stills(s, { times, outDir: tmp, blur: o.blur, format: "jpeg" });
  const cw = o.cellWidth ?? 480, ch = Math.round(cw * s.height / s.width);
  const realCols = Math.min(cols, times.length), realRows = Math.ceil(times.length / realCols);
  const fps = s.meta.fps;
  const cells = shots.map(x => ({ t: x.t, scene: x.scene, frame: Math.round(x.t * fps) }));
  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#16181d;font:500 13px/1.2 "Segoe UI",system-ui,sans-serif;color:#cfd3dc}
.top{padding:10px 14px 0;font-weight:700;color:#fff}
.g{display:grid;grid-template-columns:repeat(${realCols},${cw}px);gap:10px;padding:10px 14px 14px}
.c img{display:block;width:${cw}px;height:${ch}px;border-radius:4px;background:#000}
.c div{padding:5px 2px 0;display:flex;justify-content:space-between}
.c b{color:#fff}</style>
<div class="top">${esc(o.title ?? s.meta.title)} · ${from.toFixed(2)}–${to.toFixed(2)} s · ${s.width}×${s.height}${o.blur ? " · motion blur" : ""}</div>
<div class="g">${shots.map((x, i) => `<div class="c"><img src="data:image/jpeg;base64,${fs.readFileSync(x.path).toString("base64")}"><div><b>${x.t.toFixed(2)} s</b><span>${esc(x.scene)} · f${cells[i].frame}${x.samples > 1 ? ` · ${x.samples}×` : ""}</span></div></div>`).join("")}</div>`;
  const W = 14 * 2 + realCols * cw + (realCols - 1) * 10, H = 34 + realRows * (ch + 26) + (realRows - 1) * 10 + 14;
  const htmlFile = path.join(tmp, "sheet.html");
  fs.writeFileSync(htmlFile, html);
  const sp = await s.workers[0].newPage();
  await sp.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await sp.send("Page.enable");
  await sp.send("Page.navigate", { url: "file:///" + htmlFile.replace(/\\/g, "/") });
  await sp.evaluate("new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r))");
  await sp.evaluate("Promise.all([...document.images].map(i => i.decode()))");
  const png = await screenshot(sp, "png");
  await sp.send("Page.close").catch(() => {});
  sp.close();
  fs.mkdirSync(path.dirname(o.out), { recursive: true });
  fs.writeFileSync(o.out, png);
  fs.rmSync(tmp, { recursive: true, force: true });
  return { path: o.out, times, cells, width: W, height: H };
}

const esc = (x: string) => x.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
