import { defineScene, lowerThird, endCard, zoomInto, tf, badge, clamp, prog } from "@dolly/core";
let lt: ReturnType<typeof lowerThird>, card: ReturnType<typeof endCard>, layer: HTMLElement, target: HTMLElement;
export default defineScene({
  name: "frames", start: 5, end: 8,
  setup(ctx) {
    lt = lowerThird(ctx.screen(25), { title: "Mikkel Blom", subtitle: "Maker of Price Peek", x: 60, y: 250 });
    layer = document.createElement("div"); layer.style.cssText = "position:absolute;left:0;top:0;width:640px;height:360px";
    target = badge("€241"); target.style.cssText = "left:300px;top:160px;font-size:22px";
    layer.append(target); ctx.screen(40).append(layer);
    card = endCard(ctx.screen(60), { logo: "kr.", name: "Price Peek", tagline: "Any price, in |your| currency.", at: { logo: 6.9, name: 7.1, tag: 7.4 }, pushFrom: 6.85, pushDur: 1.15 });
  },
  render({ t }) {
    lt(t, 5.05, 6.2);
    const z = zoomInto(layer, target, t, 6.2, 6.85, { maxScale: 40, stage: { width: 640, height: 360 } });
    layer.style.transformOrigin = z.origin || "320px 180px";
    tf(layer, z.css || "none", t < 6.85 ? 1 : 0);
    card.el.style.visibility = t >= 6.84 ? "" : "hidden";
    if (t >= 6.84) card.render(t);
    void clamp; void prog;
  },
});
