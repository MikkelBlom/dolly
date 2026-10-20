# Benchmarks

All numbers measured on Mikkel's laptop: Intel Core Ultra 9 285H (6P + 8E + 2LP-E, 16 threads), 63 GB RAM, RTX 5090 Laptop (driver 610.47), Windows 11. Scene: the Price Peek baseline page (`KRW-Extension/store/video/promo-video.html`), 1920×1080. Scripts live in `experiments/`; each row names the command so it can be re-run.

## Iteration 0: baseline and capture probes (2026-10-19)

### Baseline
| Setup | Result |
|---|---|
| `record.js`, Chrome 155 new headless, serial, PNG, 6 sub-frames, 1080p60, 30 s | ~20 min reported by Mikkel. Probe: **108 ms per capture → 9.2 captures/s**; 10,800 captures = 19.6 min. Matches. |

### Single tab, per stage (`node experiments/probe-capture.mjs <browser> <mode> <format> 120 <flags>`)
| Browser | Mode | Format | Flags | render(t) ms | capture ms | fps | KB/frame |
|---|---|---|---|---|---|---|---|
| Chrome 155 `--headless=new` | screenshot | PNG | default (uses D3D11 GPU) | 2.6 | 108 | 9.0 | 519 |
| headless-shell 151 | screenshot | PNG | default (SwiftShader) | 2.4 | 88 | 11.1 | 554 |
| headless-shell 151 | screenshot | JPEG q90 | default | 2.1 | 50 | 19.0 | 96 |
| headless-shell 151 | screenshot | WebP q90 | default | 2.1 | 129 | 7.7 | 43 |
| headless-shell 151 | screenshot | PNG | gpu (D3D11 raster) | 2.1 | 80 | 12.1 | 519 |
| headless-shell 151 | screenshot | JPEG q90 | gpu | 2.0 | 61 | 15.8 | 96 |
| headless-shell 151 | beginFrame | PNG | default | – | – | – | **no screenshot returned** |
| headless-shell 151 | beginFrame | PNG | gpu | 2.1 | 62 | 15.6 | 519 |

Notes: `HeadlessExperimental.beginFrame` still exists in chrome-headless-shell 151 (Playwright build 1234) and returns screenshots with GPU flags. Capture time is dominated by PNG encoding in the browser process; render(t) is 2 ms.

### Parallel, sustained 15 s (`node experiments/probe-parallel.mjs <browsers> <tabs> <format> 15 <flags> [mode]`)
| Browsers × tabs | Format | Flags | Mode | fps | 2nd-half fps |
|---|---|---|---|---|---|
| 1 × 1 | PNG | gpu | screenshot | 11.8 | 12.4 |
| 4 × 1 | PNG | gpu | screenshot | 43.1 | 43.1 |
| 8 × 1 | PNG | gpu | screenshot | 76.3 | 80.6 |
| 12 × 1 | PNG | gpu | screenshot | 106.5 | 108.9 |
| 16 × 1 | PNG | gpu | screenshot | 112.5 | 110.3 |
| 1 × 8 | PNG | gpu | screenshot | 38.0 | 39.5 |
| 4 × 3 | PNG | gpu | screenshot | 88.9 | 90.0 |
| 12 × 1 | JPEG | gpu | screenshot | 150.2 | 156.6 |
| 16 × 1 | JPEG | gpu | screenshot | 170.7 | 173.5 |
| 12 × 1 | PNG | gpu | beginFrame | 117.3 | 120.6 |
| 12 × 1 | PNG | default (SwiftShader) | screenshot | 82.0 | 81.8 |

GPU utilisation during runs: ~3 %. Separate browsers scale; tabs inside one browser do not (1 × 8 = 38 fps vs 8 × 1 = 76 fps).

### Motion blur accumulated by the compositor (`node experiments/probe-accum.mjs <N> 7.0 <dir> <flat|tree> <profile>`)
N iframes of the scene, each at its own sub-frame time, blended in the page; one screenshot per output frame. Compared against N separate captures averaged in float by ffmpeg (sRGB space, like `tmix`). Error in 8-bit levels.

