# 02 — Deterministic, fast frame capture from Chromium

Research date: 2026-10-19. Target: Windows 11, RTX 5090 laptop GPU, Chrome 155 stable + chrome-headless-shell.
Premise: the page exposes `render(t)`, a pure function of time, which we call over CDP before each capture.
Web research only. Nothing below was measured locally; every number comes from the source it is attributed to, and the hardware differs from ours.

---

## TL;DR

- **`HeadlessExperimental.beginFrame` still exists, but only in `chrome-headless-shell`.** It was never part of new headless (`chrome --headless`). Reports that it was "removed in Chromium 147" came from people running a *full* system Chromium. HeyGen's HyperFrames still renders through headless-shell 152 with BeginFrame as of 2026-10-14. The Chromium source blocks BeginFrameControl only on macOS; Windows has no compile-time block, but HeyGen reports crashes or flag trouble on Windows under `--deterministic-mode` and falls back to screenshots there.
- **`Page.captureScreenshot` forces a redraw and copies from the surface**, so it always reflects the DOM as it stood when it was called. It is correct, but it costs about 33–37 ms per ~1080p frame in two independent measurements. Most of that is the round trip, forced redraw and readback, not the JPEG encode.
- **The beginFrame screenshot is much cheaper per call** (about 5 ms vs about 33 ms in one spike). The same spike found no net win once settling was included, and hit "Readback from surface failed" and GPU-process crashes under concurrency.
- **HTML-in-Canvas (`drawElementImage`) is the most promising new raw-pixel path.** Intent to Ship was approved on 2026-09-30 for **Chrome 157**. In Chrome 155 it is behind `--enable-features=CanvasDrawElement`. HyperFrames already ships it as its default fast path on macOS hardware-GPU renders (about 2× faster capture), with a self-verification fallback. Remotion supports it client-side only.
- **Remotion** captures with `Page.captureScreenshot` (JPEG q80 by default, `optimizeForSpeed: true`, `fromSurface: true`) and never uses beginFrame. It now ships a **patched Chromium 157** that writes raw BGRA into shared memory read by a patched FFmpeg, but only for Linux and macOS ARM64. Windows gets stock Chrome for Testing headless-shell with encoded screenshots. Remotion's own Lambda benchmark found **no clear speedup** from shared memory over JPEG on the same Chrome.
- **For our case, `render(t)` being pure makes virtual time unnecessary.** What matters is (a) knowing the compositor has painted state `t`, and (b) moving pixels cheaply.

---

## 1. `HeadlessExperimental.beginFrame` and deterministic mode

