export const HELP = `dolly: code-driven motion graphics, rendered fast. Agent-first: add --json to any command.

  dolly new <dir> [--title T] [--aspect 16:9] [--duration 15] [--storyboard sb.json]
                                     scaffold a video project (video.ts, theme.ts, scenes/)
  dolly info [project]               scenes, markers, duration, cache hashes
  dolly still [project] --times 1.5,4   PNG frames at those times (--blur for motion blur)
  dolly sheet [project] [--from a --to b] [--cols 4 --rows 3] [--times …] [--blur]
                                     labelled contact sheet PNG (look at this first)
  dolly draft [project]              960×540, 30 fps, no blur: a pacing check in seconds
  dolly render [project] [--preset youtube|youtube-hevc|archive|prores|webm-alpha|web-av1|lossless]
               [--size 1920x1080] [--fps 60] [--from a --to b] [--no-blur] [--shutter 180]
               [--gap 1.5] [--nmax 32] [--workers N] [--no-cache] [--no-audio] [--out file]
  dolly lint [project] [--strict]    motion-grammar checks with timestamps (exit 4 on errors)
  dolly diff [project] [--blur]      determinism check: frames rendered twice in different orders
  dolly bench [project]              frames/s per stage (render, capture, plan, blur, encode)
  dolly dev [project] [--port 5173]  live player: scrubber, markers, loop, slow-mo, overlays
  dolly storyboard check <file>      validate a storyboard JSON; "schema" prints its JSON Schema
  dolly doctor                       check Node, Chromium, ffmpeg and encoders
  dolly mcp                          run the MCP server (stdio)

project defaults to the current directory (it must contain video.ts).
exit codes: 0 ok · 1 usage · 2 project/build · 3 render · 4 lint/storyboard errors · 5 non-deterministic · 6 environment
`;

export const COMMAND_HELP: Record<string, string> = {
  render: `dolly render [project] [options]
  --preset      youtube (default, H.264 NVENC p7 CQ16) · youtube-hevc · archive (x264) · prores (4444+alpha) · webm-alpha · web-av1 · lossless · draft
  --size WxH    output size (default 1080 on the long side, matching the stage's aspect)
  --fps N       output frame rate (default: the video's)
  --from/--to   seconds; render a range
  --no-blur     one sample per frame
  --shutter     shutter angle in degrees (180)
  --gap         allowed px between blur samples before more are taken (1.5)
  --nmax        max samples per frame, power of two (32)
  --workers N   Chromium processes (default 3/4 of cores, max 16)
  --no-cache    re-render every frame
  --json        one JSON object with timings per stage, cache hits and the blur histogram
`,
  sheet: `dolly sheet [project] [--from a --to b] [--cols 4] [--rows 3] [--times t1,t2,…] [--blur] [--cell 480] [--out file.png]
  Frames spread evenly across the range (cell centres), each labelled with time, scene and frame number.
  Prints the PNG path; read it to see the frames.
`,
  lint: `dolly lint [project] [--strict] [--step 0.05]
  Samples the scene graph and checks: text reading time, title-safe area, min text size, WCAG contrast,
  static spans, simultaneous entrances, cuts on beat/motion, hook in 2 s, end-card length,
  CSS animations, will-change. Exit 4 if errors (or warnings with --strict).
`,
};
