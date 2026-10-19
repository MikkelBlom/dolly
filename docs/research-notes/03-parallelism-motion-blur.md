# 03 — Parallel rendering and correct motion blur

Research date: 2026-10-19. Web research only, nothing was benchmarked locally. Labels used below:
**[sourced]** means a URL backs the claim. **[estimate]** means my own arithmetic or engineering
judgement. Measure anything marked [estimate] before relying on it.

Target machine: Intel Core Ultra 9 285H (6 P-cores, 8 E-cores, 2 LP-E cores, 16 threads, no SMT),
63 GB RAM, RTX 5090 Laptop GPU with 24 GB, Windows 11.

Baseline: 30 s at 1080p60 is 1,800 output frames. Six sub-frames each gives 10,800 serial
`render(t)` + screenshot calls in about 20 minutes. That works out to **~111 ms per sub-frame,
end to end** [estimate, derived from the numbers above]. Each output frame is the `tmix` average of
its 6 sub-frames.

---

## TL;DR recommendations

| Topic | Recommendation |
|---|---|
| Pool size | Start at **W = 8 tabs**, spread over **2–4 browser instances** (2–4 tabs each). Sweep W ∈ {4, 6, 8, 10, 12} on a run of at least 3 minutes so the result reflects sustained power, not turbo. Remotion's default formula gives 8 on this machine too. |
| Scheduling | Use a **dynamic queue of contiguous chunks** (about 30–60 output frames each). Each tab renders all sub-samples of a frame back to back. Avoid static equal slices, because adaptive sampling makes per-frame cost vary by up to 32×. |
| Encode topology | Accumulate in Node, then feed **one ffmpeg in frame order** through a bounded reorder buffer. Use h264/hevc_nvenc, or x264 if CPU headroom allows. Per-chunk encodes plus `concat -c copy` is the fallback if one encoder becomes the bottleneck. |
| Screenshot | Use PNG with `optimizeForSpeed: true` (zlib level 1). Never capture JPEG frames for accumulation. |
| Accumulation | Convert sRGB to linear with a LUT, sum into a Float32 (or Uint32 fixed-point) accumulator, divide, encode back to sRGB, and add ±0.5 LSB triangular dither before quantising to 8 bit. Do this in Node, not in ffmpeg `tmix`, which averages the encoded values directly. |
| Sample count | `N = clamp(ceil(L / g), 1, 32)`, where L is the maximum on-screen displacement in px during the shutter interval and g is the allowed gap: **1.5 px** with no smear, **4–6 px** with smear. |
| Hybrid | N samples plus one **directional box blur of length g along the camera-motion vector**, applied in linear light. This is EEVEE's approach: accumulation steps, with post-process blur covering the gaps between steps. |
| Shutter | 180°, **centred** on the frame time: t ∈ [t₀ − T/4, t₀ + T/4], with T = 1/60 s. Use stratified sample times at the centres of the N sub-intervals. |

---

## Part A — Parallelism

### A1. Worker count, hybrid cores, thermals

**Hardware facts [sourced]**
- Intel ARK lists the 285H as 6 P + 8 E + 2 LP-E cores. P-cores turbo to 5.4 GHz, E-cores to 4.5 GHz, LP-E cores to 2.5 GHz. **Processor Base Power is 45 W, Maximum Turbo Power is 115 W, and Minimum Assured Power is 35 W.**
  https://www.intel.com/content/www/us/en/products/sku/241747/intel-core-ultra-9-processor-285h-24m-cache-up-to-5-40-ghz/specifications.html
- The 45 W budget is shared with the iGPU, and laptop OEMs move the power targets up or down to suit their cooling.
  https://www.club386.com/intel-core-ultra-9-285h-delivers-a-28-uplift-over-185h
- I found no review with PL1/PL2 time-series logging for the 285H. On Notebookcheck its Cinebench R23 multi-core results span a wide range across OEM power configurations (median about 20.5k, max about 23.6k).
  https://www.notebookcheck.net/Intel-Core-Ultra-9-285H-Processor-Benchmarks-and-Specs.944114.0.html