| N | Layout | ms per output frame | separate captures, total ms | PSNR dB | mean abs err | max err |
|---|---|---|---|---|---|---|
| 8 | flat (opacity 1/N, plus-lighter) | 93 | 816 | 42.6 | 1.57 | 4 |
| 16 | flat | 108 | 1,609 | 35.6 | 3.57 | 8 |
| 32 | flat | 152 | 3,567 | 28.4 | 8.82 | 17 |
| 16 | **tree** (nested 50/50 pairs) | 122 | 1,608 | 48.3 | 0.70 | 4 |
| 32 | **tree** | 177 | 3,335 | 47.7 | 0.74 | 4 |
| 16 | flat, `--force-color-profile=scrgb-linear` | 124 | 1,620 | 35.6 | 3.57 | 8 |

The flat stack quantises every layer to 8 bits (error grows with N). The binary tree keeps error at ~0.7 levels (slight +0.7 bias) for any N. The linear colour profile does not change blending; the compositor blends sRGB values.

### Compositor accumulation in parallel, sustained 20 s (`node experiments/probe-parallel-accum.mjs <W> <N> 20`)
| Workers | Samples | Output fps | Sub-frames/s | Bit-identical across workers |
|---|---|---|---|---|
| 8 | 16 | 32.5 | 519 | yes |
| 12 | 16 | 36.8 | 589 | yes |
| 12 | 32 | 21.3 | 682 | yes |
| 12 | 4 | 68.7 | 275 | yes |

Baseline equivalent: 9.2 sub-frames/s.

### HTML-in-Canvas (`--enable-features=CanvasDrawElement`)
API present in Chrome 155 and headless-shell 151: `drawElementImage`, `captureElementImage`, `requestPaint`/`paint` event, WebGL2 `texElementImage2D(target, internalformat, element)` (RGBA8 / SRGB8_ALPHA8 / RGBA16F / RGBA32F).

Fidelity vs `captureScreenshot`, same t (`node experiments/probe-hic-fidelity.mjs`):
| t | mean abs err | max | pixels off by > 4 levels |
|---|---|---|---|
| 1.0 | 0.013 | 2 | 0 % |
| 4.5 | 0.244 | 161 | 0.47 % |
| 7.0 | 0.069 | 155 | 0.10 % |
| 15.2 | 0.396 | 157 | 0.95 % |
| 16.6 | 0.365 | 155 | 0.81 % |
| 22.5 | 0.206 | 174 | 0.57 % |
| 24.9 | 0.315 | 104 | 1.04 % |
| 27.5 | 0.001 | 2 | 0 % |
Differences sit on anti-aliased edges of 3D-tilted cards and text; nothing missing.

GPU linear-light accumulation (N iframes in a layoutsubtree canvas → `texElementImage2D` SRGB8_ALPHA8 → float FBO → sRGB + dither → `readPixels` → binary POST to Node), 1 worker (`node experiments/probe-hic-gpu.mjs 1 <N> 8`):
| N | fps | render ms | paint ms | GPU submit ms | readPixels ms | POST ms |
|---|---|---|---|---|---|---|
| 1 | 11.5 | 1.1 | 5.2 | 5.9 | 31.7 | 42.4 |
| 4 | 5.5 | 2.8 | 7.0 | 25.4 | 105.8 | 40.6 |
| 16 | 2.0 | 10.0 | 7.8 | 165.2 | 290.4 | 41.9 |
Correct output, deterministic (repeat hashes match), but ~28 ms per sub-frame vs ~5.5 ms for the compositor tree. Not the fast path in this build.

### Blur budget from camera motion (`node experiments/probe-blur-budget.mjs <gap>`)
Camera only (element motion ignored, so a lower bound), 180° shutter, 1080p60, 30 s = 1,800 frames.
| gap px | max displacement per shutter | mean samples | total sub-frames | frames by N: 1 / 2–4 / 5–8 / 9–16 / 17–32 |
|---|---|---|---|---|
| 1.5 | 129.8 px | 1.80 | 3,239 | 1645 / 51 / 35 / 39 / 30 |
| 4 | 129.8 px | 1.33 | 2,388 | 1681 / 63 / 37 / 12 / 7 |
Baseline: fixed 6 → 10,800 sub-frames.

