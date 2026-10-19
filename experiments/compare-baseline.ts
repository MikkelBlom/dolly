// Port vs original page, same t, 1920×1080, no blur: per-pixel stats and side-by-side images.
import fs from "node:fs";
import { Session, stills } from "@dolly/render";
// @ts-ignore experiments are plain JS
import { launch, openPage, BASELINE } from "./cdp.mjs";
// @ts-ignore
import { decode, stats } from "./imgdiff.mjs";
import { spawnSync } from "node:child_process";
const times = process.argv.slice(2).map(Number);
const T = times.length ? times : [0.5, 1.25, 2.0, 3.75, 6.25, 7.0, 8.75, 11.25, 13.75, 15.5, 16.25, 18.75, 19.4, 21.25, 23.75, 24.8, 26.25, 28.75];
const dir = "experiments/out/compare"; fs.mkdirSync(dir, { recursive: true });
const s = await Session.open({ project: "examples/price-peek", workers: 4 });
const port = await stills(s, { times: T, outDir: dir, prefix: "port" });
s.close();
const b = await launch({ browser: "shell", flags: ["--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
await openPage(b, BASELINE);
const rows = [];
for (const [i, t] of T.entries()) {
  await b.evaluate(`render(${t})`);
  const f = `${dir}/base-${t.toFixed(2).replace(".", "_")}.png`;
  fs.writeFileSync(f, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  const st = stats(decode(port[i].path), decode(f));
  rows.push({ t, ...st });
  spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", f, "-i", port[i].path, "-filter_complex", "[0]scale=960:-1[a];[1]scale=960:-1[b];[a][b]hstack", `${dir}/side-${t.toFixed(2).replace(".", "_")}.png`]);
}
b.close();
console.table(rows);
process.exit(0);
