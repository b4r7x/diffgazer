import { describe, expect, it } from "vitest";
import { validatePublicExportShape } from "./exports";

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
});
