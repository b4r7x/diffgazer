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
