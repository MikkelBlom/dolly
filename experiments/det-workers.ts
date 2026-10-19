import crypto from "node:crypto";
import { Session } from "@dolly/render";
const s = await Session.open({ project: process.argv[2] ?? "packages/render/test/fixtures/components", width: 640, height: 360, workers: 4 });
for (const t of (process.argv[3] ?? "5.4,0.5,7.6").split(",").map(Number)) {
  const hs = [];
  for (const w of s.workers) hs.push(crypto.createHash("sha1").update(await w.frame([t])).digest("hex").slice(0, 8));
  console.log(t, hs.join(" "));
}
s.close();
