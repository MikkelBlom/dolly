// The note card springs out of the selection: quote, page title and source link.
import { defineScene, ensureStyle, flyIn, masked, popIn, typeIn, bob, tf, tilt, keys, clamp, expoOut } from "@dolly/core";
import { ARTICLE_X as X, CARD, SELECTION, T } from "../beats.ts";

let head: HTMLElement[], card: HTMLElement, logo: HTMLElement, quote: HTMLElement[], rows: HTMLElement[] = [], saved: HTMLElement;

export default defineScene({
  name: "card",
  start: T.cardOut - 0.05,
  end: T.zoom[1] + 0.05,
  setup(ctx) {
    ensureStyle("scene-card", `
.nc-h{position:absolute;margin:0;font:700 54px/1.1 var(--f-display);letter-spacing:-.03em;color:var(--c-fg);width:500px}
.nc{position:absolute;box-sizing:border-box;padding:24px 26px 22px;background:var(--c-surface);border-radius:var(--r-lg);box-shadow:var(--s-float);color:var(--c-fg);font-family:var(--f-ui)}
.nc-top{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.nc-logo{width:32px;height:32px;border-radius:9px;background:var(--c-accent);color:#fff;font:700 17px/32px var(--f-ui);text-align:center}
.nc-name{font:700 17px var(--f-ui);flex:1}
.nc-saved{padding:5px 12px;border-radius:999px;background:var(--c-accent-soft);color:#14482f;font:700 14px var(--f-ui);white-space:nowrap}
.nc-q{position:relative;margin:0 0 18px;padding-left:16px;border-left:4px solid var(--c-accent);font:italic 400 24px/1.4 var(--f-serif);color:#1d2420}
.nc-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--c-line);white-space:nowrap}
.nc-fav{width:18px;height:18px;border-radius:5px;background:#d77b4a;flex:none}
.nc-title{font:700 16px var(--f-ui)}
.nc-link{font:400 15px var(--f-ui);color:var(--c-accent);text-decoration:underline;text-underline-offset:3px}
.nc-ico{width:18px;text-align:center;color:var(--c-accent);font:700 16px var(--f-ui)}
.nc-foot{font:400 14px var(--f-ui);color:var(--c-muted);padding-top:10px;border-top:1px solid var(--c-line)}`);
    card = document.createElement("div");
    card.className = "nc";
    card.style.cssText = `left:${CARD.left}px;top:${CARD.top}px;width:${CARD.width}px`;
    card.innerHTML = `
<div class="nc-top"><div class="nc-logo">S</div><div class="nc-name">Snapnote</div><div class="nc-saved">✓ Saved</div></div>
<div class="nc-q"></div>
<div class="nc-row"><span class="nc-fav"></span><span class="nc-title">The Quiet Case for Slow Reading</span></div>
<div class="nc-row"><span class="nc-ico">↗</span><span class="nc-link">fieldnotes.blog/essays/slow-reading</span></div>
<div class="nc-foot">Alt+N · just now</div>`;
    ctx.world.append(card);
    quote = masked(card.querySelector(".nc-q") as HTMLElement, "“We remember what we take the time to write down.”");
    rows = [...card.querySelectorAll(".nc-row"), card.querySelector(".nc-foot")] as HTMLElement[];
    saved = card.querySelector(".nc-saved") as HTMLElement;
    logo = card.querySelector(".nc-logo") as HTMLElement;

    const h = document.createElement("h2");
    h.className = "nc-h";
    h.style.cssText = `left:${X + 1090}px;top:250px`;
    ctx.world.append(h);
    head = masked(h, "Quote, title, link. |Saved.|");
  },
  render({ t }) {
    // flies out of the selected sentence, growing from it, then settles flat before the camera dives into the logo
    const cx = CARD.left + CARD.width / 2, cy = CARD.top + 170;
    const settle = clamp((t - (T.zoom[0] - 1.2)) / 1.0);
    const ry = keys(t, [[T.cardOut, -16], [T.toCard[1], -7, "quartInOut"], [T.zoom[0] - 1.2, -5, "sineInOut"], [T.zoom[0] - 0.1, 0, "cubicInOut"]]);
    const drift = bob(t, 2, 3) * (1 - settle);
    flyIn(card, t, T.cardOut, {
      dx: SELECTION.x - cx, dy: SELECTION.y - cy, rotate: -6, scale0: 0.3,
      spring: { freq: 1.25, zeta: 0.62 }, extra: `${tilt(ry, 2 * (1 - settle))} translateY(${drift}px)`,
    });
    typeIn(quote, t, T.cardOut + 0.35, undefined, { stagger: 0.035 });
    rows.forEach((r, i) => {
      const p = expoOut(clamp((t - (T.cardOut + 0.75 + i * 0.15)) / 0.6));
      tf(r, `translateY(${(1 - p) * 14}px)`, p);
    });
    popIn(saved, t, T.cardOut + 1.25, { rotate: -8 });
    // the letter fades as the camera dives into the tile, so the tile's flat green becomes the end card
    logo.style.color = `rgba(255,255,255,${1 - clamp((t - (T.zoom[0] + 0.55)) / 0.2)})`;
    typeIn(head, t, T.toCard[1] + 0.1, T.zoom[0] - 0.25, { stagger: 0.07 });
  },
});
