import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { atRuleBody, type CssRule, eachRule, ruleBody } from "../registry/testing/css-contract";

const THEME_CSS_PATH = resolve(fileURLToPath(import.meta.url), "../theme.css");
const BASE_CSS_PATH = resolve(fileURLToPath(import.meta.url), "../theme-base.css");

const INCREASED_CONTRAST = "@media (prefers-contrast: more)";
const DARK_SCOPE = ':root, [data-theme="dark"]';
const LIGHT_SCOPE = '[data-theme="light"]';

/** The custom property names a block declares, in source order. */
function declaredProperties(body: string): string[] {
  return [...body.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1] ?? "");
}

function requireRuleBody(source: string, selector: string): string {
  const body = ruleBody(source, selector);
  if (body === null) throw new Error(`missing or unbalanced ${selector}`);
  return body;
}

describe("theme.css increased-contrast contract", () => {
  // jsdom applies no stylesheet and cannot evaluate a preference media query, so
  // the shipped source and its cascade order are the contract here.
  let css = "";
  let rules: CssRule[] = [];

  beforeAll(() => {
    css = readFileSync(THEME_CSS_PATH, "utf8");
    rules = eachRule(css);
  });

  it.each([
    DARK_SCOPE,
    LIGHT_SCOPE,
  ])("raises the `%s` palette after the resting block that declares it", (scope) => {
    // A media query adds no specificity: the raised palette only reaches the
    // page when it follows the same selector's resting declarations, which is
    // why it cannot live in the theme-base.css this file imports first.
    const resting = rules.findIndex((rule) => rule.selector === scope);
    const raised = rules.findIndex((rule) => rule.selector === `${INCREASED_CONTRAST} ${scope}`);

    expect(resting).toBeGreaterThanOrEqual(0);
    expect(raised).toBeGreaterThan(resting);
  });

  it.each([
    DARK_SCOPE,
    LIGHT_SCOPE,
  ])("raises only tokens the `%s` resting palette declares", (scope) => {
    const raised = declaredProperties(requireRuleBody(atRuleBody(css, INCREASED_CONTRAST), scope));
    const resting = declaredProperties(requireRuleBody(css, scope));

    expect(raised.length).toBeGreaterThan(0);
    expect(resting).toEqual(expect.arrayContaining(raised));
  });

  it("keeps the imported base free of an increased-contrast palette it could never win", () => {
    const baseRules = eachRule(readFileSync(BASE_CSS_PATH, "utf8"));

    expect(baseRules.filter((rule) => rule.selector.startsWith(INCREASED_CONTRAST))).toEqual([]);
  });
});
