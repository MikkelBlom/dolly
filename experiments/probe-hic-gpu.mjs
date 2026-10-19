// HTML-in-Canvas + WebGL2 motion-blur accumulation, raw pixels POSTed to Node (no PNG, no base64).
// N iframes of the scene live inside one <canvas layoutsubtree>; each is rendered at its own sub-frame
// time, uploaded with texElementImage2D, linearised and summed into a float framebuffer, then
// converted back to sRGB with dither and read out once per output frame.
//   node experiments/probe-hic-gpu.mjs <workers> <samples> [seconds] [save-t]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { launch, openPage } from "./cdp.mjs";

const [wArg = "1", nArg = "16", secs = "15", saveT] = process.argv.slice(2);
const W = +wArg, N = +nArg;
const SRC = "C:/Users/mikke/Desktop/Projects/KRW-Extension/store/video";
const OUT = path.resolve("experiments/out/hicgpu"); fs.mkdirSync(OUT, { recursive: true });

const host = `<!doctype html><style>html,body{margin:0;background:#000;overflow:hidden}
#cv{position:absolute;left:0;top:0;width:1920px;height:1080px}
#cv iframe{position:absolute;left:0;top:0;width:1920px;height:1080px;border:0}</style>
<canvas id="cv" width="1920" height="1080" layoutsubtree>${'<iframe src="/promo-video.html?record"></iframe>'.repeat(N)}</canvas>
<script>
const cv = document.getElementById("cv"), frames = [...cv.querySelectorAll("iframe")];
const gl = cv.getContext("webgl2", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
const info = { floatRT: !!gl.getExtension("EXT_color_buffer_float") };
const W = 1920, H = 1080;
function prog(vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p); return p;
}
const VS = \`#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0, 1); }\`;
// accumulate: sRGB texel -> linear, weighted
const ACC = prog(VS, \`#version 300 es
precision highp float; in vec2 uv; uniform sampler2D tex; uniform float w; out vec4 o;
vec3 lin(vec3 c){ return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }
void main(){ vec4 c = texture(tex, vec2(uv.x, 1. - uv.y)); o = vec4(c.rgb * w, c.a * w); }  // SRGB8_ALPHA8 upload: sampling returns linear\`);
// resolve: linear -> sRGB with triangular dither, into an RGBA8 target
const RES = prog(VS, \`#version 300 es
precision highp float; in vec2 uv; uniform sampler2D acc; out vec4 o;
vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){ vec4 a = texture(acc, uv); vec2 q = gl_FragCoord.xy;
  float d = (h(q) + h(q + 17.17) - 1.) / 255.;
  o = vec4(srgb(clamp(a.rgb, 0., 1.)) + d, a.a); }\`);
const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
function target(internal, format, type) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, W, H, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { t, f };
}
const accT = target(gl.RGBA32F, gl.RGBA, gl.FLOAT), outT = target(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
const src = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, src);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
const pixels = new Uint8Array(W * H * 4);
const paint = () => new Promise(r => { cv.addEventListener("paint", r, { once: true }); cv.requestPaint(); });
window.ready = Promise.all(frames.map(f => new Promise(r => f.onload = r))).then(() => Promise.all(frames.map(f => f.contentWindow.ready))).then(() => info);
const timing = { render: 0, paint: 0, gpu: 0, read: 0, post: 0, n: 0 };
window.timing = timing;
// one output frame: stratified sub-frame times across a 180° shutter
window.frame = async (t, fps, shutter, n, post) => {
  const a = performance.now();
  for (let i = 0; i < n; i++) frames[i].contentWindow.render(Math.max(0, t + ((i + .5) / n - .5) * shutter / fps));
  const b = performance.now();
  await paint();
  const c = performance.now();
  gl.bindFramebuffer(gl.FRAMEBUFFER, accT.f); gl.viewport(0, 0, W, H);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(ACC); gl.uniform1f(gl.getUniformLocation(ACC, "w"), 1 / n);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src);
  for (let i = 0; i < n; i++) {
    gl.texElementImage2D(gl.TEXTURE_2D, gl.SRGB8_ALPHA8, frames[i]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, outT.f); gl.useProgram(RES);
  gl.bindTexture(gl.TEXTURE_2D, accT.t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.finish();
  const d = performance.now();
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const e = performance.now();
  if (post) await fetch(post, { method: "POST", body: pixels });
  const f = performance.now();
  timing.render += b - a; timing.paint += c - b; timing.gpu += d - c; timing.read += e - d; timing.post += f - e; timing.n++;
};
</script>`;

let received = 0, lastFrame = null;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (req.method === "POST") {
    const chunks = []; req.on("data", c => chunks.push(c));
    req.on("end", () => { lastFrame = Buffer.concat(chunks); received++; res.end("ok"); });
    return;
  }
  if (u.pathname === "/host.html") { res.setHeader("content-type", "text/html"); return res.end(host); }
  const p = path.join(SRC, path.basename(u.pathname));
  if (!fs.existsSync(p)) { res.statusCode = 404; return res.end(); }
  res.setHeader("content-type", "text/html"); fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port, POST = `http://127.0.0.1:${port}/frame`;
const FLAGS = ["--enable-features=CanvasDrawElement", "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--use-angle=d3d11"];

const ws = await Promise.all(Array.from({ length: W }, () => launch({ browser: "shell", flags: FLAGS })));
await Promise.all(ws.map(s => openPage(s, `http://127.0.0.1:${port}/host.html`)));
const info = await ws[0].evaluate("window.ready");

if (saveT) {
  // one frame to disk (readPixels is bottom-up; vflip) for visual and numeric comparison
  await ws[0].evaluate(`frame(${saveT}, 60, .5, ${N}, ${JSON.stringify(POST)})`);
  const file = path.join(OUT, `gpu-${N}-${saveT}.png`);
  spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", "1920x1080", "-i", "-", "-vf", "vflip", file], { input: lastFrame });
  const h = [];
  for (let k = 0; k < 2; k++) { await ws[0].evaluate(`frame(${saveT}, 60, .5, ${N}, ${JSON.stringify(POST)})`); h.push(crypto.createHash("sha1").update(lastFrame).digest("hex").slice(0, 10)); }
  console.log(JSON.stringify({ saved: file, repeatHashes: h }));
}

received = 0;
await Promise.all(ws.map(s => s.evaluate("Object.keys(timing).forEach(k => timing[k] = 0)")));
const deadline = performance.now() + +secs * 1000;
await Promise.all(ws.map(async (s, w) => {
  let f = w * 37;
  while (performance.now() < deadline) await s.evaluate(`frame(${((f += 7) % 1800) / 60}, 60, .5, ${N}, ${JSON.stringify(POST)})`);
}));
const tm = await ws[0].evaluate("timing");
const per = Object.fromEntries(Object.entries(tm).filter(([k]) => k !== "n").map(([k, v]) => [k, +(v / tm.n).toFixed(1)]));
ws.forEach(s => s.close()); server.close();
console.log(JSON.stringify({ workers: W, samples: N, info, fps: +(received / +secs).toFixed(1), subframesPerSec: Math.round(received * N / +secs), worker0MsPerStage: per }));
process.exit(0);
