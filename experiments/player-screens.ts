// Reproducible player screenshots for the docs: drives the running `dolly dev` server through
// window.player and captures PNGs with headless Chromium.
import fs from "node:fs";
import { launch, screenshot } from "@dolly/render";
const base = process.argv[2] ?? "http://127.0.0.1:5199/";
const b = await launch({ width: 1600, height: 960 });
const p = await b.newPage();
await p.send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 960, deviceScaleFactor: 1, mobile: false });
await p.send("Page.enable");
const shot = async (name: string, url: string, script: string, wait = 1500) => {
  await p.send("Page.navigate", { url: base + url });
  for (let i = 0; i < 300; i++) { await new Promise(r => setTimeout(r, 50)); if (await p.evaluate<boolean>("!!(window.player && player.state().duration)").catch(() => false)) break; }
  // the velocity lane is measured in the background; wait for it so every screenshot shows it
  for (let i = 0; i < 400; i++) { if (await p.evaluate<boolean>("player.state().heatReady")) break; await new Promise(r => setTimeout(r, 50)); }
  await p.evaluate(script);
  await new Promise(r => setTimeout(r, wait));
  fs.writeFileSync(`docs/img/${name}.png`, await screenshot(p));
  console.log(name);
};
await shot("player-overview", "?t=16.25&ov=safe,bounds&loop=12.9-19.8&rate=0.5", "player.seek(16.25)");
await shot("player-whip-velocity", "?t=6.98&ov=heat,camera,grid&rate=0.25", "player.seek(6.98)");
await shot("player-motion-paths", "?t=2.2&ov=paths,safe", "player.seek(2.2)", 2500);
await shot("player-audio", "?t=3.5&snap=1", "player.addAudio('/project/.dolly/click-120bpm.wav', 0, 'music').then(() => player.seek(3.5))", 2500);
await shot("player-playing-loop", "?t=13.6&loop=12.9-19.8&rate=0.5", "player.play()", 1200);
b.close();
process.exit(0);
