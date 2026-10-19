// Hook: copy-pasting quotes into a notes app loses where they came from.
import { defineScene, ensureStyle, flyIn, masked, popIn, typeIn, bob, tf, tilt, keys, spring, clamp } from "@dolly/core";
import { T } from "../beats.ts";

const QUOTES = [
  "Most good ideas arrive disguised as small annoyances.",
  "Reading slowly is a way of arguing with the author.",
  "A tool you forget about is a tool that works.",
  "Good notes outlive tabs.",
];
let head: HTMLElement[], win: HTMLElement, rows: HTMLElement[] = [], pills: HTMLElement[] = [], key: HTMLElement;

export default defineScene({
  name: "pain",
  start: 0,
  end: T.whip[1] + 0.05,
  setup(ctx) {
    ensureStyle("scene-pain", `
.pain-h{position:absolute;margin:0;font:700 62px/1.08 var(--f-display);letter-spacing:-.03em;color:var(--c-fg);width:440px}
.pain-win{position:absolute;left:560px;top:96px;width:620px;height:528px;background:var(--c-surface);border-radius:var(--r-lg);box-shadow:var(--s-float);overflow:hidden;font-family:var(--f-ui);color:var(--c-fg)}
.pain-bar{height:46px;display:flex;align-items:center;gap:8px;padding:0 18px;border-bottom:1px solid var(--c-line);background:#f3eee5}
.pain-dot{width:12px;height:12px;border-radius:50%;background:#d9d1c3}
.pain-app{margin-left:12px;font:700 15px var(--f-ui);color:var(--c-muted)}
.pain-title{padding:20px 30px 6px;font:700 26px var(--f-ui)}
.pain-sub{padding:0 30px 10px;font:400 14px var(--f-ui);color:var(--c-muted)}
.pain-row{margin:0 22px;padding:14px 10px 14px 12px;border-top:1px solid var(--c-line)}
.pain-q{font:italic 400 19px/1.35 var(--f-serif);white-space:nowrap}
.pain-src{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:4px 11px;border-radius:999px;background:var(--c-warn-soft);color:var(--c-warn);font:700 15px var(--f-ui)}
.pain-key{position:absolute;left:1035px;top:552px;padding:10px 16px;border-radius:12px;background:var(--c-fg);color:#fff;font:700 20px var(--f-ui);box-shadow:0 6px 0 #000,0 18px 30px -12px rgba(0,0,0,.5);white-space:nowrap}`);
    const h = document.createElement("h2");
    h.className = "pain-h";
    h.style.cssText = "left:84px;top:250px";
    ctx.world.append(h);
    head = masked(h, "Lost the |source| again?");
    win = document.createElement("div");
    win.className = "pain-win";
    win.innerHTML = `<div class="pain-bar"><span class="pain-dot"></span><span class="pain-dot"></span><span class="pain-dot"></span><span class="pain-app">Notes</span></div>
<div class="pain-title">Reading notes</div><div class="pain-sub">4 quotes · pasted this week</div>`;
    QUOTES.forEach((q, i) => {
      const r = document.createElement("div");
      r.className = "pain-row";
      r.innerHTML = `<div class="pain-q">“${q}”</div><div class="pain-src">⚠ source? ${i === 1 ? "· can't find the tab" : ""}</div>`;
      win.append(r);
      rows.push(r);
      pills.push(r.querySelector(".pain-src") as HTMLElement);
    });
    ctx.world.append(win);
    key = document.createElement("div");
    key.className = "pain-key";
    key.textContent = "Ctrl + V";
    ctx.world.append(key);
  },
  render({ t, start, end }) {
    typeIn(head, t, 0.9, T.whip[0] - 0.05, { stagger: 0.07 });
    const ry = keys(t, [[0, -14], [T.pullBack[1], -9, "quartInOut"], [end, -6, "sineInOut"]]);
    tf(win, `${tilt(ry, 3)} translateY(${bob(t, 0, 3)}px)`, 1);
    // rows 0-2 are already there; row 3 is pasted in on the beat
    for (let i = 0; i < 3; i++) tf(rows[i], "none", 1);
    flyIn(rows[3], t, T.paste, { dx: 0, dy: 40, rotate: 0, scale0: 0.92, spring: { freq: 1.8, zeta: 0.6 } });
    for (let i = 0; i < 3; i++) tf(pills[i], "none", 1);
    // the new row's "source?" pill pops a beat later and shakes: the problem, made visible
    const shake = t > T.paste + 0.5 ? Math.sin((t - T.paste - 0.5) * 38) * 5 * Math.exp(-(t - T.paste - 0.5) * 4) : 0;
    popIn(pills[3], t, T.paste + 0.5, { rotate: 0, extra: `translateX(${shake}px)` });
    // Ctrl+V keycap: pops in just before the paste, presses on it, leaves
    const press = t >= T.paste - 0.05 && t < T.paste + 0.1 ? 5 : 0;
    const out = clamp((t - (T.paste + 1.0)) / 0.3);
    if (t < T.paste + 1.0) popIn(key, t, T.paste - 0.45, { rotate: -6, extra: `translateY(${press}px)` });
    else tf(key, `translateY(${out * 30}px) scale(${1 - out * 0.3})`, 1 - out);
  },
});
