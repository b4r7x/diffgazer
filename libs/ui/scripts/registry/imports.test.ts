import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateRegistryImportClosure } from "./imports";

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

describe("validateRegistryImportClosure", () => {
  it("flags an import that resolves to a file declared in no item", () => {
    const dir = setup({
      "registry/ui/widget/index.tsx": 'import { helper } from "@/lib/helper";\n',
      "registry/lib/helper.ts": "export const helper = 1;\n",
    });
    const items = [{ name: "widget", type: "registry:ui", files: [{ path: "registry/ui/widget/index.tsx" }] }];
    const errors = validateRegistryImportClosure(dir, items);
    expect(errors.some((e) => e.includes("not declared in any registry item"))).toBe(true);
  });

  it("flags an imported item missing from the dependency closure", () => {
    const dir = setup({
      "registry/ui/widget/index.tsx": 'import { helper } from "@/lib/helper";\n',
      "registry/lib/helper.ts": "export const helper = 1;\n",
    });
    const items = [
      { name: "widget", type: "registry:ui", files: [{ path: "registry/ui/widget/index.tsx" }] },
      { name: "helper", type: "registry:lib", files: [{ path: "registry/lib/helper.ts" }] },
    ];
    const errors = validateRegistryImportClosure(dir, items);
    expect(errors.some((e) => e.includes("missing from registryDependencies closure"))).toBe(true);
  });

  it("passes when the imported item is in the closure", () => {
    const dir = setup({
      "registry/ui/widget/index.tsx": 'import { helper } from "@/lib/helper";\n',
      "registry/lib/helper.ts": "export const helper = 1;\n",
    });
    const items = [
      { name: "widget", type: "registry:ui", registryDependencies: ["helper"], files: [{ path: "registry/ui/widget/index.tsx" }] },
      { name: "helper", type: "registry:lib", files: [{ path: "registry/lib/helper.ts" }] },
    ];
    expect(validateRegistryImportClosure(dir, items)).toEqual([]);
  });
})
