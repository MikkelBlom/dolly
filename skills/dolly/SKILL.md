---
name: dolly
description: Make motion-graphics videos from code with the dolly tool — product promos, launch films, app/extension store videos, feature explainers, animated demos, 15–60 s, 16:9 or vertical. Use whenever the user wants a promo or launch video, a product teaser, an animated walkthrough or "a video for X", or is working in a project that has a video.ts. Covers the brief → storyboard → draft → contact sheet → lint → final render loop, the scene API (camera, springs, masked type, cursor, typing, odometer, end card), the motion-grammar rules, and fast rendering with adaptive motion blur.
---

# dolly: motion-graphics videos from code

A video is a TypeScript project (`video.ts` + `scenes/*.ts`) whose every frame is a **pure function of time**: `render(t)` sets every animated property from `t` alone. That makes frames parallel-safe, cacheable and seekable — and it is the one rule you must never break.

You work through the `dolly` CLI (on PATH via this plugin, or `npm link` from the repo). Every command takes `--json`; image commands print PNG paths — **read them** to see the frames. With the MCP server enabled, `dolly_sheet` / `dolly_still` return the images inline instead.

## The loop (follow it, in order)

1. **Facts and brand.** Read the product: README, UI code, store images, existing art. Use its real UI, copy, numbers, fonts and colours. Numbers on screen must be computed the way the product computes them (copy the logic in).
2. **Storyboard** (`storyboard.json`, see `references/storyboard.md`): 4–6 scenes for ~30 s — hook → promise with proof → differentiator → control/second capability → end card. One idea per scene, headline ≤ 9 words, how the camera gets there. `dolly storyboard check storyboard.json`. Show it to the user if the brief was loose.
3. **Scaffold**: `dolly new <dir> --storyboard storyboard.json` (or `--title … --aspect 9:16`). It writes a project that is ready to render: `dolly sheet <dir>` works right away.
4. **Build scenes** in `scenes/*.ts` with the API below. Replace placeholder cards with the product's real UI rebuilt in HTML/CSS. `references/examples.md` has a complete UI-mock scene (cursor drag with live measurement), a dive into an element that becomes the end card, and a themed end card — read it before your first scene.
5. **Look**: `dolly sheet <dir>` → read the PNG (the file name changes when content or arguments change, so you never re-read a stale sheet). Zoom in with `dolly sheet <dir> --from 6 --to 8 --cols 4 --rows 2` or `dolly still <dir> --times 6.9,7.0`. Check clipped text, overlaps, mask slivers, wrapped words (add `white-space:nowrap`), things off-frame, empty holds.
6. **Lint**: `dolly lint <dir>` — fix errors; judge warnings. Fix the *rule's cause*, not the symptom. Mark background texture (mock article paragraphs, old list items) with `data-dolly-decor` on a container so text rules skip it.
7. **Draft**: `dolly draft <dir>` (960×540, 30 fps, no blur, seconds) for pacing. The user reviews drafts; the player (`dolly dev <dir>`) is the fastest way for a human to scrub.
8. **Final** only after the draft is approved: `dolly render <dir>` (1080p60, adaptive motion blur, NVENC). Then `dolly sheet <dir> --blur --from <whip-0.3> --to <whip+0.3>` to check blur on fast moves.
9. **Deliver**: the MP4 path, the beat timings (markers), and what you could not verify. Commit if it's a repo. Never upload or publish without asking.

Run renders in the background when they take more than a minute. `dolly diff <dir>` proves determinism: it renders frames twice in different orders on different workers and compares the rendered state of every element; a failure names the element and property that differ. ("Raster noise" lines are harmless anti-aliasing differences from Chromium.)

**Debugging a value at time t**: `dolly still <dir> --times 4.8 --inspect --json` returns every visible element's box (stage px), font size, colours and opacity plus the camera, and any `console.log` output from your scenes. In the player (`dolly dev`), `window.player.seek(4.8)` and the bounds/camera overlays show the same.

## Project shape

