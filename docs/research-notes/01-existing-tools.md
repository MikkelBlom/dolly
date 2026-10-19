# 01 — Existing tools: prior art for a code-driven promo-video renderer

Research date: 2026-10-19. Context: local TypeScript tool; scenes are hand-written HTML/CSS driven by a pure `render(t)`; headless Chromium capture; Windows laptop (16-core Intel, RTX 5090 Laptop); primary user is an AI coding agent, a human reviews; owner is a single developer who may use it commercially and may open-source it.

Confidence markers used below:
- **[verified]** read from the project's source, licence or docs during this research (URL given).
- **[secondary]** from third-party write-ups only.
- **[memory]** from my own background knowledge, not re-verified today. Treat as a starting point.

---

## TL;DR

1. **Don't build on Remotion.** Its licence is source-available, not open source. It's free for individuals and companies of up to 3 people, but anyone you'd distribute an open-source tool to who has 4 or more people would need their own Remotion licence. It is React-first, which doesn't match a pure `render(t)` HTML page. Its fastest capture path (shared memory) **does not exist on Windows**, so on this laptop you'd get JPEG screenshots anyway.
2. **Don't build on Revideo or Motion Canvas.** Both are canvas-scene-graph engines, not HTML/CSS. Motion Canvas has had no code commits since Feb 2025. The Revideo team now works mainly on its commercial product, Midrender, and doesn't upstream to the open-source repo.
3. **The closest prior art is HeyGen's HyperFrames** (Apache-2.0, very active, 66.8k stars). It already ships *adaptive*, After-Effects-style sub-frame motion blur (16/32/64 samples chosen from a two-probe pixel diff), static-frame dedup, multi-browser parallel capture, BeginFrame capture on Linux, and an agent skill pack. The other close one is **OpenFilm** (MIT, created 2026-10-04), whose contract is literally `frame(t)`. **Build from scratch, beside these two**: take their ideas, and since both licences are permissive you can copy code with attribution. Don't take their weight: HyperFrames is ~5.7k commits, GSAP-centric, sends telemetry by default, and on Windows falls back to screenshots and CPU-side PNG averaging.
4. **The biggest speed lever** that none of them fully exploit on Windows is Chrome's **HTML-in-Canvas** API (`drawElementImage` / `texElementSubImage2D` / `drawElementImageToTexture`). It's in origin trial, extended through Chrome 160, and behind `chrome://flags/#canvas-draw-element`. It could let sub-frame motion-blur samples accumulate **on the GPU inside the page**, with one readback per output frame instead of K screenshots. It's experimental and its API was renamed in Chrome 150 and 155, so treat it as an optional fast path, never the only path.

---

## 1. Remotion

