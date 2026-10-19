# Phase 1 research: synthesis and decisions

Date: 2026-10-19. This document holds the conclusions. Sources, quotes and per-claim confidence tags are in `docs/research-notes/01–07`; local measurements and the commands that produced them are in `docs/benchmarks.md`. Where a web source and a local measurement disagree, the local measurement wins: it was taken on this machine.

**In one paragraph:** build a thin engine from scratch, next to HyperFrames and OpenFilm rather than on top of Remotion or Revideo. Capture with chrome-headless-shell, GPU raster, **one browser process per worker** (about 12 workers) and `Page.captureScreenshot` PNG. Do motion blur in a way no existing tool does: **the browser's own compositor averages the sub-frames**. N instances of the scene sit in iframes, are blended as a binary tree of 50/50 `plus-lighter` layers, and are captured as **one** screenshot per output frame. The sample count comes from scene-graph velocity. Encode with NVENC from an in-order pipe. The agent interface is a CLI, wrapped by a Claude Code plugin (skill + `bin/` + a thin MCP server for inline images).

---

## 1. Existing tools: build on, beside, or from scratch?
Full notes: `research-notes/01-existing-tools.md`.

| Tool | What it is (2026-10) | Licence | Steal | Avoid | Verdict |
|---|---|---|---|---|---|
| **Remotion** 4.0.536 | React, frame-indexed; `captureScreenshot` per frame (JPEG q80 default); `--concurrency` = N tabs in one browser pulling from a shared queue; frames stream into ffmpeg. Its shared-memory capture is Linux and macOS ARM only. | Source-available. Free for individuals and companies of ≤3 people. Larger: $25/seat/month ("agentic coding tools" count as seats) or "Automators" $0.01/render with a $100/month minimum; mandatory telemetry in v5 ([LICENSE](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md), [FAQ](https://www.remotion.dev/docs/license/faq), [5.0 migration](https://www.remotion.dev/docs/5-0-migration)) | Streaming frames into the encoder, `delayRender` gating, agent skills format ([remotion-dev/skills](https://github.com/remotion-dev/skills)) | Integer frames only (`useCurrentFrame`), which fights sub-frame blur sampling. Tabs in one browser don't scale (measured: 1×8 tabs = 38 fps vs 8×1 browsers = 76 fps). Licence would pass to every company that uses an open-sourced tool. | **Beside** |
| **Revideo** (now `midrender/revideo`) | Canvas-2D generator timelines, renders in browser to WebCodecs | MIT | Generator-based sequencing ideas | Canvas only: can't render our HTML/CSS. Engine work now goes to the commercial Midrender product. | **No** |
| **Motion Canvas** | Same model as Revideo | MIT | – | Dormant since Dec 2024 | **No** |
| **Theatre.js** | Keyframe sequence editor | Core Apache-2.0, studio AGPL-3.0 | Keyframe data model | Development went private in 2024; AGPL editor | **No** |
| **GSAP** | Timelines; free incl. commercial since the Webflow acquisition | Free, not open source; bans use in no-code builders competing with Webflow ([standard licence](https://gsap.com/standard-license)) | Paused timelines seek deterministically (`seek`/`progress`) | Bundling it; random/function values differ per worker page unless seeded | **Optional adapter**, user-installed |
| **Lottie / dotLottie / Rive** | Vector animation players | MIT | `goToAndStop` / `setFrame` / `scrub()` seek | Rive state machines only reproduce when replayed from 0 | **Adapters** for assets |
| **HyperFrames** (HeyGen) | HTML→video for agents. One browser per worker; BeginFrame on Linux, screenshots on Windows/macOS. AE-style adaptive motion blur: diffs the shutter edges, picks 16/32/64 samples, **averages decoded PNGs on the CPU**. HTML-in-Canvas fast path on macOS. ([repo](https://github.com/heygen-com/hyperframes), [motionBlur.ts](https://github.com/heygen-com/hyperframes/blob/main/packages/engine/src/services/motionBlur.ts)) | Apache-2.0; telemetry on by default | Integer tick grid for sample times; skip static shutter windows; one-browser-per-worker coordinator; agent skills pack | CPU averaging (our compositor tree is ~19× faster per sample); its timing model isn't our `render(t)` | **Beside**; speed baseline to beat |
| **OpenFilm** | `frame(t)` contract, exactly ours ([repo](https://github.com/openfilm/openfilm)) | MIT | `look`: renders frames twice in two shuffled orders and reports differences (an automatic determinism check) | Fixed-count JPEG blur in ffmpeg | **Beside**; copy the determinism idea |
| editly, FFCreator, timecut, timesnap | Older HTML/canvas→video | various | – | Stale | No |
| **After Effects** | Precomps; Samples Per Frame (default 16, max 64) for 3D; **Adaptive Sample Limit** (up to 256) for 2D layers picks samples per layer to avoid visible echoes; global cache keyed on render-state hash; disk-cache playback | – | Per-layer adaptive sampling; cache keyed on a hash of inputs; draft/full quality switch | Collapse-transformations blur bugs | Model to copy |
| **Fusion** | Per-node motion blur (Quality = samples per side, shutter angle, centre bias); comp-wide blur toggle beside HQ/Proxy | – | Global "blur off" draft switch | – | Model to copy |

**Recommendation: build from scratch, as a thin engine beside these tools.** Reasons:
1. **Speed:** the levers that matter here (one browser per worker, compositor-side accumulation, adaptive per-frame sampling, NVENC) all live inside the renderer. Remotion's renderer can't be swapped out, and its integer-frame model fights sub-frame sampling.
2. **Fit:** our scenes are hand-written HTML/CSS with a pure `render(t)`. That excludes the canvas-only tools (Revideo, Motion Canvas) and Remotion's client renderer (no blend modes or z-index).
3. **Licence:** Mikkel alone is covered by Remotion's free tier. But a tool built on it carries Remotion's company licence to every user at a company of 4+ people. A from-scratch engine can be MIT.
4. **Small engine:** the baseline's whole toolkit is about 100 lines. The value is in components, rendering and the agent loop, not in a framework.

## 2. Deterministic, fast frame capture from Chromium
Full notes: `research-notes/02-chromium-capture.md`. Measurements: `benchmarks.md` iteration 0.

- **Screenshot cost is PNG encoding, not rendering.** `render(t)` takes 2 ms; `captureScreenshot` PNG at 1080p takes 80–108 ms. The GPU sits at ~3%.
- **`HeadlessExperimental.beginFrame` still works in chrome-headless-shell 151 on Windows**, with GPU flags. It is not faster here: 117 vs 106 fps at 12 workers. It returned no screenshot with SwiftShader. `Page.captureScreenshot` already forces a fresh frame of the current DOM, so no rAF dance is needed. **Decision:** use screenshots and keep beginFrame as an experiment flag only. HeyGen reports deterministic-mode crashes on Windows.
- **Format:** PNG (lossless, needed for accumulation and caching). JPEG captures ~1.4–1.6× faster but leaves structured artefacts once averaged. WebP is slower than PNG. Use `optimizeForSpeed: true`.
- **GPU raster:** headless-shell defaults to SwiftShader. `--enable-gpu-rasterization --ignore-gpu-blocklist --use-angle=d3d11` puts it on the RTX 5090 (confirmed via `WEBGL_debug_renderer_info`) and is 1.3× faster at 12 workers (106 vs 82 fps). **Frames are bit-identical across runs and workers with GPU raster** (SHA-1 match). The determinism check stays in the tool because this is measured, not guaranteed.
- **Virtual time:** not needed for a pure `render(t)`. Ban CSS animations/transitions and autoplaying media in scenes, and lint for them.
- **HTML-in-Canvas** (`drawElementImage`, `texElementImage2D`, `captureElementImage`): present in Chrome 155 and headless-shell 151 behind `--enable-features=CanvasDrawElement`; ships in Chrome 157. Actual WebGL signature: `texElementImage2D(target, internalformat, element)` with RGBA8 / **SRGB8_ALPHA8** / RGBA16F / RGBA32F. Measured:
  - **Fidelity:** near-identical to screenshots; < 1% of pixels differ, at anti-aliased edges of 3D-tilted cards and text.
  - **Speed:** works, and gives correct linear-light GPU accumulation, but costs ~28 ms per sub-frame (upload plus a readback that scales with N) vs ~5.5 ms for the compositor tree. **Decision:** not the fast path today. It's a watch item for Chrome 157+ and the most promising route to gamma-correct GPU blur.
- **Font/image gating:** `document.fonts.ready`, `img.decode()`, and a `ready` promise per scene before frame 0. Self-host fonts in the project so renders don't depend on the network. The baseline loads Google Fonts at render time.
- **Remotion** captures with JPEG `captureScreenshot` (no beginFrame), with half the CPUs (≤ 8) as tabs in one browser.

## 3. Parallelism
Full notes: `research-notes/03-parallelism-motion-blur.md`.

- **One browser process per worker.** Tabs share a browser's GPU process and compositor and serialise: 1 browser × 8 tabs = 38 fps; 8 browsers × 1 tab = 76 fps.
- **Worker count: default 12, measured.** Scaling is 1 → 12 fps, 4 → 43, 8 → 76, 12 → 107, 16 → 113. The knee is at 12 because PNG encoding saturates the 14 P+E cores. The research formula `(P + 0.65E)/1.4` gives 8; the measurement beats it, so trust the measurement. 20 s sustained runs showed no drop in the second half. A ≥ 3 min soak test on battery and on AC is still to do before freezing the default. `--workers` overrides it.
- **Scheduling:** a dynamic queue of contiguous chunks (30–60 frames) handed out in frame order. All sub-samples of a frame stay on one worker, which the compositor approach gives for free. Static slices balance badly because blurred frames cost up to ~2× more.
- **Encode topology:** workers → in-order reorder buffer → one ffmpeg (NVENC). NVENC does 1080p at 180–400 fps per engine, so it isn't the bottleneck; PNG decode in ffmpeg may be (to measure). Per-slice files are used only for the frame cache, as lossless intra-only files (PNG frames or FFV1), never GOP-coded slices joined with `-c copy`.
- **Where the bottleneck moves:** today it's Chromium's PNG encoder on the CPU. Next comes ffmpeg's PNG decode and CDP base64 transfer (~60 MB/s at 112 fps; not limiting yet). After that, raw pixels from HTML-in-Canvas would move it to the GPU.

## 4. Motion blur done right
Full notes: `research-notes/03-parallelism-motion-blur.md`. Measurements: `benchmarks.md`.

- **Shutter:** 180° by default (configurable), centred on the frame time (AE phase −90°, Blender "center on frame"). Stratified sample times `t + ((i + 0.5)/N − 0.5) · (angle/360)/fps`, on an integer tick grid so every worker computes identical times.
- **Adaptive sample count per frame:** `N = clamp(ceil(L / g), 1, Nmax)`. L is the largest on-screen path length (px) during the shutter, from camera velocity × zoom plus element velocities from the scene graph. g is the allowed gap between copies: 1.5 px pure, 4–6 px with smear. Take the max of L over ±2 frames so quality doesn't pump.
  - **Price Peek, camera only (a lower bound):** 1,645 of 1,800 frames need 1 sample; the whip-pan moves **130 px per shutter**, which needs 87 samples at g = 1.5. With Nmax = 32, the whip still has 4 px gaps.
  - The 16-sample render of the whip visibly steps; today's fixed 6 samples leave 22 px gaps, hence the ghosting.
- **Accumulation on the GPU, novel approach, measured:** N iframes of the scene, each at its own sub-frame time, blended by Chromium's compositor as a **binary tree of 50/50 `plus-lighter` groups**, captured once.
  - 32 samples cost 177 ms vs 3,335 ms as separate captures: **19× faster**.
  - Mean error vs float averaging is 0.74 levels (max 4, bias +0.7).
  - A flat stack (opacity 1/N each) quantises every layer: 28 dB PSNR at N = 32. The tree fixes it at any N.
  - 12 workers × 32 samples = 21 output fps (682 sub-frames/s). The baseline does 9 sub-frames/s.
- **Colour space:** the compositor averages **sRGB** values, the same as the baseline's `tmix`; `--force-color-profile=scrgb-linear` doesn't change that. Linear-light averaging is more correct: bright streaks keep their energy. It's available via HTML-in-Canvas + WebGL (measured correct, slower) or via CPU float accumulation of separate captures. **Plan:** compositor-sRGB by default, `--blur linear` as the slow, correct option; compare them on the whip before choosing the default.
- **Sample + smear:** for N > Nmax, add a directional box blur of length g along the dominant (camera) motion to the accumulated frame. Averaging and convolution are linear, so it fills the gaps (Blender EEVEE does this). Gate it on the camera dominating L, because it wrongly smears screen-fixed HUD layers. To implement and compare visually.
- **Rejected:** velocity-buffer post blur (bad on disocclusion and crossing motions); CSS/SVG blur (isotropic or axis-aligned only); ffmpeg `tmix` (CPU, fixed N, sRGB).
- **Alpha renders** must average premultiplied colour, or edges fringe.

## 5. Encoding
Full notes: `research-notes/04-encoding.md`.

| Preset | Args (core) | Why |
|---|---|---|
| `draft` | 960×540, 30 fps, `h264_nvenc -preset p1 -cq 28` | Pacing checks only; as fast as possible |
| `youtube` (default final) | `h264_nvenc -preset p7 -tune hq -rc vbr -cq 16 -b:v 0 -multipass fullres -bf 2 -b_ref_mode middle -spatial-aq 1 -temporal-aq 1 -g 30`, BT.709 tags, `+faststart`, AAC-LC 48 kHz 384k | Matches YouTube's upload spec (closed GOP of half the frame rate, 2 B-frames, 4:2:0). High-bitrate source → better YouTube re-encode |
| `youtube-hevc` | `hevc_nvenc -preset p7 -tune uhq -profile:v main10 -pix_fmt p010le -cq 18` | ~12% better compression with UHQ on Blackwell, at ~½ speed; 10-bit source |
| `archive` | `libx264 -preset slow -crf 14` (or FFV1 lossless) | CPU, archival |
| `alpha` | `prores_ks -profile:v 4444 -pix_fmt yuva444p10le -alpha_bits 16 -vendor apl0` (.mov); `libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0` (.webm) for web | Overlays for editors / browsers |
| `web-av1` | `av1_nvenc` + H.264 fallback | Self-hosted embeds only; no benefit for YouTube uploads |

- **Colour:** always `scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int` plus explicit `-colorspace/-color_primaries/-color_trc bt709`. ffmpeg assumes BT.601 for RGB input otherwise, which shifts brand colours.
- **Banding:** dither gradients in the HTML layer. There's no evidence YouTube preserves 10-bit SDR.
- **Audio:** two-pass `loudnorm` I = −14, TP = −1, `linear=true`; duck music under VO with `sidechaincompress`; `amix normalize=0`; check AAC priming offset (~21 ms) for sync.
- **Native 2160p** renders are real detail for YouTube (an option for later).

## 6. What makes promo videos good, and the lint rules
Full notes (36 rules with thresholds, detection methods and sources; component specs): `research-notes/05-motion-grammar.md`. Mikkel's existing skill (`~/.claude/skills/motion-promo-video/references/motion-grammar.md`) holds the rules proven on Price Peek ("PowerPoint" rejected → "GREAT" approved). The new rules extend it.

Core patterns: one world filmed by a continuous camera; every transition a camera move or match cut; holds never sit still; one idea per beat (≤ 9 words); easing by role (entrances ease out, exits ease in, moves ease in-out, linear only for things that never stop); low-bounce springs (≤ 5% overshoot for UI); stagger 30–80 ms; exits faster than entrances; beat grid (120 BPM = 0.5 s); cut on action and on downbeats; reading time ≥ 0.3 s + 0.06 s/char (or ≤ 20 chars/s); text ≥ 22 px at 1080p (≥ 3% of height for mobile); title-safe 90%; WCAG 4.5:1 (3:1 large); ≤ 3 flashes per second; logo hold 3–5 s.

The linter samples the scene graph (bounds, opacity, transform, text, font size, colours, camera) over time and emits `{rule, severity, t0, t1, scene, element, message}`. The first set to build, in priority order: `text-reading-time`, `safe-area-title`, `static-span`, `min-text-size`, `contrast-wcag`, `simultaneous-entrances-without-stagger`, `cut-on-beat`, `cut-on-motion`, `linear-easing-on-ui`, `overshoot-limits`, `hold-before-exit`, `logo-hold`, `flash-safety`, `camera-judder`.

**Caveat:** no first-party write-ups from Linear, Raycast, Arc, Stripe, Vercel or Figma exist; those patterns are secondhand. Thresholds tagged `[proposed]` in the notes should be tuned by frame-stepping reference films.

## 7. The agent interface
Full notes: `research-notes/07-agent-interface.md`.

- **CLI core: confirmed.** It's deterministic, scriptable, testable, cheap in context, and works from any shell or project. Every command takes `--json`, prints image paths, uses meaningful exit codes, and names the scene/element/time in errors.
- **Claude Code plugin: confirmed.** One repo acts as its own marketplace.
  - The plugin ships the **skill** (SKILL.md < 500 lines, with references for the scene API, components, motion grammar and the review loop) and slash commands as skills (`/…:new-video`, `/…:review`, `/…:final`).
  - It also ships **`bin/`**: plugin executables go on the Bash tool's PATH, so the CLI works without a global install. A Windows shebang script needs verifying; `npm link` is the fallback.
- **Thin MCP server: confirmed, with a narrower role.** Images in MCP results show inline (one round trip instead of Bash then Read; the full-size original is saved too). Tool search now defers MCP schemas, so context cost is small.
  - Tools: `still`, `sheet`, `lint`, `render_start` / `render_status` (start-and-poll, because MCP progress display is unverified and calls over 2 min get backgrounded).
  - It also serves Claude Desktop (stdio / `.mcpb`). claude.ai would need a hosted HTTPS connector, so it's out of scope.
  - It shells out to the CLI's library; no logic of its own.
- **Images:** keep them small. The Read tool downsizes and re-encodes above ~500 KB. Contact sheets (N×M frames with timestamps burnt in) beat many stills.
- **Evals:** `claude plugin eval` can grade a rendered contact sheet with an LLM judge, which is a route to acceptance test 4 (a fresh session making a video from a brief).

## 8. Architecture consequences (Phase 2 plan)
- **Scene runtime:** each scene document must be instantiable N times on one page for compositor blur. Scenes run in iframes (one document per sample), which also isolates ids and globals.
- **Monorepo:** npm workspaces. pnpm isn't installed; npm 11 does workspaces with no extra tooling. Node 24 runs TypeScript with type stripping, so the CLI needs no build step (`tsc --noEmit` for checking). Vite serves the player and bundles scene code (HMR).
- **Frame cache:** key = hash(scene bundle hash + t + sample count + shutter + size + params); value = the PNG Chrome already produced. Editing one scene invalidates only that scene's frames.
- **Projected final render, Price Peek 1080p60 with adaptive blur:** roughly 0.5–1.5 min vs 20 min. Basis: 12 workers; ~107 fps for 1-sample frames, 21–37 fps for 16–32-sample frames; camera-only budget 3,239 sub-frames; element motion will add some. This is an estimate until the pipeline exists; Phase 2 measures it.
- **Projected draft (960×540, 30 fps, no blur):** a few seconds (900 frames; capture cost scales roughly with pixels). Also to measure.
