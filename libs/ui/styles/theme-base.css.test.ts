import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { atRuleBody, type CssRule, eachRule } from "../registry/testing/css-contract";

const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../theme-base.css");

const HOVER_CAPABILITY = "@media (hover: hover)";
const WEBKIT_FALLBACK = "@supports not selector(::-webkit-scrollbar)";
const THIN = ".scrollbar-thin";
const STANDARD_SCROLLBAR_PROPERTIES = new Set(["scrollbar-width", "scrollbar-color"]);

interface CssDeclaration {
  prop: string;
  value: string;
}

/** A rule's own declarations, whitespace-normalized so a wrapped value still reads as one string. */
function declarationsOf(rule: CssRule): CssDeclaration[] {
  return rule.declarations
    .split(";")
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter((text) => text.includes(":"))
    .map((text) => ({
      prop: text.slice(0, text.indexOf(":")).trim(),
      value: text.slice(text.indexOf(":") + 1).trim(),
    }));
}

/** A rule whose selector group ends on the bare utility, at any nesting depth. */
function targetsThinUtility(rule: CssRule): boolean {
  return rule.selector === THIN || rule.selector.endsWith(` ${THIN}`);
}

describe("theme-base.css scrollbar capability contract", () => {
  // jsdom applies no stylesheet, and its CSSOM drops both @layer-nested and
  // pseudo-element rules, so the shipped source is the contract here.
  let rules: CssRule[] = [];
  let hoverRules: CssRule[] = [];

  beforeAll(() => {
    const css = readFileSync(CSS_PATH, "utf8");
    rules = eachRule(css);
    hoverRules = eachRule(atRuleBody(css, HOVER_CAPABILITY));
  });

  it("suppresses scrollbar indicators only inside the (hover: hover) media query", () => {
    // One block, or the "outside the query" case below would scope itself to a
    // fragment of the file and pass on CSS it never read.
    expect(rules.filter((rule) => rule.selector === HOVER_CAPABILITY)).toHaveLength(1);

    const hideDeclarations = hoverRules
      .filter((rule) => rule.selector.includes(".scrollbar-hide"))
      .flatMap(declarationsOf);
    const fallbackThinDeclarations = hoverRules
      .filter((rule) => rule.selector === `${WEBKIT_FALLBACK} ${THIN}`)
      .flatMap(declarationsOf);

    expect(hideDeclarations).toContainEqual({ prop: "scrollbar-width", value: "none" });
    expect(fallbackThinDeclarations).toContainEqual({ prop: "scrollbar-width", value: "thin" });
  });

  it("paints the resting thumb through the webkit pseudo tree", () => {
    const restingThumbBackgrounds = rules
      .filter((rule) => rule.selector.endsWith(`${THIN}::-webkit-scrollbar-thumb`))
      .flatMap(declarationsOf)
      .filter((declaration) => declaration.prop === "background")
      .map((declaration) => declaration.value);

    expect(restingThumbBackgrounds).toHaveLength(1);
    expect(restingThumbBackgrounds[0]).toContain("--scrollbar-thumb");
    expect(restingThumbBackgrounds[0]).not.toBe("transparent");
  });

  it("confines non-initial standard scrollbar properties to engines without ::-webkit-scrollbar", () => {
    const restingThumbColors: string[] = [];

    for (const rule of rules.filter(targetsThinUtility)) {
      for (const declaration of declarationsOf(rule)) {
        if (!STANDARD_SCROLLBAR_PROPERTIES.has(declaration.prop)) continue;
        // Chromium drops the whole ::-webkit-scrollbar tree once an element
        // carries a non-initial standard scrollbar property, falling back to a
        // resting-invisible overlay scrollbar. `auto` is the reset that cancels
        // Tailwind's same-named utility; every other value must stay guarded.
        if (declaration.prop === "scrollbar-width" && declaration.value === "auto") continue;
        expect(rule.selector).toContain(WEBKIT_FALLBACK);
        if (declaration.prop === "scrollbar-color") restingThumbColors.push(declaration.value);
      }
    }

    expect(restingThumbColors).toHaveLength(1);
    // Track stays transparent; the thumb reads at rest through --scrollbar-thumb.
    expect(restingThumbColors[0]).toContain("--scrollbar-thumb");
    expect(restingThumbColors[0]).not.toBe("transparent transparent");
    expect(restingThumbColors[0]?.endsWith("transparent")).toBe(true);
  });

  it("cancels the Tailwind scrollbar-thin utility before the fallback branch re-declares thin", () => {
    const resetIndexes = hoverRules.flatMap((rule, index) => {
      if (rule.selector !== THIN) return [];
      const resets = declarationsOf(rule).some(
        (declaration) => declaration.prop === "scrollbar-width" && declaration.value === "auto",
      );
      return resets ? [index] : [];
    });
    const fallbackIndex = hoverRules.findIndex((rule) => rule.selector === WEBKIT_FALLBACK);

    // Both are unlayered, so source order decides: Chromium keeps the reset and
    // paints the webkit thumb; Firefox reaches the later branch and gets `thin`.
    expect(resetIndexes).toHaveLength(1);
    expect(fallbackIndex).toBeGreaterThan(resetIndexes[0] ?? Number.POSITIVE_INFINITY);
  });

  it("rejects scrollbar-hide selectors and suppressive scrollbar declarations outside the (hover: hover) media query", () => {
    const outside = rules.filter((rule) => !rule.selector.includes(HOVER_CAPABILITY));
    const outsideDeclarations = outside.flatMap(declarationsOf);
    const outsideSelectors = outside
      .map((rule) => rule.selector)
      .filter((selector) => selector.includes(".scrollbar-hide"));

    expect(outsideSelectors).toEqual([]);
    expect(outsideDeclarations).not.toContainEqual({ prop: "scrollbar-width", value: "none" });
    expect(outsideDeclarations).not.toContainEqual({
      prop: "scrollbar-color",
      value: "transparent transparent",
    });
  });

  it("drives the overlay thumb from the same tokens as the thin scrollbar, and hides its rail on touch", () => {
    const OVERLAY_THUMB = '[data-slot="scroll-area-overlay-thumb"]';

    const resting = hoverRules
      .filter((rule) => rule.selector === OVERLAY_THUMB)
      .flatMap(declarationsOf)
      .filter((declaration) => declaration.prop === "background");
    expect(resting).toHaveLength(1);
    expect(resting[0]?.value).toContain("--scrollbar-thumb");
    expect(resting[0]?.value).not.toBe("transparent");

    const active = hoverRules
      .filter(
        (rule) =>
          rule.selector.includes(`:hover ${OVERLAY_THUMB}`) ||
          rule.selector.includes(`:focus-within ${OVERLAY_THUMB}`),
      )
      .flatMap(declarationsOf)
      .filter((declaration) => declaration.prop === "background");
    expect(active.length).toBeGreaterThan(0);
    for (const declaration of active) {
      expect(declaration.value).toContain("--scrollbar-thumb-active");
    }

    // Touch keeps the native indicator (.scrollbar-hide is hover-gated), so the
    // floating rail must disappear there instead of doubling it.
    const touchRules = eachRule(atRuleBody(readFileSync(CSS_PATH, "utf8"), "@media (hover: none)"));
    const railHide = touchRules
      .filter((rule) => rule.selector === '[data-slot="scroll-area-overlay"]')
      .flatMap(declarationsOf);
    expect(railHide).toContainEqual({ prop: "display", value: "none" });
  });
});

