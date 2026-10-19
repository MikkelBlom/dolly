# @dolly/core API reference

Everything is exported from `@dolly/core`. Pure helpers run anywhere; DOM helpers need the scene page.

## Defining a video

```ts
defineVideo({
  title: string,
  stage: { width, height },        // design size in CSS px (1280×720 for 16:9, 720×1280 for 9:16, 1080×1080, 1080×1350)
  fps: 60, duration: 30,           // seconds
  bpm?: 120, beatOffset?: 0,       // beat grid for markers, lint and the player
  aspect?: "16:9" | "9:16" | "1:1" | "4:5",
  theme: Theme,
  camera?: (t) => CameraState,     // usually cameraPath(stage)…build()
  background?: string,             // stage colour (default theme.colors.bg)
  world?: { setup?(ctx), render?({ t }, ctx) },   // always-on: background, grid, brand mark, world-level effects
  scenes: SceneDef[],
  markers?: [{ name, t, kind?: "cut" | "beat" | "vo" | "note" }],
  variants?: { "9:16": { stage, scenes, camera, markers, world } },   // per-aspect layout overrides (?aspect=9:16, --aspect 9:16)
  audio?: [{ src: "audio/music.mp3", start: 0, gain: 1, role: "music" | "vo" | "sfx" }],
})

defineScene({
  name: "kebab-case", start, end,            // seconds; scene is rendered and visible only in [start, end)
  markers?: { name: secondsFromStart },
  setup?(ctx),                               // build DOM once (may be async)
  render({ t, local, progress, start, end }, ctx),   // set everything from t
})
```

`ctx` (SceneContext): `world` (camera layer container), `hud` (screen-space container), `screen(z, name?)` (container at z-order), `layers.{stage,world,hud}` (shared layers), `camera(t)`, `$(id)` (lookup in this scene, throws with the scene name), `marker(name)`, `stage`, `aspect`, `theme`, `video`.

Helpers: `allMarkers(video)`, `activeScenes(video, t0, t1)`, `beatTime(video, beat)`, `withAspect(video, aspect)`.

## Math and time

| Function | Notes |
|---|---|
| `clamp(x, a=0, b=1)`, `lerp(a, b, p)`, `unlerp`, `remap(x, a0, a1, b0, b1)` | |
| `prog(t, t0, dur)` | 0..1 progress, clamped |
| `keys(t, [[t, v, easing?], …], fallback=cubicInOut)` | keyframes; easing applies to the segment arriving at that key |
| `keys2(t, [[t, [x, y], easing?]])` | 2D keyframes |
| `springTo(t, t0, from, to, params)` | value on a spring |
| `stagger(i, n, { each=0.05 \| total, from: "start" \| "end" \| "center" \| index })` | start offset of item i |
| `rng(seed)`, `seedOf(string)`, `noise1(t, seed)` | deterministic randomness and smooth noise |
| `quad(a, c, b, p)`, `cubic(a, c1, c2, b, p)`, `arcControl(a, b, bend)` | bezier points; arcControl bends a straight path |
| `snap(x, step)`, `dist`, `lerp2` | |

Easings (`EASINGS` by name, or functions): `linear, sineIn/Out/InOut, quadIn/Out/InOut, cubicIn/Out/InOut, quartIn/Out/InOut, quintIn/Out/InOut, expoIn/Out/InOut, circOut, circInOut, backOut(s), emphasizedOut, cubicBezier(x1, y1, x2, y2)`. `ease(nameOrFn)` resolves either.

Springs: `spring(t, { freq, zeta, velocity })` or `spring(t, { stiffness, damping, mass })` → 0..1 with overshoot when zeta < 1. `springOvershoot(p)`, `springSettleTime(p, tol)`, `appleSpring(duration, bounce)`.

## Camera

