import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateOrphanFiles } from "./orphans";

let root: string | null = null;

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = null;
});

function setup(files: Record<string, string>): string {
  root = mkdtempSync(resolve(tmpdir(), "ui-validators-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = resolve(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

describe("validateOrphanFiles", () => {
  it("flags an on-disk source file not declared in any item", () => {
    const dir = setup({
      "registry/lib/declared.ts": "export const a = 1;\n",
      "registry/lib/orphan.ts": "export const b = 2;\n",
    });
    const items = [
      { name: "declared", type: "registry:lib", files: [{ path: "registry/lib/declared.ts" }] },
    ];
    const errors = validateOrphanFiles(dir, items);
    expect(errors.some((e) => e.includes("registry/lib/orphan.ts"))).toBe(true);
  });

  it("ignores test files when checking for orphans", () => {
    const dir = setup({
      "registry/lib/declared.ts": "export const a = 1;\n",
      "registry/lib/declared.test.ts": "test stub\n",
    });
    const items = [
      { name: "declared", type: "registry:lib", files: [{ path: "registry/lib/declared.ts" }] },
    ];
    expect(validateOrphanFiles(dir, items)).toEqual([]);
  });
});
