import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

describe("Dialog CSS contract", () => {
  // jsdom's CSSOM ignores rules nested in @layer and never runs keyframes, so
  // assert the motion contract by parsing the source directly.
  const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../dialog.css");
  let css = "";

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
  });

  function block(header: string): string {
    const start = css.indexOf(header);
    expect(start, `missing ${header}`).toBeGreaterThan(-1);
    const from = css.indexOf("{", start) + 1;
    let depth = 1;
    for (let i = from; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) return css.slice(from, i);
      }
    }
    throw new Error(`unterminated ${header}`);
  }

  it("enters and exits on one vector — fade plus a 4px drop, never a scale", () => {
    for (const name of ["@keyframes dialog-in", "@keyframes dialog-out"]) {
      const body = block(name);
      expect(body).not.toContain("scale(");
      expect(body).toContain("translateY(-4px)");
      expect(body).toContain("translateY(0)");
      expect(body).toContain("opacity");
    }
  });

  it("resolves --dialog-duration through the overlay-wide duration contract", () => {
    expect(block("  dialog {")).toContain("--dialog-duration: var(--ui-content-enter-duration)");
    expect(css).not.toMatch(/--dialog-duration:\s*[\d.]/);
  });

  it("times every exit off the shared exit duration", () => {
    expect(block('dialog[data-state="closed"]::backdrop')).toContain(
      "var(--ui-content-exit-duration)",
    );
    expect(block('dialog[data-state="closed"] {')).toContain("var(--ui-content-exit-duration)");
  });

  it("neuters the whole contract under reduced motion", () => {
    expect(block("@media (prefers-reduced-motion: reduce)")).toContain(
      "animation: none !important",
    );
  });
});
