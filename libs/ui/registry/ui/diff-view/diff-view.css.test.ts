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
  let components = "";

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
    components = atRuleBody(css, "@layer components");
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

  it("turns the rows container into a non-scrollport under wrap", () => {
    const wrapOn = ruleBody(components, '[data-slot="diff-view"][data-wrap="on"]');

    // The consuming declarations read the switch exactly once each, so the
    // wrapped and unwrapped paths cannot drift apart.
    expect(components).toContain("overflow-x: var(--diff-rows-overflow-x)");
    expect(components).toContain("min-width: var(--diff-row-min-width)");
    expect(wrapOn).toContain("--diff-rows-overflow-x: hidden");
    expect(wrapOn).toContain("--diff-row-min-width: 0");
    expect(wrapOn).toContain("--diff-code-white-space: pre-wrap");
  });

  it("hangs continuations 2ch in and pins the gutter to the first visual line", () => {
    const wrapOn = ruleBody(components, '[data-slot="diff-view"][data-wrap="on"]');

    expect(components).toContain("text-indent: var(--diff-code-indent)");
    expect(components).toContain("padding-inline-start: var(--diff-code-pad-start)");
    expect(components).toContain("align-self: var(--diff-gutter-align)");
    expect(wrapOn).toContain("--diff-code-indent: -2ch");
    expect(wrapOn).toContain("--diff-code-pad-start: 2.5ch");
    expect(wrapOn).toContain("--diff-gutter-align: start");
  });

  it("wraps by default below 40rem unless the consumer opted out", () => {
    const narrow = atRuleBody(components, "@container diff-view (max-width: 40rem)");
    expect(narrow).toContain('[data-slot="diff-view"]:not([data-wrap="off"])');
    expect(narrow).toContain("--diff-code-white-space: pre-wrap");
    expect(ruleBody(components, '[data-slot="diff-view"]')).toContain("container-name: diff-view");
  });

  it("paints the empty band and the unmatched row from one hatch declaration", () => {
    const emptyRow = ruleBody(components, '[data-row][data-state="empty"]');
    const emptyBand = ruleBody(components, '[data-slot="diff-view-empty"][data-empty]');

    expect(emptyRow).toContain("background-image: var(--diff-hatch)");
    expect(emptyBand).toContain("background-image: var(--diff-hatch)");
    expect(emptyBand).toContain("min-height: 44px");
  });

  it('drops the hatch under variant="bare" and in forced colors', () => {
    const bare = ruleBody(
      components,
      '[data-slot="diff-view"][data-variant="bare"] [data-slot="diff-view-empty"][data-empty]',
    );
    const forced = atRuleBody(components, "@media (forced-colors: active)");

    expect(bare).toContain("background-image: none");
    expect(ruleBody(forced, '[data-slot="diff-view-empty"][data-empty]')).toContain(
      "border: 1px dashed GrayText",
    );
  });

  it("keeps the line-number gutter out of a copied selection", () => {
    const gutter = ruleBody(components, "\n  .diff-num");
    expect(gutter).toContain("user-select: none");
  });
});

describe("diff signal contrast (parsed from CSS)", () => {
  const DIFF_CSS = readFileSync(
    resolve(fileURLToPath(import.meta.url), "../diff-view.css"),
    "utf8",
  );
  const THEME_CSS = readFileSync(
    resolve(fileURLToPath(import.meta.url), "../../../../styles/theme.css"),
    "utf8",
  );

  function block(source: string, selector: string): string {
    const body = ruleBody(source, selector);
    if (body === null) {
      throw new Error(`Selector not found in CSS: ${selector}`);
    }
    return body;
  }

  function readVar(blockText: string, name: string): string | undefined {
    return blockText.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  }

  function hexToRgb(hex: string): [number, number, number] {
    const v = hex.replace("#", "");
    return [
      Number.parseInt(v.slice(0, 2), 16),
      Number.parseInt(v.slice(2, 4), 16),
      Number.parseInt(v.slice(4, 6), 16),
    ];
  }

  function luminance([r, g, b]: [number, number, number]): number {
    const lin = (c: number) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function contrast(a: string, b: string): number {
    const la = luminance(hexToRgb(a));
    const lb = luminance(hexToRgb(b));
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  const darkBg = readVar(block(THEME_CSS, ':root, [data-theme="dark"]'), "--base-bg");
  const lightBg = readVar(block(THEME_CSS, '[data-theme="light"]'), "--base-bg");

  const darkDefault = block(DIFF_CSS, '[data-slot="diff-view"]');
  const lightDefault = block(DIFF_CSS, '[data-theme="light"] [data-slot="diff-view"]');
  const darkOkabe = block(DIFF_CSS, '[data-slot="diff-view"][data-diff-palette="okabe-ito"]');
  const lightOkabe = block(
    DIFF_CSS,
    '[data-theme="light"] [data-slot="diff-view"][data-diff-palette="okabe-ito"]',
  );

  const cases: Array<{ name: string; bg?: string; anchors: Array<string | undefined> }> = [
    {
      name: "dark default",
      bg: darkBg,
      anchors: [
        readVar(darkDefault, "--diff-color-add"),
        readVar(darkDefault, "--diff-color-remove"),
        readVar(darkDefault, "--diff-color-hunk"),
      ],
    },
    {
      name: "light default",
      bg: lightBg,
      anchors: [
        readVar(lightDefault, "--diff-color-add"),
        readVar(lightDefault, "--diff-color-remove"),
        readVar(lightDefault, "--diff-color-hunk"),
      ],
    },
    {
      name: "dark okabe-ito",
      bg: darkBg,
      anchors: [
        readVar(darkOkabe, "--diff-color-add"),
        readVar(darkOkabe, "--diff-color-remove"),
        // okabe-ito inherits the theme's hunk anchor.
        readVar(darkDefault, "--diff-color-hunk"),
      ],
    },
    {
      name: "light okabe-ito",
      bg: lightBg,
      anchors: [
        readVar(lightOkabe, "--diff-color-add"),
        readVar(lightOkabe, "--diff-color-remove"),
        readVar(lightDefault, "--diff-color-hunk"),
      ],
    },
  ];

  for (const { name, bg, anchors } of cases) {
    it(`keeps add/remove/hunk markers ≥4.5:1 in ${name}`, () => {
      expect(bg).toMatch(/^#[0-9a-fA-F]{6}$/);
      for (const anchor of anchors) {
        expect(anchor).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(contrast(anchor as string, bg as string)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
