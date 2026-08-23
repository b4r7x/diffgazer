import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validatePublicComponentProps, validatePublicExportShape } from "./exports.js";
import type { RegistryItem } from "./types.js";

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

  it("flags a missing top-level import condition", () => {
    const exportsMap = { "./components/x": { types: "./dist/x.d.ts" } };
    expect(validatePublicExportShape(exportsMap, "./components/x")).toEqual([
      'package export ./components/x is missing top-level "import" condition',
    ]);
  });

  it("flags types nested under import", () => {
    const exportsMap = { "./components/x": { import: { types: "./x.d.ts", default: "./x.js" } } };
    const errors = validatePublicExportShape(exportsMap, "./components/x");
    expect(errors.some((e) => e.includes('nests "types" under "import"'))).toBe(true);
  });

  it("reports the real rule for a runtime-conditional import block", () => {
    const exportsMap = {
      "./components/x": {
        types: "./dist/x.d.ts",
        import: { node: "./dist/x.node.js", default: "./dist/x.js" },
      },
    };

    expect(validatePublicExportShape(exportsMap, "./components/x")).toEqual([
      'package export ./components/x must declare "import" as a string path, not a nested condition object',
    ]);
  });
});

describe("validatePublicComponentProps", () => {
  let root: string | null = null;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = null;
  });

  function setup(files: Record<string, string>): string {
    root = mkdtempSync(resolve(tmpdir(), "ui-component-docs-"));
    for (const [rel, content] of Object.entries(files)) {
      const abs = resolve(root, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    }
    return root;
  }

  const items = [{ name: "widget", type: "registry:ui", files: [] }] as unknown as RegistryItem[];

  it("flags a public component whose generated props table is empty", () => {
    const dir = setup({ "docs/generated/components/widget.json": JSON.stringify({ props: {} }) });
    expect(validatePublicComponentProps(dir, items)[0]).toContain("empty props table");
  });

  it("accepts a component that declares noProps", () => {
    const dir = setup({
      "docs/generated/components/widget.json": JSON.stringify({
        props: {},
        docs: { noProps: true },
      }),
    });
    expect(validatePublicComponentProps(dir, items)).toEqual([]);
  });

  it("flags a public component with no generated docs", () => {
    const dir = setup({ "registry/registry.json": "{}" });

    expect(validatePublicComponentProps(dir, items)[0]).toContain("missing generated docs");
  });
});
