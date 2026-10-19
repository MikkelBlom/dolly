---
name: review
description: Review pass on a dolly video - contact sheets, blur check on fast moves, lint, determinism - and fix what is wrong.
argument-hint: "[project dir, default: the one with video.ts]"
disable-model-invocation: true
---

# Review pass

Project: $ARGUMENTS (if empty, find the directory containing `video.ts`).

Use the `dolly` skill. Then, without asking between steps:

1. `dolly info <dir> --json` for scenes and markers.
2. `dolly sheet <dir> --cols 5 --rows 4 --json` and read it. For each scene, check: hook within 2 s, one idea per scene, headline readable and inside the safe area, nothing clipped or overlapping, no empty or static holds, the camera has arrived before text enters, the end card holds 3–6 s.
3. For every cut marker and every fast camera move: `dolly sheet <dir> --from <t-0.3> --to <t+0.3> --cols 6 --rows 1 --blur --json` and check the blur is smooth (no stepped copies) and nothing pops.
4. `dolly lint <dir> --json`: fix every error; fix warnings unless they are a deliberate choice (say which and why).
5. `dolly diff <dir> --json`: any mismatch is a bug in a scene's render (state carried between frames, will-change, an animated property only set in one branch).
6. Fix issues in the scene files (fix the rule's cause, not the one frame), re-run the sheet, and report: what you changed, what you judged acceptable, and what needs the user's eye (with sheet paths).
