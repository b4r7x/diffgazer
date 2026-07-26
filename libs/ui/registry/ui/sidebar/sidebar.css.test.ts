import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { ruleBody } from "../../testing/css-contract";

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
});
