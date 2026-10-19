// Single-tab capture cost per stage on the Price Peek baseline page.
//   node experiments/probe-capture.mjs [browser] [mode] [format] [frames] [flagset]
// browser: shell | chrome    mode: screenshot | beginframe    format: png | jpeg | webp
// flagset: default | gpu | swgl
import { launch, connect, openPage, BASELINE } from "./cdp.mjs";

const [browser = "shell", mode = "screenshot", format = "png", framesArg = "120", flagset = "default"] = process.argv.slice(2);
const FRAMES = +framesArg;
const FLAGSETS = {
  default: [],
  gpu: ["--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--enable-zero-copy"],
  swgl: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
};
const BF_FLAGS = ["--deterministic-mode", "--enable-begin-frame-control", "--run-all-compositor-stages-before-draw",
  "--disable-threaded-animation", "--disable-threaded-scrolling", "--disable-checker-imaging", "--disable-new-content-rendering-timeout"];

const flags = [...FLAGSETS[flagset], ...(mode === "beginframe" ? BF_FLAGS : [])];
const s = await launch({ browser, flags });
const result = { browser, product: s.version?.Browser, mode, format, flagset, frames: FRAMES };
try {
  let page = s;
  if (mode === "beginframe") {
    // beginFrame control must be requested when the target is created
    const bws = await connect(s.version.webSocketDebuggerUrl);
    const { targetId } = await bws.send("Target.createTarget", { url: "about:blank", enableBeginFrameControl: true });
    const port = new URL(s.version.webSocketDebuggerUrl).port;
    page = await connect(`ws://127.0.0.1:${port}/devtools/page/${targetId}`);
    await page.send("HeadlessExperimental.enable").catch(e => { result.enableError = e.message; });
  }
  const tLoad = performance.now();
  if (mode === "beginframe") {
    // pages under begin-frame control only progress when we issue frames
    const nav = openPage(page, BASELINE);
    let tick = 0, done = false; nav.then(() => done = true);
    while (!done) { await page.send("HeadlessExperimental.beginFrame", { frameTimeTicks: 1000 + tick++ * 16.6667, interval: 16.6667, noDisplayUpdates: false }).catch(() => {}); }
    await nav;
  } else await openPage(page, BASELINE);
  result.loadMs = Math.round(performance.now() - tLoad);
  const gpu = await page.evaluate(`(() => { const c = document.createElement('canvas').getContext('webgl'); if (!c) return 'no-webgl'; const e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; })()`);
  result.webglRenderer = gpu;

  let tRender = 0, tCap = 0, bytes = 0; const sizes = [];
  const t0 = performance.now();
  for (let f = 0; f < FRAMES; f++) {
    const t = (f / FRAMES) * 30;
    const a = performance.now();
    await page.evaluate(`render(${t})`);
    const b = performance.now();
    let data;
    if (mode === "beginframe") {
      const r = await page.send("HeadlessExperimental.beginFrame", { frameTimeTicks: 100000 + f * 16.6667, interval: 16.6667, screenshot: { format, quality: 90, optimizeForSpeed: true } });
      data = r.screenshotData;
      if (!data) result.missing = (result.missing || 0) + 1;
    } else {
      data = (await page.send("Page.captureScreenshot", { format, quality: format === "png" ? undefined : 90, optimizeForSpeed: true })).data;
    }
    const c = performance.now();
    tRender += b - a; tCap += c - b; bytes += data ? data.length * 0.75 : 0;
  }
  const total = performance.now() - t0;
  Object.assign(result, {
    renderMsPerFrame: +(tRender / FRAMES).toFixed(2), captureMsPerFrame: +(tCap / FRAMES).toFixed(2),
    fps: +(FRAMES / total * 1000).toFixed(1), avgKB: Math.round(bytes / FRAMES / 1024),
  });
} catch (e) { result.error = e.message; }
s.close();
console.log(JSON.stringify(result));
process.exit(0);
