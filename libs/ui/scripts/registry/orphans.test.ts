import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

  it("finds an orphan in a nested production directory with no declared sibling", () => {
    const dir = setup({
      "registry/ui/declared/index.ts": "export const declared = 1;\n",
      "registry/ui/undeclared/nested/orphan.tsx": "export const Orphan = null;\n",
    });
    const items = [
      {
        name: "declared",
        type: "registry:ui",
        files: [{ path: "registry/ui/declared/index.ts" }],
      },
    ];

    expect(validateOrphanFiles(dir, items)).toEqual([
      expect.stringContaining("registry/ui/undeclared/nested/orphan.tsx"),
    ]);
  });

  it("ignores tests, stories, testing helpers, and examples under production roots", () => {
    const dir = setup({
      "registry/lib/declared.ts": "export const declared = 1;\n",
      "registry/lib/declared.test.ts": "test stub\n",
      "registry/lib/declared.spec.ts": "test stub\n",
      "registry/lib/declared.story.tsx": "story stub\n",
      "registry/lib/tests/helper.ts": "test helper\n",
      "registry/lib/stories/demo.tsx": "story helper\n",
      "registry/hooks/testing/harness.ts": "testing helper\n",
      "registry/ui/widget/examples/demo.tsx": "example helper\n",
    });
    const items = [
      { name: "declared", type: "registry:lib", files: [{ path: "registry/lib/declared.ts" }] },
    ];

    expect(validateOrphanFiles(dir, items)).toEqual([]);
  });

  it("does not follow symlinks while walking production roots", () => {
    const dir = setup({
      "registry/lib/declared.ts": "export const declared = 1;\n",
      "outside/orphan.ts": "export const orphan = 1;\n",
    });
    symlinkSync(resolve(dir, "outside"), resolve(dir, "registry/lib/linked"));
    const items = [
      { name: "declared", type: "registry:lib", files: [{ path: "registry/lib/declared.ts" }] },
    ];

    expect(validateOrphanFiles(dir, items)).toEqual([]);
  });
});
