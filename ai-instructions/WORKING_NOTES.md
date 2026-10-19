# Working notes

## Decisions made (with reasons)
- **2026-10-19, Mikkel:** build **from scratch** (beside HyperFrames/OpenFilm, not on Remotion/Revideo); name **dolly** (CLI `dolly`); **Apache-2.0**; **public** repo MikkelBlom/dolly. Apache-2.0 also makes borrowing HyperFrames (Apache-2.0) code straightforward, with attribution in NOTICE.
- **GLOBAL_CLAUDE.md is git-ignored** because the repo is public; Mikkel's global rules are his private instructions.
- **Capture = `Page.captureScreenshot` PNG on chrome-headless-shell, GPU flags, one browser per worker.** beginFrame works on Windows (shell 151) but gave no speed gain (117 vs 106 fps); screenshots always show the latest DOM. Tabs in one browser serialise (1×8 = 38 fps vs 8×1 = 76).
- **Default 12 workers** from the measured scaling knee (12 → 107 fps, 16 → 113). Needs a ≥ 3 min soak test before freezing.
- **Motion blur = compositor tree accumulation**: N scene iframes, nested 50/50 `plus-lighter` groups, one screenshot. 19× faster than separate captures at N = 32 with 0.74-level mean error. The flat 1/N stack is rejected (8-bit quantisation per layer).
- **HTML-in-Canvas is not the fast path today** (~28 ms per sub-frame). Keep it as a watch item for Chrome 157 and as the route to linear-light GPU blur.
- **PNG over JPEG** for anything that gets accumulated or cached.
- **npm workspaces** over pnpm: pnpm isn't installed, and npm 11 is enough.

## Open technical questions
- sRGB (compositor) vs linear-light blur: compare visually on the whip-pan before choosing the default.
- Sample + smear for N > Nmax: implement, gate on camera dominance, compare.
- ffmpeg PNG decode throughput when 12 workers feed one encoder: may become the bottleneck.
- Memory per worker with 32 iframes (12 × 32 scene instances).
- Thermal: sustained throughput over ≥ 3 min, on AC vs battery; check whether Windows puts headless renderer processes into EcoQoS (efficiency mode).
- Fonts: the baseline loads Google Fonts at render time; the port should self-host fonts.
- Plugin `bin/` on Windows: does a shebang script run from the Git Bash tool? Does it reach the PowerShell tool?

## Concerns
- Compositor accumulation relies on unspecified Chromium behaviour (blend precision of render surfaces). Keep a CPU float-accumulation reference path and a regression test that diffs against it.
- The compositor tree has a +0.7-level brightness bias (rounding); measurable but invisible. Correct it later if needed.
