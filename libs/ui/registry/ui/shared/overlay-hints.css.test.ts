import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

describe("OverlayHints CSS contract", () => {
  // jsdom's CSSOM ignores rules nested in @layer and never evaluates
  // (pointer: coarse), so the collapse contract is asserted against the source.
  const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../overlay-hints.css");
  let css = "";

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
  });

  function scope(header: string): string {
    const start = css.indexOf(header);
    expect(start, `missing ${header}`).toBeGreaterThan(-1);
    const from = css.indexOf("{", start) + 1;
    let depth = 1;
    for (let i = from; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) return css.slice(from, i);
      }
    }
    throw new Error(`unterminated ${header}`);
  }

  it("wraps hints to a second row instead of scrolling them", () => {
    const body = scope('[data-slot="overlay-hints"] {');
    expect(body).toContain("flex-wrap: wrap");
    expect(body).toContain("gap: 4px 16px");
  });

  function coarseRules(): { selector: string; body: string }[] {
    const coarse = scope("@media (pointer: coarse)");
    const rules: { selector: string; body: string }[] = [];
    let selectorStart = 0;
    for (let i = 0; i < coarse.length; i += 1) {
      if (coarse[i] !== "{") continue;
      const end = coarse.indexOf("}", i);
      rules.push({
        selector: coarse
          .slice(selectorStart, i)
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\s+/g, " ")
          .trim(),
        body: coarse.slice(i + 1, end),
      });
      selectorStart = end + 1;
      i = end;
    }
    return rules;
  }

  it("hides key groups that are useless without a keyboard", () => {
    const coarse = scope("@media (pointer: coarse)");
    expect(coarse).toContain('[data-slot="overlay-hints-item"]:not([data-touch])');
    expect(coarse).toContain("display: none");
  });

  it("collapses the whole bar when no touch-relevant hint survives", () => {
    const coarse = scope("@media (pointer: coarse)");
    expect(coarse).toContain(
      '[data-slot="overlay-hints"][aria-hidden="true"]:not(:has([data-touch]))',
    );
  });

  it("collapses the host chrome row that exists only to hold the bar", () => {
    const collapsing = coarseRules().filter((rule) =>
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
      expect(rule.body).toMatch(/display: none|position: absolute/);
    }
  });

  it("never drops an AT-exposed legend out of the accessibility tree on touch", () => {
    const removing = coarseRules().filter(
      (rule) => rule.body.includes("display: none") || rule.body.includes("visibility: hidden"),
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
    const srOnly = coarseRules().find((rule) =>
      rule.selector.includes(
        '[data-slot="overlay-hints"][aria-hidden="false"] [data-slot="overlay-hints-item"]:not([data-touch])',
      ),
    );
    expect(srOnly).toBeDefined();
    expect(srOnly?.body).toContain("position: absolute");
    expect(srOnly?.body).toContain("clip-path: inset(50%)");
    expect(srOnly?.body).not.toContain("display: none");
  });

  it("never nests :has() inside :has() — the browser drops the whole rule", () => {
    expect(css).not.toMatch(/:has\([^)]*:has\(/);
  });

  it("owns no separator of its own — the host surface draws the hairline", () => {
    expect(css).not.toContain("border-top");
  });
});