```ts
// video.ts
import { cameraPath, defineVideo, parallaxGrid } from "@dolly/core";
import { theme } from "./theme.ts";
import hook from "./scenes/hook.ts";
const stage = { width: 1280, height: 720 };          // design size; output resolution is a render option
const camera = cameraPath(stage)
  .at(0, { x: 640, y: 360, zoom: 2.4 }).pullBack(0.3, 1.8, { zoom: 1 })   // reveal
  .push(1.8, 5.5, 0.06)                                                  // holds never sit still
  .whip(5.5, 6.1, { x: 2400 })                                           // next region of the world
  .build();
export default defineVideo({ title: "X", stage, fps: 60, duration: 30, bpm: 120, theme, camera,
  world: { setup(ctx) { grid = parallaxGrid(ctx.screen(0)); }, render({ t }, ctx) { grid(ctx.camera(t), stage); } },
  scenes: [hook, /* … */], markers: [{ name: "whip", t: 5.5, kind: "cut" }] });
```

```ts
// scenes/hook.ts — one file per scene; setup() builds DOM once, render() sets everything from t
import { defineScene, masked, typeIn, flyIn, popIn, badge } from "@dolly/core";
let head: HTMLElement[], card: HTMLElement;
export default defineScene({
  name: "hook", start: 0, end: 6.1,                     // rendered (and visible) only inside [start, end)
  setup(ctx) {
    const h = document.createElement("h2"); h.className = "h"; ctx.world.append(h);
    head = masked(h, "Still doing it |by hand?|");      // |…| = accent colour
    card = document.createElement("div"); card.className = "dolly-card"; ctx.world.append(card);
  },
  render({ t, start }) {
    typeIn(head, t, start + 1.6, 5.2, { stagger: 0.07 });          // rise in, leave up
    flyIn(card, t, start + 0.8, { dx: 300, dy: 80 });               // spring in from offset
  },
});
```

**Layers** (from `ctx`): `ctx.world` moves with the camera; `ctx.hud` stays in screen space (headlines over a scrolling reel); `ctx.screen(z)` is an extra screen layer at z-order z (background 0, world 10, hud 20; cursor ~30, a dolly-target layer ~40, brand mark ~50, end card ~60). `ctx.layers.{world,hud,stage}` are the shared layers for world-level effects (a dolly-through that scales the whole world). `ctx.camera(t)` is the camera state.

**Each scene only touches its own containers**, so the frame cache re-renders only frames a changed scene can affect. Shared values (beat times, product logic) go in a shared module.

## API essentials (full list: `references/api.md`)

- Time: `prog(t, t0, dur)` 0..1 · `keys(t, [[t0, v0], [t1, v1, "quartInOut"]])` (easing belongs to the arriving segment) · `stagger(i, n, { each })` · `snap(x, step)`.
- Easing: `expoOut` (entrances), `quartInOut` (camera moves), `sineInOut` (drifts), `cubicInOut`, `backOut()`, `cubicBezier(…)`; never linear for UI.
- Springs: `spring(t - t0, { freq: 1.8, zeta: 0.5 })` or `{ stiffness, damping, mass }`, `appleSpring(0.5, 0.15)`; `springOvershoot`, `springSettleTime`.
- Camera: `cameraPath(stage).at / move / whip / pullBack / push / focus(rect) / hold / zoomInto`, `parallax(cam, depth, stage)`, `worldToScreen`. Easing arguments everywhere take a function or a name (`"quartInOut"`).
- Type: `masked(el, "text |accent|
second line", { chars })` (plain text; `
` breaks lines) + `typeIn(units, t, tin, tout, { stagger, dur })`.
- Values: `roll(old, new, p)` odometer (numbers only) · `slide(old, new, p)` (labels) · `setHtml(el, html)` (no-op if unchanged) · `countUp`.
- Primitives: `badge(text)`, classes `dolly-chip`, `dolly-card`, `dolly-label`; `popIn` (springy grow from corner), `flyIn` (spring from offset, 0.7 scale, ±9°), `land(t, t0)` impact squash, `bob(t, i)` idle drift.
- UI demo: `cursor(layer, { path: [{ t, at: [x, y] | () => stagePoint(el) }], clicks })` (curved paths, press squash, ripple, live targets) · `typing(t, { t0, gap, text, focused })` · `tilt(ry, rx)` / `swingIn(el, t, t0)` 3D cards · `stagePoint(el, fx, fy)` → `[x, y]`, `stageRect(el)` → `{ x, y, w, h }` (stage px, live layout).
- Transitions & frames: `cameraPath(…).zoomInto(t0, t1, [worldX, worldY], 60)` (dive into a world element until its fill is the screen; see examples) · `endCard(layer, { …, colors })` · `lowerThird(layer, {...})` · `parallaxGrid(layer, { depth })`.
- DOM: `tf(el, transform, opacity)` (hides at 0 opacity), `ensureStyle(id, css)`, `h()`, `html()`.
- Theme: `defineTheme({ colors, fonts, fontFaces, radii, shadows })` → CSS vars `--c-accent`, `--f-display`, `--r-lg`, `--s-float`… Self-host fonts in `fonts/` and list them in `fontFaces`.

