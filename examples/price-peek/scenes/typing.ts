// E · "Even the numbers you type." Reached by dollying through D; typing into a price filter updates the
// badge per keystroke (odometer roll). Ends by diving into the last badge until its dark fill is the
// screen, which becomes the end card's background.
import { badge, clamp, cubicInOut, defineScene, ensureStyle, lerp, masked, popIn, prog, roll, sineInOut, tf, typeIn, typing, zoomInto, setHtml } from "@dolly/core";
import { T_E, conv } from "../shared.ts";

const TYPE1 = { t0: 20.45, gap: 0.2, text: "500000", cur: "KRW", focus: 20.1 };
const TYPE2 = { t0: 22.3, gap: 0.22, text: "1200", cur: "USD", focus: 21.95 };

const CSS = `
.pp-le{position:absolute;left:0;top:0;width:1280px;height:720px}
.pp-form{position:absolute;background:#fff;border-radius:22px;padding:34px 38px 40px;box-shadow:var(--s-float);transform-origin:0 50%}
.pp-form .lab{font:600 16px var(--f-price);letter-spacing:.08em;text-transform:uppercase;color:var(--c-muted)}
.pp-form .line{display:flex;align-items:center;gap:18px;margin-top:16px;font:600 28px var(--f-price);color:#5b6170}
.pp-inp{position:relative;width:330px;height:78px;border-radius:14px;border:2px solid var(--c-line);font:600 36px/74px var(--f-price);color:var(--c-fg);padding:0 20px;white-space:nowrap}
.pp-inp.focus{border-color:var(--c-accent);box-shadow:0 0 0 5px rgba(51,85,255,.15)}
.pp-inp .pre{color:#9aa0ad;margin-right:6px}
.pp-inp .dolly-caret{height:38px;vertical-align:-6px}
.pp-inp .dolly-badge{top:-34px;right:-24px;font-size:24px}`;

let lE: HTMLElement, form: HTMLElement, head: HTMLElement[];
const inputs: Array<{ el: HTMLElement; text: HTMLElement; badge: HTMLElement; k: typeof TYPE1 }> = [];

export default defineScene({
  name: "typing",
  start: 19.0,
  end: 25.4,
  setup(ctx) {
    ensureStyle("pp-typing", CSS);
    lE = document.createElement("div"); lE.className = "pp-le";
    ctx.screen(40, "typing").append(lE);
    const hE = document.createElement("h2"); hE.className = "pp-h"; hE.style.cssText = "left:80px;top:170px;width:500px";
    form = document.createElement("div"); form.className = "pp-form"; form.style.cssText = "left:640px;top:150px;width:580px";
    form.innerHTML = `<div class="lab">Price range · min</div><div class="line"><div class="pp-inp"></div>원</div>
      <div class="lab" style="margin-top:46px">Budget</div><div class="line"><div class="pp-inp"></div></div>`;
    lE.append(hE, form);
    head = masked(hE, "Even the numbers you |type.|");
    form.querySelectorAll<HTMLElement>(".pp-inp").forEach((el, i) => {
      const k = i === 0 ? TYPE1 : TYPE2;
      if (k.cur === "USD") { const pre = document.createElement("span"); pre.className = "pre"; pre.textContent = "$"; el.append(pre); }
      const text = document.createElement("span"); el.append(text);
      const b = badge(""); el.append(b);
      inputs.push({ el, text, badge: b, k });
    });
  },
  render({ t }) {
    typeIn(head, t, 19.55, Infinity, { stagger: 0.06 });
    // inputs are filled before the layer's transform so the zoom can measure the final badge
    for (const { el, text, badge: b, k } of inputs) {
      const focused = k === TYPE1 ? t >= k.focus && t < TYPE2.focus : t >= k.focus;
      el.classList.toggle("focus", focused);
      const st = typing(t, { t0: k.t0, gap: k.gap, text: k.text, focused, format: k.cur === "USD" ? s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : undefined });
      setHtml(text, st.html);
      if (!st.n) { tf(b, "scale(0)", 0); continue; }
      const now = conv(+st.typed, k.cur);
      setHtml(b, st.n > 1 ? roll(conv(+k.text.slice(0, st.n - 1), k.cur), now, prog(t, st.last, 0.3)) : now);
      if (st.n === 1) popIn(b, t, k.t0, { freq: 2.3 });
      else { const q = prog(t, st.last, 0.3); tf(b, `scale(${1 + 0.1 * Math.sin(q * Math.PI) * (1 - q)})`, 1); }
    }
    // arrives from behind, then the camera dives into the last badge until its dark fill is the screen
    const arr = cubicInOut(prog(t, T_E.dolly + 0.1, 0.8));
    const fy = sineInOut(prog(t, 19.6, 5));
    form.style.transform = `perspective(1500px) rotateY(${lerp(-16, -5, fy)}deg) rotateX(${lerp(4, 1, fy)}deg)`;
    let css = `scale(${lerp(0.62, 1, arr)})`, origin = "640px 360px";
    const z = zoomInto(lE, inputs[1].badge, t, T_E.zoom, T_E.zoomEnd, { maxScale: 60 });
    if (z.z > 0) { css = z.css; origin = z.origin; }
    lE.style.transformOrigin = origin;
    tf(lE, css, t < T_E.dolly + 0.1 || t >= T_E.zoomEnd ? 0 : clamp(arr * 1.5));
  },
});
