// D · "Your currency, your call." The yen (the reel's next item) slides left as the popup swings in;
// a cursor opens the currency menu and picks Euro; the yen's badge flips from kroner to euros.
import {
  badge, clamp, cubicInOut, cursor, defineScene, expoOut, lerp, masked, popIn, prog, setHtml, slide, spring, stagePoint, swingIn, tf, typeIn,
  ensureStyle, type CursorHandle,
} from "@dolly/core";
import { REEL_GAP, REEL_X, REEL_Y0, T_D, T_REEL, conv } from "../shared.ts";

const OPTS = [["DKK", "Danish krone"], ["EUR", "Euro"], ["USD", "US dollar"], ["GBP", "British pound"], ["SEK", "Swedish krona"], ["NOK", "Norwegian krone"]];

const CSS = `
.pp-pop{position:absolute;width:400px;background:#fff;border-radius:20px;box-shadow:var(--s-float);font-family:var(--f-body);transform-origin:0 50%}
.pp-pop header{display:flex;align-items:center;gap:14px;padding:20px 22px;border-bottom:1px solid #eceef2}
.pp-pop header i{font:700 15px/1.75 var(--f-ui);font-style:normal;background:var(--c-ink);color:#fff;padding:0 .55em;border-radius:7px 7px 7px 1px}
.pp-pop header b{display:block;font-size:18px;line-height:1.75;height:1.75em;overflow:hidden}
.pp-pop header small{display:block;color:var(--c-muted);font-size:14px}
.pp-pop .r{position:relative;display:flex;align-items:center;justify-content:space-between;padding:15px 22px;border-bottom:1px solid #eceef2;font-size:17px}
.pp-pop .r:last-child{border-bottom:0}
.pp-pop .sel{border:1px solid var(--c-line);border-radius:9px;padding:2px 12px;font-size:16px;font-weight:600;background:#fff;line-height:1.75}
.pp-pop .sel.open{border-color:var(--c-accent);box-shadow:0 0 0 4px rgba(51,85,255,.15)}
.pp-menu{position:absolute;right:22px;top:54px;width:236px;background:#fff;border-radius:12px;padding:6px;z-index:2;transform-origin:70% 0;box-shadow:0 24px 48px -20px rgba(20,24,40,.4),0 0 0 1px rgba(20,24,40,.08)}
.pp-menu .opt{position:relative;padding:8px 10px;border-radius:8px;font-size:15px;font-weight:500;z-index:1}
.pp-menu .opt b{display:inline-block;width:42px;font-weight:700}
.pp-menu .opt.hi{color:#fff}
.pp-menu .pill{position:absolute;left:6px;right:6px;height:36px;border-radius:8px;background:var(--c-accent)}
.pp-tg{width:44px;height:26px;border-radius:13px;background:var(--c-ink);position:relative}
.pp-tg::after{content:"";position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:50%;background:#fff}
.pp-tg.off{background:#d5d8de}.pp-tg.off::after{right:auto;left:4px}`;

let head: HTMLElement[], yenChars: HTMLElement[];
let yen: HTMLElement, yenB: HTMLElement, popWrap: HTMLElement, sel: HTMLElement, rateLine: HTMLElement, menu: HTMLElement, pill: HTMLElement;
let opts: HTMLElement[];
let cur: CursorHandle;

