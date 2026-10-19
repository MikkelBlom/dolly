import crypto from "node:crypto";
import { Session } from "@dolly/render";
const mode = process.argv[2];
const s = await Session.open({ project: "packages/render/test/fixtures/components", width: 640, height: 360, workers: 1 });
const w = s.workers[0];
if (mode === "geo") await w.evaluate(`document.getElementById('dolly-stage').style.textRendering = 'geometricPrecision'`);
const h = async (t: number) => {
  if (mode === "repaint") await w.evaluate(`(() => { const s = document.getElementById('dolly-stage'); s.style.color = s.style.color ? '' : 'var(--c-fg)'; })()`);
  return crypto.createHash("sha1").update(await w.frame([t])).digest("hex").slice(0, 8);
};
const out = [];
for (const seq of [[5.4], [0.5, 6.4, 5.4], [1.2, 6.4, 5.4], [3.8, 5.4], [0.5, 1.2, 6.4, 5.4]]) { let last = ""; for (const t of seq) last = await h(t); out.push(`${seq.join("→")} ${last}`); }
console.log(mode ?? "default", "|", out.join(" | "));
s.close();