### What the protocol says (tip-of-tree PDL)
From [`HeadlessExperimental.pdl`](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/HeadlessExperimental.pdl):
- The domain is described as "experimental commands only supported in headless mode".
- `beginFrame(frameTimeTicks?, interval?, noDisplayUpdates?, screenshot?: {format: jpeg|png|webp, quality, optimizeForSpeed})` returns `{hasDamage, screenshotData?}` (base64).
- It "Requires that the target was created with enabled BeginFrameControl. Designed for use with --run-all-compositor-stages-before-draw" (background: https://goo.gle/chrome-headless-rendering).
- Screenshots "can fail, for example, during renderer initialization", in which case no data is returned.
- `enable` and `disable` are deprecated; `beginFrame` itself is **not** marked deprecated.

### Implementation facts (Chromium `main`)
- [`headless/lib/browser/protocol/headless_handler.cc`](https://chromium.googlesource.com/chromium/src/+/main/headless/lib/browser/protocol/headless_handler.cc)
  - Errors with "Command is only supported if BeginFrameControl is enabled." and "...only supported with --run-all-compositor-stages-before-draw".
  - Encoders: PNG uses the fast or slow `EncodeBGRASkBitmap`, chosen by `optimizeForSpeed`. JPEG uses `gfx::JPEGCodec::Encode` with default quality 80. WebP uses `gfx::WebpCodec::Encode`.
  - An empty bitmap means success with no data. Callers must handle missing `screenshotData`.
- [`headless/lib/browser/protocol/target_handler.cc`](https://chromium.googlesource.com/chromium/src/+/main/headless/lib/browser/protocol/target_handler.cc): the **only** platform guard is `#if BUILDFLAG(IS_MAC)` → "BeginFrameControl is not supported on MacOS yet". **Windows and Linux are allowed in source.**
- [`headless/public/switches.h`](https://chromium.googlesource.com/chromium/src/+/main/headless/public/switches.h)
  - Still declares `deterministic-mode`, a meta flag that "puts the browser into deterministic mode where begin frames should be issued over DevToolsProtocol (experimental)".
  - Also declares `enable-begin-frame-control` and `enable-gpu`.
- [`headless/lib/headless_content_main_delegate.cc`](https://chromium.googlesource.com/chromium/src/+/main/headless/lib/headless_content_main_delegate.cc) has `AddSwitchesForVirtualTime()`, gated on the feature `features::kVirtualTime`. It appends `--run-all-compositor-stages-before-draw`, `--disable-new-content-rendering-timeout`, `--disable-threaded-animation`, `--disable-checker-imaging` and `--disable-image-animation-resync`. These are the same flags that deterministic mode implies.

### Which binary has it
- The old headless implementation left the Chrome binary in M132. `--headless=old` does nothing there, and users are told to use `chrome-headless-shell` ([headless README](https://chromium.googlesource.com/chromium/src/+/main/headless/README.md); [Chrome blog](https://developer.chrome.com/blog/removing-headless-old-from-chrome)).
- puppeteer-capture's README is explicit:
  - It requires `chrome-headless-shell` and throws `NotChromeHeadlessShell` for anything else.
  - It notes "`beginFrame` is not available in `--headless=new`".
  - It lists Linux **and Windows** as supported.

  Sources: [README 1.58.0](https://cdn.jsdelivr.net/npm/puppeteer-capture@1.58.0/README.md), [GitHub](https://github.com/alexey-pelykh/puppeteer-capture).
- **"Removed in Chromium 147" is a misattribution.** [hyperframes#294](https://github.com/heygen-com/hyperframes/issues/294) shows the error `'HeadlessExperimental.beginFrame' wasn't found` on a *system Chromium 147* (Linux ARM64). The fix probes for `beginFrame` and falls back to screenshots on Chromium ≥132, which is exactly when old headless left the main binary. The claim is repeated in a [troubleshooting doc](https://github.com/NousResearch/hermes-agent/blob/main/optional-skills/creative/hyperframes/references/troubleshooting.md).
- HyperFrames [PR #5591](https://github.com/heygen-com/hyperframes/pull/5591), merged 2026-10-14, says "Renders use the headless shell (HeadlessChrome/152) with BeginFrame capture". So it was alive in shell 152 in October 2026. I found **no removal commit**. Chrome 155 headless-shell *should* still have it, but **verify locally**.

### Flags people pass
puppeteer-capture adds these automatically: `--deterministic-mode --enable-begin-frame-control --disable-new-content-rendering-timeout --run-all-compositor-stages-before-draw --disable-threaded-animation --disable-threaded-scrolling --disable-checker-imaging --disable-image-animation-resync --enable-surface-synchronization`. HyperFrames uses the same set ([HeyGen research write-up](https://www.heygen.com/research/html-to-video)).

The target must be created with `Target.createTarget({enableBeginFrameControl: true})`.

### Windows status
- HeyGen: Linux uses the full beginFrame path. "macOS and Windows fall back to `Page.captureScreenshot` with heuristics", because Chrome there "either crashes under --deterministic-mode or has its own issues with the flag combination" ([heygen.com/research/html-to-video](https://www.heygen.com/research/html-to-video)).
- This is anecdotal. The source allows Windows, and puppeteer-capture claims Windows support. It is the top item to test locally.

### Speed and pitfalls (measured elsewhere)
[juxtapose#145](https://github.com/juxtapose-dev/juxtapose/issues/145), a spike closed 2026-10-14 and judged **no-go**:
- The beginFrame screenshot took about **5 ms vs 33 ms** for `Page.captureScreenshot`. The resolution is unstated (Storybook stories).
- The time spent waiting for frames to settle cancelled the saving, adding "+4–11 ms p50/p95".
- At concurrency 8 it failed with "overlapping IssueExternalBeginFrame", then crashed the GPU process ("GPU process isn't usable"), because all pages share one compositor frame source.
- With one frame in flight per browser it still saw "Readback from surface failed" ×19.
- On macOS, calling beginFrame without BeginFrameControl kills the browser.

HeyGen's workarounds ([write-up](https://www.heygen.com/research/html-to-video)):
- `requestAnimationFrame` does not fire unless you send BeginFrames. Puppeteer's `waitForFunction` (rAF polling) hangs, so they replaced it with custom polling.
- `document.fonts.ready` can hang during load. They run a warm-up loop that sends a beginFrame every 33 ms with `noDisplayUpdates: true`, then start capture at a later `frameTimeTicks` so time never goes backwards.
- `<video>` elements are unreliable in this mode. They pre-extract frames with FFmpeg and swap in `<img>`.
- Captures are JPEG q80 with `optimizeForSpeed`.

Implications for us:
- Use **one browser process per worker**, not many tabs in one browser, because the compositor frame source is shared.
- Expect occasional empty `screenshotData` and retry.

---

## 2. Virtual time (`Emulation.setVirtualTimePolicy`)

The [Emulation.pdl](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Emulation.pdl) defines policies `advance`, `pause` and `pauseIfNetworkFetchesPending`, plus a `budget` and `virtualTimeBudgetExpired`. It overrides the time base for timers, `Date` and `performance.now`.

**It is not needed when `render(t)` is pure** and nothing in the page reads the clock: no CSS animations or transitions, no Web Animations running on their own, no `<video>` playback. Our `t` *is* the clock. Virtual time only helps when content you don't control is time-driven, such as CSS animations or third-party libraries.

Two cheaper alternatives:
- Ban time-driven content in the authoring contract.
- Pause it explicitly, e.g. `document.getAnimations().forEach(a => { a.pause(); a.currentTime = t*1000 })`.

Downsides of virtual time: deadlocks with pending fetches (hence `maxVirtualTimeTaskStarvationCount`), and it interacts badly with BeginFrame control. timecut/timesnap use **JS-level time overrides** instead, and note that CSS animations are not covered ([timecut](https://github.com/tungs/timecut)).

---

## 3. `Page.captureScreenshot` and `Page.startScreencast`

### `captureScreenshot` semantics
From [Page.pdl](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Page.pdl) and [`page_handler.cc`](https://chromium.googlesource.com/chromium/src/+/main/content/browser/devtools/protocol/page_handler.cc):

| Parameter | Behaviour |
|---|---|
| `format` | `jpeg`, `png` or `webp` only. There is **no raw/RGBA format** and no CDP method returns raw pixels. Data always comes back base64-encoded in JSON. |
| `quality` | Default 80 when absent or out of range. |
| `optimizeForSpeed` | PNG only: picks `EncodeBitmapAsPngFast` over the slow encoder. JPEG and WebP ignore it. |
| `fromSurface` | Default true. Non-surface capture requires a trusted client. |
| `captureBeyondViewport` | Re-measures the page and temporarily sets `record_whole_document` and `hide_scrollbars`, which is extra work. **Leave it false for a fixed-size stage.** |
| `clip` | Triggers save, emulate, resize and restore of the view size. With no device emulation and no clip, that path is skipped. |

**Frame freshness.** [`render_widget_host_impl.cc`](https://chromium.googlesource.com/chromium/src/+/main/content/browser/renderer_host/render_widget_host_impl.cc) `GetSnapshotFromBrowser(from_surface=true)` handles this:
- With the `kCDPScreenshotNewSurface` feature, it calls `ForceRedraw` in the renderer, then `RequestRepaintOnNewSurface()`, then `CopyFromSurface`. A comment says it "should wait until the requested repaint has arrived". Otherwise it uses `RequestForceRedraw`.
- **So `captureScreenshot` forces a frame.** A DOM mutation made synchronously before the call (in our `render(t)`) is included without a rAF double-tick.
- Asynchronous work is *not* covered: image decode, font load, and anything scheduled for later.

Remotion's experimental "copy current surface without forced redraw" path made capture 2.4× faster, **but returned a stale frame 1 in 100 runs** ([remotion#12051](https://github.com/remotion-dev/remotion/issues/12051)). The forced redraw is what buys correctness.

### Measured costs
- Remotion ([#12051](https://github.com/remotion-dev/remotion/issues/12051)), on macOS ARM64 with patched Chromium 157 at 1080×1080: mean `Page.captureScreenshot` was **36.7 ms** synchronized vs 15.6 ms with the unsafe stale path. A 100-frame render took 5.24 s, so **about 52 ms/frame end to end at concurrency 1**.
- juxtapose: about **33 ms** per `captureScreenshot` ([#145](https://github.com/juxtapose-dev/juxtapose/issues/145)).
- nyaucast: `optimizeForSpeed` on PNG made capture **30–35% faster** with identical pixels. Lossless WebP (q100) was *slower* than PNG and 3.3× larger ([nyaucast#839](https://github.com/daiki-beppu/nyaucast/issues/839)).
- Remotion shared-memory PR ([#11460](https://github.com/remotion-dev/remotion/pull/11460)): raw BGRA via shared memory vs JPEG made opaque H.264 **5.16 s → 5.20 s** (no change), while transparent ProRes improved about 20% (that one avoids PNG). On Lambda, "this does not show a speedup from shared memory over JPEG on the same Chrome".
- HyperFrames batching PR ([#1928](https://github.com/heygen-com/hyperframes/pull/1928)): in-page stages took 9–15 ms/frame, and the remaining **3.5–9 ms/frame was per-call CDP overhead**.

**Where the time goes**, inferred from the above:
- CDP round trip
- forced main-frame commit, raster and draw
- GPU→CPU readback via a CopyOutputRequest
- encode: JPEG q80 at 1080p is a few ms; slow PNG costs tens of ms
- base64 inflation (+33%) and JSON over the websocket
- Node-side decode

JPEG encode is *not* the dominant cost. Remotion skipped it entirely and saw no gain on opaque output. The redraw-plus-readback synchronisation dominates.

### `startScreencast`
From page_handler.cc and Page.pdl:
- Frames come from a video consumer at *compositor swap time*.
- `everyNthFrame` skips frames.
- `maxFramesInFlight` defaults to 3. When the limit is reached, frames are **dropped** (or only the last is kept with `sendLastFrame`).
- Encoding is always JPEG or PNG with `optimizeForSpeed=true`, run on the thread pool.

There is no link between a frame and "the state after `render(t)`": you get whatever was swapped, possibly duplicated or skipped. **It is not frame-exact.** It is only usable if you tag each frame visually and de-duplicate, which is fragile. `Page.startScreenRecording` (experimental) is also real-time.

---

## 4. GPU in headless on Windows

- **chrome-headless-shell forces software rendering by default.** In `headless_content_main_delegate.cc` the comment reads "Use software rendering by default, but don't mess with gl and angle". Unless `--enable-gpu` is passed, it appends `--use-gl=angle` plus the SwiftShader-for-WebGL ANGLE implementation. On Windows it also appends `--disable-gpu-process-for-dx12-info-collection`.
- The `enable-gpu` switch comment says headless "normally forces SwiftShader for consistency"; the flag restores normal driver selection, and `--use-gl`/`--use-angle` can force a driver ([switches.h](https://chromium.googlesource.com/chromium/src/+/main/headless/public/switches.h); [Using GPU hardware in headless Chrome](https://chromium.googlesource.com/chromium/src.git/+/lkgr/docs/gpu/using-gpu-hardware-in-headless-chrome.md)).
- Puppeteer's troubleshooting page says chrome-headless-shell needs `--enable-gpu` ([pptr.dev/troubleshooting](https://pptr.dev/troubleshooting)).
- **New headless** (`chrome --headless`) is the real Chrome browser, and Google's blog says "By default, Headless Chrome disables GPU" ([Chrome blog](https://developer.chrome.com/blog/supercharge-web-ai-testing)). That article is Linux-specific. Whether stable 155 new-headless on Windows picks D3D11 automatically is **unverified**; check with `chrome://gpu` and `Page.navigate('chrome://gpu')`.
- **SwiftShader WebGL fallback** is being removed. The deprecation started in Chrome 130, and it now needs `--enable-unsafe-swiftshader` ([intent](https://groups.google.com/a/chromium.org/g/blink-dev/c/yhFguWS_3pM); [crbug 40277080](https://issues.chromium.org/issues/40277080)). This only matters if we use WebGL on the software path.
- **Useful Windows flags to try:** `--enable-gpu` (shell), `--use-angle=d3d11`, `--use-gl=angle`, `--ignore-gpu-blocklist`, `--enable-gpu-rasterization`. Use `--disable-gpu-compositing` / `--disable-gpu-rasterization` to force CPU raster as a determinism baseline.
- **Remotion flags** ([open-browser.ts](https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/renderer/src/open-browser.ts)):
  - `--ignore-gpu-blocklist --enable-unsafe-webgpu --force-gpu-mem-available-mb=4096 --force-color-profile=srgb --font-render-hinting=none --hide-scrollbars`
  - `--enable-features=NetworkService,NetworkServiceInProcess,CanvasDrawElement`
  - `--disable-gpu-rasterization` only on Lambda
  - `gl` option: `angle` → `--use-gl=angle` (+`--enable-unsafe-swiftshader` in v5); `swangle` → `--use-gl=angle --use-angle=swiftshader`; `angle-egl` → `--use-angle=gl-egl`; `vulkan` → Vulkan flags plus `--enable-features=Vulkan,UseSkiaRenderer`; any other value → `--use-gl=<value>`
  - Default is `null` in v4 and `angle` in v5 ([gl-options docs](https://www.remotion.dev/docs/gl-options))
  - Remotion's docs say headless-shell is for CPU-bound rendering and chrome-for-testing is for GPU on Linux ([chrome-headless-shell](https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell), [chrome-mode](https://www.remotion.dev/docs/options/chrome-mode))
- **Determinism of GPU raster.** No source guarantees bit-identical output from GPU raster across runs, drivers or machines.
  - Chromium's own `virtual/gpu-rasterization` tests have had flake episodes ([codereview 2274573006](https://codereview.chromium.org/2274573006)).
  - Visual-test vendors recommend pinning one environment, plus `--disable-lcd-text --font-render-hinting=none` ([Argos](https://argos-ci.com/docs/learn/reliability-and-flakiness/flaky-tests/stabilize-text-rendering)).
  - juxtapose found its residual nondeterminism came from "raster history" (tile and raster reuse), not draw timing ([#145](https://github.com/juxtapose-dev/juxtapose/issues/145)).
  - HyperFrames v0.7.60 fixed "stale SwiftShader compositor layers" appearing in captures and black frames on software GPU ([release](https://newreleases.io/project/github/heygen-com/hyperframes/release/v0.7.60)).
  - In practice, on the same machine, driver and flags, GPU raster is *usually* stable. Treat run-to-run bit identity as something to **measure**, not assume. CPU raster (SwiftShader/Skia CPU) is the safer reference for a golden-frame test.

---

## 5. Raw-pixel paths that skip CDP image encoding

### HTML-in-Canvas (`drawElementImage`) — the one to watch
- **Status**
  - DevTrial M138 and origin trial M148–150 (extended to M154/160).
  - **Intent to Ship approved 2026-09-30 with LGTMs from Alex Russell and Rick Byers. It ships in Chrome 157** on desktop, Android and WebView ([I2S](http://www.mail-archive.com/blink-dev@chromium.org/msg17593.html), [LGTMs](http://www.mail-archive.com/blink-dev@chromium.org/msg17607.html), [OT blog](https://developer.chrome.com/blog/html-in-canvas-origin-trial)).
  - The Finch feature is `CanvasDrawElement` and the flag is `chrome://flags/#canvas-draw-element`.
  - **In Chrome 155, enable it with `--enable-features=CanvasDrawElement`**, which is what Remotion does. Some newer explainer pieces may also want `--enable-experimental-web-platform-features`.
- **API**
  - The surface differs between the OT blog and the live explainer, so feature-detect at runtime.
  - OT blog: `<canvas layoutsubtree>`, a `paint` event, `canvas.requestPaint()`, `ctx.drawElementImage(el, x, y)` (returns a transform), WebGL `texElementImage2D`, WebGPU `copyElementImageToTexture`.
  - The [WICG explainer](https://github.com/WICG/html-in-canvas) now also describes `content="drawable"`/`drawable` attributes, and `captureElementImage()` → a transferable `ElementImage` that can be drawn in an `OffscreenCanvas` in a worker.
- **Readback.** The explainer's "read-back-allowed rendering" model paints only content safe to read back, so the canvas is readable.
  - Excluded: cross-origin iframes, images and URLs, system colours/themes, spelling markers, visited-link state, autofill, **subpixel text AA**, video controls/captions and IME UI. Everything else in the explainer is treated as safe.
  - Pixels can therefore go `canvas → getImageData` / `new VideoFrame(canvas)` / `VideoEncoder` in-page with no CDP encode.
- **Caveats from HyperFrames** ([guide](https://hyperframes.heygen.com/guides/html-in-canvas), [PR #1917](https://github.com/heygen-com/hyperframes/pull/1917), [v0.7.38](https://newreleases.io/project/github/heygen-com/hyperframes/release/v0.7.38), [PR #1928](https://github.com/heygen-com/hyperframes/pull/1928))
  - The paint-record path "doesn't reproduce every compositor effect". Filters, backdrop-filter, some 3D transforms, masks and blend modes trigger a fallback to screenshots.
  - WebGL and WebGPU canvases inside the subtree must be composited separately with `drawImage`.
  - The paint wait is about 1.3 ms/frame. Encoding dominates (about 10 ms JPEG in a worker).
  - Overall it is about 2× cheaper than a CDP screenshot.
  - Batching 4 frames per `page.evaluate` gave a further median 1.20× (up to 1.56× with worker encode). 17 of 19 comps were bit-identical vs baseline.
  - It ships behind a per-render self-verification net, on by default only for macOS hardware-GPU renders.
- **Remotion** supports it only in `@remotion/web-renderer` (client side), not server-side rendering. It warns that "Output pixels may differ from the built-in DOM composer" ([docs](https://www.remotion.dev/docs/client-side-rendering/html-in-canvas)). It notes that Chrome 157 fixes DPR-dependent shrinking but `objectFit="contain"` is still broken (Remotion #11620).
- **Why this matters for us.** If our whole stage lives inside one `<canvas layoutsubtree>`, each frame becomes:
  1. `render(t)`
  2. await `paint`
  3. `drawElementImage`
  4. `new VideoFrame(canvas, {timestamp})`
  5. `VideoEncoder.encode`

  All of that runs in-page and can be batched over N frames per CDP call. **No screenshot, no base64 images, and possibly zero-copy GPU encode.** Only encoded H.264/HEVC/AV1 chunks (or raw RGBA via `getImageData`, if lossless frames are needed for motion-blur accumulation) cross to Node.

### WebCodecs in the page
- `VideoEncoder` with `hardwareAcceleration: 'prefer-hardware'` is a *hint* ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/configure)). On Windows it would map to Media Foundation (NVENC behind it).
- I found no measurements for headless + WebCodecs + NVENC. Check `VideoEncoder.isConfigSupported` and time `encode()` locally.
- Without HTML-in-Canvas, WebCodecs only helps for content we draw ourselves (2D/WebGL/WebGPU canvas). **The DOM cannot reach a canvas natively before HTML-in-Canvas.** html2canvas-style re-implementations are not faithful.

### Other routes
- `OffscreenCanvas` and workers help only for canvas-native content, or with `ElementImage` from `captureElementImage`.
- `getDisplayMedia`, `chrome.tabCapture` + MediaRecorder, `Page.startScreenRecording` and `startScreencast` are all real-time and **not frame-exact**.
- Remotion's patched-Chromium shared-memory frame pool (`Page.remotionCreateFramePool`, raw BGRA into a POSIX shm pool read by a patched FFmpeg `remotionshm` input) is the only "raw RGBA out of CDP" implementation found. It is Linux and macOS ARM64 only, custom-built, and showed no gain for opaque H.264 ([PR #11460](https://github.com/remotion-dev/remotion/pull/11460)).

---

## 6. How Remotion captures

All files are under `packages/renderer/src` in [remotion-dev/remotion](https://github.com/remotion-dev/remotion/tree/main/packages/renderer/src).

- **Capture call** ([`screenshot-task.ts`](https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/renderer/src/screenshot-task.ts))
  - First `Target.activateTarget`.
  - Then `Page.captureScreenshot({format, quality: jpegQuality, clip:{0,0,w*s,h*s,scale:1}, captureBeyondViewport: true, optimizeForSpeed: true, fromSurface})`. `fromSurface` is true unless disabled or the frame is larger than 8192 px.
  - On its patched Chromium it adds `remotionFrameSlot`/`remotionFrameId`/`remotionFastViewport` for shared memory.
  - **It never calls beginFrame.**
- **Format** ([config docs](https://www.remotion.dev/docs/config)): `videoImageFormat` defaults to `jpeg` ("the fastest option"), with `jpegQuality` defaulting to 80. PNG or WebP only for transparency. In [`take-frame.ts`](https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/renderer/src/take-frame.ts) the body background is set to black for JPEG and transparent for PNG/WebP.
- **Waiting** ([`seek-to-frame.ts`](https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/renderer/src/seek-to-frame.ts))
  1. `waitForReady`, then `window.remotion_setFrame(frame, comp, attempt)`.
  2. `waitForFunction(() => window.remotion_renderReady === true)`. Any outstanding `delayRender()` handle keeps it false, and the timeout is the delayRender timeout + 3 s.
  3. `document.fonts.ready`, then the screenshot.

  There is no rAF double-tick; it relies on the screenshot's forced redraw.
- **Concurrency** ([`get-concurrency.ts`](https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/renderer/src/get-concurrency.ts)): defaults to `round(min(8, max(1, cpus/2)))`, as tabs across browser instances.
- **Browser**
  - `chromeMode` defaults to `headless-shell`; `chrome-for-testing` means new headless.
  - Remotion 4.0.534+ pins **Chrome 157.0.8080.0**. Linux and macOS ARM64 get Remotion's patched build; **Windows (win64) gets Google's stock build with encoded screenshots**, and the docs say "Windows renders were not tested for this update" ([chrome-headless-shell docs](https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell), [PR #11460](https://github.com/remotion-dev/remotion/pull/11460)).
- **Flags**: see section 4.
- **Throughput**: there is no official fps figure. The best data point is about 52 ms/frame (≈19 fps) at 1080×1080 with concurrency 1 on Apple Silicon, of which ≈37 ms is the screenshot ([#12051](https://github.com/remotion-dev/remotion/issues/12051)).

---

## 7. Gating before frame 0 and per-frame paint guarantees

- **Fonts.** Preload every face, then `await Promise.all([...faces].map(f => f.load()))` and `await document.fonts.ready`. Also check `document.fonts.check('16px "X"')` for each family. Remotion awaits `fonts.ready` after every seek.
  - Under BeginFrame control, `fonts.ready` can hang unless frames are pumped. Use HeyGen's `noDisplayUpdates` warm-up loop.
- **Images.** `await Promise.all([...document.images].map(i => i.decode()))`. For CSS background images, preload via `new Image()` + `decode()`. Pass `--disable-checker-imaging` so images are never drawn as placeholders while decoding asynchronously, and keep `--disable-image-animation-resync`.
- **Paint guarantee**
  - With `Page.captureScreenshot`, the forced redraw on the new surface makes a rAF double-tick unnecessary for synchronous DOM changes.
  - With beginFrame, the frame you issue after `render(t)` *is* the paint. Check `hasDamage` and retry if the screenshot is missing.
  - With HTML-in-Canvas, wait for the canvas `paint` event (HyperFrames forces a paint-record invalidation and then waits for it).
  - Never rely on wall-clock sleeps. Remotion rejected "fixed sleep or discarding the first frame" as unacceptable ([#12051](https://github.com/remotion-dev/remotion/issues/12051)).
- **Remaining sources of nondeterminism to stamp out**
  - CSS animations and transitions (disable them, or drive them from `t`)
  - `<video>` (pre-extract frames)
  - lazy loading (`--disable-lazy-loading` exists in the headless switches)
  - LCD text (`--disable-lcd-text`)
  - colour profile (`--force-color-profile=srgb`)
  - scrollbars (`--hide-scrollbars`)
  - device scale factor (pin it)

---

## Ranked capture strategies (fastest exact first)

Costs are per 1080p frame, extrapolated from the sources above. They are not measured on our machine.

1. **HTML-in-Canvas + in-page WebCodecs**, batched over N frames per CDP call.
   - Flow: `render(t)` → `paint` → `drawElementImage` → `VideoFrame` → `VideoEncoder`, on Chrome 155 with `--enable-features=CanvasDrawElement` (default from 157).
   - Expected cost: **about 5–15 ms/frame**. HyperFrames measured 9–15 ms in-page including JPEG; dropping JPEG for hardware encode could go lower.
   - Caveats: experimental in 155. Some compositor effects are not reproduced (filters, backdrop-filter, masks, blend, 3D), so a pixel self-check against `captureScreenshot` on sample frames is needed. Subpixel AA is off. Lossless frames for motion-blur accumulation mean `getImageData` (≈8 MB/frame) or a WebGL/WebGPU accumulation in-page instead of in Node.
2. **`HeadlessExperimental.beginFrame` with screenshot** (chrome-headless-shell, deterministic flags, one browser process per worker).
   - Expected cost: **about 5–15 ms capture plus settle**. juxtapose measured 5 ms, but with no net win after settling.
   - Caveats: Windows stability is unproven (HeyGen says crashes). Shell-only. Overlapping-BeginFrame crashes under multi-tab concurrency. Sporadic "Readback from surface failed". rAF and `fonts.ready` quirks. Still base64 JPEG/PNG.
3. **`Page.captureScreenshot`**: JPEG q≈90+ or PNG with `optimizeForSpeed`, `fromSurface: true`, no clip, no `captureBeyondViewport`, viewport sized exactly to the stage.
   - Expected cost: **about 30–40 ms/frame per worker**, parallelised over several browser *processes*.
   - Correctness is guaranteed by the forced redraw, and it works in any Chrome. This is the safe baseline and fallback, and what Remotion and HyperFrames use on Windows.
4. **Not frame-exact; do not use for final output**:
   - `startScreencast` (drops and duplicates frames)
   - `getDisplayMedia` / tabCapture / MediaRecorder / `startScreenRecording`
   - `Page.captureScreenshot` via the "copy current surface" shortcut (stale frames, per Remotion)
5. **Not available to us**: Remotion's patched-Chromium shared-memory RGBA. It is Linux/macOS only, a custom build, and showed no opaque-H.264 gain.

## Local experiments worth running

1. **Does beginFrame work on Windows headless-shell 155?** Launch chrome-headless-shell 155 (Chrome for Testing win64) with the puppeteer-capture flag set, call `createTarget({enableBeginFrameControl:true})`, and run 1000 `beginFrame({screenshot:{format:'jpeg',quality:90}})` calls.
   - Record crashes, empty `screenshotData` and ms/frame.
   - Repeat with and without `--enable-gpu --use-angle=d3d11`.
2. **`captureScreenshot` cost breakdown at 1920×1080** (shell vs `chrome --headless` 155), over the matrix {PNG slow, PNG `optimizeForSpeed`, JPEG q80/q95, WebP} × {SwiftShader/CPU, `--enable-gpu --use-angle=d3d11`}.
   - Time the CDP round trip separately from base64 decode in Node.
   - Also measure with `clip` vs no clip, and `captureBeyondViewport` false vs true.
3. **GPU check.** Navigate each config to `chrome://gpu` and confirm whether raster, compositing and WebGL are hardware-accelerated on the 5090 (or the iGPU). Laptop hybrid GPUs may pick the iGPU: test `--use-angle=d3d11` and Windows Graphics Settings, and record the ANGLE renderer string.
4. **Determinism.** Render the same 300 frames twice per config and hash the raw decoded RGBA. Compare GPU raster vs CPU raster, `--disable-lcd-text`, and `--font-render-hinting=none`. Also compare across a browser restart.
5. **Freshness test.** In `render(t)`, write a frame-specific colour or barcode into a corner, capture, decode, and assert it matches for every frame. Run it for `captureScreenshot`, beginFrame and drawElement. This is the test that catches stale frames.
6. **HTML-in-Canvas on 155.** With `--enable-features=CanvasDrawElement`, feature-detect (`'layoutSubtree' in canvas`, `ctx.drawElementImage`).
   - Measure `drawElementImage` + `getImageData` and `drawElementImage` + `new VideoFrame` + `VideoEncoder.encode` (`isConfigSupported` with `prefer-hardware`, H.264 and HEVC) at 1080p, batched N=1/4/8 per `evaluate`.
   - Diff pixels against `captureScreenshot` for our typical effects (shadows, blur, gradients, masks, transforms).
7. **Concurrency scaling.** Run 1, 2, 4, 8 and 12 workers as separate browser *processes* vs tabs in one process, for both `captureScreenshot` and beginFrame. Watch GPU-process crashes and throughput.
8. **Font and image gating.** Cold-start frame-0 correctness with and without `fonts.ready` + `decode()` + `--disable-checker-imaging`. Under beginFrame, verify `fonts.ready` resolves with a `noDisplayUpdates` warm-up loop.

## Open uncertainties

- Whether chrome-headless-shell **155** still contains beginFrame. No removal was found, and it was present in 152.
- Whether Windows deterministic mode crashes. This rests only on HeyGen's claim.
- The default GPU use of new headless on Windows.
- The exact HTML-in-Canvas API shape in 155 vs 157 (the explainer is still moving).
- WebCodecs hardware encode availability inside headless on Windows.