### Rendering architecture [verified unless marked]
- **Capture:** `@remotion/renderer` drives Chromium (Remotion ships its own compiled Chrome / `chrome-headless-shell`) through Puppeteer/CDP. Each frame is a **`Page.captureScreenshot`** call with `optimizeForSpeed: true`, `captureBeyondViewport: true` and `fromSurface` (forced on above 8192 px). Remotion's *patched* Chromium adds custom CDP parameters (`remotionFrameSlot`, `remotionFrameId`, `remotionFastViewport`) for shared-memory capture. Source: [`screenshot-task.ts`](https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/screenshot-task.ts). It does **not** use `HeadlessExperimental.beginFrame`. Time is set by calling `window.remotion_setFrame(frame, composition, attempt)` and then waiting until every `delayRender()` handle is cleared ([`seek-to-frame.ts`](https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/seek-to-frame.ts)).
- **Shared-memory capture (v4.0.534+):** the raw bitmap goes straight from Chromium to the bundled FFmpeg, skipping the JPEG/PNG encode. It turns on automatically for video renders with parallel encoding, but **only on Apple Silicon (macOS 15+) and Linux x64/ARM64 (glibc 2.35+). On Windows it falls back to regular JPEG/PNG screenshots** ([docs](https://www.remotion.dev/docs/shared-memory-capture)).
- **`--concurrency`:** the number of parallel tabs, defaulting to half the CPU threads ([renderMedia](https://www.remotion.dev/docs/renderer/render-media)). Remotion opens **N pages in one browser** and puts them in a `Pool`. Frames come off a shared "next frame to render" queue, so whichever tab is free takes the next frame. The split is dynamic and in order, not a fixed set of chunks ([`render-frames.ts`](https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/render-frames.ts)). Docs say to tune it with `npx remotion benchmark`, because more concurrency can be slower ([performance](https://www.remotion.dev/docs/performance)).
- **Stitching:** with "parallel encoding" (the default), frames stream into FFmpeg while capture continues. That costs about 30–80 MB more memory at 1080p ([parallel encoding](https://www.remotion.dev/docs/parallel-encoding)). `renderMedia()` (3.0+) combines what used to be `renderFrames()` + `stitchFramesToVideo()`. `hardwareAcceleration` enables HW encoding (you must use `videoBitrate`, not `crf`). JPEG is the default image format because it's fastest; PNG is needed for alpha.
- **Lambda / Cloud Run:** distributed rendering splits frames into chunks per function (`framesPerLambda`, at least 20 frames by default) and concatenates the results ([lambda concurrency](https://www.remotion.dev/docs/lambda/concurrency)).
- **Client-side rendering (`@remotion/web-renderer`, stable since 4.0.491):** `renderMediaOnWeb()` encodes with WebCodecs (via Mediabunny). It doesn't screenshot. It **re-implements a CSS subset and draws it to a canvas**, using `getBoundingClientRect()` and DOM order. There's no `z-index`, `backdrop-filter`, `mix-blend-mode`, SVG filters/masks, `perspective` or `@font-face`, and it's single-threaded. Every render sends telemetry, even without a key ([docs](https://www.remotion.dev/docs/client-side-rendering), [limitations](https://www.remotion.dev/docs/client-side-rendering/limitations)). This doesn't fit arbitrary hand-written CSS.
- **HTML-in-canvas:** `<HtmlInCanvas>` and `<HtmlInCanvasMotionBlur>` use Chrome's experimental API (Chrome 149+ behind a flag; enabled in Remotion's compiled Chrome; nesting needs 4.0.534 / Chromium 157). WebGL effects need `--gl=angle` ([docs](https://www.remotion.dev/docs/html-in-canvas)). `@remotion/motion-blur` also provides `<CameraMotionBlur>` (stacks layered copies with opacity, which shifts colour/opacity) and `<Trail>` ([docs](https://www.remotion.dev/docs/motion-blur)).
- **Remotion 5.0 (not yet released):** WebGL/WebGPU on by default, with `angle` GL as default falling back to `swangle`. The `@remotion/webcodecs` and `@remotion/media-parser` packages are discontinued, and BT.709 is the default colour space ([5.0 migration](https://www.remotion.dev/docs/5-0-migration)). Latest release: **v4.0.536, 2026-10-16** (GitHub API).

### Timing model, Player, Studio [memory + docs]
- `useCurrentFrame()` returns an integer frame. `<Sequence from durationInFrames>` shifts the frame for its children. `interpolate()` and `spring()` are pure functions of the frame. `delayRender()`/`continueRender()` gate readiness. Everything works in **integer frames**, and sub-frame time is only reachable through the motion-blur components. That's a real limitation if we want arbitrary shutter samples.
- `<Player>` is an embeddable React player that uses the same composition for preview. Studio is a local editor with a timeline, props editing, and "Render in browser"/server render buttons.

### Agent integrations [verified]
- Official **Agent Skills**: `npx skills add remotion-dev/skills`. Twelve skills, including `/remotion-best-practices`, `/remotion-markup`, `/remotion-render`, `/remotion-studio`, `/remotion-docs` and `/remotion-interactivity` ([docs](https://www.remotion.dev/docs/ai/skills), [repo](https://github.com/remotion-dev/skills), 5.3k stars). Docs serve Markdown by appending `.md` or sending `Accept: text/markdown` ([AI docs](https://www.remotion.dev/docs/ai)). There's a "Prompt to Motion Graphics" SaaS starter ([docs](https://www.remotion.dev/docs/ai/ai-saas-template)). I found **no official Remotion MCP server**.
- Third-party: a Motionbox guide (2026-08-02) reports agents do well on templated work and poorly on pacing, music sync and art direction ([motionbox](https://motionbox.io/blog/remotion-for-coding-agents)) [secondary].

### Licence in detail [verified]
Sources: [LICENSE.md](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md), [FAQ](https://www.remotion.dev/docs/license/faq), [Terms](https://www.remotion.dev/docs/terms), [5.0 migration](https://www.remotion.dev/docs/5-0-migration).
- **Source-available, not open source.** The FAQ is explicit about this. GitHub reports the SPDX ID as `NOASSERTION`.
- **Free License:** individuals, for-profits with **up to 3 employees** (the FAQ refers to a "4-person threshold"), non-profits, and evaluators. This includes commercial use, and the FAQ says it includes SaaS and automation. Headcount means the whole company, not just Remotion users.
- **Restriction:** you may not copy or modify Remotion to sell, rent, license or sublicense "your own derivate of Remotion".
- **Company License tiers (Terms):** *Creators* is $25 per seat per month (a seat is anyone writing Remotion code **or using agentic coding tools** on it). *Automators* is $0.01 per render with a $100/month minimum, and covers code that calls `renderMedia`/the CLI programmatically, any use of `<Player>`, and prompt-to-video tools. *Enterprise* has a $500/month minimum. Automators and Enterprise require a licence key plus **telemetry per render**, or a verifiable monthly report.
- **Distributing a tool on top:** desktop apps (Electron/Tauri) are allowed only if an abstraction layer stops end users editing or uploading Remotion code. If you stop maintaining such an app, you must keep a Company Licence for a year after its last release. Exported projects must say they were built with Remotion and link to remotion.pro/license. Users uploading arbitrary Remotion code needs prior written approval. **Anyone who can view or modify a Remotion codebase may need their own licence.**
- **5.0 changes:** contractors count toward team size, the licence will be bound to new T&Cs, and telemetry becomes mandatory for Automators.
- **What that means here:** Mikkel alone is covered by the Free License, including for his own commercial promos. An **open-source tool built on Remotion** would hand every downstream user Remotion's licence obligations, plus an "automation" tier if they're a company of 4 or more. An agent-first CLI that renders programmatically is exactly what the Terms call "automation", and the Terms specifically count seats for "agentic coding tools". That is a poor fit for a permissively licensed open-source tool.

**Take:** the tab pool fed from a dynamic queue; streaming frames into FFmpeg while capture runs (parallel encoding); `delayRender` as an explicit readiness contract; a `benchmark` command that finds the best concurrency; Markdown docs for agents; the skills packaging.
**Avoid:** React as the authoring model; integer-frame-only time; the licence; relying on shared-memory capture (not on Windows); the client-side CSS re-implementation.
**Verdict:** **Beside.** Use it as a speed and quality benchmark only.

---

## 2. Motion Canvas and Revideo

### Motion Canvas [verified]
- **Architecture:** TypeScript **generator functions** (`yield* node.position(x, 1)`) drive a **2D canvas scene graph**, not DOM/CSS. The editor is Vite-based, and export goes through image-sequence or FFmpeg plugins [memory for the exporter details].
- **Licence:** MIT ([repo](https://github.com/motion-canvas/motion-canvas), 19.4k stars).
- **Maintenance:** latest release **v3.17.2 on 2024-12-14**, npm `@motion-canvas/core` last modified 2025-02-16. The last feature commit was **2025-02-16**, and the only commit since is a docs-domain change on 2026-07-02 (GitHub API). **Effectively dormant.**

### Revideo [verified]
- **Identity:** a fork of Motion Canvas that adds headless rendering, audio and a library-first API. The repo moved from `redotvideo/revideo` to **`midrender/revideo`**, and the docs now live at [midrender.com/revideo](https://midrender.com/revideo). MIT ([repo](https://github.com/midrender/revideo), 4.1k stars).
- **Rendering:** a headless browser loops over frames, draws each one to an HTML canvas, and feeds it to **WebCodecs `VideoEncoder`**, producing a silent MP4. A Node process uses FFmpeg to extract and merge audio. `settings.workers` parallelises within one process, but it's memory-hungry because it spawns FFmpeg workers. For serverless use there are `renderPartialVideo()` + `concatenateMedia()` + `mergeAudioWithVideo()`. The docs claim it is "almost always faster than real-time" since v0.4.6, and that `resolutionScale: 0.5` roughly doubles speed ([rendering](https://midrender.com/revideo/docs/guide/rendering-videos), [slow rendering](https://midrender.com/revideo/docs/common-issues/slow-rendering)).
- **Maintenance:** 0.10.4 shipped on 2025-02-24, then a 17-month gap until **0.11.0 on 2026-07-10**. There have been 19 commits since June 2025. Midrender's own site says the team **now mainly works on Midrender** (a YC S23 AI motion-graphics editor with MCP/CLI) and that **recent engine changes haven't been upstreamed** ([midrender](https://midrender.com/revideo)). Expect drift.

**Take:** the generator-timeline ergonomics are a nice *authoring* idea (`yield* waitFor`, `all()`, `chain()`) and could sit on top of `render(t)` as an optional helper layer. Also worth taking: canvas → WebCodecs `VideoEncoder` in-page (zero screenshots) for canvas-native scenes, and partial render plus concat for chunking.
**Avoid:** both as foundations. Canvas-only means no HTML/CSS (kills the baseline); Motion Canvas is dormant; Revideo is a company's side repo.
**Verdict:** **Beside.** Borrow ideas only.

---

## 3. Theatre.js [verified]
- **What it is:** a keyframe **sequence editor** (Studio UI with a graph editor and per-prop tracks) plus a small runtime (`@theatre/core`). Animations serialise to JSON state. `sheet.sequence.position = t` seeks deterministically [memory for the API detail].
- **Licence:** `@theatre/core` is **Apache-2.0**. `@theatre/studio` is **AGPL-3.0**, but it's only meant to be used at design time and doesn't ship in the final bundle ([README](https://github.com/theatre-js/theatre)).
- **Status:** latest npm **0.7.2 (2024-05-19)**. The last public commit (2024-04-11) added a notice that development has "temporarily" moved to a private repo for 1.0. Nothing public has appeared in the **2.5 years** since, so treat it as stalled.

**Take:** the data model, where keyframes live in a JSON file next to code and a human tweaks curves visually while code stays the source of truth. That's a good human-review affordance for later.
**Avoid:** depending on it (stalled; AGPL studio). If the tool is open-sourced, an embedded AGPL editor would complicate licensing.
**Verdict:** **Beside.** If we want a curve editor later, build a small one.

---

## 4. GSAP [verified unless marked]
- **Licence:** after Webflow acquired it, GSAP **and all its formerly paid plugins** (SplitText, MorphSVG and others) are free, including for commercial use, under the "Standard 'No Charge' GSAP License" ([licence](https://gsap.com/standard-license), [Webflow blog](https://webflow.com/blog/gsap-becomes-free)). It is **not OSI open source**.
  - **Prohibited Use:** using GSAP in a tool that lets users build animations **without code through a visual interface** and "materially assists in creating a solution that competes with Webflow's" animation capabilities, unless you have Webflow's prior written consent. "Competitive Products" are defined as visual builders "similar to Webflow". The FAQ says **AI-generated code is not a Prohibited Use**.
  - Branding and notices must not be removed. Webflow can terminate the licence.
  - **What that means here:** an agent-first CLI where scenes are code is fine. A future *visual timeline editor that authors GSAP animations* is a grey zone. And an open-source tool can't ship GSAP under its own MIT/Apache licence; it should list GSAP as a user-installed dependency, not vendor it.
- **Deterministic seeking** [memory, widely relied upon, and confirmed by HyperFrames using it as the default adapter]: create timelines `paused: true`, then `tl.seek(t)`, `tl.totalTime(t)` or `tl.progress(p)`. `seek` keeps the paused state, and `suppressEvents` defaults to `true` ([seek docs](https://gsap.com/docs/v3/GSAP/Timeline/seek())). GSAP renders synchronously on seek, so a screenshot right after works without waiting for a tick. HyperFrames registers paused timelines on `window.__timelines` and seeks them ([HyperFrames README](https://github.com/heygen-com/hyperframes)). **Gotchas:** `gsap.utils.random` and function-based values are evaluated once when the tween is created, so they differ per worker page unless seeded. `.call()` callbacks are skipped when events are suppressed. `from()` tweens use `immediateRender`. Turn off `gsap.ticker` lag smoothing, or simply never let the global ticker drive anything.

**Take:** let scene authors use GSAP *inside* `render(t)` through a tiny adapter (`tl.totalTime(t)`). It's the animation library LLMs know best.
**Avoid:** making GSAP the core time model, or vendoring it.
**Verdict:** **Beside**, as an optional adapter.

---

## 5. Lottie / dotLottie / Rive (as assets inside a scene)
- **lottie-web** (MIT, 32k stars; last push 2025-09, slow). `anim.goToAndStop(frame, true)` seeks by frame [memory]. Use the SVG or canvas renderer with `autoplay: false`.
- **dotLottie-web** (MIT; Rust + WASM via ThorVG; **v0.81.0 on 2026-10-06**, active) ([repo](https://github.com/LottieFiles/dotlottie-web)). `setFrame(n)` renders the frame "regardless of current state", and community guidance says it renders **synchronously** into the canvas and `buffer` [secondary]. `useFrameInterpolation` controls sub-frame rasterisation ([perf docs](https://docs.lottiefiles.com/en/runtimes/distributions/js/v0.x/advanced/performance.md)). Whether `setFrame(12.5)` interpolates is **unverified**, and it matters for motion-blur sub-samples, so test it.
- **Rive** (`@rive-app/canvas` / `webgl2`, MIT runtime, **2.45.0 on 2026-10-17**). The high-level `rive.scrub(animationName, seconds)` works for linear animations. **State machines** are advanced by `dt` and are only deterministic if replayed from t=0 with fixed steps. The C++ docs say state machines are "deterministic at fixed dts" ([Rive state machines](https://rive.app/docs/runtimes/web/state-machines), [C++ loop](https://rive.app/docs/runtimes/cpp/rendering-loop.md)). For a pure `render(t)`, either use timeline animations with `scrub`, or replay the state machine from zero with a fixed dt and cache the result.

**Take:** an adapter interface along the lines of HyperFrames' `FrameAdapter {init, getDurationFrames, seekFrame}`, with built-in adapters for GSAP, WAAPI/CSS (`document.getAnimations()` → `currentTime`), Lottie, dotLottie and Rive.
**Avoid:** anything that owns its own clock without a seek API. Pre-render those to image sequences instead.
**Verdict:** **Beside**, as assets behind adapters.

---

## 6. HTML-to-video tools for AI agents (2025–2026)

| Tool | Licence | Activity (GitHub API, 2026-10-19) | Capture method | Parallelism | Motion blur |
|---|---|---|---|---|---|
| **HyperFrames** (HeyGen) | Apache-2.0 | v0.8.173 on 2026-10-18; 66.8k stars; 5.7k commits | BeginFrame on Linux (chrome-headless-shell); `Page.captureScreenshot` on macOS/Windows; experimental `drawElementImage` path (macOS GPU only) | N **separate browsers**, contiguous or interleaved frame ranges, chunk MP4s concatenated | **Adaptive sub-frame**, AE model (details below) |
| **OpenFilm** | MIT | created 2026-10-04; very active; 966 stars | Puppeteer screenshot (JPEG q95 / PNG) | N browsers, contiguous chunks | fixed K samples, FFmpeg `tmix` |
| **html-video** (nexu-io / Open Design) | Apache-2.0 | 2026-05-27 → last push 2026-06-21; 4.7k stars | wraps HyperFrames as its only working engine | via HyperFrames | via HyperFrames |
| **video-use** (browser-use) | MIT | active; 29k stars | not a renderer: transcript + EDL editing of footage; overlays come from HyperFrames/Remotion/Manim | — | — |
| **Shotstack** | proprietary SaaS | active | cloud JSON timeline API, not HTML | cloud | — |
| **editly** | MIT | last push 2025-05; v0.15.0-rc.1 | FFmpeg + canvas/Fabric, declarative JSON5 [memory] | — | — |
| **FFCreator** | MIT | last push 2024-12; v6.8.1 (2023) | Node + headless-gl/Pixi [memory] | — | — |
| **timecut / timesnap** | BSD-3 | dead since 2022–2024 | virtual-time JS shim (overrides rAF, `Date`, timers) + screenshots [memory] | — | — |
| **puppeteer-screen-recorder** | MIT | last push 2025-01 | real-time screencast, **not deterministic** | — | — |
| **puppeteer-capture** | MIT | v1.58.0 | `HeadlessExperimental.beginFrame` + virtual clock; README says Linux **and Windows** | — | — |
| **WebVideoCreator** | Apache-2.0 | last push 2024-01 | BeginFrame + virtual time + GPU; screenshot "compat mode" needed on macOS, said to be **~40% slower** | multi-page | — |

### HyperFrames in depth [verified from source and HeyGen's post]
- **Contract:** each composition exposes `window.__hf = {duration, seek(t)}`. The renderer never calls `play()` and rAF never drives anything. Seek times are quantised (`Math.round(t*fps)/fps`). Libraries plug in via `FrameAdapter` (`init`, `getDurationFrames`, `seekFrame`), with GSAP as the default ([HeyGen research post](https://www.heygen.com/research/html-to-video)).
- **BeginFrame capture (Linux only):** `chrome-headless-shell` with `--deterministic-mode --enable-begin-frame-control --run-all-compositor-stages-before-draw --disable-threaded-animation --disable-threaded-scrolling --disable-checker-imaging --disable-image-animation-resync --enable-surface-synchronization`. Screenshots are JPEG q80 with `optimizeForSpeed`. **Pitfalls:** the main thread doesn't tick between CDP calls, so `document.fonts.ready` hangs (fixed with a warm-up loop of `beginFrame({noDisplayUpdates:true})` every 33 ms); and `waitForFunction` hangs because rAF never fires. HeyGen reports that **on macOS and Windows Chrome crashes or misbehaves under that flag combination, so they fall back to `Page.captureScreenshot`** with heuristics (fonts ready, computed styles, pixel hashes) they call "not the most robust". That conflicts with puppeteer-capture and WebVideoCreator, which claim BeginFrame works on Windows. **We should test this ourselves.** A third-party troubleshooting guide says Chromium 147+ removed `HeadlessExperimental.beginFrame`, but I could not confirm that: the CDP docs still list it ([CDP](https://chromedevtools.github.io/devtools-protocol/tot/HeadlessExperimental/)). HyperFrames itself feature-detects BeginFrame and falls back.
- **Video elements:** FFmpeg pre-extracts frames to JPEG, then a `<video>` is swapped for an `<img>` with copied computed styles. Fonts are inlined as base64. Authoring bans `Date.now()`, unseeded `Math.random()` and render-time fetches.
- **Parallelism** ([`parallelCoordinator.ts`](https://github.com/heygen-com/hyperframes/blob/main/packages/engine/src/services/parallelCoordinator.ts)): **one browser per worker**, because "sharing also crashes BeginFrame and serializes screenshots". This is a direct contrast with Remotion's tabs in one browser and worth benchmarking. Auto worker count is `floor(cpus/8)`, clamped to 6–16, with an explicit maximum of 24. The memory budget per worker was revised upward after OOMs; at about 500 MB of parent V8 heap per worker, 6 workers exhausted a 4 GB heap. Interleaved stride distribution keeps the streaming encoder's reorder window at O(workers) frames. Silent worker exits on Windows were seen in the field.
- **Motion blur** ([`motionBlur.ts`](https://github.com/heygen-com/hyperframes/blob/main/packages/engine/src/services/motionBlur.ts)), which is almost exactly what we planned:
  - AE shutter model: `shutterTime = angle/360/fps`, `windowStart = t + phase/360/fps`, sample k at `windowStart + (k+0.5)/N * shutterTime`. Defaults are angle 180 and phase −90 (centred).
  - Seek times are built from an **integer tick grid** (`fps * 4096` ticks per second) so every host computes identical times. Times before 0 clamp to 0, as AE does.
  - **Adaptive:** capture the two shutter-window edges as probes and compute the mean absolute byte difference. A diff of 3 or less gets 16 samples, 6 or less gets 32, anything more gets 64 (the cap). Calibration is described in PR #4029, and the 32 step is interpolated.
  - Fixed `samplesPerFrame` is clamped to 1–64.
  - Frames whose whole shutter window (plus the previous frame's window) falls in a known-static range reuse the previous output buffer.
  - The blend runs in sRGB by default to match AE's 8-bpc non-linear behaviour; `linear` is an option. Averaging is done **on the CPU in Node over decoded PNGs**. That's the main inefficiency we can beat.
- **Other ideas worth taking:** static-frame dedup (anchor-verified, on by default in screenshot mode); a lint/check/snapshot/inspect CLI for agents; `doctor`; a skills pack (`npx skills add heygen-com/hyperframes`); worker-sizing provenance logged for telemetry.
- **Telemetry:** on by default; disable with `hyperframes telemetry disable`.

### OpenFilm in depth [verified]
- **Contract:** `window.film = { frame(t), duration?, ready?: Promise, width?, height? }`. "The same `t` always draws the same picture, whatever was drawn before". Frames are requested out of order, in parallel and at fractional times (for blur). This matches our `render(t)` baseline one to one ([README](https://github.com/openfilm/openfilm)). A `film.html` holds tracks of `<section>` elements with `<iframe>`/`<video>`/`<audio>` clips using media fragments (`#t=12,18`) and an `at` attribute.
- **`openfilm look`** draws every frame of a contact sheet **twice, in two shuffled orders, and names frames that changed**: an automatic determinism check. It also flags font failures, missing audio and text clipped by the frame. That's an excellent agent-facing QA idea.
- **Render** ([`render.mjs`](https://github.com/openfilm/openfilm/blob/main/packages/openfilm/src/render.mjs)): N browsers, each with a contiguous chunk. Blur uses `samples` (default 8 with `--blur`) and `shutter` 0.5, capturing `fps*samples` JPEGs and piping them to FFmpeg as `image2pipe` with `tmix=frames=K` + `select`. That's simple but very wasteful: K JPEG encodes and decodes per frame, and no adaptivity. Encode settings are libx264 `medium` CRF 16 with tagged BT.709, VP9 or ProRes 4444 for alpha.

**Take (agent tools):** the HyperFrames adaptive-blur design and tick grid; one browser per worker; OpenFilm's `frame(t)` contract and shuffled-order determinism check; HyperFrames' lint/inspect/snapshot commands; skills packaging; BT.709 tagging.
**Avoid:** CPU-side PNG averaging; JPEG round-trips per sub-sample; telemetry by default; a GSAP-only time model; the sheer size of the HyperFrames codebase.
**Verdict:** **Beside** both, but read their code closely. Both licences (Apache-2.0 and MIT) allow copying code into an MIT/Apache project with attribution (keep NOTICE/LICENSE headers).

---

## 7. After Effects and DaVinci Resolve Fusion

### After Effects
- **Motion blur settings** (Composition Settings → Advanced) [secondary + memory; Adobe's helpx returned 403, so official ranges were not re-verified]:
  - **Shutter Angle:** default 180°. The range is 0–720° from memory; "720" did not appear in any source I could read today.
  - **Shutter Phase:** default −90° since CS3 (−½ the angle, which centres the blur). It was 0° before CS3, so blur trailed the action ([PVC](https://www.provideocoalition.com/motion_blur/)).
  - **Samples Per Frame:** default 16, maximum 64. It applies to **3D layers, shape layers and some effects**.
  - **Adaptive Sample Limit:** applies to **2D layers**, maximum 256, default 128 (per a 2009 forum post). AE "looks at a layer and decides how many subframes it should use to avoid echoes, up to the maximum". As I understand it [memory], the count scales with how far the layer moves on screen within the shutter. **That is exactly the per-layer, motion-proportional sampling our tool wants.** HyperFrames approximates it per *frame* with a pixel-diff probe, not per layer.
  - Two switches: per-layer motion blur, plus the comp-level "Enable Motion Blur". Render Settings can override with on for checked layers, or off for all.
- **Precomps and nested comps:** a precomp renders as a flattened layer. **Collapse Transformations** (the "star" switch) reorders rendering so nested layers are transformed in the parent's space (sharp vectors, shared 3D camera). The known trap is that collapsing changes the render order, so motion blur can vanish or behave oddly, and blur set inside a precomp covers only internal motion, not the container's movement ([School of Motion](https://www.schoolofmotion.com/tutorials/collapse-transformations-continuously-rasterize-after-effects), [PVC](https://www.provideocoalition.com/?p=4407)) [secondary]. **Lesson:** decide explicitly whether the shutter integrates the *parent* transform of a nested scene; in a pure `render(t)` model, re-rendering the whole frame at each sub-time integrates everything automatically.
- **Caching:** RAM preview caches rendered frames; the green bar marks cached frames. The Global Performance Cache (CS6+) keeps frames keyed by a hash of the render state, so undo or redo reuses frames, and the disk cache persists them [memory]. **25.2 added "Preview from Disk Cache"**, which streams cached frames from disk into RAM so playback isn't limited by RAM ([Puget Systems](https://www.pugetsystems.com/blog/2025/02/24/upcoming-boost-to-after-effects-preview-playback-with-ram-and-disk-cache/)). AE stops caching new frames when RAM runs out.
- **Draft and preview modes** [memory]: preview resolution (Full, ½, ⅓, ¼, Auto); Fast Previews with Adaptive Resolution (drops resolution during interaction); Draft 3D; Region of Interest; preview "skip frames"; and motion blur and frame blending toggles that are separate for preview and render.

### DaVinci Resolve Fusion
- **Motion blur** is per node, on the node that *creates* the motion (Transform, Merge and so on; Settings tab → Motion Blur) ([DaVinci Resolve Club](https://davinciresolveclub.com/davinci-resolve-motion-blur/)) [secondary]:
  - **Quality:** default **2**, meaning two samples **on each side** of the motion. Higher values are smoother and slower.
  - **Shutter Angle:** default **100°**; 360° is a full frame.
  - **Center Bias:** moves the centre of the blur (for trails).
  - **Sample Spread:** changes the weight given to each sample (brightness).
  - Concatenated transforms are blurred once, using predicted motion. That's an analytic per-node approach, not whole-frame re-rendering [memory].
  - A comp-wide **Motion Blur** toggle sits beside **High Quality** and **Proxy** (right-click the transport area). Fusion Studio's time ruler shows HiQ / MB / Prx / APrx (auto proxy) / Some (selective update) [memory; not verified today].
- **Caching** [memory]: RAM cache per node and per frame (the green bar), Cache to Disk per node, proxies and auto-proxy, and a "Some" mode that only renders the nodes the views need.

**Take:**
- AE's angle/phase/samples vocabulary as our public parameters. Agents and humans already know it, and HyperFrames uses it too.
- AE's *adaptive limit* idea: sample count proportional to on-screen motion, with a floor and a cap.
- Fusion's per-element blur scope, as an opt-in (`data-blur` on moving layers) for when whole-frame re-render is too costly.
- Draft-versus-final toggles (`--draft`: ½ resolution, blur off or 4 samples; `--final`: full).
- A frame cache keyed by a hash of render state (scene source hash + t + quality), so unchanged ranges aren't re-rendered between agent iterations.

**Avoid:** AE's precomp/collapse trap. Make nested-scene blur semantics explicit and simple.
**Verdict:** **Beside.** Use them as the reference vocabulary and quality bar.

---

## 8. Cross-cutting findings that should shape our design

1. **Capture on Windows is the crux.** Remotion's shared-memory capture is not on Windows. HyperFrames says BeginFrame plus deterministic mode crashes or misbehaves on Windows/macOS. puppeteer-capture and WebVideoCreator say BeginFrame works on Windows. **Benchmark three paths on this laptop:** (a) `Page.captureScreenshot` with `optimizeForSpeed`, JPEG versus raw/PNG; (b) chrome-headless-shell `beginFrame`; (c) HTML-in-Canvas, either a WebGL `texElementSubImage2D` accumulation with one `readPixels`/`toBlob` per output frame, or WebCodecs `VideoEncoder` on the canvas inside the page. Path (c) is the only one where K blur samples don't cost K CDP round trips and K image encodes.
2. **Motion blur should accumulate on the GPU, not in Node.** HyperFrames decodes PNGs and averages them on the CPU, and OpenFilm uses FFmpeg `tmix` over JPEGs. With an RTX 5090, accumulating in a float texture in WebGL/WebGPU, or in a native/CUDA step, is a big untapped win.
3. **Adaptivity:** HyperFrames' two-probe pixel diff (16/32/64) is a good default and cheap. AE's per-layer, motion-proportional approach is better, and achievable if `render(t)` scenes can report each layer's screen-space velocity, or if we diff per region or tile.
4. **Workers:** benchmark tabs in one browser (Remotion) against one browser per worker (HyperFrames' finding that sharing serialises screenshots). Budget RAM per worker (HyperFrames: about 500 MB of parent heap per worker plus Chrome RSS).
5. **Encoding:** NVENC on the 5090 (`h264_nvenc`/`hevc_nvenc`/`av1_nvenc`). Tag BT.709 like OpenFilm. Stream frames into the encoder, sorted by a reorder window.
6. **Agent-first QA:** shuffled-order determinism check (OpenFilm), lint/inspect/snapshot (HyperFrames), contact sheets, Markdown docs plus a skill.

---

## 9. Recommendation: **build from scratch (a thin engine), beside HyperFrames/OpenFilm, not on Remotion or Revideo**

**Why not Remotion**
- *Licence:* free for Mikkel personally, including commercial promos. But an open-sourced tool would pass Remotion's source-available licence to every user. Companies of 4 or more people would need Creators seats (which explicitly count agentic coding tools) or Automators per-render billing plus mandatory telemetry from 5.0. That's incompatible with a permissive open-source release, and the "derivative" clause blocks selling a modified Remotion.
- *Fit:* React plus integer frames versus our pure `render(t)` HTML page. We'd be fighting the framework to inject arbitrary sub-frame times.
- *Speed on this machine:* its shared-memory fast path isn't available on Windows, so we'd get the same `captureScreenshot` path we can drive ourselves.

**Why not Revideo or Motion Canvas**
- Canvas scene graphs can't render our HTML/CSS baseline.
- Motion Canvas has been dormant since Feb 2025. Revideo is a side repo of a commercial product, and its team says engine changes aren't upstreamed.

**Why not just adopt HyperFrames** (the strongest alternative, and a legitimate option)
- *For it:* Apache-2.0, very active, already has adaptive AE-style blur, agent skills and Windows support (via screenshots).
- *Against it:*
  - Its time model is GSAP/adapters plus `data-*` timing attributes, not a bare `render(t)`.
  - It's a ~5.7k-commit codebase with telemetry on by default.
  - On Windows it uses screenshot capture with CPU PNG averaging, the slow path we specifically want to beat with GPU accumulation.
  - Our differentiators (custom adaptive blur, maximum speed on one Windows/RTX box) live exactly in the parts we'd have to rewrite.
- **Recommended use:** install it in `experiments/` as a **benchmark baseline**. Render the same scene with `--workers N` and motion blur on, so we have a number to beat. Copy specific modules with Apache-2.0 attribution where useful: the tick-grid sample timing, the static-window guard, the worker-sizing heuristics.

**Licence implications of building from scratch**
- Our core can be MIT or Apache-2.0.
- Chromium (BSD-style), Puppeteer (Apache-2.0) and FFmpeg are fine; prefer an LGPL FFmpeg build invoked as a separate process. Note that NVENC-enabled builds are often `--enable-nonfree` and not redistributable, so have users supply FFmpeg rather than bundling it.
- **GSAP:** optional, user-installed, never vendored. Avoid shipping a visual GSAP animation builder without Webflow's consent.
- **Theatre Studio:** AGPL, don't embed.
- **Lottie/dotLottie/Rive runtimes:** MIT, fine.
- **HyperFrames/OpenFilm code:** keep attribution (NOTICE for Apache-2.0).

**Uncertainties to resolve by experiment, not research**
- Does BeginFrame work on Windows with chrome-headless-shell today?
- What does an HTML-in-Canvas sub-sample actually cost? Does `drawElementImage` need a full rendering update per call?
- How fast is `captureScreenshot` at 1080p on this machine: JPEG versus PNG, and tabs versus browsers?
- Does `dotLottie.setFrame` interpolate fractional frames?
