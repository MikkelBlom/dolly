// Camera-only motion budget for the baseline: max on-screen displacement during a 180° shutter per frame,
// and the sample count N = clamp(ceil(L / gap), 1, 32) it implies. Element motion is ignored (lower bound).
//   node experiments/probe-blur-budget.mjs [gapPx]
import { launch, openPage, BASELINE } from "./cdp.mjs";
const gap = +(process.argv[2] || 1.5);
const s = await launch({ browser: "shell" });
await openPage(s, BASELINE);
const L = await s.evaluate(`(() => {
  const out = [], K = 1920 / 1280, fps = 60, sh = .5 / fps;
  // a world point at the screen edge moves most under zoom; take the max over corners and centre
  const pts = [[0,0],[1280,0],[0,720],[1280,720],[640,360]];
  const screen = (c, p) => { const wx = c.cx + (p[0] - 640) / c.s, wy = c.cy + (p[1] - 360) / c.s; return [wx, wy]; };
  for (let f = 0; f < 30 * fps; f++) {
    const t = f / fps, a = camera(t - sh / 2), b = camera(t + sh / 2);
    let m = 0;
    for (const p of pts) {
      const w = screen(a, p); // world point under screen point p at shutter open; where is it at close?
      const x = (w[0] - b.cx) * b.s + 640, y = (w[1] - b.cy) * b.s + 360;
      m = Math.max(m, Math.hypot(x - p[0], y - p[1]) * K);
    }
    out.push(m);
  }
  return out; })()`);
s.close();
const N = L.map(l => Math.min(32, Math.max(1, Math.ceil(l / gap))));
const hist = {}; for (const n of N) { const k = n === 1 ? "1" : n <= 4 ? "2-4" : n <= 8 ? "5-8" : n <= 16 ? "9-16" : "17-32"; hist[k] = (hist[k] || 0) + 1; }
console.log(JSON.stringify({ gapPx: gap, frames: L.length, maxDispPx: +Math.max(...L).toFixed(1), meanSamples: +(N.reduce((a, b) => a + b, 0) / N.length).toFixed(2), totalSubframes: N.reduce((a, b) => a + b, 0), hist }));
process.exit(0);
