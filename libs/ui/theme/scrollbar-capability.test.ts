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

describe("scrollbar capability styles", () => {
  it("suppresses scrollbar indicators only inside the (hover: hover) media query", () => {
    const hoverCapabilityRule = findHoverCapabilityRule(postcss.parse(themeBaseCss));

    const scrollbarHideDeclarations: string[] = [];
    const scrollbarThinDeclarations: string[] = [];
    hoverCapabilityRule.walkRules((rule) => {
      if (rule.selector.includes(".scrollbar-hide")) {
        rule.walkDecls((decl) => {
          scrollbarHideDeclarations.push(`${decl.prop}: ${decl.value}`);
        });
      }
      if (rule.selector === ".scrollbar-thin") {
        rule.walkDecls((decl) => {
          scrollbarThinDeclarations.push(`${decl.prop}: ${decl.value}`);
        });
      }
    });

    expect(scrollbarHideDeclarations).toContain("scrollbar-width: none");
    expect(scrollbarThinDeclarations).toContain("scrollbar-color: transparent transparent");
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
