// Does HTML-in-Canvas (WICG drawElementImage / layoutsubtree) work in this browser, and what does it cost?
//   node experiments/probe-html-in-canvas.mjs [chrome|shell]
import { launch } from "./cdp.mjs";

const browser = process.argv[2] || "chrome";
const s = await launch({ browser, flags: ["--enable-features=CanvasDrawElement", "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--enable-experimental-web-platform-features"] });
await s.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await s.send("Page.enable");
await s.send("Page.navigate", { url: "data:text/html,<!doctype html><body style='margin:0'></body>" });
await new Promise(r => setTimeout(r, 500));
const out = await s.evaluate(`(async () => {
  const c = document.createElement('canvas');
  c.width = 1920; c.height = 1080; c.setAttribute('layoutsubtree', '');
  c.innerHTML = '<div id="el" style="width:1920px;height:1080px;background:#eef1f6;font:800 120px sans-serif;color:#3355ff">Hello <span style="display:inline-block;transform:rotate(8deg)">world</span></div>';
  document.body.append(c);
  const ctx = c.getContext('2d');
  const api = {
    drawElementImage: typeof ctx.drawElementImage, drawElement: typeof ctx.drawElement,
    requestPaint: typeof c.requestPaint, onpaint: 'onpaint' in c,
    texElementImage2D: typeof (document.createElement('canvas').getContext('webgl2') || {}).texElementImage2D,
  };
  if (api.drawElementImage !== 'function' && api.drawElement !== 'function') return { api };
  const el = c.querySelector('#el');
  const paint = () => new Promise(r => { c.addEventListener('paint', r, { once: true }); c.requestPaint ? c.requestPaint() : requestAnimationFrame(() => r()); });
  await paint();
  const draw = () => api.drawElementImage === 'function' ? ctx.drawElementImage(el, 0, 0) : ctx.drawElement(el, 0, 0);
  let err; try { draw(); } catch (e) { err = String(e); }
  const px = ctx.getImageData(400, 60, 1, 1).data;
  const t0 = performance.now(); const N = 60;
  for (let i = 0; i < N; i++) {
    el.firstChild.textContent = 'Frame ' + i + ' ';
    await paint(); draw(); ctx.getImageData(0, 0, 1920, 1080);
  }
  return { api, err, samplePixel: [...px], msPerFrameWithReadback: (performance.now() - t0) / N };
})()`);
console.log(JSON.stringify({ browser, product: s.version.Browser, ...out }));
s.close(); process.exit(0);
