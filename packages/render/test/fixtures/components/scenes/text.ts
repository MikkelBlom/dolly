import { defineScene, masked, typeIn, roll, slide, setHtml, prog } from "@dolly/core";
let words: HTMLElement[], chars: HTMLElement[], num: HTMLElement, label: HTMLElement;
export default defineScene({
  name: "text", start: 0, end: 2,
  setup(ctx) {
    ctx.world.insertAdjacentHTML("beforeend", `<h2 id="h" style="position:absolute;left:40px;top:40px;margin:0;font:800 44px/1 var(--f-display)"></h2>
      <div id="c" style="position:absolute;left:40px;top:120px;font:700 36px var(--f-body);white-space:nowrap"></div>
      <div id="n" style="position:absolute;left:40px;top:200px;font:700 36px/1.75 var(--f-body);white-space:nowrap"></div>
      <div id="l" style="position:absolute;left:300px;top:200px;font:600 24px/1.75 var(--f-body);white-space:nowrap"></div>`);
    words = masked(ctx.$("h"), "Every price, in |your| currency.");
    chars = masked(ctx.$("c"), "₩1,500,000", { chars: true });
    num = ctx.$("n"); label = ctx.$("l");
  },
  render({ t }) {
    typeIn(words, t, 0.1, 1.6, { stagger: 0.06 });
    typeIn(chars, t, 0.2, Infinity, { stagger: 0.04, dur: 0.7 });
    setHtml(num, roll("1.199 kr.", "1.200 kr.", prog(t, 0.6, 0.6)));
    setHtml(label, slide("DKK · Danish krone", "EUR · Euro", prog(t, 0.7, 0.5)));
  },
});
