# Future ideas

## Rendering
- **[Medium] `dolly dev` hosting the warm pool**: today `dolly daemon` is separate from the player; one process could serve both.
- **[Medium] Daemon: skip page reloads for fully cached renders** (a cached `draft` reloads 12 pages at 960×540 it never uses, and the next sheet reloads them back).
- **[Low] MCP server could start the daemon itself** on first use.
- **[High] Skip browsers when the cache covers the render**: a fully cached final still pays ~5 s start-up.
- **[High] Gamma-correct blur option** (`--blur linear`): CPU float accumulation of a few compositor groups, or HTML-in-Canvas when it gets fast. Compare on the whip.
- **[Medium] Blur preview in the player**: show the accumulated frame when paused (one host iframe set in the player).
- **[Medium] Bias correction** for the compositor tree's +0.7-level rounding bias.
- **[Medium] Native 2160p renders** for YouTube uploads.
- **[Medium] Smarter smear gate**: per-layer smear (world vs elements moving with the camera) instead of the 80 % camera-dominance rule.
- **[Phase 4] Native GPU backend** (CanvasKit / skia-canvas / Vello) behind the same frame contract, validated by golden diffs.

## Authoring
- **[High] More components** from the research list: device/window frames, spotlight/focus ring, callout arrows, keycap shortcut, command palette, code editor/terminal, before/after slider, chart grow, logo wall, word rotator, strike-and-replace, marker sweep, captions auto-timed from VO.
- **[High] 9:16 layout for Price Peek** to exercise `variants` end to end.
- **[Medium] Storyboard → scenes with transitions**: the scaffold uses whips + zoom-into; map every storyboard `transition` value to a camera move.
- **[Medium] GSAP / Lottie / Rive adapters** (seek by time; seeded randomness).

## Lint
- **[Medium] easing-role, overshoot, spring-settled-at-cut, camera-judder, flash-safety, text-on-busy-background** rules from `docs/research-notes/05-motion-grammar.md` (need keyframe/camera metadata or pixel sampling).
- **[Low] Per-project rule config** in `dolly.json`.

## Audio
- **[Phase 4] VO hooks** (ElevenLabs etc.) with word timings → subtitles and VO-driven timing. Never call paid services without asking.
- **[Phase 4] Beat detection** to auto-place markers.
- **[Medium] SFX cue sheet → audio track** (the parallel Price Peek session's `sound-plan.md` is a good format to support).
