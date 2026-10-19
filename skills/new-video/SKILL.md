---
name: new-video
description: Start a new dolly promo video from a brief - storyboard, scaffold, first contact sheet.
argument-hint: "<one-paragraph brief>"
disable-model-invocation: true
---

# New video from a brief

Brief: $ARGUMENTS

Use the `dolly` skill (load it first if it isn't loaded). Then:

1. Read the product (README, UI code, store/marketing images) for real copy, numbers, colours and fonts. If there is no product in this directory, work from the brief alone and say so.
2. Write `video/storyboard.json` (see the skill's `references/storyboard.md`): 4–6 scenes, one idea each, headlines ≤ 9 words, a hook ≤ 3 s, an end card 3–6 s, transitions planned as camera moves. Run `dolly storyboard check video/storyboard.json --json` and fix every error.
3. Show the user the storyboard as a short table (scene, seconds, idea, on-screen text, transition) and continue unless the brief was too loose to commit to.
4. `dolly new video --storyboard video/storyboard.json --json`, then put the brand into `video/theme.ts` and replace each scene's placeholder card with the real hero element built in HTML/CSS.
5. `dolly sheet video --json` → read the PNG; fix what looks wrong; `dolly lint video --json` → fix errors.
6. `dolly draft video --json` and report the draft path, the sheet path and the open questions. Do not run the final render until the user approves the draft.