export default defineScene({
  name: "control",
  start: 12.9,
  end: 19.8,
  markers: { "pop-in": 0.65, pick: 3.4 },
  setup(ctx) {
    ensureStyle("pp-control", CSS);
    const hD = document.createElement("h2"); hD.className = "pp-h"; hD.style.cssText = "left:80px;top:96px;width:620px";
    ctx.hud.append(hD);
    head = masked(hD, "Your currency, your call.");

    yen = document.createElement("div"); yen.className = "pp-yen";
    const w = document.createElement("span"); w.className = "w";
    yenB = badge(""); w.append(yenB); yen.append(w);
    ctx.world.append(yen);
    yenChars = masked(w, "¥42,800", { chars: true });

    popWrap = document.createElement("div"); popWrap.className = "pp-abs"; popWrap.style.cssText = "left:2380px;top:800px";
    popWrap.innerHTML = `<div class="pp-pop">
      <header><i>kr.</i><div><b class="rate"></b><small>Daily ECB rate</small></div></header>
      <div class="r">Convert to <span class="sel"></span><div class="pp-menu"><div class="pill"></div>${OPTS.map(([c, n]) => `<div class="opt"><b>${c}</b>${n}</div>`).join("")}</div></div>
      <div class="r">On <span class="pp-tg"></span></div>
      <div class="r">On this site <span class="pp-tg"></span></div>
      <div class="r">Show all prices <span class="pp-tg off"></span></div>
      <div class="r">Area &amp; weight <span class="pp-tg"></span></div></div>`;
    ctx.world.append(popWrap);
    sel = popWrap.querySelector(".sel")!; rateLine = popWrap.querySelector(".rate")!;
    menu = popWrap.querySelector(".pp-menu")!; pill = popWrap.querySelector(".pill")!;
    opts = [...popWrap.querySelectorAll<HTMLElement>(".opt")];

    // targets are measured live every frame, so the cursor follows the tilting popup
    const selP = () => stagePoint(sel, 0.55, 0.6);
    const eurP = () => stagePoint(opts[1], 0.35, 0.55);
    cur = cursor(ctx.screen(30, "cursor"), {
      path: [
        { t: T_D.cursorIn, at: [1250, 690] }, { t: T_D.atSel, at: selP }, { t: T_D.glide - 0.1, at: selP },
        { t: T_D.glide + 0.3, at: eurP }, { t: T_D.cursorOut, at: eurP },
        { t: 18.4, at: () => { const [x, y] = eurP(); return [x + 150, y + 210]; } },
      ],
      clicks: [T_D.open, T_D.pick], from: T_D.cursorIn, to: 18.5,
    });
  },
  render({ t }, ctx) {
    const cy = ctx.camera(t).y;
    // the yen is the reel's next item; it slides left as the popup swings in
    {
      const arrive = T_REEL[3], sl = expoOut(prog(t, 13.55, 1.0));
      const d = (REEL_Y0 + 3 * REEL_GAP - (cy - 30)) / REEL_GAP, k = Math.min(Math.abs(d), 1.6);
      yen.style.left = lerp(REEL_X, 1690, sl) + "px";
      yen.style.top = lerp(REEL_Y0 + 3 * REEL_GAP - 70, 1150 - 60, sl) + "px";
      tf(yen, `scale(${(1 - 0.14 * k) * lerp(1, 0.9, sl)})`, t < arrive - 0.3 ? 0 : 1 - 0.6 * Math.min(k, 1.2));
      typeIn(yenChars, t, arrive - 0.25, Infinity, { stagger: 0.035, dur: 0.7 });
    }
    typeIn(head, t, 13.8, Infinity, { stagger: 0.06 });
    swingIn(popWrap, t, T_D.popIn);

    const pk = prog(t, T_D.pick, 0.55);
    setHtml(sel, t < T_D.pick ? "DKK · Danish krone ▾" : slide("DKK · Danish krone ▾", "EUR · Euro ▾", pk));
    const r0 = `1.000 ₩ = ${conv(1000, "KRW")}`, r1 = `1.000 ₩ = ${conv(1000, "KRW", "EUR")}`;
    setHtml(rateLine, t < T_D.pick ? r0 : slide(r0, r1, pk));

    // the yen badge lands as DKK, then flips over to EUR when the user picks it
    {
      const t0 = T_REEL[3] + 0.5;
      if (t < T_D.pick + 0.05) { yenB.textContent = conv(42800, "JPY"); popIn(yenB, t, t0); }
      else {
        const f = (t - T_D.pick - 0.05) / 0.5, half = f < 0.5;
        yenB.textContent = half ? conv(42800, "JPY") : conv(42800, "JPY", "EUR");
        const ang = half ? f * 2 * 90 : lerp(-90, 0, spring((f - 0.5) * 0.5, { freq: 2.2, zeta: 0.45 }));
        tf(yenB, `perspective(500px) rotateX(${ang}deg)`, 1);
      }
    }
    // the menu springs open; the highlight is a pill that glides between rows
    sel.classList.toggle("open", t >= T_D.open && t < T_D.pick + 0.15);
    if (t >= T_D.open && t < T_D.pick + 0.3) {
      const pin = spring(t - T_D.open, { freq: 2.4, zeta: 0.7 }), pout = cubicInOut(prog(t, T_D.pick + 0.08, 0.2));
      tf(menu, `translateY(${(1 - pin) * -10}px) scale(${lerp(0.92, 1, pin) - pout * 0.04})`, clamp((t - T_D.open) * 8) * (1 - pout));
      opts.forEach((o, i) => { const q = expoOut(prog(t, T_D.open + 0.04 + i * 0.035, 0.4)); o.style.transform = `translateY(${(1 - q) * -8}px)`; o.style.opacity = String(q); });
      const gp = spring(t - T_D.glide, { freq: 2.6, zeta: 0.75 });
      const top = lerp(opts[0].offsetTop, opts[1].offsetTop, gp);
      pill.style.top = top + "px";
      opts.forEach(o => o.classList.toggle("hi", Math.abs(o.offsetTop - top) < 18));
    } else {
      // hidden in its closed pose, so the cursor's live target doesn't jump when the menu goes away
      tf(menu, t < T_D.open ? "translateY(-10px) scale(0.92)" : "translateY(0px) scale(0.96)", 0);
      opts.forEach(o => { o.style.transform = "none"; o.style.opacity = "1"; });
    }
    cur.render(t);
  },
});