## Iteration 1: first full pipeline on the Price Peek port (2026-10-19)

12 workers (headless-shell 151, GPU raster, one browser each), PNG capture, compositor-tree blur (gap 1.5 px, Nmax 32, 180° shutter), NVENC `youtube` preset (`h264_nvenc p7 hq`, CQ 16). Commands: `node experiments/try-render.ts draft|final`.

| Render | Wall | Start-up (12 browsers) | Plan | Render + encode | Output fps | Sub-frames/s | vs baseline (20 min) |
|---|---|---|---|---|---|---|---|
| Draft 960×540, 30 fps, no blur, NVENC p1 | **11.0 s** | 5.2 s | – | 5.7 s | 159 | 159 | 109× |
| Final 1080p60, adaptive blur, no cache | **48.9 s** | 4.4 s | 1.6 s | 38.7 s | 46.5 | 375 | 24.5× |
| Final, warm cache (1,800 hits) | 16.7 s | ~5 s | cached | 6.9 s (read + encode) | – | – | – |
| Final after editing one scene (`end`, 280 frames re-rendered) | 22.2 s | ~5 s | cached | 9.9 s | – | – | – |

Adaptive sample histogram (frames by N): 1: 774 · 2: 124 · 4: 151 · 8: 280 · 16: 277 · 32: 194. Total 14,506 sub-frames (baseline: 10,800 fixed). Max motion 129.8 px per shutter (the whip). 11 frames get the camera smear.

**Corrections found while measuring** (earlier numbers in this iteration were wrong and are not reported):
- With 32 full-HD documents per host, Chromium's default GPU tile budget silently dropped layers on heavy-blur frames: content vanished and renders looked *faster* (44.7 s). Fixed with `--force-gpu-mem-available-mb=12000`.
- `will-change: transform` on masked text made text sharpness depend on render history (layers keep the raster scale of their first paint). Fixed (removed) and now a lint error.

Blur accuracy after the fixes (`node experiments/verify-blur.ts`): compositor 32-sample frame vs 32 separate captures averaged in float:
| t | mean abs | max | > 4 levels |
|---|---|---|---|
| 6.98 (whip) | 0.80 | 4 | 0.03 % |
| 19.3 (dolly) | 0.65 | 4 | 0.005 % |
A host sample at N=1 is bit-identical to the plain page.

Port fidelity vs the original page (`node experiments/compare-baseline.ts`, 18 times, no blur): mean abs error 0–0.70 levels per frame; the remaining differences are the background dot grid's phase (generalised parallax maths) and text anti-aliasing.

## Iteration 2: after the acceptance-test fixes (2026-10-19)

Same machine and project. The blur host now waits for every scene document to be fully ready (a race could leak the t=0 frame into early blurred frames), and the cache was invalidated (`RENDERER` 8).

| Render | Wall | Start-up | Plan | Render + encode | Output fps | vs baseline (20 min) |
|---|---|---|---|---|---|---|
| Draft 960×540, 30 fps, no blur (`dolly draft`, no cache) | **9.8 s** | – | – | – | – | 122× |
| Final 1080p60, adaptive blur, no cache (`dolly render`) | **41.7 s** | 3.1 s | 1.4 s | 32.9 s | 54.6 | 28.8× |

Blur: 14,490 sub-frames (N: 1 → 774 frames, 2 → 124, 4 → 155, 8 → 276, 16 → 277, 32 → 194); 11 frames smeared.

`dolly bench examples/price-peek` (12 workers, 1080p):
| Stage | fps | ms/frame | Note |
|---|---|---|---|
| render(t) in page, 1 worker | 673.6 | 1.5 | the scene's own JS + style/layout |
| capture PNG, 1 worker | 10.4 | 95.8 | raster + PNG encode + base64 over CDP; 582 KB/frame |
| plan (motion), 12 workers | 334.7 | 3.0 | |
| capture 1 sample, 12 workers | 98.7 | 10.1 | |
| capture 8 samples (compositor blur), 12 workers | 49.1 | 20.4 | 393 sub-frames/s |
| capture 32 samples, 12 workers | 20.1 | 49.7 | 644 sub-frames/s |
| encode youtube (PNG decode + h264_nvenc p7) | 133.6 | 7.5 | |
| encode draft (PNG decode + h264_nvenc p1) | 349.3 | 2.9 | |

