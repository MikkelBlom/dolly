import { defineScene, badge, popIn, flyIn, land, primitivesCss, tf } from "@dolly/core";
let card: HTMLElement, chip: HTMLElement, b: HTMLElement;
export default defineScene({
  name: "primitives", start: 2, end: 3.5,
  setup(ctx) {
    primitivesCss();
    card = document.createElement("div"); card.className = "dolly-card"; card.style.cssText = "left:60px;top:80px;width:240px;height:160px";
    chip = document.createElement("div"); chip.className = "dolly-chip"; chip.style.cssText = "left:360px;top:110px;font:700 30px var(--f-body)"; chip.textContent = "$249";
    b = badge("1.654 kr."); b.style.cssText = "left:420px;top:90px";
    ctx.world.append(card, chip, b);
  },
  render({ t }) {
    flyIn(card, t, 2.05, { dx: 260, dy: 80 });
    tf(chip, `scale(${1 + land(t, 2.9)})`, 1);
    popIn(b, t, 2.6);
  },
});
