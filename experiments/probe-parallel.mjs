// Aggregate capture throughput with N browsers × T tabs, sustained for a fixed duration.
//   node experiments/probe-parallel.mjs <browsers> <tabsPerBrowser> [format] [seconds] [flagset] [mode]
import { launch, connect, openPage, BASELINE } from "./cdp.mjs";

const [nb = "4", nt = "1", format = "png", secs = "20", flagset = "gpu", mode = "screenshot"] = process.argv.slice(2);
const FLAGSETS = {
  default: [],
  gpu: ["--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
};
const BF = ["--deterministic-mode", "--enable-begin-frame-control", "--run-all-compositor-stages-before-draw",
  "--disable-threaded-animation", "--disable-threaded-scrolling", "--disable-checker-imaging", "--disable-new-content-rendering-timeout"];
const flags = [...FLAGSETS[flagset], ...(mode === "beginframe" ? BF : [])];

const browsers = await Promise.all(Array.from({ length: +nb }, () => launch({ browser: "shell", flags })));
const pages = [];
for (const b of browsers) {
  const port = new URL(b.version.webSocketDebuggerUrl).port;
  const bws = await connect(b.version.webSocketDebuggerUrl);
  for (let i = 0; i < +nt; i++) {
    let p = b;
    if (i > 0 || mode === "beginframe") {
      const { targetId } = await bws.send("Target.createTarget", { url: "about:blank", enableBeginFrameControl: mode === "beginframe" });
      p = await connect(`ws://127.0.0.1:${port}/devtools/page/${targetId}`);
    }
    pages.push(p);
  }
}
await Promise.all(pages.map(async p => {
  if (mode !== "beginframe") return openPage(p, BASELINE);
  const nav = openPage(p, BASELINE); let done = false, k = 0; nav.then(() => done = true);
  while (!done) await p.send("HeadlessExperimental.beginFrame", { frameTimeTicks: 1000 + k++ * 16.7, interval: 16.7 }).catch(() => {});
}));

let frames = 0, bytes = 0, missing = 0;
const deadline = performance.now() + +secs * 1000;
const perSecond = [];
let lastFrames = 0;
const tick = setInterval(() => { perSecond.push(frames - lastFrames); lastFrames = frames; }, 1000);
await Promise.all(pages.map(async (p, w) => {
  let f = w * 997, tick = 0;
  while (performance.now() < deadline) {
    const t = ((f += 13) % 1800) / 60;
    await p.evaluate(`render(${t})`);
    let data;
    if (mode === "beginframe") data = (await p.send("HeadlessExperimental.beginFrame", { frameTimeTicks: 100000 + tick++ * 16.7, interval: 16.7, screenshot: { format, quality: 90, optimizeForSpeed: true } })).screenshotData;
    else data = (await p.send("Page.captureScreenshot", { format, quality: format === "png" ? undefined : 90, optimizeForSpeed: true })).data;
    if (!data) missing++;
    else { Buffer.from(data, "base64"); bytes += data.length * .75; }
    frames++;
  }
}));
clearInterval(tick);
browsers.forEach(b => b.close());
const fps = frames / +secs;
console.log(JSON.stringify({ browsers: +nb, tabs: +nt, workers: pages.length, format, flagset, mode, fps: +fps.toFixed(1),
  firstHalf: perSecond.slice(0, perSecond.length >> 1).reduce((a, b) => a + b, 0) / (perSecond.length >> 1),
  secondHalf: perSecond.slice(perSecond.length >> 1).reduce((a, b) => a + b, 0) / (perSecond.length - (perSecond.length >> 1)),
  MBps: +(bytes / +secs / 1e6).toFixed(1), missing }));
process.exit(0);