**What this means [estimate]**
- A burst test of 30–60 s runs at PL2 (up to 115 W). After the turbo time window, the chip falls back toward PL1 (45 W, or whatever this OEM configured). That fallback costs roughly 25–40% of all-core clock. **Benchmark the pool size on a render of at least 3 minutes**, or W will look better than it really is.
- Skymont E-cores are much stronger than earlier E-cores. A Chromium renderer main thread on an E-core will be maybe 60–75% as fast as on a P-core. The 2 LP-E cores sit on the SoC tile at 2.5 GHz. Count them as near zero for rendering, and let OS and background work run there.
- Effective core budget ≈ `P + 0.65·E + 0·LP = 6 + 5.2 ≈ 11`. Each worker is more than one thread of load: the renderer main thread, raster and compositor threads, a share of the GPU process, and Node-side PNG decode and accumulation. So roughly 1.3–1.5 cores per worker, which gives W ≈ 7–9. **Start at 8.**

**Windows scheduling [partly sourced]**
- Windows assigns QoS by window state: foreground gets high, visible gets medium, minimised or background gets low. **EcoQoS threads are steered to E-cores** by Thread Director.
  https://www.techrepublic.com/article/ecoqos-gives-windows-11-apps-better-battery-life/
  AnandTech (12th-gen review) gives a background browser tab as its example of work that goes to E-cores:
  https://at-web1.www.anandtech.com/show/17047/the-intel-12th-gen-core-i912900k-review-hybrid-performance-brings-hybrid-complexity/3
- Chromium applies EcoQoS to processes it considers backgrounded. User reports name the feature `UseEcoQoSForBackgroundProcess`, disabled with `--disable-features=UseEcoQoSForBackgroundProcess`. One 2026 article says the flag no longer works in current Chrome. These are forum and blog sources, not official Chromium documentation.
  https://forum.vivaldi.net/post/697470 · https://www.lifehacker.jp/article/2602-hacks-every-google-chrome-user-should-know/
- **Unverified:** I found no source on whether *headless* renderers get marked as background. Mitigations to apply anyway:
  - Launch flags: `--disable-renderer-backgrounding --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-features=UseEcoQoSForBackgroundProcess,CalculateNativeWinOcclusion`
  - Run on AC power with the "Best performance" power mode.
  - Check the Task Manager "Efficiency mode" column during a render. If chrome.exe children show the leaf icon, the flags did not take effect.
  - Last resort: raise the priority class or clear power throttling on child PIDs from Node via `SetProcessInformation(ProcessPowerThrottling)`, or use Process Lasso.

**Remotion's sizing [sourced]**
- `resolveConcurrency(null)` returns **half the CPU count, clamped to [1, 8]**. It also accepts a number or a percentage string, and throws above `os.cpus().length` or below 1. Source: `packages/renderer/src/get-concurrency.ts`:
  https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/get-concurrency.ts
  The `renderMedia()` docs say the default is "half the available CPU threads": https://www.remotion.dev/docs/renderer/render-media
  On this machine that is 16/2 = 8.
- Remotion publishes **no concurrency scaling numbers**. Its docs only say concurrency that is too high or too low both hurt, and that `npx remotion benchmark` should be used to find the optimum. The tool runs a render `--runs` times (default 3) for each value in a comma-separated `--concurrencies` list.
  https://www.remotion.dev/docs/performance · https://www.remotion.dev/docs/cli/benchmark · https://www.remotion.dev/docs/terminology/concurrency
- In Remotion, local concurrency means **N tabs in one browser**, and frames render out of order. Components must be pure functions of the frame number.
  https://www.remotion.dev/docs/flickering · https://www.remotion.dev/docs/terminology/concurrency
- Remotion also defaults to **JPEG** frames because they are fastest, and uses PNG only when transparency is needed. That suits encoding, but not accumulation, as explained in A3.
  https://www.remotion.dev/docs/renderer/render-media

