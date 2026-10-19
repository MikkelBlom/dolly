# Rendering

## Commands

| Command | What | Typical time (30 s video, reference laptop) |
|---|---|---|
| `dolly sheet <dir>` | 4×3 labelled contact sheet PNG | ~5 s |
| `dolly still <dir> --times a,b` | PNG frames (`--blur` for motion blur) | ~4 s |
| `dolly draft <dir>` | 960×540, 30 fps, no blur, NVENC p1 → `out/draft.mp4` | ~11 s |
| `dolly render <dir>` | 1080p60, adaptive blur, `youtube` preset → `out/<name>.mp4` | ~50 s; re-renders only changed scenes |
| `dolly render <dir> --from 6 --to 8` | a range (check a transition) | seconds |
| `dolly lint <dir>` | motion-grammar findings | ~10 s |
| `dolly diff <dir>` | determinism check | ~10 s |
| `dolly bench <dir>` | frames/s per stage | ~30 s |

Most of a short command's time is starting Chromium; keep checks batched (one sheet rather than many stills).

## Presets (`--preset`)

- `youtube` (default): H.264 NVENC p7 hq, CQ 16, closed GOP of half the frame rate, 2 B-frames, BT.709, AAC 384k, faststart. Matches YouTube's upload recommendations; high bitrate so YouTube's re-encode has a clean source.
- `youtube-hevc`: HEVC Main10, NVENC uhq. Smaller files.
- `archive`: x264 slow CRF 14 (CPU).
- `prores`: ProRes 4444 with alpha (`.mov`) for editors. `webm-alpha`: VP9 with alpha for browsers. Give the stage a transparent background for alpha.
- `web-av1`: AV1 for self-hosted embeds. `lossless`: FFV1 intermediate. `draft`: fast and small.

Without an NVIDIA GPU use `--preset archive`.

## Motion blur

- 180° shutter by default (`--shutter`), centred on the frame.
- Per frame, dolly measures the largest on-screen motion during the shutter (camera + every visible element) and takes N = next power of two of motion/1.5 px samples (1 when calm, up to 32; `--gap`, `--nmax`), using the max over ±2 frames so quality doesn't pump.
- The N sub-frames are scene copies blended by Chromium's compositor in a binary tree and captured as one image (19× faster than separate captures; within ~1 level of a float average).
- Frames that need more than 32 samples and where the camera causes the motion get a smear along the camera direction on the world layer only (headlines and the brand mark stay sharp).
- `--no-blur` renders one sample per frame.

## Cache

Each frame is cached under `<project>/.dolly/cache` keyed by everything that can change its pixels: the shared code/theme/assets hash, the hashes of the scenes active during its shutter, its sample times and the output size. Editing `scenes/end.ts` re-renders only the end scene's frames. `--no-cache` forces everything.

## Audio

`defineVideo({ audio: [{ src: "audio/music.mp3", start: 0, role: "music" }, { src: "audio/vo.wav", start: 0.4, role: "vo" }] })`. On render, tracks are placed at their start times, music is side-chain ducked under VO, and the mix is normalised to −14 LUFS / −1 dBTP (two-pass loudnorm). In the player, drop audio files on the page, drag clips to align (they snap to markers/beats), and the placement is copied as an `audio:` snippet. `--no-audio` skips the mux.

## Aspect ratios

Author per-aspect overrides in `variants: { "9:16": { stage: { width: 720, height: 1280 }, scenes: [...], camera } }`; render with `--aspect 9:16`; the player switches with the aspect menu.
