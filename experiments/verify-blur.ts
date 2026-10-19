// Compositor-accumulated frame vs. N separate captures averaged in float (sRGB) by ffmpeg.
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { Session, subTimes } from "@dolly/render";
// @ts-ignore
import { decode, stats } from "./imgdiff.mjs";
const T = process.argv.slice(2).map(Number);
const s = await Session.open({ project: "examples/price-peek", workers: 2 });
const dir = "experiments/out/verify"; fs.mkdirSync(dir, { recursive: true });
for (const t of T.length ? T : [6.98, 19.3, 24.8, 16.3]) {
  const ts = subTimes(t * 60, 32, 60, 180);
  const acc = await s.workers[0].frame(ts);
  fs.writeFileSync(`${dir}/acc-${t}.png`, acc);
  for (const [i, x] of ts.entries()) fs.writeFileSync(`${dir}/sub-${i}.png`, await s.workers[1].frame([x]));
  spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "60", "-i", `${dir}/sub-%d.png`, "-vf", "format=gbrpf32le,tmix=frames=32,select='eq(n\,31)',format=rgb24", "-frames:v", "1", `${dir}/ref-${t}.png`]);
  console.log(t, JSON.stringify(stats(decode(`${dir}/acc-${t}.png`), decode(`${dir}/ref-${t}.png`))));
}
s.close();
