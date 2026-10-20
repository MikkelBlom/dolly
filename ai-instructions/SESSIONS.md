# Sessions

## 2026-10-19 · Claude Code (Opus 5.5) · Phase 1 research
**Brief (from Mikkel, summarised):** build a local, agent-first tool that turns code into motion-graphics promo videos and renders them as fast as this machine allows.
- **Phase 1:** research, written to `docs/research.md`.
- **Phase 2:** build the monorepo `core` / `player` / `render` / `lint`.
- **Phase 3:** CLI + Claude Code plugin (skill, slash commands) + thin MCP server.
- **Phase 4:** design for later; don't build. Native GPU backend, VO hooks, beat detection.
- **Acceptance:**
  1. Port Price Peek with the same look.
  2. Report draft and final render times against the 20 min baseline, with frames/s per stage from `bench`; adaptive blur smooth on the whip.
  3. Player screenshots: scrubber, markers, loop, slow-mo, overlays.
  4. A fresh Claude session makes a short video from a one-paragraph brief using only the skill and CLI.
  5. Tests for core math and golden frames.
- **Rules:** measure before optimising; taste as rules; ask before paid services, publishing or uploading; genuine decisions (name, licence, build-on-Remotion) go to Mikkel with a recommendation.

**Done:**
- Six parallel research agents covered tools, capture, parallelism + blur, encoding, motion grammar and the agent interface.
- Local probes measured capture paths, scaling, compositor accumulation, HTML-in-Canvas and the blur budget.
- Synthesis written to `docs/research.md`; numbers to `docs/benchmarks.md`; ai-instructions set up.

**Key findings:**
- Baseline capture is 108 ms/frame, bound by PNG encoding.
- 12 browsers → 107 fps.
- Compositor tree blur: 32 samples per screenshot, 19× faster, deterministic.
- HTML-in-Canvas works but is slow today.

**Issues:**
- Subagents could not write `07-agent-interface.md` themselves; the main session wrote it from their report.
- There is no git remote yet: the repo name depends on the name decision.

**Next steps:**
- Mikkel decides on build-on vs scratch, the name and the licence.
- Then Phase 2: scaffold, `core` port, `render` pipeline with real measurements.

## 2026-10-19 (continued) · Claude Code (Opus 5.5) · Phases 2–3 build, acceptance
**Decisions from Mikkel:** build from scratch; name `dolly`; Apache-2.0; public repo MikkelBlom/dolly.

**Done:**
- Monorepo: core (maths, camera, runtime, components, themes, storyboard), render (pool, compositor-tree adaptive blur + smear, cache, encode presets, audio mux, stills/sheets, bench, determinism), lint (13 rules), player (`dolly dev`), CLI, MCP server, Claude Code plugin (skill + references + 3 slash commands + bin shim).
- Price Peek port (`examples/price-peek`).
- Tests: 32 passing, including golden frames and determinism.
- Acceptance: a fresh agent made `examples/snapnote` from a one-paragraph brief using only the skill and CLI (final 25.4 s render).

**Results:**
- Price Peek final 1080p60 with adaptive blur: 41.7 s, vs 20 min baseline.
- Draft: 9.8 s.
- One-scene edit: 22 s.

**Bugs found and fixed while measuring:**
- GPU tile budget dropped layers.
- `will-change` made raster history-dependent.
- Inactive scenes showed through `visibility`.
- Iframe stage scale stuck at 0 (no resize event).
- `zoomInto` left state behind.
- Blur-host readiness race.
- Pixel-based determinism false positives.

**Issues:**
- Terminal `claude` CLI isn't logged in, so the "fresh session" was a subagent, and marketplace install wasn't exercised.
- Another session edited the KRW baseline during this session (end-card +0.15 s, uncommitted); experiments pin commit 2a2b909.

**Next steps:** see WORKING_NOTES open questions and FUTURE_IDEAS (warm worker daemon is the biggest agent-loop win).

## 2026-10-20 · Claude Code (Opus 5.5) · Faster agent review loop
**Done:**
- `dolly daemon [project] [--detach] [--idle 30] [--status] [--stop]`: keeps a project's session (bundle server + 12 workers) warm, runs the CLI's own commands in-process and streams their output back; `still/sheet/lint/info/diff/render/draft` use it automatically (`--no-daemon` / `DOLLY_NO_DAEMON=1` opt out). Rebuild on every command + reload pages only on change; file watcher reloads in the background; dead browsers are replaced.
- `render()` opens a lazy session: a fully cached render (plan + all frames) starts no Chromium (scene metadata cached per bundle).
- Fixed a latent debugging-port collision between dolly processes (port 0 + `DevToolsActivePort`).
- Tests: 37 (5 new: port collisions, lazy session, warm refresh/size change, daemon output identity, daemon status).

**Results** (`docs/benchmarks.md` iteration 3, Price Peek): warm `sheet` 3.16 → 0.54 s, `still` 2.42 → 0.27 s, `info` 2.14 → 0.17 s, `lint` 4.58 → 1.62 s; fully cached `render` 16.2 → 7.5 s, cached `draft` 4.9 → 1.1 s.

**Issues:** fonts.gstatic.com reset connections for several minutes, so every cold Price Peek command failed meanwhile (network fonts, see WORKING_NOTES concerns). The worktree's `examples/snapnote/fonts/` is git-ignored, so Snapnote can't render from a fresh clone.

**Next steps:** daemon skips page reloads for fully cached renders; MCP server/plugin could start the daemon; cache encoded segments so a cached render doesn't re-encode 1,800 PNGs.
