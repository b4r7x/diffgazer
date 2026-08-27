import { describe, expect, it } from "vitest";
import { eachRule, ruleIndex } from "./css-contract";

describe("ruleIndex", () => {
  it("orders two rules by where they are declared", () => {
    const css = "a { color: red; }\nb { color: blue; }";

    expect(ruleIndex(css, "b")).toBeGreaterThan(ruleIndex(css, "a"));
  });

  it("throws on a missing selector instead of reporting an index a comparison would pass", () => {
    expect(() => ruleIndex("a { color: red; }", "b")).toThrow(/missing b/);
  });
});

describe("eachRule", () => {
  it("keeps a declaration written after a nested block on its own rule", () => {
    // The mis-slice this reader exists to prevent: a scanner cutting at the
    // first `}` loses `color`, and a suite filtering rules by declaration then
    // passes over text it never read.
    const rules = eachRule("a { display: none; &:hover { opacity: 1; } color: red; }");

    expect(rules[0]?.selector).toBe("a");
    expect(rules[0]?.declarations).toContain("display: none");
    expect(rules[0]?.declarations).toContain("color: red");
    expect(rules[0]?.declarations).not.toContain("opacity: 1");
  });

  it("enumerates a nested rule under the selectors it nests inside", () => {
    const rules = eachRule("@media (pointer: coarse) { a { display: none; } }");

    expect(rules.map((rule) => rule.selector)).toEqual([
      "@media (pointer: coarse)",
      "@media (pointer: coarse) a",
    ]);
    expect(rules[0]?.declarations.trim()).toBe("");
    expect(rules[1]?.declarations).toContain("display: none");
  });

  it("rejoins a selector the formatter wrapped and drops comments", () => {
    const rules = eachRule(`
      /* display: none in prose is not a declaration */
      [data-slot="hints"][aria-hidden="true"]
        [data-slot="hints-item"]:not([data-touch]) {
        position: absolute;
      }
    `);

    expect(rules).toHaveLength(1);
    expect(rules[0]?.selector).toBe(
      '[data-slot="hints"][aria-hidden="true"] [data-slot="hints-item"]:not([data-touch])',
    );
    expect(rules[0]?.declarations).not.toContain("display: none");
  });

  it("refuses to read an unbalanced block instead of truncating it", () => {
    expect(() => eachRule("a { display: none;")).toThrow(/unbalanced/);
  });
});
