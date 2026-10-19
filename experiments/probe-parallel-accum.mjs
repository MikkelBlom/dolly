// Sustained throughput of compositor tree accumulation across W browsers, plus a determinism check.
//   node experiments/probe-parallel-accum.mjs <workers> <samples> [seconds]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { launch, openPage } from "./cdp.mjs";

const [wArg = "8", nArg = "16", secs = "20"] = process.argv.slice(2);
const W = +wArg, N = +nArg;
const SRC = "C:/Users/mikke/Desktop/Projects/KRW-Extension/store/video";
const iframe = `<iframe src="/promo-video.html?record"></iframe>`;
const tree = n => n === 1 ? iframe : `<div class="g"><div class="h">${tree(n / 2)}</div><div class="h">${tree(n / 2)}</div></div>`;
const host = `<!doctype html><style>html,body{margin:0;background:#000;overflow:hidden}
iframe{position:absolute;left:0;top:0;width:1920px;height:1080px;border:0}
.g{position:absolute;inset:0;isolation:isolate}.h{position:absolute;inset:0;opacity:.5;mix-blend-mode:plus-lighter;isolation:isolate}</style>
${tree(N)}<script>
const frames = [...document.querySelectorAll("iframe")];
window.ready = Promise.all(frames.map(f => new Promise(r => f.onload = r))).then(() => Promise.all(frames.map(f => f.contentWindow.ready)));
window.renderAll = (t, fps, shutter) => frames.forEach((f, i) => f.contentWindow.render(t + ((i + .5) / frames.length - .5) * shutter / fps));
</script>`;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/host.html") { res.setHeader("content-type", "text/html"); return res.end(host); }
  const p = path.join(SRC, path.basename(u.pathname));
  if (!fs.existsSync(p)) { res.statusCode = 404; return res.end(); }
  res.setHeader("content-type", "text/html"); fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;
const FLAGS = ["--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--use-angle=d3d11"];

const ws = await Promise.all(Array.from({ length: W }, () => launch({ browser: "shell", flags: FLAGS })));
await Promise.all(ws.map(s => openPage(s, `http://127.0.0.1:${port}/host.html`)));
const shot = async s => (await s.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true })).data;

// determinism: same frame rendered twice on different workers must hash identically
const hashes = [];
for (const s of ws.slice(0, 2)) for (let k = 0; k < 2; k++) {
  await s.evaluate(`renderAll(7.0, 60, .5)`);
  hashes.push(crypto.createHash("sha1").update(await shot(s)).digest("hex").slice(0, 10));
}

let frames = 0; const deadline = performance.now() + +secs * 1000;
await Promise.all(ws.map(async (s, w) => {
  let f = w * 37;
  while (performance.now() < deadline) {
    await s.evaluate(`renderAll(${((f += 7) % 1800) / 60}, 60, .5)`);
    Buffer.from(await shot(s), "base64"); frames++;
  }
}));
ws.forEach(s => s.close()); server.close();
console.log(JSON.stringify({ workers: W, samples: N, fps: +(frames / +secs).toFixed(1), subframesPerSec: Math.round(frames * N / +secs), deterministic: new Set(hashes).size === 1, hashes }));
process.exit(0);
