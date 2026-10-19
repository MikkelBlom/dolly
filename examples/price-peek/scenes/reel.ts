// C · "Reads prices the local way." A whip-pan lands on a reel of local formats; the camera steps
// down it item by item, and items away from the centre shrink and dim.
import { badge, clamp, defineScene, masked, popIn, prog, tf, typeIn } from "@dolly/core";
import { REEL_GAP, REEL_X, REEL_Y0, T_REEL, conv } from "../shared.ts";

const REEL: Array<[shown: string, value: number, cur: string, note: string]> = [
  ["3억 5,000만원", 350000000, "KRW", "Korean 억 and 만"],
  ["3万円", 30000, "JPY", "Japanese 万"],
  ["19,99 €", 19.99, "EUR", "Decimal comma"],
];

let head: HTMLElement[];
const items: Array<{ el: HTMLElement; chars: HTMLElement[]; badge: HTMLElement }> = [];

export default defineScene({
  name: "reel",
  start: 6.9,
  end: 13.8,
  setup(ctx) {
    const hC = document.createElement("h2"); hC.className = "pp-h"; hC.style.cssText = "left:80px;top:200px;width:430px";
    ctx.hud.append(hC);
    head = masked(hC, "Reads prices the |local| way.");
    REEL.forEach(([shown, v, c, note], i) => {
      const el = document.createElement("div");
      el.className = "pp-item"; el.style.left = REEL_X + "px"; el.style.top = REEL_Y0 + i * REEL_GAP - 70 + "px";
      const w = document.createElement("span"); w.className = "w";
      const b = badge(conv(v, c)); w.append(b);
      const n = document.createElement("span"); n.className = "note"; n.textContent = note;
      el.append(w, n);
      ctx.world.append(el);
      items.push({ el, chars: masked(w, shown, { chars: true }), badge: b });
    });
  },
  render({ t }, ctx) {
    const cy = ctx.camera(t).y;
    items.forEach(({ el, chars, badge: b }, i) => {
      const d = (REEL_Y0 + i * REEL_GAP - (cy - 30)) / REEL_GAP;
      const k = Math.min(Math.abs(d), 1.6);
      tf(el, `scale(${1 - 0.14 * k})`, t < T_REEL[i] - 0.3 ? 0 : clamp(1 - 0.7 * k) * (1 - prog(t, 13.2, 0.5)));
      typeIn(chars, t, T_REEL[i] - 0.25, Infinity, { stagger: 0.035, dur: 0.7 });
      popIn(b, t, T_REEL[i] + 0.5);
    });
    typeIn(head, t, 7.45, 12.75, { stagger: 0.07 });
  },
});
