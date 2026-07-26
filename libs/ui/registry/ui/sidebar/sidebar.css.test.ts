import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { ruleBody } from "../../testing/css-contract";
import { sidebarItemVariants } from "./sidebar-variants";

describe("Sidebar tree connector geometry contract", () => {
  // jsdom applies no stylesheet, so the trunk and tick are not observable from a
  // rendered test; the source is the contract. Connectors and the row's selected
  // background fill share one origin — the row's left edge. Anchoring them
  // anywhere else puts the trunk inside the fill and leaves a slab of highlight
  // hanging in the shell's gutter.
  const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../sidebar.css");
  const TREE_ITEM = '[data-slot="sidebar"][data-variant="tree"] [data-diffgazer-navigation-item]';
  let css = "";

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
  });

  it("anchors the trunk and the tick on the row's own left edge", () => {
    expect(ruleBody(css, `${TREE_ITEM}::before`)).toContain("left: 0");
    expect(ruleBody(css, `${TREE_ITEM}::after`)).toContain("left: 0");
  });

  it("indents the tree row by the rail its connectors draw, and gives it back as padding", () => {
    const className = sidebarItemVariants({ variant: "tree" });

    expect(className).toContain("[--sidebar-tree-rail:14px]");
    expect(className).toContain("ml-(--sidebar-tree-rail)");
    expect(className).toContain("pl-[calc(1.5rem-var(--sidebar-tree-rail))]");
    // The indent has to come out of the row's own width; w-full plus a margin
    // overflows the column sideways.
    expect(className).toContain("w-auto");
  });
});
