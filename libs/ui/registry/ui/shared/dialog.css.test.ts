import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { atRuleBody, ruleBody } from "../../testing/css-contract";

describe("Dialog CSS contract", () => {
  // jsdom's CSSOM ignores rules nested in @layer and never runs keyframes, so
  // assert the motion contract by parsing the source directly.
  const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../dialog.css");
  let css = "";

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
  });

  it("enters and exits on one vector — fade plus a 4px drop, never a scale", () => {
    for (const name of ["@keyframes dialog-in", "@keyframes dialog-out"]) {
      const body = atRuleBody(css, name);
      expect(body).not.toContain("scale(");
      expect(body).toContain("translateY(-4px)");
      expect(body).toContain("translateY(0)");
      expect(body).toContain("opacity");
    }
  });

  it("opens on the dialog-owned 150ms clock, not the anchored tier's", () => {
    expect(ruleBody(css, "dialog")).toContain("--dialog-duration: 150ms");
  });

  // Regression: the CSS body lock and DialogContent's useScrollLock both
  // compensated for the scrollbar, so opening a dialog shifted the page.
  it("ships no CSS body scroll lock — useScrollLock is the only owner", () => {
    expect(ruleBody(css, "body:has(dialog[open])")).toBeNull();
  });

  it("times every exit off the shared exit duration", () => {
    expect(ruleBody(css, 'dialog[data-state="closed"]::backdrop')).toContain(
      "var(--ui-content-exit-duration)",
    );
    expect(ruleBody(css, 'dialog[data-state="closed"]')).toContain(
      "var(--ui-content-exit-duration)",
    );
  });

  it("neuters the whole contract under reduced motion", () => {
    expect(atRuleBody(css, "@media (prefers-reduced-motion: reduce)")).toContain(
      "animation: none !important",
    );
  });
});
