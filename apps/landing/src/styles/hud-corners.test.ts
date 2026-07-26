import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.css"), "utf8");

/** The bodies of every `@media (<query>)` block, concatenated. */
function mediaBlocks(query: string): string {
  const opener = `@media (${query}) {`;
  const blocks: string[] = [];
  for (let from = css.indexOf(opener); from !== -1; from = css.indexOf(opener, from + 1)) {
    let depth = 0;
    for (let i = from; i < css.length; i++) {
      if (css[i] === "{") depth++;
      if (css[i] === "}" && --depth === 0) {
        blocks.push(css.slice(from + opener.length, i));
        break;
      }
    }
  }
  if (blocks.length === 0) throw new Error(`no @media (${query}) block`);
  return blocks.join("\n");
}

/**
 * Declarations of the one rule in `block` whose selector list mentions every
 * given selector. Anchoring on the selector rather than on a whitespace-exact
 * regex of the whole rule keeps these assertions about the contract instead of
 * about how the declarations happen to be formatted.
 */
function ruleFor(block: string, ...selectors: string[]): string {
  let depth = 0;
  let start = 0;
  let open = -1;
  for (let i = 0; i < block.length; i++) {
    if (block[i] === "{") {
      if (depth === 0) open = i;
      depth++;
    } else if (block[i] === "}" && --depth === 0) {
      const selector = block.slice(start, open);
      if (selectors.every((wanted) => selector.includes(wanted))) {
        return block.slice(open + 1, i);
      }
      start = i + 1;
    }
  }
  throw new Error(`no rule matching ${selectors.join(" + ")}`);
}

describe("landing HUD corners on narrow viewports", () => {
  const narrow = mediaBlocks("max-width: 920px");

  it("clears the top corners while a heading occupies the HUD band", () => {
    const hidden = ruleFor(
      narrow,
      'html:not([data-osd-scene="s1"]) .hud-tl',
      'html[data-hud-band="occupied"] .hud-tl',
      'html[data-hud-band="occupied"] .hud-tr',
    );

    expect(hidden).toContain("opacity: 0");
    expect(hidden).toContain("visibility: hidden");
  });

  it("keeps a corner that holds focus visible, so scrolling cannot hide it", () => {
    const focused = ruleFor(narrow, ".hud-tr:focus-within");

    expect(focused).toContain("opacity: 1");
    expect(focused).toContain("visibility: visible");
    // Equal specificity to the hide rule, so source order is what makes it win.
    expect(narrow.indexOf(".hud-tr:focus-within")).toBeGreaterThan(
      narrow.indexOf('html[data-hud-band="occupied"] .hud-tr'),
    );
  });

  it("drops both bottom corners, which would otherwise sit on the content column", () => {
    expect(ruleFor(narrow, ".hud-bl", ".hud-br")).toContain("display: none");
  });

  it("sizes the install chip as a tap target wherever the pointer is coarse", () => {
    expect(ruleFor(mediaBlocks("pointer: coarse"), ".hud-install")).toContain("height: 44px");
  });
});

describe("landing HUD wordmark", () => {
  it("lays the art out at a crisp 10px step and scales the whole block", () => {
    const figlet = ruleFor(css, ".logo-figlet");

    // Box-drawing strokes only survive on whole device pixels: lay out at 10px,
    // then scale. Sizing the font down directly is what smeared the mark.
    expect(figlet).toContain("font-size: 10px");
    expect(figlet).toContain("transform: scale(var(--wm-scale))");
    expect(figlet).toContain("transform-origin: top left");
  });

  it("reserves the scaled box on the corner, since transforms do not lay out", () => {
    const corner = ruleFor(css, ".hud-tl");

    expect(corner).toContain("width: calc(63ch * var(--wm-scale))");
    expect(corner).toContain("height: calc(6em * var(--wm-scale))");
  });

  it("keeps the mark largest where it is the only chrome in the band", () => {
    const scaleOf = (declarations: string): number => {
      const value = /--wm-scale:\s*([\d.]+)/.exec(declarations)?.[1];
      if (value === undefined) throw new Error("no --wm-scale declaration");
      return Number(value);
    };

    const phone = scaleOf(ruleFor(css, ".hud-tl"));
    const desktop = scaleOf(ruleFor(mediaBlocks("min-width: 921px"), ".hud-tl"));

    // Above 921px the wordmark shares the frame with three other HUD corners
    // and the hero heading, so it steps back rather than growing.
    expect(phone).toBeGreaterThan(desktop);
  });

  it("keeps the figlet as the only wordmark at every width", () => {
    expect(css).not.toContain(".logo-word");
  });
});
