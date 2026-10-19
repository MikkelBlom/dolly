import { Session } from "@dolly/render";
const s = await Session.open({ project: "examples/price-peek", workers: 1 });
const w = s.workers[0];
for (const t of [11.25, 18.75, 0, 18.75]) {
  await w.evaluate(`__dolly.render(${t})`);
  console.log(t, JSON.stringify(await w.evaluate(`[...document.querySelectorAll('.dolly-c')].map(c => c.dataset.scene + '/' + c.dataset.layer + ':' + (c.style.visibility||'-') + ':' + getComputedStyle(c).visibility)`)));
  console.log(JSON.stringify(await w.evaluate(`[...document.querySelectorAll('.pp-item')].map(e => getComputedStyle(e).visibility + '/' + e.style.visibility + '/' + e.style.opacity)`)));
}
s.close();
