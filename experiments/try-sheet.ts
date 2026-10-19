import { Session, sheet } from "@dolly/render";
const s = await Session.open({ project: "examples/price-peek", workers: 4 });
try {
  const r = await sheet(s, { cols: 4, rows: 3, out: "experiments/out/pp-sheet.png", blur: false });
  console.log(JSON.stringify({ path: r.path, timings: s.timings, size: [s.width, s.height] }));
} finally { s.close(); }
