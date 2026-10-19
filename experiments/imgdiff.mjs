// Per-pixel error stats between two images (decoded to rgb24 by ffmpeg).
//   node experiments/imgdiff.mjs a.png b.png [heatmap.png]
import { spawnSync } from "node:child_process";

export function decode(file) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 28 });
  return r.stdout;
}

export function stats(a, b) {
  let sum = 0, bias = 0, max = 0; const hist = new Array(9).fill(0);
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i], ad = Math.abs(d);
    sum += ad; bias += d; if (ad > max) max = ad;
    hist[Math.min(8, Math.ceil(Math.log2(ad + 1)))]++;
  }
  return { meanAbs: +(sum / a.length).toFixed(3), bias: +(bias / a.length).toFixed(3), max,
    over4: +((hist.slice(3).reduce((x, y) => x + y, 0)) / a.length * 100).toFixed(3) + "%" };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const [x, y, heat] = process.argv.slice(2);
  const a = decode(x), b = decode(y);
  console.log(JSON.stringify(stats(a, b)));
  if (heat) {
    const out = Buffer.alloc(a.length);
    for (let i = 0; i < a.length; i += 3) { const d = Math.min(255, (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) * 8); out[i] = d; out[i + 1] = d; out[i + 2] = d; }
    spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1920x1080", "-i", "-", heat], { input: out });
  }
}
