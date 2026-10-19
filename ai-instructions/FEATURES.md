# Features

| Feature | Status | Description | Date | Depends on | Blocked by |
|---|---|---|---|---|---|
| Phase 1 research | Implemented | `docs/research.md` + `docs/research-notes/01–07` | 2026-10-19 | – | – |
| Capture probes | Implemented | `experiments/*.mjs`: single-tab stages, parallel scaling, compositor accumulation, HTML-in-Canvas fidelity + GPU accumulation, blur budget | 2026-10-19 | – | – |
| Monorepo scaffold (core, player, render, lint, cli, mcp, plugin) | Planned | npm workspaces, Node 24 TS type stripping | – | – | Name decision |
| `core`: timeline, springs, easings, keys, camera, components, themes, storyboard schema | Planned | Port + generalise Price Peek toolkit | – | scaffold | – |
| `render`: worker pool, compositor-tree adaptive blur, NVENC, frame cache, stills/sheets, determinism check, bench | Planned | See research.md §2–5 | – | core | – |
| `player`: scrubber, markers, loop, slow-mo, overlays, audio, URL state, aspect ratios | Planned | Vite + HMR | – | core | – |
| `lint`: motion-grammar rules | Planned | research.md §6 | – | core | – |
| CLI + Claude Code plugin (skill, bin/, MCP) | Planned | research.md §7 | – | render, lint | Name decision |
| Price Peek port | Planned | Acceptance 1 | – | core, render | – |
