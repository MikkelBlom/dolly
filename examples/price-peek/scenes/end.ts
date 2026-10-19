// F · End card on the badge's dark fill: logo, name, tagline, and price badges floating in three depth
// planes with depth of field.
import { badge, clamp, defineScene, endCard, ensureStyle, spring, tf } from "@dolly/core";
import { T_E, T_F } from "../shared.ts";

// [text, x, y, depth 0 far … 2 near]
const FLOATS: Array<[string, number, number, number]> = [["7.480 kr.", 150, 120, 1], ["€241", 1050, 96, 0], ["1.654 kr.", 1040, 590, 2], ["$271", 190, 580, 0],
  ["1,7 mio. kr.", 960, 250, 0], ["149 kr.", 120, 340, 2], ["£203", 1130, 420, 1], ["1.261 kr.", 330, 640, 1]];

let card: ReturnType<typeof endCard>;
const floats: HTMLElement[] = [];

export default defineScene({
  name: "end",
  start: 25.33,
  end: 30,
  setup(ctx) {
    ensureStyle("pp-end", `.dolly-end .dolly-badge{background:#262a33;color:#c9cdd6;box-shadow:none;transform-origin:50% 50%}`);
    card = endCard(ctx.screen(60, "end"), { logo: "kr.", name: "Price Peek", tagline: "Any price, in |your| currency.", at: T_F, pushFrom: T_E.zoomEnd, pushDur: 4.65 });
    for (const [s, x, y] of FLOATS) {
      const b = badge(s); b.style.left = x + "px"; b.style.top = y + "px";
      card.el.insertBefore(b, card.el.firstChild);
      floats.push(b);
    }
  },
  render({ t }) {
    card.render(t);
    FLOATS.forEach(([, x, y, depth], i) => {
      const t0 = T_F.tag + 0.1 + i * 0.09, s = spring(t - t0, { freq: 1.3, zeta: 0.6 });
      const par = [0.4, 0.8, 1.5][depth], sc = [0.8, 1, 1.55][depth];
      const dx = (x - 640) * (1 - s) * -0.4, dy = (y - 360) * (1 - s) * -0.4;
      const drift = (t - T_E.zoomEnd) * -14 * par;
      const el = floats[i];
      el.style.filter = depth === 2 ? "blur(3px)" : depth === 0 ? "blur(1px)" : "none";
      tf(el, `translate(${dx + drift}px,${dy + Math.sin(t * 0.8 + i) * 6 * par}px) scale(${sc * Math.max(0, s)})`, clamp((t - t0) * 4) * [0.45, 0.8, 0.55][depth]);
    });
  },
});
