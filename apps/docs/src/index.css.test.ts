import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

const THEME_RADIUS_RE = /^\s*--radius:\s*([^;]+);/m;
const DEMO_PREVIEW_BLOCK_RE = /\.docs-chrome\s+\[data-demo-preview\]\s*\{([\s\S]*?)\}/;

function extractRadiusDeclaration(block: string): string | undefined {
  for (const line of block.split("\n")) {
    const match = line.match(/^\s*--radius:\s*([^;]+);/);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

describe("docs chrome demo preview radius contract", () => {
  it("restores the library radius on demo previews under sharp-corner chrome", () => {
    const themeCss = readRepoFile("libs/ui/styles/theme.css");
    const indexCss = readRepoFile("apps/docs/src/index.css");

    const libraryRadius = themeCss.match(THEME_RADIUS_RE)?.[1]?.trim();
    const demoPreviewBlock = indexCss.match(DEMO_PREVIEW_BLOCK_RE)?.[1] ?? "";
    const demoPreviewRadius = extractRadiusDeclaration(demoPreviewBlock);

    expect(libraryRadius).toBe("0.25rem");
    expect(demoPreviewRadius).toBe(libraryRadius);
  });
});
