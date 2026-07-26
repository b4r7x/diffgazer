import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

describe("DiffView CSS contract", () => {
  // jsdom's CSSOM ignores rules nested in @layer and never resolves container
  // queries or layout, so the sizing contract is asserted against the source.
  const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../diff-view.css");
  let css = "";

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
  });

  /** Text between the braces of the first rule whose selector contains `header`. */
  function scope(header: string): string {
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

  it("pairs inline-size containment on the root with a definite inline size", () => {
    // Regression guard: inline-size containment zeroes the figure's intrinsic
    // width contribution, so a shrink-to-fit consumer (flex centering, grid auto
    // track, float) collapsed the root to its 2px borders and every line
    // shattered. The container may only be declared alongside a guaranteed
    // inline size.
    const root = scope('[data-slot="diff-view"] {');
    expect(root).toContain("container-type: inline-size");
    expect(root).toContain("inline-size: 100%");
  });

  it("declares the size container on exactly one element", () => {
    // A second container anywhere inside the figure would re-zero the width
    // contribution the root sizing depends on.
    expect(css.match(/container-type:/g)).toHaveLength(1);
  });

  it("keeps the wrap tier's released row floor behind the container query", () => {
    const wrapped = scope('[data-slot="diff-view"][data-wrap="on"] {');
    expect(wrapped).toContain("--diff-row-min-width: 0");
    expect(css).toContain("@container diff-view (max-width: 40rem)");
  });

  it("lets a consumer opt out of every wrap trigger", () => {
    // data-wrap="off" is the documented escape hatch (apps/landing depends on it
    // for the hero diff), so no wrap trigger may apply without honouring it.
    const triggers = css.match(/--diff-code-white-space: pre-wrap/g) ?? [];
    const optOuts = css.match(/\[data-slot="diff-view"\]:not\(\[data-wrap="off"\]\)/g) ?? [];
    expect(triggers).toHaveLength(3);
    expect(optOuts).toHaveLength(2);
  });
});
