# dolly

Code-driven motion graphics for product promos, launch films and feature explainers, rendered as fast as the machine allows. Built for AI coding agents first: every command has `--json` output and returns images (stills, contact sheets) the agent can look at; a Claude Code plugin teaches the scene API, the motion-grammar rules and the review loop.

Every scene is a pure function of time, `render(t)`, so frames render in parallel, cache per scene, seek instantly and can be checked for determinism.

| | Price Peek promo, 30 s, 1080p60 |
|---|---|
| Hand-written page + serial recorder (6 fixed blur samples) | ~20 min |
| dolly final render (adaptive blur, 1–32 samples per frame, NVENC) | **42 s** |
| dolly draft (960×540, 30 fps) | **10 s** |
| dolly re-render after editing one scene | **22 s** |

Numbers and methods: [`docs/benchmarks.md`](docs/benchmarks.md). Research and design decisions: [`docs/research.md`](docs/research.md). Architecture: [`docs/architecture.md`](docs/architecture.md).

## Install

Needs Node 24+, ffmpeg on PATH (NVENC encoders for the default presets) and a Chromium (`dolly doctor` checks all three).

```bash
git clone https://github.com/MikkelBlom/dolly && cd dolly && npm install && npm link
```

```bash
npx playwright install chromium-headless-shell
```

Claude Code plugin (the `dolly` skill, `/dolly:new-video`, `/dolly:review`, `/dolly:final-render`, and the MCP server that returns stills and contact sheets inline):

```bash
claude plugin marketplace add MikkelBlom/dolly && claude plugin install dolly@dolly
```

## Use

```bash
dolly new my-video --title "My product"     # or --storyboard storyboard.json
dolly daemon my-video --detach              # optional: keep browsers warm (sheet ~0.5 s instead of ~3.5 s)
dolly sheet my-video                        # labelled contact sheet PNG
dolly lint my-video                         # motion-grammar findings with timestamps
dolly draft my-video                        # 960×540 pacing draft
dolly render my-video                       # 1080p60, adaptive motion blur, YouTube preset
dolly dev my-video                          # live player: scrubber, markers, loops, overlays
```

In Claude Code: `/dolly:new-video <one-paragraph brief>`.

A scene:

```ts
import { defineScene, masked, typeIn, flyIn } from "@dolly/core";
let head: HTMLElement[], card: HTMLElement;
export default defineScene({
  name: "hook", start: 0, end: 4,
  setup(ctx) { /* build DOM once in ctx.world / ctx.hud */ },
  render({ t }) { typeIn(head, t, 1.6, 3.4); flyIn(card, t, 0.3, { dx: 300, dy: 80 }); },
});
```

## Packages

| Package | What |
|---|---|
| `@dolly/core` | scene authoring: timeline, keyframes, springs, easings, camera, components, themes, storyboard schema, browser runtime |
| `@dolly/render` | Chromium worker pool, compositor-accumulated adaptive motion blur, frame cache, NVENC/x264/ProRes encoding, audio mux, stills, sheets, bench, determinism |
| `@dolly/lint` | motion-grammar checks |
| `@dolly/player` | `dolly dev` review player |
| `@dolly/cli` | the `dolly` command |
| `@dolly/mcp` | thin MCP server over the CLI |

Tests: `npm test` (core maths, render maths, golden frames for every component, determinism).

## Licence

[Apache-2.0](LICENSE).
