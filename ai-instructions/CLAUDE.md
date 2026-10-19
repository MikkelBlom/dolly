# dolly — project guide

Read `INDEX.md` first. Mikkel's global rules live in `~/.claude/CLAUDE.md` (a local copy, `GLOBAL_CLAUDE.md`, is git-ignored because this repo is public).

## What this is
**dolly** (CLI: `dolly`) is a local tool that turns code into polished motion-graphics videos (product promos, launch films, feature explainers) and renders them as fast as this machine allows. **The main user is an AI agent (Claude Code)**; Mikkel reviews results and gives direction. Every interface is designed agent-first: fast feedback, structured (`--json`) output, images the agent can look at, no GUI-only steps.

Origin: the Price Peek promo (`C:\Users\mikke\Desktop\Projects\KRW-Extension\store\video\`: `promo-video.html` + `record.js`). It is the baseline, the first port target and the style reference. **Read it; never modify that repo.**

The brief (phases 1–4, acceptance criteria) is recorded in `SESSIONS.md` (2026-10-19 entry) and the research and design in `docs/research.md`.

## Invariants (never violate)
1. **`render(t)` is pure.** Every frame derives from time alone: no state carried between frames, no `Date.now()`, no unseeded randomness. This is what makes rendering parallel-safe, cacheable, seekable and deterministic.
2. **The CLI is the source of truth.** The MCP server and the plugin wrap it; they never contain logic of their own.
3. **Measure before optimising.** Every performance claim has a row in `docs/benchmarks.md` with the command that produced it.
4. **Taste is rules.** When output looks wrong, fix the component or lint rule, not just the one video.
5. **Ask Mikkel before** any paid service (ElevenLabs etc.), publishing, or uploading anything.
6. Errors name the scene, element and time. Exit codes mean something.
7. Genuinely-his decisions (naming, licence, building on Remotion/Revideo) are presented with a recommendation and wait for his answer.

## Machine
Windows 11, Intel Core Ultra 9 285H (6P + 8E + 2LP-E, 16 threads, no HT), 63 GB RAM, RTX 5090 Laptop (driver 610), ffmpeg 8.1 gyan full build, Node 24, Chrome 155, Playwright chromium-headless-shell 151 (`%LOCALAPPDATA%\ms-playwright\chromium_headless_shell-1234`). Laptop: benchmark **sustained**, not burst.
