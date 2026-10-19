# 05 — Motion grammar for promo / launch videos

Research notes, 2026-10-19. Web research only. Purpose: ground the promo-video linter ("motion grammar")
and the component/preset library in sourced, checkable numbers.

**How to read the confidence labels**

- **[spec]** — the number comes from a published standard or official design system (Netflix, EBU/SMPTE, WCAG, IBM Carbon, Material, Apple, YouTube Help).
- **[practitioner]** — from a respected practitioner/blog/vendor; plausible but not a standard.
- **[proposed]** — my own default, derived from the sources cited next to it. These are the numbers most worth tuning against real films.

**Honest gap:** I found **no first-party write-ups** by Linear, Raycast, The Browser Company (Arc), Stripe, Vercel or Figma about *how* they make their launch films. What exists is secondary (a Lago post describing Linear's films, job ads, press coverage). Patterns attributed to those companies below are therefore partly from those secondary sources and partly from general knowledge of the films; nothing below should be quoted as "Linear says X". Watching and frame-stepping 10–20 reference films to calibrate the [proposed] thresholds is the obvious follow-up.

---

## A. What makes these films good

### A1. One idea per beat, and one motion at a time

The clearest description of the Linear launch-film style comes from Lago, who copied it deliberately: films of **about 20 seconds**, **no voice-over, no stock footage, no abstract 3D shapes**; "the camera moves through the real product, one action at a time" ([Lago, "We killed our motion design job"](https://getlago.com/blog/we-killed-our-motion-design-job)). Their own rules for the copy were: real product only (no invented UI), one motion at a time, the camera does every transition (screens slide off-frame instead of floating like cards), **no intro card**, every shot must advance a named story point or it gets cut, and shots hold long enough to read the payoff. Their films came out at ~23 s.

This matches the IBM Carbon split between **productive** motion (subtle, fast, for task UI) and **expressive** motion (energetic, reserved for significant moments) ([Carbon motion](https://carbondesignsystem.com/elements/motion/overview/)): a launch film is mostly productive motion punctuated by a few expressive beats, not expressive motion everywhere.

Implications for the linter: limit concurrent focal motion, require holds after reveals, forbid an intro card before the hook.

### A2. Type animated at the speed of perception (Apple)

Motionographer's breakdown of Apple's iPhone 7 film "Don't Blink" ([Motionographer, 2016](https://motionographer.com/2016/09/14/4-ways-dont-blink-is-a-masterclass-of-type-and-rhythm/)) is the most concrete Apple-pacing source found:

- Mostly one- and two-syllable words, **each on screen for about 5–7 frames (~0.2 s at 29.97 fps)**, one word at a time, matching a fast adult reading pace of about five words per second. So rapid-fire kinetic type is legitimate — but only for *single short words in a sequence*, not for sentences.
- **"Animating the signified"**: the motion illustrates the meaning of the word (e.g. a word is reshaped into "re-engineered").
- **Time as a character**: deliberate slow-motion moments and an abrupt stop on a minimal product lockup with a chime — contrast in tempo is the device.
- **Breaking the plane**: mostly 2D, with one deliberate move into z-space for emphasis.
- Percussion-heavy soundtrack driving the cut rhythm.

Other sources describe Apple reveals as restrained — text fades, scales or slides into place and never competes with the message ([Moonb, kinetic typography examples](https://www.moonb.io/blog/kinetic-typography)).

### A3. Motion has a job: easing communicates role

The design systems agree on a small vocabulary:

- **Entering** → decelerate (ease-out). **Exiting permanently** → accelerate (ease-in). **Moving within the frame** → standard ease-in-out. **Linear** only for things that never stop (spinners, loops, marquees). Sources: Carbon's standard/entrance/exit curves ([Carbon](https://carbondesignsystem.com/elements/motion/overview/)), Material 1's standard/deceleration/acceleration/sharp curves ([Material 1 duration & easing](https://m1.material.io/motion/duration-easing.html)), and Jitter's help centre, which says linear looks "mechanical" and should be reserved for elements that never stop ([Jitter help](https://help.jitter.video/en/articles/16072578-fix-robotic-animations-with-the-right-easing-curve)).
- Practitioner guidance popularised by Emil Kowalski: never use ease-in for UI entrances because it delays the first movement and feels sluggish; strong ease-out such as `cubic-bezier(0.23, 1, 0.32, 1)` ([secondary summary of emilkowalski/skills](https://instagit.com/emilkowalski/skills/why-ease-in-should-never-be-used-for-ui-interactions/)) [practitioner, secondhand].

### A4. Durations scale with distance and importance

- Carbon tokens [spec]: fast-01 **70 ms** (buttons/toggles), fast-02 **110 ms** (fades), moderate-01 **150 ms** (small expansions), moderate-02 **240 ms** (toasts), slow-01 **400 ms** (large expansions), slow-02 **700 ms** (background dimming). Duration should scale with size of change, on a non-linear scale ([Carbon](https://carbondesignsystem.com/elements/motion/overview/)).
- Material 1 [spec]: mobile ~**300 ms**, large full-screen up to **375 ms**; entering **225 ms**, exiting **195 ms**; tablet +30%, wearables −30%, desktop **150–200 ms** ([Material 1](https://m1.material.io/motion/duration-easing.html)).
- Material 3 duration tokens [spec, via Flutter]: short1–4 = **50/100/150/200 ms**, medium1–4 = **250/300/350/400**, long1–4 = **450/500/550/600**, extralong1–4 = **700/800/900/1000** ([Flutter `Durations`](https://api.flutter.dev/flutter/material/Durations-class.html)). M3 easing (from my knowledge of the Flutter/M3 source; verify): emphasized ≈ `cubic-bezier(0.2,0,0,1)`, emphasizedDecelerate `(0.05,0.7,0.1,1)`, emphasizedAccelerate `(0.3,0,0.8,0.15)`, standard `(0.2,0,0,1)`, standardDecelerate `(0,0,0,1)`, standardAccelerate `(0.3,0,1,1)`. Constant names confirmed at [Flutter `Easing`](https://api.flutter.dev/flutter/material/Easing-class.html).
- Val Head [practitioner]: start in **200–500 ms**; small changes 200–300, large travel 400–500; bouncy/elastic easing belongs at the long end; much below ~200 ms an animation may not be perceived at all ([Val Head, "How fast should your UI animations be?"](https://valhead.com/2016/05/05/how-fast-should-your-ui-animations-be/)). Basis: NN/g's 0.1 s "instant" and 1 s "flow of thought" thresholds.
- **Video caveat:** these are interaction durations. In a promo the viewer did not trigger the motion and must *notice* it, so on-screen entrances in good launch films typically run a bit longer than UI tokens (≈300–800 ms) — [proposed], calibrate on references.

### A5. Springs, with restrained bounce

- Apple (WWDC23 "Animate with springs") [spec]: springs specified by **duration** and **bounce** (−1…1); presets smooth / snappy / bouncy; example `.spring(duration: 0.6, bounce: 0.2)`; conversion: mass = 1, stiffness = (2π / duration)², damping = 1 − 4π·bounce / duration for bounce ≥ 0 ([Apple session](https://developer.apple.com/videos/play/wwdc2023/10158/), [WWDC notes](https://wwdcnotes.com/notes/wwdc23/10158)). My recollection is that the presets are bounce 0 / 0.15 / 0.3 (verify). Bounce ≈ 1 − damping ratio ζ, so bounce 0.3 → ζ ≈ 0.7 → overshoot ≈ e^(−ζπ/√(1−ζ²)) ≈ **4.6%**; bounce 0.15 → <1% overshoot.
- Motion (ex-Framer Motion) [spec]: default spring bounce **0.25**, damping **10**, mass **1**, restDelta 0.01, restSpeed 0.1; tween default **0.3 s** (0.8 s for multi-keyframe) ([motion.dev transitions](https://motion.dev/docs/react-transitions)). Classic physical defaults stiffness 100 / damping 10 / mass 1 give ζ = 10 / (2√100) = **0.5 → ~16% overshoot**, which is why "default spring" looks bouncy in video.

### A6. Choreography: offset & delay, parenting, one thing leads

Issara Willenskomer's "UX in Motion" 12 principles (easing, offset & delay, parenting, transformation, value change, masking, overlay, cloning, obscuration, parallax, dimensionality, dolly & zoom) are effectively a component taxonomy for promo films ([UX Mag manifesto](https://uxmag.com/articles/creating-usability-with-motion-the-ux-in-motion-manifesto)). Offset & delay: related elements move one after another, not in lockstep, which creates hierarchy. Stagger intervals seen in practice: motion.dev's tutorial uses **50 ms** ([motion.dev stagger](https://motion.dev/tutorials/js-stagger)), LogRocket uses 100 ms ([LogRocket](https://blog.logrocket.com/css-staggered-animations/)), Dynatrace tokens 20 ms; Material treats staggers as a stylistic choice and warns they lengthen total duration ([Material customization](https://material.io/design/motion/customization.html)). The Disney principles map onto UI mainly as squash/stretch on press, short anticipation, staging, arcs, and staggered follow-through ([IxDF](https://ixdf.org/literature/article/ui-animation-how-to-apply-disney-s-12-principles-of-animation-to-ui-design), [uxdesign.cc](https://uxdesign.cc/disneys-12-principles-of-animation-exemplified-in-ux-design-5cc7e3dc3f75)).

Material's transition patterns are directly reusable as promo transitions: **container transform** (a persistent container grows into the next screen), **shared axis** (x/y/z translate + fade, for sequential steps), **fade through** (unrelated screens), **fade** (things entering/leaving) ([Material motion system](https://material.io/design/motion/the-motion-system.html)).

### A7. Editing: emotion first, eye-trace, cut on action, cut to music

- **Murch's Rule of Six** [practitioner canon]: emotion 51%, story 23%, rhythm 10%, eye-trace 7%, 2D plane of screen 5%, 3D space 4%; sacrifice from the bottom up ([No Film School](https://nofilmschool.com/2016/11/6-rules-good-cutting-according-oscar-winning-editor-walter-murch), [Filmdaft table](https://filmdaft.com/walter-murchs-rule-of-six-the-editors-formula-for-choosing-the-right-cut/)). Of these, **rhythm, eye-trace and 2D-plane are machine-checkable** from a scene graph.
- **Cut on action**: cutting during movement hides the cut ([PremiumBeat](https://www.premiumbeat.com/blog/9-essential-video-editing-cuts)). **J/L cuts** lead or trail audio across a picture cut ([StudioBinder](https://www.studiobinder.com/blog/what-is-an-l-cut), [Vimeo](https://vimeo.com/blog/post/j-cuts-l-cuts)) — in promos, the whoosh/riser as a J-cut into the next scene.
- **Beat sync** [practitioner]: frames per beat = (60 / BPM) × fps (120 BPM @ 30 fps = 15 frames); cut on phrases of 2/4/8 beats rather than every beat; big changes on downbeats; cutting on every beat feels relentless, cutting only on beat 1 gets predictable; nudge a few frames if a beat cut breaks continuity ([Filmdaft](https://filmdaft.com/how-to-edit-video-clips-to-the-beat-of-music-the-easy-way/), [beat-sync skill table](https://www.claudemarket.ai/skills/iart-ai/motion-design-skills/beat-sync-editing), [Sonilo](https://sonilo.com/blog/guides/how-to-make-video-sync-with-music)). Cut cadence by mood: every ~4 beats playful, 8–16 beats premium with long holds, 1–2 beats only at a climax.

### A8. Camera: continuous camera instead of cuts, within judder limits

Linear-style films move a virtual camera through a flat product canvas rather than cutting (Lago, above). Physical limit: RED's rule of thumb is **no faster than one full image width every ~7 seconds** at 24 fps / 180° shutter for textured content, otherwise judder/strobing; larger shutter angle (more blur) smooths, higher frame rate helps ([RED, camera panning speed](https://www.reddigitalcinema.com/red-101/camera-panning-speed)). Phil Holland argues it is outdated for modern displays ([panSpeedCalc](https://daejeonchronicles.com/2022/10/08/phil-hollands-panspeedcalc/)). For rendered video: motion blur at 180° (1/2 frame exposure) makes fast moves and whips acceptable; without blur, keep per-frame displacement small.

### A9. Reading time and on-screen text

- Netflix [spec]: **≤ 42 chars/line, ≤ 2 lines, ≤ 20 chars/s adult (17 cps children)** ([Netflix English timed text guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide)); minimum **5/6 s** (20 frames @ 24 fps), maximum **7 s** per event ([Netflix general requirements](https://backlothelp.netflix.com/hc/en-us/articles/215758617)); **2-frame minimum gap**, gaps either 2 frames or ≥ 0.5 s; in/out times snap to shot changes if within **0.5 s (12 frames @ 24 fps)** ([Netflix timing guidelines](https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394-Timed-Text-Style-Guide-Subtitle-Timing-Guidelines)). Text appearing/disappearing a few frames from a cut reads as a flicker / "new subtitle".
- BBC [secondary]: **160–180 wpm** (≈0.33–0.375 s/word), ~0.3 s/word minimum ([Clevercast summary of BBC guidelines](https://clevercast.com/bbc-subtitling-guidelines)). The BBC page itself could not be fetched; verify.
- Promo heuristic "~3 words/s + reaction time": 3 w/s = 180 wpm, consistent with BBC upper bound. Headlines in promos are *not* subtitles — viewers also have to parse motion — so the linter should use the slower of the bounds.

### A10. Legibility: size, safe areas, contrast, backgrounds

- **Broadcast safe areas** [spec]: SMPTE ST 2046-1 action-safe = **93%** and title-safe = **90%** of width and height, centred; EBU R95 expresses it as 3.5% and 5% insets per edge ([Wikipedia: safe area](https://en.wikipedia.org/wiki/Safe_area_(television)), [EBU R95](https://tech.ebu.ch/publications/r095)). Web video doesn't overscan, but players overlay controls, so title-safe is still the right box for 16:9.
- **9:16 social UI** [practitioner, no official Meta/TikTok spec found]: on 1080×1920, keep text out of the top ~**250–260 px** and the bottom ~**400–420 px**, avoid the right-hand icon column; safest region ≈ central 1080×1350 ([Hopper HQ](https://www.hopperhq.com/blog/instagram-reel-size/), [Canadian Tire design system](https://brand-qa2.canadiantire.ca/en/ctr/design-system/omni-channel/motion/margins-and-safe-space.html): type-safe 896×1264 starting 260 px from top, 48 px side margins; [House of Marketers](https://houseofmarketers.com/guide-to-safe-zones-tiktok-facebook-instagram-stories-reels/): avoid top/bottom 10% on TikTok).
- **Minimum text size at 1080p** [practitioner/regulatory]: body ≥ **22 px** at 1080p, lower-third name ~44 px / role ~26 px, double for 4K ([Towbook video type scale](https://styleguide.towbook.com/video/typography)); French ARPP requires legal-mention **x-height ≥ 22 px** in HD ([Cape help](https://help-advancedtv.cape.io/hc/en-us/articles/34886879364881-How-to-measure-the-height-of-Health-Warning-legal-mentions-for-ARPP-clearance)); 10-foot UI minimum 28 px @1080p ([Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/?p=3285)). No source found for phone-specific minimums; see rule `min-text-size` for a derived value.
- **Contrast** [spec]: WCAG 1.4.3 **4.5:1**, large text **3:1** (≥18 pt / 24 CSS px, or ≥14 pt bold); 1.4.6 AAA 7:1 / 4.5:1; 1.4.11 non-text UI **3:1** ([W3C Understanding 1.4.3](https://w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)). For video the background changes over time, so contrast must be checked across the whole hold, and a consistent scrim/backing is the reliable fix; shadows alone are unreliable ([Smashing, text over images](https://smashingmagazine.com/2023/08/designing-accessible-text-over-images-part1), [Cloudinary](https://cloudinary.com/documentation/accessible_media_visual_audio_clarity_text), [Amazon APL gradients](https://developer.amazon.com/en-US/alexa/alexa-haus/visual-design/apl-components/apl-background)).
- **Flashing** [spec]: WCAG 2.3.1 — nothing flashes more than **3 times in any 1 s** unless below general/red flash thresholds ([Stark WCAG explained](https://www.getstark.co/wcag-explained/operable/seizures-and-physical-reactions/)). Relevant to beat-synced flash cuts and strobing logo stings.

### A11. Hook, end card, sound

- **Hook**: Facebook/Nielsen (self-serving, 2016–17): up to **47%** of a campaign's value in the first **3 s**, 74% in 10 s ([Martech](https://martech.org/even-brief-video-views-drive-brand-lift-facebook-nielsen-study-finds/), [Marketing Dive](https://marketingdive.com/news/brand-lift-happens-in-less-than-1-second-of-video-study-finds/377333)); widely repeated "85% watched sound-off" figure from the same era — treat as old. Implication: message must work silently and the product/value must appear in the first seconds, no intro card.
- **End card / logo**: YouTube end screens occupy the last **5–20 s**, video must be ≥ **25 s** ([YouTube Help](https://support.google.com/youtube/answer/6388789)). Logo stings ~3–4 s total ([autoae](https://autoae.online/blog/logo-sting)); end cards read best at 3–6 s ([Morphic](https://morphic.com/resources/videos/end-card-animation-videos)) — [practitioner].
- **VO pacing**: ~**150 wpm** standard (140–160), 110–120 for complex content; 60 s ≈ 125–150 words ([Bread n Beyond](https://breadnbeyond.com/how-many-words-does-a-60-seconds-explainer-video-needs/), [IRPR calculator](https://sounddesign.irpr.agency/tools/voiceover-word-count-calculator/)).
- **Loudness**: YouTube normalises to ≈ **−14 LUFS** integrated (not officially documented); true peak ≤ **−1 dBTP**; music ducked **15–20 dB** under VO ([IRPR mixing guide](https://sounddesign.irpr.agency/guides/how-to-mix-audio-for-youtube/), [Joseph Nilo](https://josephnilo.com/blog/dialogue-loudness-lufs-true-peak-video/)) [practitioner].

---

## B. Lintable motion-grammar rules

**Shared definitions (used by the detectors)**

- `F` = frame rate; `W×H` = frame size; `S = min(W,H)`; `D = diag(W,H)`.
- **Visible text element**: text node with opacity ≥ 0.9 × its max opacity and on-screen bbox; **readable span** = contiguous interval where it is visible *and* its bbox speed < 2% S/s and scale change < 2%/s (i.e. "settled").
- **Moving**: element bbox-centroid speed > 0.5% D/s, or scale/rotation/opacity rate above a small epsilon; camera counts as moving if its transform changes by that much.
- **Focal element**: text, or any element with area ≥ 2% of frame, or tagged `focal`.
- **Entrance/exit**: interval where opacity rises from <0.1 to >0.9 (or bbox enters the frame) / the reverse. Easing is read from the authored keyframes when available; otherwise fit from sampled progress (normalised velocity profile).
- **Cut**: marker from the timeline (hard cut) or detected discontinuity in camera/scene id.
- **Beat grid**: `tBeat(n) = t0 + n·60/BPM`; bar line every 4 beats (time signature configurable).
- Sampling: evaluate the scene graph at every frame for timing rules; contrast/busy-background can sample every 2–3 frames.

Severity: **error** = will look broken or is unsafe/unreadable; **warn** = likely craft problem; **info** = taste / worth a look.

| # | id | Rule | Default threshold | Detection from scene graph | Sev. | Source |
|---|---|---|---|---|---|---|
| 1 | `hook-within-first-2s` | Something salient must be on screen and moving early; the product/value must appear fast; no intro card first. | Focal element moving by **t ≤ 0.5 s**; headline or product UI visible by **t ≤ 2.0 s** (warn) / **3.0 s** (error). No black/empty frame > 0.3 s at start. Logo-only first shot > 1 s = warn. | At each t in [0,3], count visible focal elements and moving elements; check first time a `role:headline`/`role:product` element is readable; mean frame luminance variance ≈ 0 = empty. | warn / error | [Meta/Nielsen 3 s](https://martech.org/even-brief-video-views-drive-brand-lift-facebook-nielsen-study-finds/); [Lago "no intro card"](https://getlago.com/blog/we-killed-our-motion-design-job) |
| 2 | `text-reading-time` | Every text block must stay readable long enough to read. | readable span ≥ **max(0.83 s, 0.5 s + words/3.0, chars/17)**. Exception: single-word kinetic sequences (≤ 2 words, ≤ 10 chars per item) need ≥ **0.2 s** each (6 frames @30). | Per text element: words = token count, chars = length; compare to readable span. | error (< 70% of need) / warn | [Netflix 20 cps, 5/6 s min](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide); [BBC 160–180 wpm](https://clevercast.com/bbc-subtitling-guidelines); [Don't Blink 5–7 frames/word](https://motionographer.com/2016/09/14/4-ways-dont-blink-is-a-masterclass-of-type-and-rhythm/) |
| 3 | `text-overstay` | Static text that sits too long kills pace. | readable span > **7 s** with no other motion → info; > 10 s → warn. Exempt end card. | Same spans as rule 2. | info / warn | [Netflix 7 s max](https://backlothelp.netflix.com/hc/en-us/articles/215758617) |
| 4 | `text-line-length` | Caption-style text lines must be short. | ≤ **42 chars/line**, ≤ **2 lines** for body/caption roles; headline ≤ **8 words** [proposed]. | Line-wrap info from text layout; count chars per rendered line. | warn | [Netflix](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide) |
| 5 | `text-cut-flicker` | Text should not appear or disappear just before/after a cut; either snap to the cut or keep ≥ 0.5 s away. | Text in/out time within **(2 frames, 0.5 s)** of a cut → warn. | For each text entrance start / exit end, distance to nearest cut. | warn | [Netflix timing guidelines](https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394-Timed-Text-Style-Guide-Subtitle-Timing-Guidelines) |
| 6 | `safe-area-title` (16:9) | Text and logos inside title-safe; focal action inside action-safe. | Text/logo bbox inside centred **90%×90%** (5% inset) → else error; focal non-text inside **93%** → else warn. Ignore intentionally bleeding backgrounds. | Bbox (with transforms, after camera) vs rect at every frame of readable span. | error / warn | [SMPTE ST 2046-1 / EBU R95](https://en.wikipedia.org/wiki/Safe_area_(television)) |
| 7 | `safe-area-social` (9:16) | Text clear of platform UI on vertical video. | At 1080×1920: top ≥ **260 px**, bottom ≥ **420 px**, left ≥ **48 px**, right ≥ **120 px** (icon column) [proposed from practitioner sources]; scale with height. | Same as rule 6 with asymmetric rect; preset per platform. | warn | [Hopper](https://www.hopperhq.com/blog/instagram-reel-size/); [Canadian Tire DS](https://brand-qa2.canadiantire.ca/en/ctr/design-system/omni-channel/motion/margins-and-safe-space.html) |
| 8 | `min-text-size` | Text must be legible on a phone. | Hard floor: **font-size ≥ 2.0% of H** (22 px @1080p) → error below. Target for mobile-watched 16:9: **≥ 3.0% of H** (≈32 px @1080) → warn below. 9:16 at 1920 tall: body **≥ 44 px**, headlines ≥ 64 px [proposed]. Fine print (legal) exempt from warn, not from error. | Rendered font size × cumulative scale × camera zoom, at the settled readable span. | error / warn | [Towbook 22 px @1080](https://styleguide.towbook.com/video/typography); [ARPP 22 px x-height](https://help-advancedtv.cape.io/hc/en-us/articles/34886879364881-How-to-measure-the-height-of-Health-Warning-legal-mentions-for-ARPP-clearance); mobile values [proposed] |
| 9 | `contrast-wcag` | Text contrast against what is actually behind it, through the whole hold. | **≥ 4.5:1**; **≥ 3:1** if "large" (treat font-size ≥ 4.5% of H, or ≥ 3.5% bold, as large [proposed mapping of 24 px/18.66 px CSS]). Check the **10th-percentile** background luminance under the glyph bbox, worst frame. | Render background layer stack without the text; sample pixels in text bbox; compute WCAG relative luminance contrast vs text colour (account for text opacity). | error | [WCAG 1.4.3](https://w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |
| 10 | `text-on-busy-background` | Text over a busy or moving background needs a scrim/backing. | Under the text bbox: luminance std-dev > **0.15** (0–1 scale) or edge density > **8%** pixels, or background moving > 2% S/s, with no scrim/backing element → warn. | Same background render as rule 9; Sobel edge ratio; check for a backing element (opacity ≥ 0.5) between text and background. | warn | [Smashing](https://smashingmagazine.com/2023/08/designing-accessible-text-over-images-part1); [Cloudinary](https://cloudinary.com/documentation/accessible_media_visual_audio_clarity_text) |
| 11 | `static-span` | Something should always be alive; dead frames read as a stall. | No moving element *and* no camera motion for > **1.5 s** → warn (> 3 s error), unless the span is a required reading hold (rule 2) or logo hold, in which case allow up to required + **1.0 s**. A slow camera drift (≥ 0.5% D/s) counts as motion. | Per frame, boolean "anything moving"; run-length of false. | warn / error | [proposed]; Linear-style continuous camera ([Lago](https://getlago.com/blog/we-killed-our-motion-design-job)) |
| 12 | `hold-before-exit` | After an element settles, it must hold before leaving; enter-then-immediately-exit looks like a mistake. | Settled hold ≥ **max(0.4 s, reading time for text)** before exit starts. | Per element: end of entrance → start of exit. | warn | [Lago "readable holds"](https://getlago.com/blog/we-killed-our-motion-design-job); [proposed] |
| 13 | `entrance-duration-range` | Single-element moves should be perceivable but not sluggish. | Entrance/move duration **150–900 ms** for UI/text [proposed for video; UI tokens are 70–700]. < 120 ms (non-cut) → warn "may not register"; > 1.2 s for a single element → info. Background dims/camera moves exempt. | Entrance/exit/move intervals from keyframes. | warn / info | [Carbon](https://carbondesignsystem.com/elements/motion/overview/); [Material 3 tokens](https://api.flutter.dev/flutter/material/Durations-class.html); [Val Head 200–500](https://valhead.com/2016/05/05/how-fast-should-your-ui-animations-be/) |
| 14 | `duration-scales-with-distance` | Bigger travel → longer duration; tiny nudges should be quick. | Flag moves where travel > **40% of S** in < **250 ms** (unless whip with motion blur), or travel < **2% of S** over > **600 ms**. | Travel = centroid displacement + equivalent of scale change; compare to duration. | info | [Carbon](https://carbondesignsystem.com/elements/motion/overview/); [Val Head](https://valhead.com/2016/05/05/how-fast-should-your-ui-animations-be/) |
| 15 | `exit-not-slower-than-entrance` | Exits should be quicker than or equal to entrances. | exit duration ≤ **1.0 ×** entrance duration (Material ratio ≈ 0.87). | Pair entrance/exit per element. | info | [Material 1 225/195 ms](https://m1.material.io/motion/duration-easing.html) |
| 16 | `linear-easing-on-ui` | Discrete UI/text moves must not use linear easing. | Linear (or fitted velocity profile with < 15% variance) on a start-stop position/scale/opacity move → warn. Exempt: loops, marquees, spinners, continuous camera drift, counters' digit roll inside an eased envelope. | Easing from keyframes, or fit: max/mean normalised velocity ratio < 1.15 and nonzero velocity at both ends. | warn | [Jitter](https://help.jitter.video/en/articles/16072578-fix-robotic-animations-with-the-right-easing-curve) |
| 17 | `easing-role-mismatch` | Entrances decelerate, permanent exits accelerate, in-frame moves ease-in-out. | Entrance whose peak velocity is in the last 40% of its duration (ease-in) → warn; exit with peak in the first 40% (ease-out exit that "stops" off-screen) → info. | Velocity profile peak position. | warn / info | [Carbon entrance/exit curves](https://carbondesignsystem.com/elements/motion/overview/); [Material 1](https://m1.material.io/motion/duration-easing.html); [Kowalski via summary](https://instagit.com/emilkowalski/skills/why-ease-in-should-never-be-used-for-ui-interactions/) |
| 18 | `too-many-easings` | A film should use a small, consistent motion vocabulary. | Distinct easing curves (cluster beziers within 0.05 per control point; springs clustered by (duration, bounce)) > **4** → warn; > 6 → error-ish warn. | Collect all authored easings; cluster. | warn | Carbon uses 3 curves × 2 modes ([Carbon](https://carbondesignsystem.com/elements/motion/overview/)); [proposed] |
| 19 | `overshoot-limits` | Springs on UI/text should settle with restrained bounce. | Overshoot ≤ **5%** of travel for text and UI (≈ Apple bounce ≤ 0.3, ζ ≥ 0.7); ≤ **12%** for playful elements (badges, icons) → else warn; > 1 visible oscillation (second peak > 1% travel) → warn. | Sample element position/scale; overshoot = (max beyond target)/travel; count zero-crossings of (value − target). Or compute ζ = c / (2√(km)) analytically from spring params. | warn | [Apple springs](https://developer.apple.com/videos/play/wwdc2023/10158/); [motion.dev defaults](https://motion.dev/docs/react-transitions) |
| 20 | `spring-settled-at-cut` | No visible residual oscillation when a cut or exit happens. | At cut / exit start, every spring within **0.5 px** and **0.5%** scale of target (or explicitly in motion as part of a cut-on-action). | Distance to target at cut time. | warn | [motion.dev restDelta](https://motion.dev/docs/react-transitions); [proposed] |
| 21 | `simultaneous-entrances-without-stagger` | ≥ 3 sibling elements entering at once should be staggered. | ≥ 3 siblings (same parent or role) with entrance starts within **16 ms** → warn. Recommended offset **30–80 ms** per item. | Group entrances by parent/role; sort start times; min Δ. | warn | [UX in Motion: offset & delay](https://uxmag.com/articles/creating-usability-with-motion-the-ux-in-motion-manifesto); [motion.dev 50 ms](https://motion.dev/tutorials/js-stagger) |
| 22 | `stagger-too-slow` | Long staggers stall the beat. | Per-item offset > **150 ms** with > 4 items, or total stagger span > **900 ms** → info. | Same grouping as rule 21. | info | [Material: staggers lengthen duration](https://material.io/design/motion/customization.html); [proposed] |
| 23 | `max-concurrent-focal-points` | One thing moves at a time; the eye can only track one lead. | At any t, number of *independently* moving focal elements (not parented to the same moving group, not in one stagger group) > **2** → warn; > 3 → error. | Per frame, set of moving focal elements; merge those sharing a moving ancestor or stagger group. | warn / error | [Lago "one motion at a time"](https://getlago.com/blog/we-killed-our-motion-design-job); [Murch eye-trace](https://nofilmschool.com/2016/11/6-rules-good-cutting-according-oscar-winning-editor-walter-murch) |
| 24 | `motion-direction-consistency` | Within a scene, elements of the same role enter from the same direction; transitions keep the story's direction. | Entrance velocity vectors of same-role elements in one scene differ by > **90°** → info; consecutive push/whip transitions reverse direction without a marker → warn. | Angle of mean velocity during entrance; transition direction from camera delta. | info / warn | [Material shared axis](https://material.io/design/motion/the-motion-system.html); [proposed] |
| 25 | `cut-on-beat` | Cuts and major transitions land on the beat grid; scene changes on bar lines. | Cut offset from nearest beat ≤ **1 frame** (ok), 2 frames (info), > 2 frames (warn). Scene-change cuts not on a bar line or half-bar → info. Applies only if BPM set. | Distance from each cut to `tBeat`; check n mod 4. | warn / info | [Filmdaft beat editing](https://filmdaft.com/how-to-edit-video-clips-to-the-beat-of-music-the-easy-way/); [beat-sync formula](https://www.claudemarket.ai/skills/iart-ai/motion-design-skills/beat-sync-editing) |
| 26 | `cut-cadence` | Avoid cutting on every beat for long; avoid machine-gun shots. | Cuts on ≥ 8 consecutive beats → info "frantic"; shot shorter than **0.5 s** outside a declared montage → warn; median shot length < 1 beat over > 4 s → info. | Shot lengths from cut markers vs beat grid. | info / warn | [beat-sync table](https://www.claudemarket.ai/skills/iart-ai/motion-design-skills/beat-sync-editing); [Sonilo](https://sonilo.com/blog/guides/how-to-make-video-sync-with-music) |
| 27 | `cut-on-motion` | Hard cuts should happen during motion (cut on action) or be a deliberate match. | At a cut, either outgoing last 3 frames or incoming first 3 frames have camera or focal speed > **3% S/s**, or rule 28 match holds → else info "static-to-static cut". | Velocities around cut time. | info | [PremiumBeat: cutting on action](https://www.premiumbeat.com/blog/9-essential-video-editing-cuts) |
| 28 | `eye-trace-continuity` | The viewer's focus point shouldn't jump across the frame at a cut (unless intended). | Distance between dominant focal centroid on last frame before cut and first frame after > **35% of D** → warn; < 10% of D → counts as a match cut. | Dominant focal = largest/most-salient moving focal element (or tagged); compare centroids. | warn | [Murch: eye-trace, 2D plane](https://nofilmschool.com/2016/11/6-rules-good-cutting-according-oscar-winning-editor-walter-murch) |
| 29 | `camera-judder` | Camera pans / large moves of textured content must not strobe. | Without motion blur: camera (or full-frame layer) translation ≤ **W / 7 s** at 24 fps, scale by F/24 (≈ W/2.8 s at 60 fps) → warn above. With ≥ 180° motion blur: allow 4× and whips. Any element displacement > **8% of W per frame** without blur → warn. | Camera transform delta per frame converted to screen-space px; motion-blur flag from render settings. | warn | [RED panning speed](https://www.reddigitalcinema.com/red-101/camera-panning-speed) |
| 30 | `parallax-depth-order` | Parallax layers must move in depth order (near faster than far). | For layers with z/depth tags, screen-space speed must be monotonic in depth during a camera move; violation → warn. | Per camera move, compare per-layer screen velocities to depth. | warn | [UX in Motion: parallax, dimensionality](https://uxmag.com/articles/creating-usability-with-motion-the-ux-in-motion-manifesto) |
| 31 | `flash-safety` | No more than 3 general flashes in any 1 s. | Count opposing changes in mean relative luminance ≥ **10%** over regions ≥ **25% of the frame** (approximation of WCAG's 10° field) within any 1 s window: > 3 flash pairs → error. Also saturated-red flashes. | Per frame mean relative luminance on a coarse grid; detect pairs of opposing transitions where darker state < 0.8. | error | [WCAG 2.3.1](https://www.getstark.co/wcag-explained/operable/seizures-and-physical-reactions/) |
| 32 | `logo-hold` | The final logo lockup must resolve fully and hold. | Fully settled logo visible ≥ **2.0 s** (warn < 1.5 s, error < 1.0 s); total sting ≤ **5 s**. | Element `role:logo` readable span at end of timeline. | warn / error | [autoae sting 3–5 s](https://autoae.online/blog/logo-sting); [lockup 1.5–3 s hold](https://claudskills.com/skills/a19-logo-lockup/SKILL.md) [practitioner] |
| 33 | `end-card-duration` | CTA/URL end card is readable and long enough; meets platform rules. | End card (CTA + URL) readable ≥ **max(3 s, reading time + 1 s)**; ≤ 6 s for social. If target = YouTube end screen: final card **5–20 s** and video ≥ **25 s** (info). | Elements with `role:cta`/`role:url` at the end. | warn / info | [YouTube Help](https://support.google.com/youtube/answer/6388789); [Morphic 3–6 s](https://morphic.com/resources/videos/end-card-animation-videos) |
| 34 | `sound-off-legible` | The film must make sense with sound off: if VO carries information, captions or on-screen text must too. | If VO track exists: ≥ **80%** of VO words covered by captions or matching on-screen text → else warn. | Compare VO transcript timing to caption/text elements. | warn | [85% sound-off claim (old, Facebook)](https://www.wpfastestcache.com/blog/13-facebook-video-statistics-that-matter-for-businesses-and-creators/) |
| 35 | `vo-pacing-and-mix` | VO fits the cut; music sits under it. | VO ≤ **160 wpm** (warn > 170); script words ≤ 2.5 × seconds. Mix: integrated **−14 LUFS ±1**, true peak ≤ **−1 dBTP**, music ≥ **15 dB** under VO while speaking. | From VO transcript markers + audio analysis (ffmpeg `ebur128`). | warn / info | [Bread n Beyond](https://breadnbeyond.com/how-many-words-does-a-60-seconds-explainer-video-needs/); [IRPR](https://sounddesign.irpr.agency/guides/how-to-mix-audio-for-youtube/) |
| 36 | `sfx-sync` | Sound effects land on their visual events. | Click SFX within **±1 frame** of cursor press (scale-down start); whoosh peak within **±2 frames** of transition peak velocity; impact on logo settle. | SFX markers vs event times derived from scene graph (velocity peak, press keyframe). | warn | [J/L-cut practice](https://vimeo.com/blog/post/j-cuts-l-cuts); [proposed] |

Notes on implementation:

- Rules 2, 9, 10 should ignore text whose role is `decorative` (WCAG exempts incidental text and logos — logos should still be checked by rule 32, not 9).
- Many thresholds want **platform presets**: `youtube-16x9`, `reels-9x16`, `tiktok-9x16`, `linkedin-1x1`, `store-promo-16x9` (title-safe vs social-safe, min text size, end-card length).
- Rules 23, 27, 28 depend on a good "focal element" heuristic; let authors tag `focal: true` and fall back to largest moving text/UI.
- Contrast and busy-background checks need a background-only render pass; this is the one rule family that can't be done purely from bboxes.

---

## C. Components and presets a promo tool should ship

(Beyond the already-planned masked text reveal, odometer, badge/chip/card, cursor with click, typing, 3D tilt card, parallax grid, zoom-into-element, lower-thirds, end card.) Specs are defaults; every preset should emit lint-friendly metadata (role, focal, stagger group).

### C1. Kinetic type

| Component | Spec |
|---|---|
| **Word-by-word punch** (Apple "Don't Blink") | One word at a time, 6–8 frames each @30 fps, hard cut or 80 ms scale 1.08→1 snap; restrict to ≤ 2-syllable words; beat-quantised option. |
| **Line slide-up stagger** | Each line masked, translateY 100%→0, 450–600 ms ease-out (e.g. `cubic-bezier(0.23,1,0.32,1)`), 60 ms line stagger. |
| **Per-character cascade** | 20–35 ms per char, opacity + 8–12 px rise, total ≤ 700 ms; headlines ≤ 30 chars only. |
| **Word rotator / swap** | Fixed prefix ("Built for ___"), rotating word via vertical mask, 400 ms out/in, hold ≥ reading time; width animates with spring (bounce ≤ 0.15). |
| **Strike-and-replace** | Strike line draws 250 ms L→R, old word fades to 40%, new word types or slides in. |
| **Text-to-UI morph** ("animating the signified") | Container transform: a word's bbox becomes the UI element (button, chip, card) — shared-element tween of rect, radius, colour, 500–700 ms emphasized easing. |
| **Highlight marker sweep** | Background highlight scaleX 0→1 behind a word, 300 ms ease-out, origin left, 10–20% padding. |
| **Big-number stat** | Counter (odometer) + unit + caption; digits tabular; ends on beat; hold ≥ 1.5 s. |
| **Streaming AI text** | Token-by-token reveal at 30–60 tokens/s with caret; auto-compress long outputs (fast-forward with blur). |

### C2. Product and UI framing

| Component | Spec |
|---|---|
| **Device frames** | Generic laptop, phone, tablet, browser window (address bar, tabs), desktop window (traffic lights), terminal; screen content slot accepts live DOM/scene; shadow + subtle reflection; no brand marks. |
| **UI screenshot pan / scroll-through** | Long screenshot scrolls inside a frame; speed limited by rule 29 (≤ frame-height / 7 s without blur), ease-in-out; optional "zoom to region" keyframes. |
| **Camera rig** | Virtual camera with push-in drift (0.5–1.5% scale/s), dolly, orbit (≤ 15° for UI planes), rack-focus/depth-of-field, all with motion-blur shutter (180° default). |
| **Spotlight / dim** | Darken everything but a target rect (scrim 50–70%, Carbon slow-02 ~700 ms for dims) with soft feathered rounded-rect hole that can travel between targets. |
| **Focus ring / pulse** | Ring draws around element (stroke 2–3 px at 1080), 1–2 soft pulses then settle; never > 3/s (flash rule). |
| **Callout arrow / annotation** | Hand-drawn or geometric arrow with stroke-draw-on 300–450 ms, head pops at end; label anchored with leader line; auto-avoid safe-area edges. |
| **Keycap shortcut** | Rendered keys (⌘ K) press down 2–3 px + shadow change, 80 ms down / 120 ms up, synced with click SFX. Command-palette demo preset (open → type → filter list → select). |
| **Cursor upgrades** | Arc-path movement (slight curve), 400–800 ms per move with ease-in-out, 120–200 ms dwell before click, press scale 0.9, optional click ripple; drag-and-drop and text-selection variants; multiplayer cursors with name tags. |
| **Code editor / terminal** | Syntax-highlighted typing at 15–30 chars/s (faster than human, still readable), line highlight, diff add/remove colouring, terminal output stream. |
| **Before / after slider** | Divider sweeps 0→50%→100% with labels; hold at each end ≥ 1 s. |
| **Split-screen compare** | Two panes, shared axis entry, synchronized actions. |
| **Notification / toast stack** | Toasts slide in from edge with spring (bounce 0.15), stack push-down with 50 ms stagger, auto-dismiss. |
| **Loading → content** | Skeleton shimmer (linear loop allowed) → content fades/slides in staggered. |
| **Chart grow** | Bar grow (scaleY from baseline, 40–60 ms stagger), line draw (stroke-dashoffset), value labels count up. |
| **Feature tile grid / bento** | 4–9 tiles staggered entrance (40–60 ms), each with a micro-loop; camera can push into one tile (container transform). |
| **Logo wall / marquee** | Customer logos marquee at constant (linear) speed within judder limit, or grid fade-in staggered. |
| **Testimonial / quote card** | Quote with reading-time-driven hold, avatar, name, role; lower-third style. |
| **Checklist / feature list** | Check icons draw on (stroke 250 ms) with 120–200 ms stagger, item text slides 8 px. |
| **Pricing / plan reveal** | Card flip or rise; price uses counter. |
| **Changelog / timeline** | Horizontal or vertical timeline, camera travels along it, nodes pop on beat. |

### C3. Logo reveals

| Preset | Spec |
|---|---|
| **Mask wipe** | Logo revealed by linear-gradient mask sweep 500–700 ms ease-in-out, settle hold ≥ 2 s. |
| **Stroke draw → fill** | SVG paths draw 600–900 ms, fill crossfades 200 ms. |
| **Assemble from shapes** | Logo parts fly in from offsets with 40–80 ms stagger, spring bounce ≤ 0.2. |
| **Morph from product icon** | App icon / UI element morphs into logo (shared element). |
| **Light sweep / shine** | Specular band across logo 600 ms after settle; once only. |
| **Wordmark type-on** | Logotype letters cascade; tagline follows after 300 ms. |

### C4. Transitions

| Preset | Spec |
|---|---|
| **Whip pan** | 200–350 ms, strong ease-in-out, mandatory motion blur (≥ 180°, ideally sub-frame samples), optional directional blur; whoosh SFX peak at velocity peak; direction follows story direction. |
| **Push / shared axis** | Outgoing and incoming move together on x/y (or z = scale) 400–600 ms, plus 30% crossfade overlap (Material shared axis). |
| **Container transform / zoom-through** | Element grows to fill frame and becomes next scene (Material), 500–800 ms emphasized easing; the planned "zoom-into-element" is one instance. |
| **Match cut (shape / position)** | Tool aligns a shape in shot A's last frame with a shape in shot B's first frame (centroid within 10% D, similar scale); validated by rule 28. |
| **Mask wipe / shape wipe** | Geometric mask (rect, circle from click point — iris) 400–600 ms. |
| **Fade through** | Out 40% / in 60% of 300–400 ms, for unrelated scenes (Material). |
| **Hard cut on beat** | Default between unrelated beats; quantised to beat grid. |
| **Flash cut / frame flash** | 1–2 white frames; throttled by flash-safety rule (≤ 3/s). |
| **Speed ramp** | Time-remap within a camera move (fast → slow on payoff); "time as a character". |

### C5. Atmosphere and layout helpers

- **Backgrounds**: gradient mesh with slow drift (linear allowed), subtle film grain/noise (prevents banding in H.264), soft spotlight vignette.
- **Glass / blur panels** with consistent backdrop blur; doubles as the text scrim required by rule 10.
- **Caption track**: auto-timed captions from VO transcript using Netflix timing rules (2-frame gaps, snap to cuts, ≤ 42 chars/line, ≤ 20 cps).
- **Safe-zone overlays**: toggleable guides for title/action safe and per-platform 9:16 UI zones (preview only, never rendered).
- **Beat grid**: BPM + offset input, snap-to-beat for keyframes/cuts, bar/phrase markers.
- **Sound kit**: whoosh (3 lengths), UI click, soft pop, riser, impact/sub-hit, chime for logo; auto-placed from scene events (rule 36), plus auto-ducking of music under VO.
- **Aspect-ratio reflow presets**: same scene graph laid out for 16:9, 9:16, 1:1 with per-format safe areas and text sizes.

---

## Open questions / things to verify

1. Calibrate the [proposed] thresholds (min text size on mobile, static-span 1.5 s, focal-point limit 2, entrance 150–900 ms, overshoot 5%) by frame-stepping ~15 reference films (Apple, Linear, Raycast, Arc, Vercel Ship, Figma Config, Stripe Sessions). No first-party making-of material was found for these.
2. Verify on primary pages that could not be fetched: BBC subtitle guidelines (wpm, font size as % of screen height), Material 3 easing values (m3.material.io renders client-side), Apple HIG Motion text, Apple spring preset bounce values.
3. Meta/TikTok publish no stable official 9:16 safe-zone numbers in the results found; keep these as editable presets.
4. "Large text" in WCAG is defined in CSS px for a viewing distance assumption; mapping it to % of video height is a project decision, not a standard.
