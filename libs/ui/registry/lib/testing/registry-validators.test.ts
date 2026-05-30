import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  aliasImportBase,
  extractLocalImports,
  stripTemplateLiterals,
} from "../../../src/validation/registry-validation-fs";
import { validatePublicExportShape } from "../../../src/validation/registry-exports-validator";
import { validateRegistryImportClosure } from "../../../src/validation/registry-import-validator";
import { validateOrphanFiles } from "../../../src/validation/registry-orphan-validator";

describe("extractLocalImports", () => {
  it("collects @/ alias and relative specifiers, ignoring bare packages", () => {
    const source = `
      import { a } from "@/hooks/use-a";
      import type { B } from "@/lib/b";
      import { C } from "./c";
      import { useState } from "react";
      export { D } from "@/components/ui/d";
    `;
    expect(extractLocalImports(source).sort()).toEqual(
      ["./c", "@/components/ui/d", "@/hooks/use-a", "@/lib/b"].sort(),
    );
  });

  it("ignores specifiers that appear only inside template literals", () => {
    const source = "const code = `import { x } from \"@/hooks/fake\"`;";
    expect(extractLocalImports(source)).toEqual([]);
  });
})

describe("stripTemplateLiterals", () => {
  it("blanks template-literal contents so embedded code is not parsed as imports", () => {
    expect(stripTemplateLiterals("a `import x` b")).toBe("a `` b");
  });
})

describe("aliasImportBase", () => {
  it("maps @/ aliases to their registry directory", () => {
    expect(aliasImportBase("@/hooks/use-a")).toBe("registry/hooks/use-a");
    expect(aliasImportBase("@/lib/b")).toBe("registry/lib/b");
    expect(aliasImportBase("@/components/ui/c")).toBe("registry/ui/c");
    expect(aliasImportBase("./relative")).toBeNull();
  });
})

describe("validatePublicExportShape", () => {
  it("accepts an export with top-level types and import", () => {
    const exportsMap = { "./components/x": { types: "./dist/x.d.ts", import: "./dist/x.js" } };
    expect(validatePublicExportShape(exportsMap, "./components/x")).toEqual([]);
  });

  it("flags a missing top-level types condition", () => {
    const exportsMap = { "./components/x": { import: "./dist/x.js" } };
    expect(validatePublicExportShape(exportsMap, "./components/x")).toContain(
      'package export ./components/x is missing top-level "types" condition',
    );
  });

  it("flags types nested under import", () => {
    const exportsMap = { "./components/x": { import: { types: "./x.d.ts", default: "./x.js" } } };
    const errors = validatePublicExportShape(exportsMap, "./components/x");
    expect(errors.some((e) => e.includes('nests "types" under "import"'))).toBe(true);
  });
})

describe("file-based validators", () => {
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

  it("flags an on-disk source file not declared in any item", () => {
    const dir = setup({
      "registry/lib/declared.ts": "export const a = 1;\n",
      "registry/lib/orphan.ts": "export const b = 2;\n",
    });
    const items = [{ name: "declared", type: "registry:lib", files: [{ path: "registry/lib/declared.ts" }] }];
    const errors = validateOrphanFiles(dir, items);
    expect(errors.some((e) => e.includes("registry/lib/orphan.ts"))).toBe(true);
  });

  it("ignores test files when checking for orphans", () => {
    const dir = setup({
      "registry/lib/declared.ts": "export const a = 1;\n",
      "registry/lib/declared.test.ts": "test stub\n",
    });
    const items = [{ name: "declared", type: "registry:lib", files: [{ path: "registry/lib/declared.ts" }] }];
    expect(validateOrphanFiles(dir, items)).toEqual([]);
  });
})
