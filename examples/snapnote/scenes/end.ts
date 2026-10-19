// End card: name and promise. The camera dives into the note card's green logo tile; its fill becomes this card.
import { defineScene, endCard } from "@dolly/core";
import { T } from "../beats.ts";

let card: ReturnType<typeof endCard>;

export default defineScene({
  name: "end",
  start: T.zoom[1],
  end: 15,
  setup(ctx) {
    card = endCard(ctx.screen(60, "end"), {
      logo: "S", name: "Snapnote", tagline: "Notes in |one keystroke|",
      at: { logo: 11.0, name: 11.3, tag: 11.8 }, pushFrom: 10.8, pushDur: 4.2,
    });
    // the stock tagline grey is 2.7:1 on the brand green; use a light warm tint (set once, never animated)
    const tag = card.el.querySelector("p.tag") as HTMLElement | null;
    if (tag) tag.style.color = "#eef3ea";
  },
  render({ t }) { card.render(t); },
});
