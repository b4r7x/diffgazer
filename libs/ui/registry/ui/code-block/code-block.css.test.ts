import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { atRuleBody, ruleBody } from "../../testing/css-contract";

describe("CodeBlock CSS contract", () => {
  // jsdom's CSSOM ignores rules nested in @layer and pseudo-element styles, so
  // assert the CSS contract by parsing the source selectors/declarations directly.
  const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../code-block.css");
  let css = "";
  let coarse = "";

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
    coarse = atRuleBody(css, "@media (pointer: coarse)");
  });

  it("gives the copy button a real 44px box on coarse pointers", () => {
    const button = ruleBody(coarse, '[data-slot="code-block-copy-button"]');
    expect(button).not.toBeNull();
    expect(button).toContain("width: 44px");
    expect(button).toContain("height: 44px");
  });

  it("grows the header row so the 44px control is not clipped by the figure", () => {
    // [data-slot="code-block"] is overflow:hidden and the content <pre> paints
    // after the header, so a control taller than the header row loses its top
    // to the clip and its bottom to the <pre>.
    const root = ruleBody(css, '[data-slot="code-block"]');
    const header = ruleBody(coarse, '[data-slot="code-block-header"]');
    expect(root).not.toBeNull();
    expect(header).not.toBeNull();
    expect(root).toContain("overflow: hidden");
    expect(header).toContain("min-height: 44px");
  });

  it("carries no circle anywhere — the hard-edge contract", () => {
    expect(css).not.toContain("border-radius: 50%");
    const marks = ruleBody(css, '[data-slot="code-block-dots"] span');
    expect(marks).not.toBeNull();
    expect(marks).toContain("border-radius: 0");
    expect(marks).toContain("width: 8px");
  });

  it("ramps the three marks down instead of repeating one ornament", () => {
    const alphas = [1, 2, 3].map((index) =>
      ruleBody(css, `[data-slot="code-block-dots"] span:nth-child(${index})`),
    );
    for (const rule of alphas) expect(rule).not.toBeNull();
    expect(alphas[0]).toContain("42%");
    expect(alphas[1]).toContain("28%");
    expect(alphas[2]).toContain("16%");
  });

  it("flattens the ramp in forced colors", () => {
    const forced = atRuleBody(css, "@media (forced-colors: active)");
    expect(ruleBody(forced, '[data-slot="code-block-dots"] span')).toContain(
      "background: GrayText",
    );
  });

  it("keeps the optical pull-back off the headers that centre their label", () => {
    // The unscoped 44px rule must not carry it, or the centred chrome="dots" and
    // terminal headers shift by 10px.
    const button = ruleBody(coarse, '[data-slot="code-block-copy-button"]');
    expect(button).not.toBeNull();
    expect(button).not.toContain("margin-right");
    expect(coarse).toContain(
      '[data-slot="code-block"]:not([data-chrome="dots"]):not([data-variant="terminal"])',
    );
    expect(coarse).toContain("margin-right: -10px");
  });
});
