# Future ideas

## Rendering
- **[High] Gamma-correct blur in the compositor.** The compositor tree averages sRGB values (like `tmix`). Linear-light averaging is more correct (bright streaks over dark keep their energy). Options: CPU linear accumulation of a few compositor-averaged groups; or find a Chromium path with float/linear render surfaces. Measure visually on the whip-pan before deciding it matters.
- **[Medium] Bias correction** for the compositor tree's +0.7-level rounding bias (e.g. offset the leaf opacity slightly).
- **[Medium] Native 2160p renders** for YouTube uploads (real detail, not an upscale), once 1080p is fast.
- **[Phase 4] Native GPU backend** (CanvasKit / skia-canvas / Vello) validated by frame diffs against Chromium.

## Audio
- **[Phase 4] VO hooks** (ElevenLabs etc.) with word timings → subtitles and VO-driven timing. Never call paid services without asking.
- **[Phase 4] Beat detection** to auto-place markers.
