import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { atRuleBody, eachRule, ruleBody } from "../../testing/css-contract";

describe("DiffView CSS contract", () => {
  // jsdom's CSSOM ignores rules nested in @layer and never resolves container
  // queries or layout, so the sizing contract is asserted against the source.
  const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../diff-view.css");
  let css = "";

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
  });

  it("pairs inline-size containment on the root with a definite inline size", () => {
    // Regression guard: inline-size containment zeroes the figure's intrinsic
    // width contribution, so a shrink-to-fit consumer (flex centering, grid auto
    // track, float) collapsed the root to its 2px borders and every line
    // shattered. The container may only be declared alongside a guaranteed
    // inline size.
    const root = ruleBody(css, '[data-slot="diff-view"]');
    expect(root).toContain("container-type: inline-size");
    expect(root).toContain("inline-size: 100%");
  });

  it("declares the size container nowhere but the root", () => {
    // A second container anywhere inside the figure would re-zero the width
    // contribution the root sizing depends on.
    const root = ruleBody(css, '[data-slot="diff-view"]') ?? "";
    expect(css.replace(root, "")).not.toContain("container-type:");
  });

  it("keeps the wrap tier's released row floor behind the container query", () => {
    expect(ruleBody(css, '[data-slot="diff-view"][data-wrap="on"]')).toContain(
      "--diff-row-min-width: 0",
    );
    expect(atRuleBody(css, "@container diff-view (max-width: 40rem)")).toContain(
      "--diff-row-min-width: 0",
    );
  });

  it("lets a consumer opt out of every wrap trigger", () => {
    // data-wrap="off" is the documented escape hatch (apps/landing depends on it
    // for the hero diff), so every rule that turns wrapping on is either the
    // explicit [data-wrap="on"] opt-in or excludes [data-wrap="off"].
    const triggers = eachRule(css).filter((rule) =>
      rule.declarations.includes("--diff-code-white-space: pre-wrap"),
    );

    expect(triggers.length).toBeGreaterThan(0);
    for (const trigger of triggers) {
      expect(trigger.selector).toMatch(/\[data-wrap="on"\]|:not\(\[data-wrap="off"\]\)/);
    }
  });

  it("re-anchors the light signal whether data-theme sits on an ancestor or the root itself", () => {
    // DiffView spreads consumer props onto the [data-slot="diff-view"] figure, so
    // <DiffView data-theme="light" /> is a supported shape: a descendant-only
    // selector would leave the dark-tuned anchors on a light page.
    const lightRules = eachRule(css).filter((rule) =>
      rule.selector.includes('[data-theme="light"]'),
    );
    const defaultTier = lightRules.find((rule) => rule.declarations.includes("--diff-color-hunk:"));
    const okabeTier = lightRules.find((rule) => rule.selector.includes("okabe-ito"));

    expect(lightRules.length).toBeGreaterThan(0);
    for (const rule of [defaultTier, okabeTier]) {
      expect(rule?.selector).toContain('[data-theme="light"] [data-slot="diff-view"]');
      expect(rule?.selector).toContain('[data-theme="light"][data-slot="diff-view"]');
    }
  });
});
