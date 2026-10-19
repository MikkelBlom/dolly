# Features

| Feature | Status | Description | Date | Depends on | Blocked by |
|---|---|---|---|---|---|
| Phase 1 research | Implemented | `docs/research.md` + `docs/research-notes/01–07`, local capture probes in `experiments/` | 2026-10-19 | – | – |
| `core`: math, easings, springs, keys, stagger, seeded noise | Implemented | Pure, tested (`packages/core/test`) | 2026-10-19 | – | – |
| `core`: camera + shot-language path builder, parallax, world/screen transforms | Implemented | `cameraPath(stage).at/move/whip/pullBack/push/focus` | 2026-10-19 | – | – |
| `core`: video/scene model, markers, aspect variants, runtime (`window.__dolly`) | Implemented | render/motion/inspect/setSmear; deterministic clock; scenes hidden outside [start,end) | 2026-10-19 | – | – |
| `core`: components | Implemented | masked type, odometer roll/slide, badge/chip/card, popIn/flyIn/land/bob, cursor, typing, 3D tilt/swingIn, parallax grid, zoomInto, lower third, end card | 2026-10-19 | – | – |
| `core`: themes/tokens, storyboard schema + validator | Implemented | CSS vars; `dolly storyboard check/schema` | 2026-10-19 | – | – |
| `render`: worker pool, compositor-tree adaptive blur, smear, plan cache | Implemented | One browser per worker; 1–32 samples per frame | 2026-10-19 | core | – |
| `render`: frame cache keyed per scene | Implemented | Editing one scene re-renders only its frames | 2026-10-19 | – | – |
| `render`: encode presets (NVENC H.264/HEVC/AV1, x264, ProRes 4444 alpha, VP9 alpha, FFV1), audio mux with ducking + loudnorm | Implemented | Alpha path implemented, **not yet verified by a render** | 2026-10-19 | – | – |
| `render`: stills, contact sheets, bench, determinism (noise-aware) | Implemented | | 2026-10-19 | – | – |
| `lint`: motion-grammar rules | Implemented | 13 rules, tuned against the approved Price Peek film | 2026-10-19 | render | – |
| `player` (`dolly dev`) | Implemented | scrubber, markers, beat snap, loops, slow-mo, overlays (safe, thirds, bounds, camera, paths, velocity), audio lanes with drag, URL state, aspect switch, hot reload, `window.player` | 2026-10-19 | render | – |
| CLI `dolly` | Implemented | new/info/still/sheet/draft/render/lint/diff/bench/dev/storyboard/doctor/mcp, `--json`, exit codes | 2026-10-19 | – | – |
| MCP server | Implemented | inline images, render jobs, lint/info/new | 2026-10-19 | cli | – |
| Claude Code plugin + marketplace | Implemented | skill + references, 3 slash-command skills, bin/ shim, launcher; `claude plugin validate --strict` passes | 2026-10-19 | – | Install test via marketplace not run (CLI not logged in) |
| Price Peek port | Implemented | `examples/price-peek`, ≤ 0.83 levels mean error vs committed original | 2026-10-19 | – | – |
| Golden-frame + determinism tests | Implemented | `packages/render/test` | 2026-10-19 | – | – |
| Self-hosted fonts for Price Peek | Planned | uses Google Fonts CSS at render time | – | – | Mikkel's OK to download the OFL font files |
| 9:16 variant of Price Peek | Planned | variants mechanism exists, no vertical layout authored | – | – | – |
| Phase 4: native GPU backend, VO hooks, beat detection | Planned (designed) | `docs/architecture.md` §Phase 4 | – | – | – |
