// Select any sentence on an article and press Alt+N. The article stays in the world through the card scene.
import { defineScene, ensureStyle, masked, popIn, typeIn, bob, tf, tilt, keys, spring, clamp, cursor, stagePoint, stageRect, cubicInOut } from "@dolly/core";
import { ARTICLE_X as X, T } from "../beats.ts";

export const SENTENCE = "We remember what we take the time to write down.";
let head: HTMLElement[], win: HTMLElement, chars: HTMLElement[] = [], target: HTMLElement, ext: HTMLElement;
let keysEl: HTMLElement[] = [], cur: ReturnType<typeof cursor>;

export default defineScene({
  name: "select",
  start: T.whip[0] - 0.05,
  end: T.zoom[1] + 0.05,
  setup(ctx) {
    ensureStyle("scene-select", `
.sel-h{position:absolute;margin:0;font:700 54px/1.1 var(--f-display);letter-spacing:-.03em;color:var(--c-fg);width:380px}
.sel-win{position:absolute;width:720px;height:572px;background:var(--c-surface);border-radius:var(--r-lg);box-shadow:var(--s-float);overflow:hidden;color:var(--c-fg);font-family:var(--f-ui)}
.sel-tabs{height:40px;background:#efe9df;display:flex;align-items:flex-end;padding:0 14px;gap:8px}
.sel-tab{height:32px;padding:0 16px;display:flex;align-items:center;gap:8px;background:var(--c-surface);border-radius:12px 12px 0 0;font:700 15px var(--f-ui);white-space:nowrap}
.sel-fav{width:16px;height:16px;border-radius:4px;background:#d77b4a}
.sel-url{height:46px;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid var(--c-line)}
.sel-field{flex:1;height:30px;border-radius:999px;background:#f3eee6;display:flex;align-items:center;padding:0 14px;font:400 15px var(--f-ui);color:#4b4f49;white-space:nowrap}
.sel-ext{width:30px;height:30px;border-radius:9px;background:var(--c-accent);color:#fff;font:700 16px var(--f-ui);display:flex;align-items:center;justify-content:center}
.sel-body{padding:28px 52px}
.sel-kick{font:700 15px var(--f-ui);letter-spacing:.08em;color:#9c4f27}
.sel-h1{font:700 31px/1.15 var(--f-ui);letter-spacing:-.02em;margin:8px 0 8px;white-space:nowrap}
.sel-by{font:400 15px var(--f-ui);color:var(--c-muted);margin-bottom:18px}
.sel-p{font:400 19px/1.62 var(--f-serif);color:#2b302c;margin-bottom:14px}
.sel-p span.l{display:block;white-space:nowrap}
.sel-c{border-radius:2px}
.sel-fade{opacity:.45}
.sel-keys{position:absolute;display:flex;gap:12px;align-items:center}
.sel-key{min-width:64px;height:64px;padding:0 18px;border-radius:16px;background:var(--c-surface);border:2px solid var(--c-line);box-shadow:0 6px 0 #d8cfbf,0 20px 30px -14px rgba(40,32,20,.45);font:700 26px var(--f-ui);color:var(--c-fg);display:flex;align-items:center;justify-content:center;white-space:nowrap}
.sel-plus{font:700 28px var(--f-ui);color:var(--c-muted)}`);
    win = document.createElement("div");
    win.className = "sel-win";
    win.style.cssText = `left:${X + 90}px;top:74px`;
    win.innerHTML = `
<div class="sel-tabs"><div class="sel-tab"><span class="sel-fav"></span>The Quiet Case for Slow Reading</div></div>
<div class="sel-url"><div class="sel-field">🔒&nbsp; fieldnotes.blog/essays/slow-reading</div><div class="sel-ext">S</div></div>
<div class="sel-body">
  <div class="sel-kick">ESSAY · 6 MIN READ</div>
  <div class="sel-h1">The Quiet Case for Slow Reading</div>
  <div class="sel-by">By Ada Lindqvist · Field Notes</div>
  <div class="sel-p"><span class="l">Most of what we read slides past us. We skim, we nod,</span><span class="l">we open another tab, and by evening it is gone.</span></div>
  <div class="sel-p"><span class="l">Slow reading isn't about speed. It's about what stays.</span><span class="l" id="sel-target"></span><span class="l">The rest drifts off with the next open tab.</span></div>
  <div class="sel-p sel-fade"><span class="l">Try it for a week: one article a day, one quote kept.</span></div>
</div>`;
    ctx.world.append(win);
    target = win.querySelector("#sel-target") as HTMLElement;
    for (const ch of SENTENCE) {
      const s = document.createElement("span");
      s.className = "sel-c";
      s.textContent = ch;
      target.append(s);
      chars.push(s);
    }
    ext = win.querySelector(".sel-ext") as HTMLElement;

    const h = document.createElement("h2");
    h.className = "sel-h";
    h.style.cssText = `left:${X + 860}px;top:190px`;
    ctx.world.append(h);
    head = masked(h, "Select. Press |Alt+N.|");

    const k = document.createElement("div");
    k.className = "sel-keys";
    k.style.cssText = `left:${X + 862}px;top:440px`;
    k.innerHTML = `<div class="sel-key">Alt</div><div class="sel-plus">+</div><div class="sel-key">N</div>`;
    ctx.world.append(k);
    keysEl = [...k.children] as HTMLElement[];

    cur = cursor(ctx.screen(30, "cursor"), {
      path: [
        { t: T.cursorIn, at: [1180, 700] },
        { t: T.dragStart - 0.05, at: () => stagePoint(target, 0, 0.6) },
        { t: T.dragStart, at: () => stagePoint(target, 0, 0.6) },
        { t: T.dragEnd, at: () => stagePoint(target, 1, 0.6), bend: 0, ease: cubicInOut },
        { t: T.dragEnd + 0.5, at: () => { const [x, y] = stagePoint(target, 1, 0.6); return [x + 40, y + 70]; } },
      ],
      clicks: [T.dragStart],
      from: T.cursorIn, to: T.toCard[0],
    });
  },
  render({ t }) {
    // browser: slight 3D tilt drifting flatter; dims once the note card takes over
    const ry = keys(t, [[T.whip[0], 12], [T.whip[1] + 0.4, 7, "quartInOut"], [T.toCard[1], 4, "sineInOut"]]);
    const dim = keys(t, [[T.cardOut, 1], [T.toCard[1], 0.55, "cubicInOut"]]);
    tf(win, `${tilt(ry, 2)} translateY(${bob(t, 1, 3)}px)`, dim);

    typeIn(head, t, T.whip[1] + 0.2, T.cardOut, { stagger: 0.07 });

    // selection follows the cursor, snapped to whole characters like a real browser selection
    let sel = 0;
    if (t >= T.dragEnd) sel = chars.length;
    else if (t > T.dragStart) {
      const p = cur.pos(t);
      const cx = p[0];
      for (const c of chars) { const r = stageRect(c); if (r.x + r.w / 2 <= cx) sel++; }
    }
    chars.forEach((c, i) => { c.style.background = i < sel ? "var(--c-accent-soft)" : "transparent"; });

    // Alt + N keycaps: pop in on quarter beats, both press on T.press, leave with the headline
    const pressed = t >= T.press && t < T.press + 0.14 ? 1 : 0;
    const out = clamp((t - T.cardOut) / 0.35);
    [0, 1, 2].forEach((i) => {
      const t0 = i === 0 ? T.keyAlt : i === 1 ? T.keyAlt + 0.07 : T.keyN;
      if (t < T.cardOut) popIn(keysEl[i], t, t0, { rotate: i === 2 ? 8 : -8, extra: `translateY(${pressed * 6}px)` });
      else tf(keysEl[i], `translateY(${-out * 60}px) scale(${1 - out * 0.2})`, 1 - out);
    });
    keysEl.forEach((k, i) => { if (i !== 1) k.style.boxShadow = pressed ? "0 0 0 #d8cfbf,0 8px 16px -10px rgba(40,32,20,.45)" : ""; });

    // the extension icon reacts to the shortcut
    const bump = t >= T.press ? 1 + 0.25 * Math.sin(Math.PI * clamp((t - T.press) / 0.3)) : 1;
    tf(ext, `scale(${bump})`, 1);

    cur.render(t);
  },
});
