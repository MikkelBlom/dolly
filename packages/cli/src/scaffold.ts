// `dolly new`: a project that renders immediately and already follows the motion grammar (one world, a
// camera that whips between regions, masked headlines, a push-in on every hold, an end card). With a
// storyboard, one scene file per storyboard scene, laid out left to right in the world.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateStoryboard, type Storyboard } from "@dolly/core";

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../core/src/index.ts");

export interface ScaffoldOptions { title: string; aspect: "16:9" | "9:16" | "1:1" | "4:5"; duration: number; storyboard?: string; force?: boolean }

const STAGES = { "16:9": [1280, 720], "9:16": [720, 1280], "1:1": [1080, 1080], "4:5": [1080, 1350] } as const;

export function scaffold(dir: string, o: ScaffoldOptions): { dir: string; files: string[] } {
  if (fs.existsSync(path.join(dir, "video.ts")) && !o.force) throw new Error(`${dir} already has a video.ts (use --force to overwrite)`);
  let sb: Storyboard;
  if (o.storyboard) {
    sb = JSON.parse(fs.readFileSync(o.storyboard, "utf8"));
    const v = validateStoryboard(sb);
    if (!v.ok) throw new Error(`storyboard has errors:\n${v.problems.filter(p => p.severity === "error").map(p => `  ${p.path}: ${p.message}`).join("\n")}`);
  } else {
    const d = o.duration;
    sb = {
      title: o.title, aspect: o.aspect, fps: 60, bpm: 120,
      scenes: [
        { name: "hook", duration: 3, idea: "The problem, as a question", text: ["Still doing it |by hand?|"], transition: "pull-back" },
        { name: "product", duration: Math.max(4, d - 7.5), idea: "The product does it for you", text: ["Meet |Product.|"], transition: "whip" },
        { name: "end", duration: 4.5, idea: "Name and promise", text: ["Product", "Do it once. Never again."], transition: "zoom-into" },
      ],
    };
  }
  const aspect = sb.aspect ?? o.aspect;
  const [W, H] = STAGES[aspect];
  const files: string[] = [];
  const write = (rel: string, body: string) => {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body.replace(/^\n/, ""));
    files.push(rel);
  };
  const timeline = validateStoryboard(sb).timeline;
  const total = +timeline[timeline.length - 1].end.toFixed(3);
  const last = sb.scenes.length - 1;

  write("storyboard.json", JSON.stringify({ $schema: "storyboard.schema.json", ...sb }, null, 2) + "\n");
  write("theme.ts", `
import { defineTheme } from "@dolly/core";

// Brand tokens: swap these for the product's colours and fonts. Self-host font files under fonts/ and
// list them in fontFaces so renders never touch the network.
export const theme = defineTheme({
  name: ${JSON.stringify(sb.title)},
  colors: { bg: "#eef1f6", fg: "#14161b", accent: "#3355ff", "accent-soft": "#8ea0ff", muted: "#8a90a0", surface: "#ffffff", ink: "#14161b", line: "#dfe2e8" },
  fonts: { display: '"Segoe UI", system-ui, sans-serif', body: '"Segoe UI", system-ui, sans-serif', ui: '"Segoe UI", system-ui, sans-serif' },
  fontFaces: [],
  radii: { sm: 8, md: 14, lg: 22 },
  shadows: {
    card: "0 24px 48px -28px rgba(20,24,40,.35), 0 0 0 1px rgba(20,24,40,.05)",
    float: "0 50px 90px -40px rgba(20,24,40,.5), 0 0 0 1px rgba(20,24,40,.06)",
  },
});
`);
  // regions: each content scene gets a region of the world, left to right; the camera whips between them
  const regionX = (i: number) => W / 2 + i * W * 1.6;
  const wide = aspect === "16:9";
  // hero card and its badge, in world coordinates relative to a region's left edge
  const card = { x: Math.round(W * (wide ? 0.56 : 0.33)), y: Math.round(H * (wide ? 0.27 : 0.5)), w: Math.round(W * 0.34), h: Math.round(H * 0.42) };
  const badgeCentre = (i: number) => [regionX(i) - W / 2 + card.x + 24 + 28, card.y - 14 + 16];
  const hasEnd = sb.scenes.length > 1;
  const endStart = hasEnd ? timeline[last].start : total;
  const camKeys: string[] = [];
  timeline.forEach((sc, i) => {
    if (hasEnd && i === last) return;
    const x = regionX(i);
    // open on a close-up of the hero card, then pull back to reveal the headline beside it
    if (i === 0) camKeys.push(`.at(0, { x: ${x - W / 2 + card.x + card.w / 2}, y: ${card.y + card.h / 2}, zoom: 1.8 }).pullBack(0.3, 1.6, { x: ${x}, y: ${H / 2}, zoom: 1 })`);
    else camKeys.push(`.whip(${(sc.start - 0.3).toFixed(2)}, ${(sc.start + 0.3).toFixed(2)}, { x: ${x} })`);
    const nextMove = hasEnd && i === last - 1 ? endStart - 0.9 : (timeline[i + 1]?.start ?? sc.end) - 0.3;
    camKeys.push(`.push(${(i === 0 ? 1.6 : sc.start + 0.3).toFixed(2)}, ${nextMove.toFixed(2)}, 0.05)`);
    // the last content scene ends by diving into its dark badge until the fill is the end card's background
    if (hasEnd && i === last - 1) { const [bx, by] = badgeCentre(i); camKeys.push(`.zoomInto(${(endStart - 0.9).toFixed(2)}, ${endStart.toFixed(2)}, [${bx}, ${by}], 40)`); }
  });
  const imports = sb.scenes.map((s, i) => `import ${ident(s.name)} from "./scenes/${s.name}.ts";`).join("\n");
  write("video.ts", `
// ${sb.title}. Edit scenes/*.ts; keep render(t) pure (every value from t alone).
// Review loop: dolly sheet . → dolly lint . → dolly draft . → dolly render .
import { cameraPath, defineVideo, parallaxGrid } from "@dolly/core";
import { theme } from "./theme.ts";
${imports}

const stage = { width: ${W}, height: ${H} };
// one world, filmed by a camera that moves between scene regions
const camera = cameraPath(stage)
  ${camKeys.join("\n  ")}
  .build();

let grid: ReturnType<typeof parallaxGrid>;

export default defineVideo({
  title: ${JSON.stringify(sb.title)},
  stage, fps: ${sb.fps ?? 60}, duration: ${total}, bpm: ${sb.bpm ?? 120}, aspect: ${JSON.stringify(aspect)},
  theme, camera,
  world: {
    setup(ctx) { grid = parallaxGrid(ctx.screen(0, "background"), { depth: 0.5 }); },
    render({ t }, ctx) { grid(ctx.camera(t), stage); },
  },
  scenes: [${sb.scenes.map(s => ident(s.name)).join(", ")}],
});
`);
  sb.scenes.forEach((s, i) => {
    const tl = timeline[i];
    const isEnd = i === last && sb.scenes.length > 1;
    const text = s.text ?? [];
    if (isEnd) {
      write(`scenes/${s.name}.ts`, `
// ${s.idea}
import { defineScene, endCard } from "@dolly/core";

let card: ReturnType<typeof endCard>;

export default defineScene({
  name: ${JSON.stringify(s.name)},
  start: ${(tl.start - 0.02).toFixed(2)},
  end: ${tl.end},
  setup(ctx) {
    card = endCard(ctx.screen(60, "end"), {
      logo: ${JSON.stringify((text[0] ?? sb.title).slice(0, 2))}, name: ${JSON.stringify(text[0] ?? sb.title)}, tagline: ${JSON.stringify(text[1] ?? s.idea)},
      at: { logo: ${(tl.start + 0.2).toFixed(2)}, name: ${(tl.start + 0.5).toFixed(2)}, tag: ${(tl.start + 1.0).toFixed(2)} }, pushFrom: ${tl.start}, pushDur: ${(tl.end - tl.start).toFixed(2)},
    });
  },
  render({ t }) { card.render(t); },
});
`);
      return;
    }
    const x = regionX(i) - W / 2;
    write(`scenes/${s.name}.ts`, `
// ${s.idea}${s.vo ? `\n// VO: ${s.vo}` : ""}${s.visual ? `\n// Visual: ${s.visual}` : ""}
import { defineScene, ensureStyle, flyIn, masked, popIn, badge, typeIn, bob, clamp } from "@dolly/core";

const X = ${x}; // this scene's region in the world
// headline enters once the camera has arrived and leaves before the next move
const HEAD_IN = ${(i === 0 ? 1.7 : tl.start + 0.45).toFixed(2)}, HEAD_OUT = ${(hasEnd && i === last - 1 ? endStart - 1.3 : (timeline[i + 1]?.start ?? tl.end) - 0.6).toFixed(2)};
const CARD_IN = ${(i === 0 ? 0.05 : tl.start + 0.35).toFixed(2)};
let head: HTMLElement[], card: HTMLElement, chip: HTMLElement;

export default defineScene({
  name: ${JSON.stringify(s.name)},
  start: ${Math.max(0, tl.start - 0.35).toFixed(2)},
  end: ${(hasEnd && i === last - 1 ? endStart + 0.05 : i + 1 < timeline.length ? timeline[i + 1].start + 0.35 : tl.end).toFixed(2)},
  setup(ctx) {
    ensureStyle("scene-${s.name}", \`
.${s.name}-h{position:absolute;margin:0;font:800 ${aspect === "16:9" ? 72 : 84}px/1 var(--f-display);letter-spacing:-.035em;color:var(--c-fg)}
.${s.name}-card{position:absolute;width:${card.w}px;height:${card.h}px;background:var(--c-surface);border-radius:var(--r-lg);box-shadow:var(--s-float)}\`);
    const h = document.createElement("h2");
    h.className = "${s.name}-h";
    h.style.cssText = \`left:\${X + ${Math.round(W * 0.07)}}px;top:${Math.round(H * (aspect === "16:9" ? 0.3 : 0.18))}px;width:${Math.round(W * (aspect === "16:9" ? 0.42 : 0.8))}px\`;
    ctx.world.append(h);
    head = masked(h, ${JSON.stringify(text[0] ?? s.idea)});
    card = document.createElement("div");
    card.className = "${s.name}-card";
    card.style.cssText = \`left:\${X + ${Math.round(W * (aspect === "16:9" ? 0.56 : 0.33))}}px;top:${Math.round(H * (aspect === "16:9" ? 0.27 : 0.5))}px\`;
    chip = badge("New");
    chip.style.cssText = "left:24px;top:-14px";
    card.append(chip);
    ctx.world.append(card);
  },
  render({ t }) {
    typeIn(head, t, HEAD_IN, HEAD_OUT, { stagger: 0.07 });
    flyIn(card, t, CARD_IN, { dx: 260, dy: 80, extra: \`translateY(\${bob(t, ${i}) * clamp(t - CARD_IN - 1.2)}px)\` });
    popIn(chip, t, CARD_IN + 0.8);
  },
});
`);
  });
  write("README.md", `
# ${sb.title}

A [dolly](https://github.com/MikkelBlom/dolly) video. Storyboard: \`storyboard.json\`; scenes: \`scenes/\`.

\`\`\`bash
dolly sheet .      # contact sheet PNG of the whole video
dolly lint .       # motion-grammar checks
dolly draft .      # 960×540 pacing draft in seconds
dolly render .     # final 1080p60 with adaptive motion blur
dolly dev .        # live player
\`\`\`
`);
  write("tsconfig.json", JSON.stringify({
    compilerOptions: { target: "es2023", module: "nodenext", moduleResolution: "nodenext", lib: ["es2023", "dom"], strict: true, noEmit: true, allowImportingTsExtensions: true, skipLibCheck: true, paths: { "@dolly/core": [CORE.replace(/\\/g, "/")] } },
    include: ["**/*.ts"],
  }, null, 2) + "\n");
  write(".gitignore", ".dolly/\nout/\n");
  return { dir, files };
}

const ident = (name: string) => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()) + "Scene";
