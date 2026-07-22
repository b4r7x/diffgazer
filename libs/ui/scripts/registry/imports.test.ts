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
    const items = [
      { name: "widget", type: "registry:ui", files: [{ path: "registry/ui/widget/index.tsx" }] },
    ];
    const errors = validateRegistryImportClosure(dir, items);
    expect(errors).toEqual([
      "widget imports @/lib/helper from registry/ui/widget/index.tsx, which resolves to registry/lib/helper.ts but is not declared in any registry item's files[]",
    ]);
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
    expect(errors).toEqual([
      "widget imports @/lib/helper from registry/ui/widget/index.tsx, which resolves to registry item helper but is missing from registryDependencies closure",
    ]);
  });

  it("passes when the imported item is in the closure", () => {
    const dir = setup({
      "registry/ui/widget/index.tsx": 'import { helper } from "@/lib/helper";\n',
      "registry/lib/helper.ts": "export const helper = 1;\n",
    });
    const items = [
      {
        name: "widget",
        type: "registry:ui",
        registryDependencies: ["helper"],
        files: [{ path: "registry/ui/widget/index.tsx" }],
      },
      { name: "helper", type: "registry:lib", files: [{ path: "registry/lib/helper.ts" }] },
    ];
    expect(validateRegistryImportClosure(dir, items)).toEqual([]);
  });

  it("passes when a hidden shim item and its importer both declare the same @diffgazer-keys dependency", () => {
    const dir = setup({
      "registry/ui/dialog/index.tsx":
        'import { useFocusRestore } from "@/hooks/use-focus-restore";\n',
      "registry/hooks/use-focus-restore.ts": "export const useFocusRestore = () => {};\n",
    });
    const items = [
      {
        name: "dialog",
        type: "registry:ui",
        registryDependencies: ["@diffgazer-keys/focus-restore"],
        files: [{ path: "registry/ui/dialog/index.tsx" }],
      },
      {
        name: "use-focus-restore",
        type: "registry:hook",
        registryDependencies: ["@diffgazer-keys/focus-restore"],
        meta: { hidden: true },
        files: [{ path: "registry/hooks/use-focus-restore.ts" }],
      },
    ];
    expect(validateRegistryImportClosure(dir, items)).toEqual([]);
  });
});
