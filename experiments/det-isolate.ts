import crypto from "node:crypto";
import { Session } from "@dolly/render";
const s = await Session.open({ project: "packages/render/test/fixtures/components", width: 640, height: 360, workers: 1 });
const w = s.workers[0];
const h = async (t: number) => crypto.createHash("sha1").update(await w.frame([t])).digest("hex").slice(0, 8);
const target = 5.4;
const fresh = await h(target);
const out: Record<string, string> = { fresh };
for (const prior of [0.5, 2.3, 3.85, 5.0, 5.2, 6.0, 6.3, 6.6, 7.0, 7.6, 5.4]) { await h(prior); out[`after ${prior}`] = await h(target); }
console.log(JSON.stringify(out, null, 1));
s.close();
