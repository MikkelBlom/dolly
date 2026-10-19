---
name: final-render
description: Final render of an approved dolly video - lint gate, determinism check, render with adaptive motion blur, verification sheet.
argument-hint: "[project dir] [preset: youtube|youtube-hevc|archive|prores|webm-alpha]"
disable-model-invocation: true
---

# Final render

Arguments: $ARGUMENTS (project dir, optional preset; default preset `youtube`).

Use the `dolly` skill. Then:

1. `dolly lint <dir> --json`: stop and report if there are errors.
2. `dolly diff <dir> --blur --json`: stop and report if frames differ.
3. Run `dolly render <dir> --preset <preset> --json` in the background (it prints one JSON object when done: output path, timings, cache hits, blur histogram).
4. Verify the output: `ffprobe` duration, resolution and frame rate; then extract a contact sheet from the actual file around the fastest moves (e.g. `ffmpeg -ss <t> -i out.mp4 -frames:v 1 check.png` for 3–4 times) and look at them.
5. Report the file path, size, render time and anything that needs the user's eye. Do not upload or publish it.
