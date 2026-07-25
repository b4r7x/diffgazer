import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss, { type AtRule } from "postcss";
import { describe, expect, it } from "vitest";

const themeBaseCss = readFileSync(resolve(import.meta.dirname, "../styles/theme-base.css"), "utf8");

function findHoverCapabilityRule(root: postcss.Root): AtRule {
  const matches = root.nodes.filter(
    (node): node is AtRule =>
      node.type === "atrule" && node.name === "media" && node.params === "(hover: hover)",
  );
  expect(matches).toHaveLength(1);
  const [hoverCapabilityRule] = matches;
  if (!hoverCapabilityRule) throw new Error("unreachable: length asserted above");
  return hoverCapabilityRule;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

describe("scrollbar capability styles", () => {
  it("suppresses scrollbar indicators only inside the (hover: hover) media query", () => {
    const hoverCapabilityRule = findHoverCapabilityRule(postcss.parse(themeBaseCss));

    const scrollbarHideDeclarations: string[] = [];
    const scrollbarThinDeclarations: string[] = [];
    hoverCapabilityRule.walkRules((rule) => {
      if (rule.selector.includes(".scrollbar-hide")) {
        rule.walkDecls((decl) => {
          scrollbarHideDeclarations.push(`${decl.prop}: ${normalize(decl.value)}`);
        });
      }
      if (rule.selector === ".scrollbar-thin") {
        rule.walkDecls((decl) => {
          scrollbarThinDeclarations.push(`${decl.prop}: ${normalize(decl.value)}`);
        });
      }
    });

    expect(scrollbarHideDeclarations).toContain("scrollbar-width: none");
    expect(scrollbarThinDeclarations).toContain("scrollbar-width: thin");
  });

  it("paints the resting thumb through the webkit pseudo tree", () => {
    const root = postcss.parse(themeBaseCss);
    const restingThumbBackgrounds: string[] = [];

    root.walkRules((rule) => {
      if (rule.selector !== ".scrollbar-thin::-webkit-scrollbar-thumb") return;
      rule.walkDecls("background", (decl) => {
        restingThumbBackgrounds.push(normalize(decl.value));
      });
    });

    expect(restingThumbBackgrounds).toHaveLength(1);
    expect(restingThumbBackgrounds[0]).toContain("--scrollbar-thumb");
    expect(restingThumbBackgrounds[0]).not.toBe("transparent");
  });

  it("confines non-initial standard scrollbar properties to engines without ::-webkit-scrollbar", () => {
    const root = postcss.parse(themeBaseCss);
    const restingThumbColors: string[] = [];

    root.walkRules((rule) => {
      if (rule.selector !== ".scrollbar-thin") return;
      rule.walkDecls(/^scrollbar-(width|color)$/, (decl) => {
        // Chromium drops the whole ::-webkit-scrollbar tree once an element
        // carries a non-initial standard scrollbar property, falling back to a
        // resting-invisible overlay scrollbar. `auto` is the reset that cancels
        // Tailwind's same-named utility; every other value must stay guarded.
        if (decl.prop === "scrollbar-width" && decl.value === "auto") return;
        const guard = decl.parent?.parent;
        expect(guard?.type).toBe("atrule");
        expect(guard && "params" in guard ? normalize(guard.params) : "").toBe(
          "not selector(::-webkit-scrollbar)",
        );
        if (decl.prop === "scrollbar-color") restingThumbColors.push(normalize(decl.value));
      });
    });

    expect(restingThumbColors).toHaveLength(1);
    // Track stays transparent; the thumb reads at rest through --scrollbar-thumb.
    expect(restingThumbColors[0]).toContain("--scrollbar-thumb");
    expect(restingThumbColors[0]).not.toBe("transparent transparent");
    expect(restingThumbColors[0]?.endsWith("transparent")).toBe(true);
  });

  it("cancels the Tailwind scrollbar-thin utility before the fallback branch re-declares thin", () => {
    const hoverCapabilityRule = findHoverCapabilityRule(postcss.parse(themeBaseCss));

    const resetIndexes: number[] = [];
    let fallbackBranchIndex = -1;
    hoverCapabilityRule.each((node, index) => {
      if (
        node.type === "atrule" &&
        normalize(node.params) === "not selector(::-webkit-scrollbar)"
      ) {
        fallbackBranchIndex = index;
        return;
      }
      if (node.type !== "rule" || node.selector !== ".scrollbar-thin") return;
      node.walkDecls("scrollbar-width", (decl) => {
        expect(decl.value).toBe("auto");
        resetIndexes.push(index);
      });
    });

    // Both are unlayered, so source order decides: Chromium keeps the reset and
    // paints the webkit thumb; Firefox reaches the later branch and gets `thin`.
    expect(resetIndexes).toHaveLength(1);
    expect(fallbackBranchIndex).toBeGreaterThan(resetIndexes[0] ?? Number.POSITIVE_INFINITY);
  });

  it("rejects scrollbar-hide selectors and suppressive scrollbar declarations outside the (hover: hover) media query", () => {
    const root = postcss.parse(themeBaseCss);
    findHoverCapabilityRule(root).remove();

    let sawScrollbarHideSelector = false;
    let sawScrollbarWidthNone = false;
    let sawScrollbarColorTransparentTransparent = false;

    root.walkRules((rule) => {
      if (rule.selector.includes(".scrollbar-hide")) sawScrollbarHideSelector = true;
    });
    root.walkDecls("scrollbar-width", (decl) => {
      if (decl.value === "none") sawScrollbarWidthNone = true;
    });
    root.walkDecls("scrollbar-color", (decl) => {
      if (decl.value === "transparent transparent") sawScrollbarColorTransparentTransparent = true;
    });

    expect(sawScrollbarHideSelector).toBe(false);
    expect(sawScrollbarWidthNone).toBe(false);
    expect(sawScrollbarColorTransparentTransparent).toBe(false);
  });
});