describe("theme-base.css shiki dual-theme contract", () => {
  let shikiRules: CssRule[] = [];

  beforeAll(() => {
    shikiRules = eachRule(readFileSync(CSS_PATH, "utf8")).filter((rule) =>
      rule.selector.includes(".shiki"),
    );
  });

  it("resolves an unscoped code block to the dark set the bare :root palette paints", () => {
    const unscoped = shikiRules.filter((rule) => !rule.selector.includes("[data-theme="));
    const declarations = unscoped.flatMap(declarationsOf);

    expect(unscoped).toHaveLength(1);
    expect(declarations).toContainEqual({ prop: "color", value: "var(--shiki-dark)" });
    expect(declarations).toContainEqual({
      prop: "background-color",
      value: "var(--shiki-dark-bg)",
    });
  });

  it("gives a light subtree the light set through the only themed branch", () => {
    // Themed branches share their specificity, so a [data-theme="dark"] copy
    // would beat the light branch it follows and re-paint the code block dark
    // inside an explicitly light subtree.
    const themed = shikiRules.filter((rule) => rule.selector.includes("[data-theme="));
    const declarations = themed.flatMap(declarationsOf);

    expect(themed.map((rule) => rule.selector)).toEqual([
      '[data-theme="light"] .shiki, [data-theme="light"] .shiki span',
    ]);
    expect(declarations).toContainEqual({ prop: "color", value: "var(--shiki-light)" });
    expect(declarations).toContainEqual({
      prop: "background-color",
      value: "var(--shiki-light-bg)",
    });
  });
});
