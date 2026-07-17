import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import defaultSource from "./diff-view-default.tsx?raw";
import denseSource from "./diff-view-dense.tsx?raw";
import hairlineSource from "./diff-view-hairline.tsx?raw";
import lineNumbersSource from "./diff-view-line-numbers.tsx?raw";
import maxHeightSource from "./diff-view-max-height.tsx?raw";
import paletteSource from "./diff-view-palette-okabe-ito.tsx?raw";
import splitSource from "./diff-view-split.tsx?raw";
import statusbarSource from "./diff-view-statusbar.tsx?raw";
import viewfinderSource from "./diff-view-viewfinder.tsx?raw";
import withHeaderSource from "./diff-view-with-header.tsx?raw";

const HEADED_EXAMPLES = [
  ["diff-view-default", defaultSource],
  ["diff-view-dense", denseSource],
  ["diff-view-hairline", hairlineSource],
  ["diff-view-line-numbers", lineNumbersSource],
  ["diff-view-max-height", maxHeightSource],
  ["diff-view-palette-okabe-ito", paletteSource],
  ["diff-view-split", splitSource],
  ["diff-view-statusbar", statusbarSource],
  ["diff-view-viewfinder", viewfinderSource],
  ["diff-view-with-header", withHeaderSource],
] satisfies ReadonlyArray<readonly [string, string]>;

function readPatch(example: string, source: string): string {
  const patch = source.match(/const patch = `([\s\S]*?)`;/)?.[1];
  if (patch === undefined) throw new Error(`Missing patch literal in ${example}`);
  return patch;
}

describe.each(HEADED_EXAMPLES)("%s", (example, source) => {
  it("contains a strict unified patch", () => {
    const result = spawnSync("git", ["apply", "--numstat"], {
      encoding: "utf8",
      input: readPatch(example, source),
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/^\d+\t\d+\t.+$/m);
  });
});
