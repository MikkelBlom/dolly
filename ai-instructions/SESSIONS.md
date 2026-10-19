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
