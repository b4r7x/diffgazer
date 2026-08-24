import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { atRuleBody, eachRule, ruleBody } from "../../testing/css-contract";

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

  it("measures the line-number gutter in digits, so its 12px gap survives", () => {
    // Under the global border-box reset the padding is taken out of the declared
    // width instead of sitting beside it, leaving a three-digit number to spill
    // into the sign column.
    const number = ruleBody(css, '[data-slot="code-block-line-number"]');
    expect(number).not.toBeNull();
    expect(number).toContain("box-sizing: content-box");
    expect(number).toMatch(/[;{\n]\s*width: var\(--code-block-line-number-w, 2ch\)/);
    expect(number).toContain("padding-right: 12px");
  });

  it.each([
    "keyword",
    "string",
    "comment",
    "type",
    "function",
    "attr",
  ])("colors .code-%s from its --code token", (token) => {
    // apps/web tokenizes evidence into these class names, so a rename here drops
    // the coloring with every suite on both sides still green.
    const rule = eachRule(css).find((candidate) =>
      candidate.selector
        .split(",")
        .some((part) => part.trim().endsWith(`[data-slot="code-block"] .code-${token}`)),
    );

    expect(rule).toBeDefined();
    expect(rule?.declarations).toContain(`color: var(--code-${token})`);
  });

  it("flattens the ramp in forced colors", () => {
    const forced = atRuleBody(css, "@media (forced-colors: active)");
    expect(ruleBody(forced, '[data-slot="code-block-dots"] span')).toContain(
      "background: GrayText",
    );
  });

  it('soft-wraps the body under data-wrap="on", overriding the default pre', () => {
    // The default rule sits on a lower-specificity selector, so a wrapped body
    // that lost this override would silently go back to horizontal scrolling.
    const wrapped = ruleBody(css, '[data-slot="code-block-content"][data-wrap="on"] code');
    expect(ruleBody(css, '[data-slot="code-block-line"] > code')).toContain("white-space: pre");
    expect(wrapped).toContain("white-space: pre-wrap");
    expect(wrapped).toContain("overflow-wrap: anywhere");
  });

  it("keeps the optical pull-back off the headers that centre their label", () => {
    // The unscoped 44px rule must not carry it, or the centred chrome="dots" and
    // terminal headers shift by 10px.
    expect(ruleBody(coarse, '[data-slot="code-block-copy-button"]')).not.toContain("margin-right");
    expect(
      ruleBody(
        coarse,
        '[data-slot="code-block"]:not([data-chrome="dots"]):not([data-variant="terminal"]) [data-slot="code-block-copy-button"]',
      ),
    ).toContain("margin-right: -10px");
  });
});
