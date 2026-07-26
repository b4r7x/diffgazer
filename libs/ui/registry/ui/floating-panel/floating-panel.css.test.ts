import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { ruleBody } from "../../testing/css-contract";

describe("FloatingPanel CSS contract", () => {
  // jsdom never applies the stylesheet, so the panel's own overflow behavior is not observable
  // from a rendered test; the CSS source is the contract.
  const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../../../../styles/theme-base.css");
  let css = "";

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
  });

  it("makes the panel its own scroll container so the available-size caps scroll instead of clipping", () => {
    const body = ruleBody(css, ".ui-floating-panel");
    expect(body).not.toBeNull();
    expect(body).toContain("overflow: auto");
  });

  it("keeps the transform-origin and z-index hooks on the same base rule", () => {
    const body = ruleBody(css, ".ui-floating-panel");
    expect(body).toContain("transform-origin: var(--ui-content-transform-origin, center)");
    expect(body).toContain("z-index: var(--ui-floating-z, var(--z-popover))");
  });
});
