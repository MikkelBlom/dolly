import { render } from "@dolly/render";
const mode = process.argv[2] ?? "draft";
const r = await render(mode === "draft"
  ? { project: "examples/price-peek", width: 960, height: 540, fps: 30, blur: false, preset: "draft", out: "experiments/out/pp-draft.mp4", cache: false }
  : { project: "examples/price-peek", preset: "youtube", out: "experiments/out/pp-final.mp4", cache: process.argv[3] !== "nocache" });
console.log(JSON.stringify(r, null, 1));
