// Masked type: each word (or character) rises out of its own clip box. "|word|" marks an accent span.
import { ensureStyle, escapeHtml } from "../dom.ts";
import { expoOut, quartInOut, type Easing } from "../easing.ts";
import { prog } from "../math.ts";

const CSS = `
.dolly-wm{display:inline-block;overflow:hidden;vertical-align:top;padding:0 .02em .14em;margin:0 -.02em -.14em}
.dolly-wi{display:inline-block}
.dolly-accent{color:var(--c-accent)}`;

export interface MaskedOptions {
  /** Split into characters instead of words (prices, names). */
  chars?: boolean;
  /** Class for |accented| parts. */
  accentClass?: string;
  /** Insert at the start of the element (keeps existing children such as a badge after the text). */
  prepend?: boolean;
}

/**
 * Fill `el` with masked units and return them (the spans that move). "|word|" is an accent; "\n" is a
 * line break. Plain text only: HTML in the text throws (it would be escaped and shown literally).
 */
export function masked(el: HTMLElement, text: string, opts: MaskedOptions = {}): HTMLElement[] {
  ensureStyle("masked", CSS);
  if (/<\/?[a-z]/i.test(text)) throw new Error(`masked(): text contains HTML (${JSON.stringify(text.slice(0, 40))}); use \\n for a line break and |…| for the accent`);
  const unitsHtml = (line: string): string => {
    let out = "";
    for (const part of line.split(/(\|[^|]*\|)/).filter(Boolean)) {
      const accent = part.startsWith("|") && part.endsWith("|") && part.length > 1;
      const s = accent ? part.slice(1, -1) : part;
      for (const u of opts.chars ? [...s] : s.split(/(\s+)/)) {
        if (u === "") continue;
        if (!opts.chars && /^\s+$/.test(u)) { out += " "; continue; }
        const cls = accent ? ` ${opts.accentClass ?? "dolly-accent"}` : "";
        out += `<span class="dolly-wm"><span class="dolly-wi${cls}">${u === " " ? "&nbsp;" : escapeHtml(u)}</span></span>`;
      }
    }
    return out;
  };
  el.insertAdjacentHTML(opts.prepend === false ? "beforeend" : "afterbegin", text.split("\n").map(unitsHtml).join("<br>"));
  return [...el.querySelectorAll<HTMLElement>(".dolly-wi")];
}

export interface TypeInOptions {
  /** Seconds between units. Words 0.05–0.08, characters 0.03–0.045. */
  stagger?: number;
  /** Entrance duration per unit. */
  dur?: number;
  /** Exit duration per unit (exits are shorter than entrances). */
  exitDur?: number;
  /** Travel as a % of the unit's height. 140 so no sliver peeks under the mask. */
  rise?: number;
  /** Degrees of tilt while rising. */
  rotate?: number;
  ease?: Easing;
  exitEase?: Easing;
}

/** Rise units in from below at `tin`, and out upwards at `tout`. */
export function typeIn(units: HTMLElement[], t: number, tin: number, tout = Infinity, o: TypeInOptions = {}): void {
  const stagger = o.stagger ?? 0.05, dur = o.dur ?? 0.75, exitDur = o.exitDur ?? 0.5, rise = o.rise ?? 140, rot = o.rotate ?? 6;
  const ein = o.ease ?? expoOut, eout = o.exitEase ?? quartInOut;
  units.forEach((u, i) => {
    const pin = ein(prog(t, tin + i * stagger, dur));
    const pout = eout(prog(t, tout + i * stagger * 0.6, exitDur));
    u.style.transform = `translateY(${(1 - pin) * rise - pout * rise}%) rotate(${(1 - pin) * rot}deg)`;
  });
}

/** Time when the last unit has finished entering. Lint's reading-time rule starts counting here. */
export const typeInDone = (n: number, tin: number, o: TypeInOptions = {}): number => tin + (n - 1) * (o.stagger ?? 0.05) + (o.dur ?? 0.75) * 0.6;
