# Motion grammar

What separates a film from a slideshow. From well-regarded launch films (Apple, Linear, Raycast, Stripe), motion-design systems (IBM Carbon, Material, Apple HIG), editing theory (Murch, cutting on action) and the Price Peek promo (first attempt rejected as "looks like a PowerPoint", the rebuild approved as "GREAT"). Sources: `docs/research-notes/05-motion-grammar.md` in the dolly repo. `[lint: id]` marks rules `dolly lint` checks.

## Structure

- **One world, one camera.** Every scene is a region of one large world layer; a virtual camera moves through it. Never cut to a blank background and rebuild.
- **Every transition is a camera move or a match cut**, never a fade to nothing:
  - *Pull-back reveal*: open on an extreme close-up (zoom 2.5–3) of one detail, pull back so the rest appears around it.
  - *Whip-pan*: 0.5–0.7 s, quartInOut, to the next region. Motion blur sells it.
  - *Reel scroll*: items stacked vertically, camera steps down one at a time; items away from centre shrink (−14 %) and dim.
  - *Continuity carry*: the next scene's hero is already in frame (the reel's last item becomes the next layout's subject).
  - *Dolly-through*: the world scales ~2.4× and fades while the next layer scales 0.62 → 1 behind it.
  - *Zoom into an element*: exponential zoom (×60) into a dark element until its fill is the next background. The best end-card entrance.
- **Holds never sit still**: slow push-in (+5–7 % zoom, sineInOut) and a few px of bob. [lint: static-span — nothing moves for > 1.5 s]
- **Background with parallax**: a faint dot grid at half camera speed makes every move readable.
- **Story**: hook (question/problem) → promise with proof → differentiator → control → second capability → end card. One idea per beat. ≤ 9 words of headline on screen. [lint: hook-within-2s]
- **End card** 3–6 s: logo, name, tagline, slow push. [lint: end-card-duration]

## Timing

- **Beat grid** (120 BPM = 0.5 s): cascades on quarter beats (0.25 s); camera moves start on whole/half seconds; cuts on downbeats. [lint: cut-on-beat]
- **Stagger everything**: words 50–80 ms, characters 30–45 ms, cards 150 ms, badges 250 ms. Nothing important appears all at once. [lint: simultaneous-entrances]
- **Reading time**: on-screen text needs ≥ 0.5 s + words/3 (min 0.8 s) after it has fully arrived. [lint: text-reading-time]
- **Exits are shorter than entrances** (~0.5 s vs 0.75 s) and accelerate away; entrances decelerate in.
- **Cut on action**: change scenes while something moves, not during a hold. [lint: cut-on-motion]
- Single elements move in 150–900 ms; camera moves 0.5–1.5 s; slow drifts across a whole hold.

## Easing and physics

- Entrances `expoOut` (sharp start, long settle); camera moves `quartInOut`; drifts `sineInOut`. Never linear for UI, never the CSS default `ease`.
- Physical pop-ins use springs: freq 1.3–2.4 Hz, ζ 0.42–0.7. Lower ζ for small playful things (badges 2.1 Hz/0.42), higher for big heavy things (cards 1.25/0.62, popups 1.0/0.7). Keep overshoot ≤ ~15 % on UI (`springOvershoot`).
- Flying elements start at 0.7 scale, 200–400 px away, rotated ±9°, and spring home; they are still settling when the next thing starts (overlap).
- Impact: the receiving element reacts (a card squashes 3–4 % when a badge lands: `land`).

## Type

- Masked reveals: each word (headlines) or character (prices, names) rises from its own clip box with a slight rotation; travel 140 %.
- Exit headlines upwards through the same masks before the next one comes in.
- A number that changes rolls like an odometer (`roll`, differing digits only, right to left). A label that changes slides as a whole string (`slide`).
- Legibility: ≥ 22 px at 1080p [lint: min-text-size]; vertical formats ≥ 3 % of height; contrast ≥ 4.5:1, 3:1 for large text [lint: contrast-wcag]; inside the 90 % title-safe area [lint: safe-area-title].

## UI demos

- The cursor moves on curved paths (quadratic bezier, `bend` 0.25), never straight lines; squashes to 0.86 on press; every click sends a ripple.
- Measure cursor targets live (`stagePoint`) — tilted and animating cards move them.
- Tilt UI cards in 3D (perspective 1500px, rotateY −38° → −10°, drifting to −5°). A flat card reads as a screenshot.
- Dropdowns spring open with options staggered in; the highlight is a pill that glides, not a class that jumps.
- Typing: each new character drops in (scale 1.25 → 1); the caret blinks only while idle; badges update per keystroke with a small bump.

## Polish

- Motion blur is automatic (adaptive samples, 180° shutter). Fast whips need it; design moves knowing they will blur.
- Depth of field on end-card floaters: far ones small with blur(1px), near ones 1.55× with blur(3px), drifting at different speeds.
- A small persistent brand mark through the content scenes; it leaves before the end card.
- Stay inside the brand: same colours, fonts and shapes as the product's UI and store images. Motion adds energy, not new visual language.
- No `will-change`, no CSS animations/transitions [lint: will-change, css-animation].

## Sound (separate step)

Leave renders silent unless the user provides music/VO. Music ~120 BPM to match the grid; VO ~150 wpm; music ducked 8–12 dB under VO; master to −14 LUFS (`audio` in defineVideo does this on render). Don't synthesize sound effects with oscillators — it sounds cheap. Never call a paid voice service without asking.
