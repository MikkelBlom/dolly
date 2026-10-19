// A · "Shopping abroad?" Seoul's price rolls in at an extreme close-up; the camera pulls back as the
// other chips fly in. B · "Every price, in your currency." Badges land on a beat cascade.
import { badge, bob, clamp, defineScene, land, lerp, masked, popIn, primitivesCss, spring, tf, typeIn } from "@dolly/core";
import { conv } from "../shared.ts";

const CHIPS: Array<[city: string, shown: string, value: number, cur: string, x: number, y: number]> = [
  ["Seoul", "₩1,500,000", 1500000, "KRW", 600, 62],
  ["New York", "$249", 249, "USD", 1040, 116],
  ["Berlin", "19,99 €", 19.99, "EUR", 640, 258],
  ["Tokyo", "¥42,800", 42800, "JPY", 960, 314],
  ["London", "£219", 219, "GBP", 660, 452],
  ["Bangkok", "฿8,490", 8490, "THB", 1000, 500],
];
// where each chip flies in from (relative), and the beat its badge lands on
const CHIP_IN = [[0, 0], [380, -160], [-260, 60], [320, 120], [-200, 260], [300, 300]];
const T_CHIP = [0, 1.1, 1.25, 1.4, 1.55, 1.7];
const T_BADGE = [3.5, 3.75, 4.0, 4.25, 4.5, 4.75];

let headA: HTMLElement[], headB: HTMLElement[];
const chips: Array<{ el: HTMLElement; chars: HTMLElement[]; badge: HTMLElement }> = [];

export default defineScene({
  name: "prices",
  start: 0,
  end: 7.4,
  markers: { "head-a": 2.05, "head-b": 3.3, badges: 3.5 },
  setup(ctx) {
    primitivesCss();
    const hA = document.createElement("h2"); hA.className = "pp-h"; hA.style.cssText = "left:80px;top:190px;width:470px";
    const hB = document.createElement("h2"); hB.className = "pp-h"; hB.style.cssText = "left:80px;top:150px;width:520px";
    ctx.world.append(hA, hB);
    headA = masked(hA, "Shopping |abroad?|");
    headB = masked(hB, "Every price, in |your| currency.");
    for (const [city, shown, v, c, x, y] of CHIPS) {
      const el = document.createElement("div");
      el.className = "dolly-chip"; el.style.left = x + "px"; el.style.top = y + "px";
      const p = document.createElement("span"); p.className = "p";
      const b = badge(conv(v, c)); p.append(b);
      const cityEl = document.createElement("span"); cityEl.className = "city"; cityEl.textContent = city;
      el.append(p, cityEl);
      ctx.world.append(el);
      chips.push({ el, chars: masked(p, shown, { chars: true }), badge: b });
    }
  },
  render({ t }) {
    chips.forEach(({ el, chars, badge: b }, i) => {
      const [dx, dy] = CHIP_IN[i];
      const s = i === 0 ? 1 : spring(t - T_CHIP[i], { freq: 1.25, zeta: 0.62 });
      const bump = 1 + land(t, T_BADGE[i]);
      const y = bob(t, i, 4, 1.1) * clamp(t - 2.5);
      tf(el, `translate(${dx * (1 - s)}px,${dy * (1 - s) + y}px) rotate(${(1 - s) * (i % 2 ? 9 : -9)}deg) scale(${(i === 0 ? 1 : lerp(0.7, 1, s)) * bump})`,
        i === 0 ? clamp(t * 6) : clamp((t - T_CHIP[i]) * 5));
      typeIn(chars, t, i === 0 ? 0.15 : T_CHIP[i] + 0.1, Infinity, i === 0 ? { stagger: 0.045, dur: 0.8 } : { stagger: 0.03, dur: 0.6 });
      popIn(b, t, T_BADGE[i]);
    });
    typeIn(headA, t, 2.05, 3.15, { stagger: 0.08 });
    typeIn(headB, t, 3.3, Infinity, { stagger: 0.06 });
  },
});
