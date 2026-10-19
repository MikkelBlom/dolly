import { Session } from "@dolly/render";
// @ts-ignore
import { launch, openPage, BASELINE } from "./cdp.mjs";
const q = `(() => { const e = document.querySelector('.p .dolly-wi, .p .wi'); const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return [e.textContent, c.fontFamily, c.fontWeight, c.fontVariantNumeric, c.letterSpacing, c.fontSize, r.width.toFixed(2), c.fontFeatureSettings, c.fontOpticalSizing, c.fontStretch]; })()`;
const s = await Session.open({ project: "examples/price-peek", workers: 1 });
await s.workers[0].evaluate("__dolly.render(1.25)");
console.log("port", JSON.stringify(await s.workers[0].evaluate(q)));
s.close();
const b = await launch({ browser: "shell" }); await openPage(b, BASELINE); await b.evaluate("render(1.25)");
console.log("base", JSON.stringify(await b.evaluate(q)));
b.close(); process.exit(0);