Bottleneck: Chromium's PNG encode in capture (CPU). Encoding (133 fps) outruns capture, so it overlaps fully.

Acceptance test (fresh agent, Snapnote, 15 s, from a one-paragraph brief, `examples/snapnote`): draft 6.2 s, final 1080p60 25.4 s, `sheet` ~3 s, `lint` ~3.6 s.

## Iteration 3: warm daemon and browserless cached renders (2026-10-20)

Same machine, `examples/price-peek` (12 workers, 1080p unless noted). Wall time of real CLI invocations from a fresh `node` process (what an agent pays per call), median of 3, measured with a small harness that spawns `node packages/cli/bin/dolly.ts <args> --json`. "Before" is the previous code (commit adeb05d, identical render code to this branch's base), run against the same project with its own cache. "Warm" = with `dolly daemon examples/price-peek --detach` running; the commands are unchanged (the CLI finds the daemon by itself).

| Command | Before | After, cold (no daemon) | After, warm daemon | Speed-up (warm vs before) |
|---|---|---|---|---|
| `dolly info` | 2.14 s | 2.33 s | **0.17 s** | 12.6× |
| `dolly still --times 2,7,14` | 2.42 s | 2.63 s | **0.27 s** | 9.0× |
| `dolly still --times 2,7,14 --blur` (after the first, which opens the blur hosts: 1.71 s) | – | – | **0.32 s** | – |
| `dolly sheet` (4×3) | 3.16 s | 3.57 s | **0.54 s** | 5.9× |
| `dolly lint` | 4.58 s | 4.56 s | **1.62 s** | 2.8× |
| `dolly render`, all 1,800 frames cached | 16.19 s | **7.49 s** (0 browsers) | 7.74 s | 2.2× |
| `dolly draft`, all frames cached | 4.87 s | **1.07 s** (0 browsers) | 1.40 s | 4.6× |
| `dolly draft --no-cache` | – | 10.17 s | **6.10 s** | 1.7× (vs cold) |

- Daemon start-up (`dolly daemon … --detach`, returns when serving): 4.5–6.3 s, paid once; it stops after 30 idle minutes.
- After the source changes, the first warm command includes a rebuild (~40 ms) and a page reload of all 12 workers: `info` right after editing a scene 0.53 s; `still` after recovering from a scene that threw at load 0.51 s. Switching output size (sheet at 1080p right after a 960×540 draft) costs a reload: sheet 0.73–0.82 s instead of 0.54 s.
- Two clients at once are queued: `sheet` + `still` started together finish in 0.85 s.
- The cold path is unchanged within noise: an interleaved A/B of `sheet` (old vs new code, 4 rounds) gave 3.19–3.41 s vs 3.36–3.75 s (the first round of each, 4.8/4.5 s, was a font-cache warm-up).
- Fully cached render, what is left: 6.7 s of the 7.5 s is reading 1,800 cached PNGs and re-encoding them (PNG decode + NVENC p7); `startMs` 0, `workers` 0.

**Output identity.** `--json` stdout is byte-identical cold vs warm for `info`, `still`, `sheet` and `lint`, and for build errors (syntax error) and load errors (a scene that throws). Pixels: 8 stills (with and without blur) cold vs warm differ by at most 1 level on 3–5 of 8 frames; two cold runs differ the same way (Chromium's known raster noise).

**Bug found while measuring.** `launch()` picked debugging ports as `9500 + random(300)` per process. With a daemon holding 12 ports, a cold CLI run picked a taken port and *attached to the daemon's browser* via `/json/version` (its tabs showed up inside the daemon's Chromiums; the next warm blurred still hung). Now `--remote-debugging-port=0` and the port is read from `DevToolsActivePort`. The collision was possible before too, between any two concurrent dolly processes.

**Environment note.** fonts.gstatic.com reset connections for several minutes during this session (curl too); every cold Price Peek command failed with `NetworkError` until it recovered. No numbers above come from that window.
