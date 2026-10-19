import { defineScene, cursor, typing, swingIn, setHtml, stagePoint, ensureStyle, type CursorHandle } from "@dolly/core";
let pop: HTMLElement, btn: HTMLElement, inp: HTMLElement, cur: CursorHandle;
export default defineScene({
  name: "ui", start: 3.5, end: 5,
  setup(ctx) {
    ensureStyle("fx-ui", `.fx-pop{position:absolute;left:330px;top:60px;width:260px;padding:20px;background:#fff;border-radius:16px;box-shadow:var(--s-float);transform-origin:0 50%;font:600 16px var(--f-body)}
      .fx-btn{display:inline-block;margin-top:14px;padding:6px 14px;border-radius:8px;background:var(--c-accent);color:#fff}
      .fx-inp{position:absolute;left:40px;top:140px;width:230px;height:52px;border:2px solid var(--c-line);border-radius:10px;font:600 26px/48px var(--f-body);padding:0 14px;white-space:nowrap}`);
    pop = document.createElement("div"); pop.className = "fx-pop"; pop.innerHTML = `Convert to<br><span class="fx-btn">Euro</span>`;
    inp = document.createElement("div"); inp.className = "fx-inp";
    ctx.world.append(pop, inp);
    btn = pop.querySelector(".fx-btn")!;
    cur = cursor(ctx.screen(30), { path: [{ t: 3.6, at: [620, 340] }, { t: 4.3, at: () => stagePoint(btn, 0.5, 0.6) }, { t: 4.9, at: () => stagePoint(btn, 0.5, 0.6) }], clicks: [4.4], from: 3.6, to: 5 });
  },
  render({ t }) {
    swingIn(pop, t, 3.55);
    setHtml(inp, typing(t, { t0: 3.7, gap: 0.15, text: "500000", focused: true }).html);
    cur.render(t);
  },
});