**Pool-sizing formula (recommended)**
```
W0 = round((P + 0.65*E) / 1.4)        // = 8 on 285H
sweep W in {W0-4, W0-2, W0, W0+2, W0+4} on a >=3-minute render, plugged in
pick smallest W within 5% of best sustained throughput (headroom for thermals/encoder)
```
Expected scaling [estimate]: near-linear up to about 6, flattening between 8 and 10, regressing
past about 12 as power, memory bandwidth and the GPU process become limits. If the RTX 5090
is not actually used for compositing (check `chrome://gpu` from a headless capture, per
https://chromium.googlesource.com/chromium/src.git/+/lkgr/docs/gpu/using-gpu-hardware-in-headless-chrome.md),
rasterisation lands on the CPU and the knee comes earlier.

### A2. Scheduling; one browser with many tabs vs many browsers

**Contiguous chunks vs interleaving**
- Each output frame needs N sub-frames at t₀ + δᵢ. **Keep a frame's sub-samples on one tab.** The scene state is coherent, the accumulator lives in one place, and nothing has to cross between workers.
- With adaptive N, per-frame cost varies from 1× to 32×. A whip-pan section can cost 30 times more than a static title card. **Static equal slices therefore load-balance badly.**
- Recommended: a **dynamic work queue of contiguous chunks** of C ≈ 30–60 output frames, handed out in frame order. Workers that finish early pull the next chunk.
  - Chunk locality keeps the scene warm (decoded images, layout caches).
  - In-order dispatch keeps the reorder buffer small (see A3).
  - Shrinking C near the end of the timeline (e.g. C = 8) avoids a long tail on the last worker.
- Interleaving (frame i goes to worker i mod W) balances naturally and keeps the reorder buffer tiny, but each tab jumps through the timeline. That is fine only if `render(t)` is truly pure and cheap to jump. It is a valid alternative if chunking shows tail problems.

**One browser with N tabs vs N browsers**
- Chromium historically runs **one GPU process per browser instance**, serving every renderer through multiplexed command buffers. The cited article says that GPU process is single-threaded. This source is from 2010 (Chrome 7 era). Current Chromium still has one GPU process per browser, which can be seen in Chrome's Task Manager. The display compositor (Viz) is a shared service with mutually distrusting clients.
  https://legitreviews.com/?p=8883 · https://blog.chromium.org/2010/08/chromium-graphics-overhaul.html · https://chromium.googlesource.com/chromium/src/+/main/services/viz/README.md
- **So N tabs in one browser share one GPU process and one Viz.** Raster, compositing and the readback for `Page.captureScreenshot` all funnel through it, which can serialise work. I found **no published measurement** of this contention for screenshot workloads. The search turned up only general advice that pages in a browser share memory and CPU and stop scaling past some point, with figures of about 150–200 MB per extra browser.
  https://screenshotone.com/blog/bulk-screenshots-with-puppeteer/ · https://www.browserless.io/blog/optimizing-puppeteer
- **Recommendation [estimate]:** use **B browsers × T tabs**, with B = 2–4 and T = 2–4. This gives several GPU processes, so readback and compositing are not serialised behind one, while memory overhead stays bounded. With 63 GB of RAM, memory is not the constraint. Benchmark 1×8, 2×4, 4×2 and 8×1 at W = 8. Expect 8×1 or 4×2 to win when screenshot readback dominates.
- Each tab needs its own `Page.captureScreenshot` loop. Puppeteer screenshots in the same browser serialise per target, not globally, but they share the GPU process.

### A3. Encode topology and where the bottleneck moves

**Per-sub-frame pipeline cost [sourced where marked, otherwise estimate]**

| Stage | Notes |
|---|---|
| `render(t)` + layout/paint/raster | Depends on the scene. CSS blur, shadows and gradients are GPU-dependent (https://www.remotion.dev/docs/performance). |
| PNG encode in the browser | CDP `captureScreenshot` has `optimizeForSpeed`, which restricts compression to zlib q1 / RLE (https://screenshotone.com/blog/optimize-for-speed-when-rendering-screenshots-in-puppeteer-and-chrome-devtools-protocol). JPEG/WebP capture is reported as about **3× faster** than PNG (https://npmjs.org/package/testcafe-browser-provider-chromex). |
| base64 + WebSocket IPC | Fast-mode 1080p PNG is about 2–5 MB, plus 33% for base64, decoded on Node's main thread. Several MB per shot at 100+ shots/s means hundreds of MB/s of JSON/base64 per Node process. **Run one Node worker_thread or process per browser** so this isn't funnelled through one event loop. |
| PNG decode in Node | `sharp`/libvips or `@napi-rs/image`, not pure-JS pngjs. Expect about 5–15 ms per 1080p fast-mode PNG [estimate]. |
| Accumulate | See B6. About 5–15 ms per sample in plain JS with a LUT; about 1–3 ms with WASM SIMD or N-API [estimate]. |
| Encode final frame | 1,800 frames total. x264 `medium` at 1080p runs at an estimated 60–150 fps on this CPU, but competes with Chromium. NVENC costs almost no CPU. |

**Do not capture JPEG for accumulation.** JPEG's 8×8 block and chroma artefacts differ between
sub-frames, and averaging turns them into structured noise. Capture lossless PNG and encode once
at the end.

**Topology options**
1. **Single ffmpeg, in-order (recommended).** Node accumulates each output frame and writes raw `rgb24` (or `rgb48le` if dithering happens in ffmpeg) to one ffmpeg's stdin, in frame order, through a **bounded reorder buffer**.
   - Buffer size ≈ W × C × 6.2 MB (1080p rgb24). With W = 8 and C = 30 that is about 1.5 GB worst case, fine with 63 GB.
   - Back-pressure: stop handing out chunks more than K chunks ahead of the write head.
   - Pros: no concat seams, one rate-control pass, simple.
   - The encoder sees only 1,800 frames, which is not where the time goes. The bottleneck stays in capture.
2. **Per-chunk encodes + lossless concat.** Each chunk is encoded by its own ffmpeg with identical parameters and a closed GOP starting with an IDR (x264: `-g C -keyint_min C -sc_threshold 0 -x264-params open-gop=0`; NVENC: `-forced-idr 1` plus a fixed `-g`). Then `ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4`.
   - The concat demuxer requires **all files to have the same streams, codecs, time base and so on**. A wrong file duration causes gaps or artefacts.
     https://ffmpeg.org/ffmpeg-formats.html#concat
   - This also gives resumable renders, since a crashed chunk can be re-run.
   - Downsides: forced keyframes every C frames, rate control per chunk, more processes.
   - Use it only if option 1 proves encoder-bound, or if resumability matters.

**NVENC limits [sourced, sources conflict]**
- NVIDIA Video Codec SDK 13.0 application note: "On non-qualified GPUs [GeForce], the number of concurrent encode sessions is limited to **8 per system**." A forum quote of SDK 12.2 says this needs Windows driver ≥ 551.76.
  https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/nvenc-application-note/index.html · https://forums.developer.nvidia.com/t/how-to-increase-number-of-nvenc-concurrent-sessions/169367
- The current NVIDIA support matrix, fetched today, lists **12** concurrent sessions for GeForce rows, and **3 NVENC engines** for the GeForce RTX 5090 Laptop GPU.
  https://developer.nvidia.com/video-encode-and-decode-gpu-support-matrix-new
- History: 2 → 3 sessions around 2020, then 3 → 5 with driver 531.41 in 2023.
  https://tomshardware.com/news/nvidia-increases-concurrent-nvenc-sessions-on-consumer-gpus · https://www.techspot.com/community/topics/nvidia-geforce-users-can-now-encode-more-simultaneous-streams.279727/
- **Practical upshot:** the cap is at least 8 on current drivers, and the matrix suggests 12. Only 3 hardware engines exist, so more than 3 concurrent NVENC sessions adds little throughput. For option 2, cap NVENC chunk encoders at 3. For option 1, use one `hevc_nvenc`/`h264_nvenc` session (e.g. `-preset p7 -tune hq -rc vbr -cq 18 -b:v 0`). That frees every CPU core for Chromium.

**Where the bottleneck moves [estimate]**
1. Serial baseline: one tab, latency-bound at 111 ms per shot. CPU and GPU are mostly idle.
2. W = 8: limited by the CPU power budget (PL1) across renderer threads and PNG encode, plus GPU-process readback if all tabs are in one browser.
3. Node: base64 decode and PNG decode become visible above about 60–80 shots/s per Node event loop. Spread the work over worker_threads.
4. Encoder: x264 CPU encode steals cores from Chromium. NVENC removes that.
5. Disk is not a factor if frames are streamed. Writing 10,800 PNGs to disk (about 30–50 GB) and decoding them in ffmpeg is avoidable I/O and decode work. Keep frames in memory.

**Throughput estimate [estimate]**: with adaptive sampling averaging about 8–10 sub-frames per
output frame (about 15–18k shots), and W = 8 at about 5–6× effective speed-up under sustained
power, the render takes **~5–7 min**. That compares with 20 min today at only 6 samples.

---

## Part B — Motion blur done right

### B4. Shutter angle and phase conventions

- **Shutter angle** θ: the exposure time is (θ/360°) × frame duration. **180° is the conventional film setting.** At 60 fps, 180° means 1/120 s, about 8.33 ms. 360° means the shutter is open for the whole frame interval, which RenderMan documents as "360 = open for entire frame".
  https://www.provideocoalition.com/motion_blur/ · https://renderman.pixar.com/resources/RenderMan_20/rfkMotionBlur.html
- **Shutter phase** (After Effects): before CS3 the default was 0°, so blur trailed forward from the frame. Since CS3 the default is **−θ/2 (−90° for 180°)**, which centres the samples on the frame time.
  https://www.provideocoalition.com/motion_blur/
- **Blender** (Cycles and EEVEE) uses *Position*: Start on Frame, Center on Frame, or End on Frame. *Shutter* is measured in frames (0.5 = 180°). Cycles also has a shutter curve (default: instant open and close) and rolling shutter.
  https://docs.blender.org/manual/en/latest/render/cycles/render_settings/motion_blur.html · https://docs.blender.org/manual/en/latest/render/eevee/render_settings/motion_blur.html
- **RenderMan** uses shutterOpen/shutterClose plus `shutteropening` to control open and close speed (a trapezoid shutter).
  https://renderman.pixar.com/resources/RenderMan_20/rfkMotionBlur.html
- **Recommendation:** use 180°, centred. Sample times are `tᵢ = t₀ + (−0.5 + (i+0.5)/N) · S` with S = (θ/360)/fps and i = 0…N−1. This is the stratified midpoint rule. Always include the exact t₀ sample when N is odd, so the "still" frame matches the unblurred design. A centred shutter keeps the blurred object centred on its keyframed position, which matters for text and UI that must read cleanly at hold frames. A trapezoid or Gaussian-ish shutter weighting (e.g. tent weights in `w_i`) softens the ends of the blur streak and makes stepping less visible at a given N.

### B5. How many samples: adaptive sub-sampling

**What tools do [sourced]**
- **After Effects:**
  - *Samples Per Frame* applies to 3D layers, shape layers and some effects (max 64; old default 16).
  - *Adaptive Sample Limit* is the **maximum** number of sub-frames for 2D layers (up to 256). AE "can look at a layer and decide how many subframes it needs to avoid visible echoes, up to this maximum."
  - Adobe does not publish the exact rule. It is inferred to scale with the layer's motion in pixels.
  - Practitioner advice: max both settings, and lower Samples Per Frame only until echoes appear.
  - https://www.provideocoalition.com/motion_blur/ · https://www.provideocoalition.com/cmg_hidden_gems_chapter_8_motion_blur_and_more/
- **Blender EEVEE:** *Steps* is the number of accumulation time steps. The manual says the technique "is precise but requires many steps for clean gradients", that "this is used in combination with the post-process blur to handle the inter-step gaps", and that each step is a full scene re-evaluation. *Max Blur* caps the post blur radius in pixels. That combination is exactly the hybrid recommended below.
  https://docs.blender.org/manual/en/latest/render/eevee/render_settings/motion_blur.html
- **RenderMan:** blur is on when `maxTimeSamples > 1`. Xform/geo time samples add motion segments so curved paths stay curved. Heavy blur needs more pixel samples.
  https://renderman.pixar.com/resources/RenderMan_20/rfkMotionBlur.html · https://github.com/prman-pixar/RenderManForBlender/wiki/Motion-Blur-21
- **Accumulation buffer** (Haeberli & Akeley, SIGGRAPH '90): render the whole scene once per time sample and sum the passes in a high-precision buffer. Too few samples produces "a series of disjoint ghosting artifacts in the direction of motion".
  https://www.microsoft.com/en-us/research/publication/the-accumulation-buffer-hardware-support-for-high-quality-rendering/ · https://arxiv.org/pdf/2210.06159

**Quantifying stepping [estimate, first principles]**
With N uniform samples over a blur of length L px, adjacent copies sit about `g = L/N` apart.
Copies merge into a continuous smear once g is no more than the width of the edge transition.
- A crisp anti-aliased edge transition is about 1 px wide. At **g ≤ 1 px** nothing is visible.
- At **g ≈ 1.5–2 px**, a faint ripple shows only on hard, high-contrast edges such as text and UI lines.
- At **g ≥ 3–4 px**, distinct ghost copies are visible. That is the "stepped ghosting" seen today.

Whip-pan example: the camera crosses one screen width (1,920 px) in 0.25 s, which is 7,680 px/s
and 128 px per frame at 60 fps.
- A 180° shutter gives **L = 64 px**.
- Today's N = 6 gives **g ≈ 10.7 px**, clearly stepped, which matches what is observed.
- No smear: g = 1.5 px needs N ≈ 43; g = 2 px needs N = 32.
- With smear, a 6 px gap needs **N ≈ 11**.

**Computing L per output frame from the scene graph (recommended)**
```
for each output frame t0, shutter window [ta, tb]:
  for each visible element e (incl. camera as a transform on everything):
     sample screen-space positions of e's bbox corners (or a few key points)
     at K = 3–5 times across [ta, tb]  (catches curved paths / springs)
     L_e = max over points of polyline length of that point's screen path
           (include rotation: corner path length; include scale: corner motion)
  L = max_e L_e          // optionally weight by e's on-screen contrast/area
N  = clamp(ceil(L / g), 1, NMAX)    // g = 1.5 px pure sampling; g = 4–6 px with smear
NMAX = 32 (64 for extreme whip-pans if budget allows)
if N > 1 and N even and you want the exact t0 sample: N += 1 (optional)
```
- The camera transform's contribution (velocity × zoom, plus rotation about the screen centre ×
  the radius to the frame corner) usually dominates. Computing it analytically is cheap and
  needs no rendering.
- Because each frame depends only on its own L, N is computed *before* rendering. That gives the
  scheduler a cost estimate per chunk (cost ∝ ΣN), which helps it balance load.
- Hysteresis: smooth N across neighbouring frames (e.g. the max over a window of ±2 frames) so blur
  quality does not visibly "pump" when N changes during a move.

### B6. Accumulation: linear light, precision, dithering, cost

**Linear vs sRGB [sourced]**
- Image values are gamma-encoded, so averaging them directly darkens bright-on-dark mixes and produces dark fringes. The correct method is to linearise, average, then re-encode.
  https://petapixel.com/2015/03/20/an-explanation-of-how-computers-handle-color · https://obsproject.com/wiki/Linear-Color-Blending · https://gioui.org/doc/architecture/color
- A white streak over black at 50% coverage should display at sRGB ≈ 188 (linear 0.5). Averaging encoded values gives 128, a visibly too-dark, "thin" streak. This is why naive frame blending looks stroboscopic and grey [estimate, from the sRGB formula].
- Real cameras integrate light linearly, so linear accumulation is the physically correct choice.
- Caveat: CSS compositing itself blends in gamma-encoded sRGB, so a page's own alpha edges are "sRGB-correct" by design. That does not change the fact that *temporal* integration should be linear.
  https://lists.w3.org/Archives/Public/public-colorweb/2021Jan/0044.html

**ffmpeg `tmix` facts [sourced from the source code, libavfilter/vf_mix.c]**
- Options: `frames` (default 3, max 1024), `weights` (default "1 1 1", last weight repeats), `scale` (0 means normalise by the sum of weights), `planes`.
- It has slice threading (`AVFILTER_FLAG_SLICE_THREADS`).
- It accepts any non-paletted, non-hwaccel format, including 16-bit and float.
- **It does no transfer-function handling.** Equal-weight 8-bit input uses an integer running sum with round-half-up. Unequal weights use float accumulation with `lrintf`.
- https://github.com/FFmpeg/FFmpeg/blob/master/libavfilter/vf_mix.c
- So today's `tmix` blends in encoded sRGB. A linear-light version in ffmpeg would need `zscale=transfer=linear:npl=100,format=gbrpf32le` → `tmix` → `zscale=transfer=iec61966-2-1` (zscale and colorspace filters exist: https://ffmpeg.org/ffmpeg-filters.html#zscale). With **variable N per frame**, `tmix` with a fixed `frames` value does not fit anyway. **Accumulate in Node.**

**GPU filters in ffmpeg**: `blend_vulkan`, `overlay_cuda`, `xfade_opencl` and `colorspace_cuda`
exist, but I found **no CUDA, OpenCL or Vulkan N-frame temporal-averaging filter**. `tmix`,
`tblend` and `mix` are CPU only.
https://ffmpeg.org/ffmpeg-filters.html

**Precision**
- Accumulate in **Float32**, or in **Uint32 fixed-point** linear values from a 256-entry LUT (sRGB8 → linear × 65535). The sum of 32 × 65535 fits easily in 32 bits.
- An 8-bit accumulator or repeated pairwise blending loses precision. FFmpeg developers noted that chained two-frame blends are less accurate than an exact n-frame average.
  https://ffmpeg.org/pipermail/ffmpeg-devel/2017-May/211815.html
- **Output:**
  - Linear → sRGB via a 4096-entry (12-bit) LUT.
  - Add **triangular-PDF dither of ±1 LSB** (or blue noise) before rounding to 8 bit. Long smooth blur streaks over gradients otherwise band visibly.
  - Alternatively send `rgb48le` to ffmpeg and let a 10-bit HEVC encode (`hevc_nvenc -pix_fmt p010le`) keep the precision.

**Cost of averaging in Node [estimate]**

One 1080p RGBA frame is 8.29 M bytes. The work is about 8.3 M (LUT lookup + add) operations per sample:

| Implementation | Per sample | 32 samples (one heavy output frame) |
|---|---|---|
| Plain JS loop, typed arrays + LUT | ~8–20 ms | ~0.3–0.6 s |
| WASM SIMD / N-API C++ (or `sharp` raw ops) | ~1–3 ms | ~30–100 ms |
| Memory bandwidth floor (≈ 265 MB at ~80 GB/s LPDDR5X) | — | ~3 ms |

- **Accumulate incrementally as each sub-frame arrives**, in the worker that owns the frame. The cost then hides behind the ~100 ms capture latency and needs no 32-frame buffer. Even plain JS (about 10 ms per sample) is under 10% of capture time.
- Use RGB only (skip alpha) if the output is opaque. That saves 25%.

**GPU accumulation options**
- *Inside the page (WebGPU/WebGL):* not workable for DOM content. Page scripts cannot read back composited DOM pixels. Only canvas/WebGL content is readable.
- *Node WebGPU:* the `webgpu` npm package (Dawn's `dawn.node`) supports Windows with D3D12/Vulkan and offscreen compute with readback.
  https://github.com/dawn-gpu/node-webgpu
  It would make accumulation nearly free, but the uploads (8 MB per sample over PCIe, about 0.5 ms) and the native dependency are not worth it given the CPU cost above. **Not recommended unless profiling shows accumulation is above about 15% of the time.**

### B7. Alternatives: velocity blur, and hybrid "sample + smear"

**Pure post-process vector blur**
- From a per-pixel velocity buffer: McGuire et al. 2012 tile-max/neighbour-max reconstruction, and Guertin, McGuire & Nowrouzezahrai 2014.
  https://research.nvidia.com/sites/default/files/pubs/2013-11_A-Fast-and/Guertin2013MotionBlur-small.pdf · https://casual-effects.com/g3d/G3D10/build/manual/class_g3_d_1_1_motion_blur.html
- **Pros:** costs one render per frame.
- **Cons:**
  - We would have to *render* a velocity buffer from the scene graph (per element, rasterised masks × screen velocity), which means re-implementing much of the compositor.
  - It cannot reveal occluded background behind a moving object (disocclusion). Gather filters guess.
  - Rotation and curved paths become linear approximations.
  - Overlapping objects moving in different directions give cross-pattern artefacts (Blender notes this for EEVEE's post blur).
- **Not recommended as the primary method** for a DOM renderer.

**Hybrid: N samples plus a directional smear (recommended)**
- Render N stratified samples, where N comes from g = 4–6 px instead of 1.5 px. Fill the g-px gaps between copies with a short directional blur of length g along the motion.
- This is EEVEE's design (steps + post blur for the inter-step gaps).
- **Key simplification [estimate, linear algebra]:** averaging and convolution are both linear. "Smear each sample by kernel k, then average" equals "average, then smear by k", *as long as k is the same for all samples*. So **one directional box blur of length g on the accumulated linear frame** replaces N per-sample blurs.
- Kernel direction:
  - Use the dominant (camera) screen-velocity direction. For a whip-pan this is essentially horizontal.
  - Box length is g px. That matches the spacing, so the copies tile into a continuous streak.
  - Use a 1D box (or tent) implemented as a running sum, which is O(1) per pixel, about 2–5 ms per frame in WASM.
- **Caveat:** a global smear also blurs elements that do not share the camera motion, such as screen-fixed HUD/text and objects moving the other way. They get an extra blur of at most g px (4–6 px) in one direction. That is acceptable during a whip-pan where everything streaks, but bad for a static overlay.
  - Mitigation 1: apply the smear only when the camera term dominates L.
  - Mitigation 2: render screen-fixed overlays as a separate pass and composite them after the smear.
  - Mitigation 3: weight the smear by a coarse mask of "moves with camera".
- Savings in the whip-pan example: N drops from about 32–43 to about 11–16 with no visible stepping. That is 3× fewer screenshots in exactly the frames that dominate cost.

**In-browser smear via CSS/SVG**
- CSS `filter: blur()` is isotropic Gaussian only.
- SVG `feGaussianBlur stdDeviation="sx sy"` is axis-aligned. A horizontal-only blur (`sx>0, sy=0`) works for horizontal pans but not for arbitrary directions without rotating the content.
- It is also a Gaussian rather than a box, so it does not tile copies cleanly. It is applied in the element's local (pre-transform) space, so zoom changes its effective radius. It also blends in sRGB, not linear.
- **Prefer the Node-side linear box smear.**

---

## Proposed algorithm (pseudocode)

```text
const FPS=60, SHUTTER_DEG=180, S=(SHUTTER_DEG/360)/FPS
const G_NO_SMEAR=1.5, G_SMEAR=5, NMAX=32

plan:
  for f in 0..F-1:
    t0=f/FPS; ta=t0-S/2; tb=t0+S/2
    L[f]   = maxScreenPathLength(sceneGraph, ta, tb, K=4)    // px
    dir[f] = dominantMotionDir(camera, ta, tb)
  Ls = movingMax(L, radius=2)                                  // hysteresis
  for f: N[f] = clamp(ceil(Ls[f]/G_SMEAR),1,NMAX); smear[f] = (N[f]>1) ? min(G_SMEAR, Ls[f]/N[f]) : 0
  chunks = split frames into runs of ~C (adaptively by sum N ≈ target cost), queue in order

worker (B browsers × T tabs, one Node worker_thread per browser):
  for chunk from queue:
    for f in chunk:
      acc = Float32Array(W*H*3).fill(0)
      for i in 0..N[f]-1:
        t = t0 + (-0.5 + (i+0.5)/N[f]) * S
        await page.evaluate(render, t)
        png = await cdp.Page.captureScreenshot({format:'png', optimizeForSpeed:true})
        rgb = decodePNG(png)                       // sharp / napi
        acc += LUT_srgb8_to_lin[rgb] * w_i          // tent or box weights, Σw=1
      if smear[f] > 0: acc = directionalBox(acc, dir[f], smear[f])
      out8 = linToSrgb8(acc) with TPDF dither
      reorderBuffer.put(f, out8)

writer: while reorderBuffer.has(next): ffmpegStdin.write(reorderBuffer.take(next++))
ffmpeg -f rawvideo -pix_fmt rgb24 -s 1920x1080 -r 60 -i - -c:v hevc_nvenc -preset p7 -tune hq -rc vbr -cq 18 -b:v 0 out.mp4
```

---

## Open questions / not verified

- The exact rule After Effects uses for Adaptive Sample Limit is not published.
- Whether headless Chromium renderers on Windows are marked EcoQoS/background, and so steered to E-cores. Check the Task Manager Efficiency-mode column.
- How much screenshot throughput is lost to GPU-process sharing (1 browser × 8 tabs vs 8 × 1). No published data; benchmark it.
- The NVENC session limit is 8 (SDK 13 app note) vs 12 (support matrix). Irrelevant if ≤ 3 sessions are used.
- Whether the RTX 5090 or the Arc iGPU is used by headless Chromium. On hybrid-GPU laptops Chromium may pick the iGPU. Check `chrome://gpu`, and consider `--use-angle=d3d11` plus the Windows Graphics settings "High performance" GPU preference for chrome.exe.
- Sustained PL1 on this specific laptop: the OEM may configure more than 45 W. Measure with HWiNFO during the benchmark sweep.
