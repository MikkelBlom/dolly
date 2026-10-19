# Working notes

## Decisions made (with reasons)
- **2026-10-19, Mikkel:** build **from scratch** (beside HyperFrames/OpenFilm, not on Remotion/Revideo); name **dolly** (CLI `dolly`); **Apache-2.0**; **public** repo MikkelBlom/dolly. Apache-2.0 also makes borrowing HyperFrames (Apache-2.0) code straightforward, with attribution in NOTICE.
- **GLOBAL_CLAUDE.md is git-ignored** because the repo is public; Mikkel's global rules are his private instructions.
- **Capture = `Page.captureScreenshot` PNG on chrome-headless-shell, GPU flags, one browser per worker.** beginFrame works on Windows (shell 151) but gave no speed gain (117 vs 106 fps). Tabs in one browser serialise (1×8 = 38 fps vs 8×1 = 76).
- **Default workers = ¾ of logical cores, max 16** (12 here; measured knee 12 → 107 fps, 16 → 113).
- **Motion blur = compositor tree accumulation** (N scene iframes in nested 50/50 `plus-lighter` groups, one screenshot). Flat 1/N stack rejected (8-bit quantisation per layer).
- **Smear past the cap**: frames needing > 32 samples whose motion is mostly camera get an SVG Gaussian blur on the world layer along the pan (σ = gap/√12), with a filter region sized to the visible world each frame (huge regions make Chromium drop the layer; objectBoundingBox clips the world).
- **Chromium flags that matter for correctness**: `--force-gpu-mem-available-mb=12000` (default budget dropped layers on 32-document hosts), `--disable-lcd-text`, `--disable-low-res-tiling`, `--disable-checker-imaging`. `RENDERER` in `frames.ts` is part of every cache key; bump it when capture changes pixels.
- **No `will-change`** anywhere (lint error): Chromium keeps such layers at their first raster scale → render-order-dependent text.
- **Inactive scenes use `display:none`**; `tf()` sets `visibility: ""` (not "visible") so hidden ancestors still hide children.
- **HTML-in-Canvas is not the fast path today** (~28 ms per sub-frame). Watch item for Chrome 157.
- **npm workspaces**, Node 24 type stripping (no build step); esbuild for scene bundles and the player UI.
- **Lint tuned against the approved Price Peek film** (taste as rules): odometer transitions and live values (≥ 3 text states) aren't reading-time text; font size measured where text rests; outermost entering element counts once; static = < 3 px/s; mobile size only for vertical/square; contrast error only < 3:1.
- **Determinism / golden comparisons are noise-aware**: Chromium leaves a faint render-history-dependent AA fringe on moving text (max ~98 levels; persists with CPU raster and `--disable-partial-raster`). A difference counts as a real mismatch only if > 0.002 % of channels change by > 128 levels or mean > 0.4. Calibrated: the zoomInto colour bug gave 0.138 % strong pixels, noise gives 0.
- **Experiments pin the Price Peek baseline to commit 2a2b909**: the KRW working copy was edited by another session during this one (end-card timings +0.15 s, uncommitted).

## Open technical questions
- sRGB (compositor) vs linear-light blur: compare visually on the whip before choosing the default; HTML-in-Canvas gives linear light when it gets faster.
- Root cause of the residual raster history noise (suspect layer squashing/assignment hysteresis). Worth a minimal repro for a Chromium bug if it matters.
- Start-up is ~4–9 s for 12 browsers (fonts loaded per browser from Google Fonts for Price Peek). A persistent worker daemon (or `dolly dev` keeping a pool warm) would make stills/sheets near-instant.
- Warm-cache renders still take ~17 s (browser start + PNG decode/re-encode of 1,800 frames). Skip starting workers when everything is cached.
- Thermal soak test (≥ 3 min sustained, AC vs battery) not done; renders so far are < 1 min.
- Plugin `bin/` on Windows Git Bash: shim written (`bin/dolly`, `bin/dolly.cmd`) but not verified through an actual marketplace install (the terminal `claude` CLI isn't logged in on this machine).
- The alpha (ProRes/WebM) path is implemented but has not been rendered and checked.

## Concerns
- Compositor accumulation relies on unspecified Chromium behaviour (blend precision of render surfaces). `experiments/verify-blur.ts` compares against a CPU float average; keep running it after Chromium updates.
- `fontCss` (network fonts) makes renders depend on Google Fonts being reachable; self-host for Price Peek once Mikkel OKs downloading the font files.
- Mikkel's existing global skill `~/.claude/skills/motion-promo-video` overlaps the plugin's `dolly` skill (both trigger on "make a promo video"). Needs his call: retire it, or point it at dolly.
