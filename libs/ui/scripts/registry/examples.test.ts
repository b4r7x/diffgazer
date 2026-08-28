import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  validateExamplesAvoidKeysPackage,
  validateExamplesDeclareClientBoundary,
} from "./examples.js";

let root: string | null = null;

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = null;
});

function withExamples(files: Record<string, string>): string {
  root = mkdtempSync(resolve(tmpdir(), "ui-examples-"));
  for (const [name, source] of Object.entries(files)) {
    const path = resolve(root, "registry/examples/widget", name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  }
  return root;
}

describe("validateExamplesAvoidKeysPackage", () => {
  it("flags a keys package import in any example, not just the ones with a sibling test", () => {
    const dir = withExamples({
      "widget-keyboard.tsx": 'import { useNavigation } from "@diffgazer/keys";\n',
      "widget-scoped.tsx": 'import { useKey } from "@diffgazer/keys/use-key";\n',
    });

    expect(validateExamplesAvoidKeysPackage(dir)).toEqual([
      expect.stringContaining(
        'registry/examples/widget/widget-keyboard.tsx imports "@diffgazer/keys"',
      ),
      expect.stringContaining(
        'registry/examples/widget/widget-scoped.tsx imports "@diffgazer/keys"',
      ),
    ]);
  });

  it("accepts examples that import the copied local hook path", () => {
    const dir = withExamples({
      "widget-keyboard.tsx":
        'import { useNavigation } from "@/hooks/use-navigation";\nexport default useNavigation;\n',
    });

    expect(validateExamplesAvoidKeysPackage(dir)).toEqual([]);
  });
});

describe("validateExamplesDeclareClientBoundary", () => {
  it.each([
    {
      crossing: "a render-function child",
      source: [
        'import { Widget } from "@/components/ui/widget";',
        "export default function Example() {",
        "  return <Widget>{(props) => <a {...props}>go</a>}</Widget>;",
        "}",
        "",
      ].join("\n"),
    },
    {
      crossing: "a JSX event handler",
      source: [
        "export default function Example() {",
        '  return <button type="button" onClick={() => undefined} />;',
        "}",
        "",
      ].join("\n"),
    },
  ])('flags an example that passes $crossing without "use client"', ({ crossing, source }) => {
    const dir = withExamples({ "widget-boundary.tsx": source });

    expect(validateExamplesDeclareClientBoundary(dir)).toEqual([
      expect.stringContaining(
        `registry/examples/widget/widget-boundary.tsx passes ${crossing} but omits "use client"`,
      ),
    ]);
  });

  it("accepts a boundary-crossing example that declares the directive", () => {
    const dir = withExamples({
      "widget-boundary.tsx": [
        '"use client";',
        "",
        "export default function Example() {",
        '  return <button type="button" onClick={() => undefined} />;',
        "}",
        "",
      ].join("\n"),
    });

    expect(validateExamplesDeclareClientBoundary(dir)).toEqual([]);
  });

  it("accepts an example whose only JSX handler lives inside a code sample string", () => {
    const dir = withExamples({
      "widget-sample.tsx": [
        "const sample = `export function Counter() {",
        "  return <button onClick={() => setCount(count + 1)}>{count}</button>",
        "}`;",
        "",
        "export default function Example() {",
        "  return <pre>{sample}</pre>;",
        "}",
        "",
      ].join("\n"),
    });

    expect(validateExamplesDeclareClientBoundary(dir)).toEqual([]);
  });
});
