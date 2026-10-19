// Snapnote launch video. Edit scenes/*.ts; keep render(t) pure (every value from t alone).
import { cameraPath, defineVideo, parallaxGrid, clamp, expoIn, sineInOut } from "@dolly/core";
import { theme } from "./theme.ts";
import { ARTICLE_X, LOGO, T } from "./beats.ts";
import painScene from "./scenes/pain.ts";
import selectScene from "./scenes/select.ts";
import cardScene from "./scenes/card.ts";
import endScene from "./scenes/end.ts";

const stage = { width: 1280, height: 720 };
const path = cameraPath(stage)
  .at(0, { x: 718, y: 380, zoom: 2.4 }).pullBack(T.pullBack[0], T.pullBack[1], { x: 640, y: 360, zoom: 1 })
  .push(T.pullBack[1], T.whip[0], 0.05)
  .whip(T.whip[0], T.whip[1], { x: ARTICLE_X + 640, y: 360, zoom: 1 })
  .push(T.whip[1], T.toCard[0], 0.05)
  .move(T.toCard[0], T.toCard[1], { x: ARTICLE_X + 1000, y: 360, zoom: 1 }, "quartInOut")
  .push(T.toCard[1], T.zoom[0], 0.06)
  .build();

// Zoom into the logo tile: exponential zoom that keeps the tile pinned on screen while it drifts to the centre,
// so the dive goes *into* the tile instead of past it (a plain camera move eases x/y and zoom together).
const ZOOM_TO = 120;
function camera(t: number) {
  if (t < T.zoom[0]) return path(t);
  const c0 = path(T.zoom[0]);
  const p = clamp((t - T.zoom[0]) / (T.zoom[1] - T.zoom[0]));
  const z = c0.zoom * Math.pow(ZOOM_TO / c0.zoom, expoIn(p));
  const k = (c0.zoom / z) * (1 - sineInOut(p));
  return { ...c0, x: LOGO.x + (c0.x - LOGO.x) * k, y: LOGO.y + (c0.y - LOGO.y) * k, zoom: z };
}

let grid: ReturnType<typeof parallaxGrid>;

export default defineVideo({
  title: "Snapnote",
  stage, fps: 60, duration: 15, bpm: 120, aspect: "16:9",
  theme, camera,
  world: {
    setup(ctx) { grid = parallaxGrid(ctx.screen(0, "background"), { depth: 0.5, color: "rgba(31,111,74,.16)" }); },
    render({ t }, ctx) { grid(ctx.camera(t), stage); },
  },
  scenes: [painScene, selectScene, cardScene, endScene],
  markers: [
    { name: "paste", t: T.paste, kind: "beat" },
    { name: "whip", t: T.whip[0], kind: "cut" },
    { name: "drag", t: T.dragStart, kind: "beat" },
    { name: "alt-n", t: T.press, kind: "beat" },
    { name: "zoom-end", t: T.zoom[0], kind: "cut" },
  ],
});
