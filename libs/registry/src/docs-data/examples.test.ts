import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findExamples, generateDemoIndex } from "./examples.js";

describe("findExamples", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-examples-"));
    mkdirSync(join(tempDir, "dialog"), { recursive: true });
    writeFileSync(join(tempDir, "dialog/basic.tsx"), "export default function Basic() {}\n");
    writeFileSync(join(tempDir, "dialog/dialog-form.tsx"), "export default function Form() {}\n");
    writeFileSync(
      join(tempDir, "dialog/dialog-form.test.tsx"),
      "import { render } from '@testing-library/react';\n",
    );
    writeFileSync(
      join(tempDir, "dialog/dialog-form.spec.tsx"),
      "import { render } from '@testing-library/react';\n",
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("excludes .test.tsx and .spec.tsx from discovered examples", () => {
    const examples = findExamples(tempDir, "dialog");
    expect(examples).toEqual(["basic", "dialog-form"]);
  });

  it("returns an empty list for a missing item directory", () => {
    expect(findExamples(tempDir, "missing")).toEqual([]);
  });
});

describe("generateDemoIndex", () => {
  it("emits lazy imports for discovered examples", () => {
    const content = generateDemoIndex({
      items: [{ name: "dialog" }],
      examplesDir: "/examples",
      importPathPrefix: "@/examples",
      findExamplesFn: () => ["basic"],
    });

    expect(content).toContain('"basic": lazy(() => import("@/examples/dialog/basic"))');
  });

  it("throws when a discovered example resolves to a test/spec key", () => {
    expect(() =>
      generateDemoIndex({
        items: [{ name: "dialog" }],
        examplesDir: "/examples",
        importPathPrefix: "@/examples",
        findExamplesFn: () => ["dialog-form.test"],
      }),
    ).toThrow(/test\/spec example "dialog-form\.test"/);
  });
});
