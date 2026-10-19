// Price Peek promo, 30 s. One continuous world filmed by a virtual camera: no slide cuts, every
// transition is a camera move (pull-back, whip-pan, reel scroll, dolly-through, zoom into a badge).
// Timing sits on a 120 BPM grid (one beat = 0.5 s) for a music bed.
import { camera, cubicInOut, defineVideo, expoOut, parallaxGrid, prog, quartInOut, sineInOut, tf } from "@dolly/core";
import { theme } from "./theme.ts";
import { REEL_GAP, T_E, sharedStyles } from "./shared.ts";
import prices from "./scenes/prices.ts";
import reel from "./scenes/reel.ts";
import control from "./scenes/control.ts";
import typing from "./scenes/typing.ts";
import end from "./scenes/end.ts";

const stage = { width: 1280, height: 720 };

// world point (x, y) sits at the screen centre, zoomed by `zoom`
const cam = camera({
  x: [[0, 795], [0.95, 795], [2.45, 640, quartInOut], [6.7, 650, sineInOut], [7.3, 2240, quartInOut]],
  y: [[0, 112], [0.95, 116], [2.45, 360, quartInOut], [6.7, 352, sineInOut], [7.3, 360, quartInOut],
    [9.0, 360], [9.55, 360 + REEL_GAP, quartInOut], [11.0, 360 + REEL_GAP], [11.55, 360 + 2 * REEL_GAP, quartInOut],
    [13.0, 360 + 2 * REEL_GAP], [13.6, 360 + 3 * REEL_GAP, quartInOut], [19, 370 + 3 * REEL_GAP, sineInOut]],
  // pull back from the extreme close-up, then a slow push-in on every hold so the frame never sits still
  zoom: [[0, 2.7], [0.95, 2.55], [2.45, 1, quartInOut], [6.7, 1.07, sineInOut], [7.0, 1.0, quartInOut],
    [13.1, 1.05, sineInOut], [13.6, 1, quartInOut], [19, 1.06, sineInOut]],
}, stage);

let grid: ReturnType<typeof parallaxGrid>;
let glow: HTMLElement, mark: HTMLElement;

export default defineVideo({
  title: "Price Peek",
  stage, fps: 60, duration: 30, bpm: 120, theme, camera: cam,
  world: {
    setup(ctx) {
      sharedStyles();
      const bg = ctx.screen(0, "background");
      grid = parallaxGrid(bg, { gap: 28, dot: 1.3, color: "#d3d8e1", depth: 0.5 });
      glow = document.createElement("div");
      glow.style.cssText = "position:absolute;width:900px;height:900px;margin:-450px 0 0 -450px;border-radius:50%;background:radial-gradient(closest-side, rgba(255,255,255,.85), rgba(255,255,255,0))";
      bg.append(glow);
      mark = document.createElement("div");
      mark.className = "pp-mark";
      mark.innerHTML = "<i>kr.</i>Price Peek";
      ctx.screen(50, "brand").append(mark);
    },
    render({ t }, ctx) {
      const c = ctx.camera(t);
      // D → E: dolly through the popup; the world grows and fades while E arrives from behind
      const dol = cubicInOut(prog(t, T_E.dolly, 0.75));
      const ws = c.zoom * (1 + dol * 1.4);
      const w = ctx.layers.world;
      w.style.transform = `translate(640px,360px) scale(${ws}) translate(${-c.x}px,${-c.y}px)`;
      w.style.opacity = String(1 - dol);
      w.style.visibility = dol >= 1 ? "hidden" : "visible";
      // HUD headlines leave with the world during the dolly
      ctx.layers.hud.style.transformOrigin = "640px 360px";
      tf(ctx.layers.hud, `scale(${1 + dol * 0.5})`, 1 - dol);
      grid(c, stage, 1 + dol * 1.4);
      glow.style.left = 640 + Math.sin(t * 0.35) * 260 + "px";
      glow.style.top = 330 + Math.cos(t * 0.27) * 140 + "px";
      tf(mark, `translateY(${(1 - expoOut(prog(t, 0.6, 0.8))) * 20}px)`, expoOut(prog(t, 0.6, 0.8)) * (1 - prog(t, T_E.zoom, 0.4)));
    },
  },
  scenes: [prices, reel, control, typing, end],
  markers: [
    { name: "hook", t: 0, kind: "cut" }, { name: "badges", t: 3.5, kind: "beat" }, { name: "whip", t: 6.7, kind: "cut" },
    { name: "pick-euro", t: 16.3, kind: "beat" }, { name: "dolly", t: 19, kind: "cut" }, { name: "zoom-end", t: 24.15, kind: "cut" },
  ],
});
