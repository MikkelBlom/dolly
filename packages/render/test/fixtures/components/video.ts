// Golden-frame fixture: one short scene per component, small stage so the test is fast.
import { cameraPath, defineVideo, defaultTheme, parallaxGrid } from "@dolly/core";
import text from "./scenes/text.ts";
import primitives from "./scenes/primitives.ts";
import ui from "./scenes/ui.ts";
import frames from "./scenes/frames.ts";

const stage = { width: 640, height: 360 };
let grid: ReturnType<typeof parallaxGrid>;

export default defineVideo({
  title: "components", stage, fps: 30, duration: 8, bpm: 120, theme: defaultTheme,
  camera: cameraPath(stage).at(0, { x: 320, y: 180, zoom: 1 }).move(5.0, 5.6, { x: 420, zoom: 1.2 }).build(),
  world: { setup(ctx) { grid = parallaxGrid(ctx.screen(0)); }, render({ t }, ctx) { grid(ctx.camera(t), stage); } },
  scenes: [text, primitives, ui, frames],
});
