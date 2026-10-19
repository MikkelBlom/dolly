// Render the whip-pan range only and pull one frame, for blur inspection.
import { render } from "@dolly/render";
const r = await render({ project: "examples/price-peek", from: 6.5, to: 7.5, out: "experiments/out/pp-whip.mp4", preset: "youtube", ...(process.argv[2] === "nosmear" ? { blur: { gap: 1.5, nmax: 32 } } : {}) });
console.log(JSON.stringify({ wall: r.wallMs, blur: r.blur, cache: r.cache }));
