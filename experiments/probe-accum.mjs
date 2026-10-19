// Can Chromium's compositor do motion-blur accumulation for us? N iframes of the scene, each rendered at
// its own sub-frame time, stacked with opacity 1/N and mix-blend-mode: plus-lighter, captured as ONE
// screenshot. Compared against N separate captures averaged in float by ffmpeg.
//   node experiments/probe-accum.mjs [N] [t] [outdir]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { launch, openPage } from "./cdp.mjs";

const [nArg = "8", tArg = "7.0", outArg = "experiments/out/accum", layout = "flat", profile = "srgb"] = process.argv.slice(2);
const N = +nArg, T = +tArg, OUT = path.resolve(outArg);
fs.mkdirSync(OUT, { recursive: true });
const SRC = "C:/Users/mikke/Desktop/Projects/KRW-Extension/store/video";
const FPS = 60, SHUTTER = 0.5;
const subT = i => T + (N > 1 ? (i / (N - 1) - .5) * SHUTTER : 0) / FPS;

const iframe = `<iframe src="/promo-video.html?record"></iframe>`;
const tree = n => n === 1 ? iframe : `<div class="g"><div class="h">${tree(n / 2)}</div><div class="h">${tree(n / 2)}</div></div>`;
const host = `<!doctype html><style>html,body{margin:0;background:#000;overflow:hidden}
iframe{position:absolute;left:0;top:0;width:1920px;height:1080px;border:0;${layout === "flat" ? `mix-blend-mode:plus-lighter;opacity:${1 / N}` : ""}}
.g{position:absolute;inset:0;isolation:isolate}.h{position:absolute;inset:0;opacity:.5;mix-blend-mode:plus-lighter;isolation:isolate}
#root{position:absolute;inset:0;isolation:isolate}</style><div id="root">
${layout === "flat" ? iframe.repeat(N) : tree(N)}</div>
<script>
const frames = [...document.querySelectorAll("iframe")];
window.ready = Promise.all(frames.map(f => new Promise(r => f.onload = r))).then(() => Promise.all(frames.map(f => f.contentWindow.ready)));
window.renderAll = ts => frames.forEach((f, i) => f.contentWindow.render(ts[i]));
</script>`;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/host.html") { res.setHeader("content-type", "text/html"); return res.end(host); }
  const p = path.join(SRC, path.basename(u.pathname));
  if (!fs.existsSync(p)) { res.statusCode = 404; return res.end(); }
  res.setHeader("content-type", "text/html"); fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const s = await launch({ browser: "shell", flags: [...(profile === "srgb" ? [] : [`--force-color-profile=${profile}`]), "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const shot = async () => Buffer.from((await s.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true })).data, "base64");

// 1. compositor accumulation
await openPage(s, `http://127.0.0.1:${port}/host.html`);
const ts = Array.from({ length: N }, (_, i) => subT(i));
await s.evaluate(`renderAll(${JSON.stringify(ts)})`);
await shot(); // warm
let a = performance.now();
const REPS = 10;
for (let r = 0; r < REPS; r++) { await s.evaluate(`renderAll(${JSON.stringify(ts.map(x => x + r * 1e-6))})`); await shot(); }
const accumMs = (performance.now() - a) / REPS;
await s.evaluate(`renderAll(${JSON.stringify(ts)})`);
fs.writeFileSync(path.join(OUT, "compositor.png"), await shot());

// 2. reference: N separate captures, averaged by ffmpeg in float (sRGB space, like tmix) and in linear light
await openPage(s, `http://127.0.0.1:${port}/promo-video.html?record`);
a = performance.now();
for (let i = 0; i < N; i++) { await s.evaluate(`render(${ts[i]})`); fs.writeFileSync(path.join(OUT, `sub-${i}.png`), await shot()); }
const separateMs = performance.now() - a;
s.close(); server.close();

const ff = args => spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
ff(["-framerate", "60", "-i", path.join(OUT, "sub-%d.png"), "-vf", `format=gbrpf32le,tmix=frames=${N},select='eq(n\\,${N - 1})',format=rgb24`, "-frames:v", "1", path.join(OUT, "ref-srgb.png")]);
const psnr = (x, y) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", x, "-i", y, "-lavfi", "psnr", "-f", "null", "-"], { encoding: "utf8" });
  return (r.stderr.match(/PSNR.*average:([\d.inf]+).*max:([\d.inf]+)/) || [])[0];
};
console.log(JSON.stringify({
  N, t: T, layout, profile, compositorMsPerFrame: +accumMs.toFixed(1), separateMsTotal: Math.round(separateMs),
  psnrCompositorVsFloatSrgb: psnr(path.join(OUT, "compositor.png"), path.join(OUT, "ref-srgb.png")),
}));
process.exit(0);