## Rules that are easy to break

- **Pure render.** No `Date.now()`, no `Math.random()` (the runtime makes both deterministic, but don't rely on it), no state carried between frames, no `setTimeout`, no CSS animations/transitions (frozen), **no `will-change`** (Chromium keeps such layers at their first raster scale → frames depend on render order; lint errors on it).
- Set every animated property in `render` every frame (both branches of an `if`), or a frame rendered out of order inherits stale values.
- Hide with `tf(el, …, 0)`; show with opacity > 0. Don't set `visibility: visible` explicitly (it overrides hidden ancestors).
- Masked text travels 140 % (no sliver under the mask). Inline prices in absolute boxes need `white-space: nowrap`.
- Time entrances for when the camera has *arrived*; a headline entering during a pull-back sits off-screen.
- Fade a region's old content out when the next scene starts if the camera can still see it.
- Measure live targets (`stagePoint`) with the element in its final pose; for zoom-into, `zoomInto` clears transforms before measuring.

## Motion grammar (taste as rules; details and sources: `references/motion-grammar.md`)

One world, one camera; every transition is a camera move (pull-back, whip-pan 0.5–0.7 s quartInOut, reel scroll, dolly-through, zoom-into) or a match cut — never fade to nothing. Holds never sit still (push-in +5–7 %, bob). 120 BPM grid: cascades on quarter beats, moves start on beats. Stagger everything (words 50–80 ms, chars 30–45 ms, cards 150 ms). Entrances decelerate (expoOut), exits are shorter and accelerate. Springs: badges 2.1 Hz ζ 0.42, cards 1.25 Hz ζ 0.62, popups 1.0 Hz ζ 0.7. Reading time ≥ 0.5 s + words/3. Text ≥ 22 px at 1080p; contrast ≥ 4.5:1; inside 90 % title-safe. Hook within 2 s; end card 3–6 s. Tilt UI cards in 3D (a flat card reads as a screenshot). Real product UI, real numbers.

## Rendering facts (so you can plan)

Final 30 s 1080p60 with adaptive blur ≈ 50 s on the reference laptop (12 Chromium workers); draft ≈ 11 s; editing one scene re-renders only its frames. Motion blur: each frame gets 1–32 samples from on-screen motion (180° shutter), averaged by Chromium's compositor; whips past 32 samples get a camera-direction smear. Presets: `youtube` (default), `youtube-hevc`, `archive`, `prores` (alpha), `webm-alpha`, `web-av1`, `lossless`. Audio in `defineVideo({ audio: [{ src, start, role: "music" | "vo" }] })` is ducked and normalised to −14 LUFS on render. Details: `references/rendering.md`.

## When something fails

Errors name the scene and time (`scene "typing" at t=21.400s: …`). Exit codes: 1 usage · 2 project/build · 3 render · 4 lint errors · 5 non-deterministic · 6 environment (`dolly doctor`). Missing Chromium: `npx playwright install chromium-headless-shell`. Never call paid services (voice, music) or upload anything without asking the user.
