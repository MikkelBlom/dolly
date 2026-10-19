# Worked examples

Three complete pieces that cover the parts that are easy to get wrong: a UI mock with a cursor drag that measures live layout, a dive into an element that becomes the end card, and a themed end card. The first is from a real run (the "Snapnote" test video).

## 1. UI mock: cursor drags a selection over a sentence, then a shortcut

```ts
// scenes/select.ts — the article window lives in the world at x = X; the camera whipped here at 3.0–3.6 s
import { defineScene, ensureStyle, masked, popIn, typeIn, bob, tf, tilt, keys, clamp, cursor, stagePoint, stageRect } from "@dolly/core";

const X = 2048;
const T = { whipEnd: 3.6, cursorIn: 3.9, dragStart: 4.3, dragEnd: 5.2, keyAlt: 5.5, keyN: 5.75, press: 6.0, out: 7.0 };
const SENTENCE = "We remember what we take the time to write down.";
let head: HTMLElement[], win: HTMLElement, chars: HTMLElement[] = [], target: HTMLElement, keysEl: HTMLElement[] = [];
let cur: ReturnType<typeof cursor>;

export default defineScene({
  name: "select", start: 2.95, end: 10.85,
  setup(ctx) {
    ensureStyle("scene-select", `
.sel-win{position:absolute;width:720px;height:572px;background:var(--c-surface);border-radius:var(--r-lg);box-shadow:var(--s-float);overflow:hidden}
.sel-body{padding:28px 52px}
.sel-p{font:400 19px/1.62 var(--f-serif);margin-bottom:14px}
.sel-p span.l{display:block;white-space:nowrap}
.sel-h{position:absolute;margin:0;font:700 54px/1.1 var(--f-display);width:380px}
.sel-keys{position:absolute;display:flex;gap:12px;align-items:center}
.sel-key{min-width:64px;height:64px;padding:0 18px;border-radius:16px;background:var(--c-surface);border:2px solid var(--c-line);font:700 26px var(--f-ui);display:flex;align-items:center;justify-content:center}`);
    win = document.createElement("div");
    win.className = "sel-win";
    win.style.cssText = `left:${X + 90}px;top:74px`;
    // mock article text is texture, not a message: data-dolly-decor keeps the text rules off it
    win.innerHTML = `<div class="sel-body" data-dolly-decor>
      <div class="sel-p"><span class="l">Slow reading isn't about speed. It's about what stays.</span><span class="l" id="target"></span></div></div>`;
    ctx.world.append(win);
    target = win.querySelector("#target")!;
    for (const ch of SENTENCE) { const s = document.createElement("span"); s.textContent = ch; target.append(s); chars.push(s); }

    const h = document.createElement("h2"); h.className = "sel-h"; h.style.cssText = `left:${X + 860}px;top:190px`;
    ctx.world.append(h);
    head = masked(h, "Select. Press\n|Alt+N.|");          // \n = line break

    const k = document.createElement("div"); k.className = "sel-keys"; k.style.cssText = `left:${X + 862}px;top:440px`;
    k.innerHTML = `<div class="sel-key">Alt</div><div>+</div><div class="sel-key">N</div>`;
    ctx.world.append(k);
    keysEl = [...k.children] as HTMLElement[];

    // targets are functions, measured every frame (the window tilts and bobs)
    cur = cursor(ctx.screen(30, "cursor"), {
      path: [
        { t: T.cursorIn, at: [1180, 700] },
        { t: T.dragStart, at: () => stagePoint(target, 0, 0.6) },              // fx, fy: fractions of the box
        { t: T.dragEnd, at: () => stagePoint(target, 1, 0.6), bend: 0, ease: "cubicInOut" },
        { t: T.dragEnd + 0.5, at: () => { const [x, y] = stagePoint(target, 1, 0.6); return [x + 40, y + 70]; } },
      ],
      clicks: [T.dragStart], from: T.cursorIn, to: T.out,
    });
  },
  render({ t }) {
    tf(win, `${tilt(keys(t, [[T.whipEnd - 0.6, 12], [T.whipEnd + 0.4, 7, "quartInOut"], [10, 4, "sineInOut"]]), 2)} translateY(${bob(t, 1, 3)}px)`, 1);
    typeIn(head, t, T.whipEnd + 0.2, T.out, { stagger: 0.07 });

    // selection follows the cursor, snapped to whole characters; set for EVERY frame (pure render)
    let sel = 0;
    if (t >= T.dragEnd) sel = chars.length;
    else if (t > T.dragStart) { const [cx] = cur.pos(t); for (const c of chars) { const r = stageRect(c); if (r.x + r.w / 2 <= cx) sel++; } }
    chars.forEach((c, i) => { c.style.background = i < sel ? "var(--c-accent-soft)" : "transparent"; });

    const pressed = t >= T.press && t < T.press + 0.14 ? 6 : 0;
    [T.keyAlt, T.keyAlt + 0.07, T.keyN].forEach((t0, i) => {
      const out = clamp((t - T.out) / 0.35);
      if (t < T.out) popIn(keysEl[i], t, t0, { extra: `translateY(${pressed}px)` });
      else tf(keysEl[i], `translateY(${-out * 60}px)`, 1 - out);
    });
    cur.render(t);
  },
});
```

`stagePoint(el, fx, fy)` → `[x, y]` in stage px (fx/fy are fractions of the element's box: 0,0 top-left, 1,1 bottom-right). `stageRect(el)` → `{ x, y, w, h }` in stage px. `cursor(...).pos(t)` → `[x, y]`. All measure live layout including transforms.

## 2. Dive into an element: its fill becomes the end card

Use the camera (the whole world zooms, the element stays pinned on screen and slides to the centre):

```ts
// video.ts
const camera = cameraPath(stage)
  .at(0, { x: 640, y: 360, zoom: 1 })
  // …moves…
  .push(8.0, 9.9, 0.05)
  .zoomInto(9.9, 10.8, [badgeWorldX, badgeWorldY], 60)   // world point of a dark element's centre
  .build();
```

Find the world point by construction (you placed the element: left/top in the world container plus half its size). Time the end scene to start at the dive's end (10.8 here) on the same colour as the element's fill. Fade text inside the element out early in the dive (`tf(label, "none", 1 - prog(t, 9.9, 0.3))`). For a dive inside a screen-space layer instead of the world, the component `zoomInto(layer, el, t, t0, t1)` returns `{ z, css, origin }`: set `layer.style.transformOrigin = origin` and `layer.style.transform = css` while `z > 0`.

## 3. A themed end card

```ts
import { defineScene, endCard } from "@dolly/core";
let card: ReturnType<typeof endCard>;
export default defineScene({
  name: "end", start: 10.78, end: 15,
  setup(ctx) {
    card = endCard(ctx.screen(60, "end"), {
      logo: "S", name: "Snapnote", tagline: "Notes in |one keystroke|",
      at: { logo: 11.0, name: 11.3, tag: 11.8 }, pushFrom: 10.8, pushDur: 4.2,
      colors: { bg: "#1f6f4a", name: "#ffffff", tagline: "#e6f2ea", accent: "#ffffff", logoBg: "#ffffff", logoFg: "#1f6f4a", logoRadius: "22%" },
    });
  },
  render({ t }) { card.render(t); },
});
```

Keep the tagline ≥ 4.5:1 against `bg` (`dolly lint` checks it); make the accent *stronger* than the rest of the tagline, not lighter.
