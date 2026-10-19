import { Session, determinism } from "@dolly/render";
const s = await Session.open({ project: "packages/render/test/fixtures/components", width: 640, height: 360, workers: 2 });
const times = [0.3, 0.5, 0.8, 1.2, 1.7, 2.4, 3.8, 5.4, 6.4];
const plain = await determinism(s, { times, blur: false, outDir: "experiments/out/det" });
console.log("no blur:", plain.ok, JSON.stringify(plain.mismatches.map(m => [m.t, m.meanAbs, m.changedPct, m.strongPct, m.kind])));
const blur = await determinism(s, { times, blur: true, outDir: "experiments/out/det" });
console.log("blur:", blur.ok, JSON.stringify(blur.mismatches.map(m => [m.t, m.samples, m.meanAbs, m.changedPct, m.strongPct, m.kind])));
s.close();
