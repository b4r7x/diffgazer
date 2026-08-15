import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("mdx component map bundle boundary", () => {
  it("lazy-loads hook source components instead of importing them eagerly", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./mdx-components.tsx"), "utf8");

    expect(source).toContain("lazy(() =>");
    expect(source).toContain('import("@/components/hook-source")');
    expect(source).not.toMatch(/^import \{ HookSource/m);
  });
});
