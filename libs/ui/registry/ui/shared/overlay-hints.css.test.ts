import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { atRuleBody, type CssRule, eachRule, ruleBody } from "../../testing/css-contract";

describe("OverlayHints CSS contract", () => {
  // jsdom's CSSOM ignores rules nested in @layer and never evaluates
  // (pointer: coarse), so the collapse contract is asserted against the source.
  const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../overlay-hints.css");
  let css = "";
  let coarse = "";
  let coarseRules: CssRule[] = [];

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
    coarse = atRuleBody(css, "@media (pointer: coarse)");
    coarseRules = eachRule(coarse);
  });

  it("wraps hints to a second row instead of scrolling them", () => {
    // At 390 a fourth hint no longer fits on one line, and a horizontally
    // scrolling legend inside a scrolling overlay is unreachable on touch.
    expect(ruleBody(css, '[data-slot="overlay-hints"]')).toContain("flex-wrap: wrap");
  });

  it("hides key groups that are useless without a keyboard", () => {
    expect(
      ruleBody(
        coarse,
        '[data-slot="overlay-hints"][aria-hidden="true"] [data-slot="overlay-hints-item"]:not([data-touch])',
      ),
    ).toContain("display: none");
  });

  it("collapses the whole bar when no touch-relevant hint survives", () => {
    expect(
      ruleBody(coarse, '[data-slot="overlay-hints"][aria-hidden="true"]:not(:has([data-touch]))'),
    ).toContain("display: none");
  });

  it("collapses the host chrome row that exists only to hold the bar", () => {
    const collapsing = coarseRules.filter((rule) =>
      rule.selector.includes(':has(> [data-slot="overlay-hints"]'),
    );

    // Both legend kinds lose the dead chrome strip: the decorative one by
    // leaving the box tree, the AT-exposed one by leaving the visual flow.
    expect(collapsing.map((rule) => rule.selector).join("\n")).toContain(
      '[aria-hidden="true"]:only-child):not(:has([data-touch]))',
    );
    expect(collapsing.map((rule) => rule.selector).join("\n")).toContain(
      '[aria-hidden="false"]:only-child):not(:has([data-touch]))',
    );
    for (const rule of collapsing) {
      expect(rule.declarations).toMatch(/display: none|position: absolute/);
    }
  });

  it("never drops an AT-exposed legend out of the accessibility tree on touch", () => {
    const removing = coarseRules.filter(
      (rule) =>
        rule.declarations.includes("display: none") ||
        rule.declarations.includes("visibility: hidden"),
    );
    expect(removing.length).toBeGreaterThan(0);

    for (const rule of removing) {
      // `display:none` prunes the a11y tree, so it may only ever target a
      // legend the consumer left decorative (aria-hidden). Dialog opts in with
      // aria-hidden={false} and must stay announceable to VoiceOver/TalkBack.
      expect(rule.selector).toContain('[aria-hidden="true"]');
      expect(rule.selector).not.toContain('[aria-hidden="false"]');
    }
  });

  it("takes AT-exposed hints out of the visual flow instead", () => {
    const srOnly = coarseRules.find((rule) =>
      rule.selector.includes(
        '[data-slot="overlay-hints"][aria-hidden="false"] [data-slot="overlay-hints-item"]:not([data-touch])',
      ),
    );
    expect(srOnly).toBeDefined();
    expect(srOnly?.declarations).toContain("position: absolute");
    expect(srOnly?.declarations).toContain("clip-path: inset(50%)");
    expect(srOnly?.declarations).not.toContain("display: none");
  });

  it("never nests :has() inside :has() — the browser drops the whole rule", () => {
    expect(css).not.toMatch(/:has\([^)]*:has\(/);
  });

  it("owns no separator of its own — the host surface draws the hairline", () => {
    // A hint bar that drew its own border-top would double the hairline of the
    // host chrome row it always sits inside.
    expect(css).not.toContain("border-top");
  });
});