`cameraPath(stage)` → `.at(t, {x, y, zoom, rotate}, ease?)`, `.move(t0, t1, to, ease)`, `.whip(t0, t1, to)`, `.pullBack(t0, t1, to)`, `.push(t0, t1, amount=0.06)`, `.focus(t0, t1, rect, padding)`, `.hold(t)`, `.build()`.
Or `camera({ x: Key[], y: Key[], zoom: Key[], rotate: Key[] }, stage)`.
State `{ x, y, zoom, rotate }` = world point at screen centre. `cameraTransform(c, stage)`, `worldToScreen(c, stage, p)`, `screenToWorld`, `fitRect(rect, stage, padding)`, `parallax(c, depth, stage)` (depth 0.5 = half speed), `cameraDisplacement(a, b, stage)`.

## Components (DOM)

| Component | Signature | Use |
|---|---|---|
| Masked type | `masked(el, "text \|accent\|", { chars?, accentClass?, prepend? })` → units; `typeIn(units, t, tin, tout?, { stagger, dur, exitDur, rise=140, rotate=6 })`; `typeInDone(n, tin, o)` | headlines (words), prices/names (chars) |
| Odometer | `roll(a, b, p)` (numbers), `slide(a, b, p)` (labels), `setHtml(el, html)`, `countUp(a, b, p, fmt)` | values that change |
| Badge | `badge(text, cls?)` → `.dolly-badge` | price tags, "New" |
| Chip / card | classes `.dolly-chip`, `.dolly-card`, `.dolly-label` (`primitivesCss()`) | |
| Pop | `popIn(el, t, t0, { freq=2.1, zeta=0.42, rotate=-8, extra })` | badges grow from their sharp corner |
| Fly | `flyIn(el, t, t0, { dx, dy, rotate=9, scale0=0.7, spring, extra })` | cards arriving |
| Reactions | `land(t, t0, amount=0.035)` squash; `bob(t, i, amp=4)` idle drift | overlap & follow-through |
| Cursor | `cursor(layer, { path: [{ t, at: [x,y] \| () => [x,y], ease?, bend? }], clicks: [t…], from?, to? })` → `.render(t)`, `.pos(t)` | UI demos; targets measured live |
| Typing | `typing(t, { t0, gap, text, format?, focused })` → `{ n, typed, last, html }` | inputs; caret blinks only when idle |
| 3D tilt | `tilt(ry, rx=0, perspective=1500, extra)`; `swingIn(el, t, t0, { dx=520, from=-38, to=-10, drift=5 })` | UI cards as objects |
| Grid | `parallaxGrid(layer, { gap=28, dot=1.3, color, depth=0.5 })` → `(cam, stage, extraZoom)` | readable camera moves |
| Zoom into | `zoomInto(layer, target, t, t0, t1, { maxScale=60, fadeText=3.5, stage })` → `{ z, css, origin }` | dive into a dark element → end card |
| End card | `endCard(layer, { logo, name, tagline, at: { logo, name, tag }, pushFrom, pushDur })` → `{ el, render(t) }` | |
| Lower third | `lowerThird(layer, { title, subtitle, x, y })` → `(t, tin, tout)` | names/captions |

DOM helpers: `tf(el, transform, opacity)`, `show(el, on)`, `ensureStyle(id, css)`, `h(tag, attrs, ...children)`, `html(str)`, `escapeHtml`, `stagePoint(el, fx, fy)`, `stageRect(el)`.

## Theme

```ts
defineTheme({
  name, colors: { bg, fg, accent, muted, surface, ink, … }, fonts: { display, body, ui?, mono?, … },
  fontFaces: [{ family, src: "fonts/X-Bold.woff2", weight: "700" }],   // verified before frame 0
  fontCss?: ["https://…"],                                             // avoid: renders then need the network
  radii: { sm, md, lg }, shadows: { card, float }, extra?: {},
})
```
CSS variables: `--c-<color>`, `--f-<font>`, `--r-<radius>`, `--s-<shadow>`, `--x-<extra>`. `contrast(a, b)` gives the WCAG ratio.

## Storyboard

`validateStoryboard(json)` → `{ ok, problems: [{ path, message, severity }], timeline }`; `storyboardSchema`; `readingTime(text)`.

## Runtime (window.__dolly in a scene page)

`render(t)`, `motion(t0, t1)` → `{ px, camera, cameraVec, element }`, `inspect(t)` → visible text elements with rect, font size, colours, opacity; `meta`; `ready`; `setSmear(dx, dy)`. The player and renderer use these; you rarely need them directly.
