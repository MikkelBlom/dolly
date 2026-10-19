// HTML-in-Canvas fidelity on the real baseline: wrap #stage inside <canvas layoutsubtree>, draw it with
// drawElementImage, and diff against a normal screenshot of the same t.
//   node experiments/probe-hic-fidelity.mjs [times...]
import fs from "node:fs";
import path from "node:path";
import { launch, openPage, BASELINE } from "./cdp.mjs";
import { decode, stats } from "./imgdiff.mjs";

const times = process.argv.slice(2).map(Number);
if (!times.length) times.push(1.0, 4.5, 7.0, 15.2, 16.6, 22.5, 24.9, 27.5);
const OUT = path.resolve("experiments/out/hic"); fs.mkdirSync(OUT, { recursive: true });
const src = fs.readFileSync("C:/Users/mikke/Desktop/Projects/KRW-Extension/store/video/promo-video.html", "utf8");
const page = src
  .replace(`<div id="stage">`, `<canvas id="cv" width="1920" height="1080" layoutsubtree style="position:absolute;left:0;top:0;width:1920px;height:1080px"><div id="wrap" style="position:relative;width:1920px;height:1080px;overflow:hidden;background:#0b0c0f"><div id="stage">`)
  .replace(`<script>\n// Same EUR`, `</div></canvas><script>\n// Same EUR`)
  .replace(`window.DURATION = DURATION;`, `
const cv = $("cv"), cx = cv.getContext("2d");
window.snap = async t => {
  render(t);
  await new Promise(r => { cv.addEventListener("paint", r, { once: true }); cv.requestPaint(); });
  cx.clearRect(0, 0, 1920, 1080); cx.drawElementImage($("wrap"), 0, 0);
  return cv.toDataURL("image/png").split(",")[1];
};
window.DURATION = DURATION;`)
  // fit() would scale to the window; inside the canvas we want a fixed 1.5x stage
  .replace(`function fit() {`, `function fit() { $("stage").style.transform = "scale(1.5)"; return;`);
const file = path.join(OUT, "hic-page.html");
fs.writeFileSync(file, page);

const flags = ["--enable-features=CanvasDrawElement", "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const s = await launch({ browser: "shell", flags });
await openPage(s, "file:///" + file.replace(/\\/g, "/") + "?record");
const ref = await launch({ browser: "shell", flags });
await openPage(ref, BASELINE);
const results = [];
for (const t of times) {
  const a = Buffer.from(await s.evaluate(`snap(${t})`), "base64");
  await ref.evaluate(`render(${t})`);
  const b = Buffer.from((await ref.send("Page.captureScreenshot", { format: "png" })).data, "base64");
  const fa = path.join(OUT, `hic-${t}.png`), fb = path.join(OUT, `shot-${t}.png`);
  fs.writeFileSync(fa, a); fs.writeFileSync(fb, b);
  results.push({ t, ...stats(decode(fa), decode(fb)) });
}
s.close(); ref.close();
console.log(JSON.stringify(results, null, 0));
process.exit(0);
