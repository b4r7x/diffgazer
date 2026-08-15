import { describe, expect, it } from "vitest";
import { maskJsxRawText } from "./jsx-source-mask.js";
import { extractImportSpecifiers } from "./specifiers.js";

describe("maskJsxRawText", () => {
  it("preserves source length when astral-plane characters are present", () => {
    const source = 'const Icon = () => <span>🍎</span>;\nimport { a } from "./a.js";';
    const masked = maskJsxRawText(source);
    expect(masked.length).toBe(source.length);
    expect(extractImportSpecifiers(source)).toEqual([
      { specifier: "./a.js", kind: "import", isTypeOnly: false },
    ]);
  });

  it("does not treat generic type arguments as JSX when a later tag shares a prefix", () => {
    const source = [
      "function pick<T>(x: T) { return x; }",
      "<Tooltip>hi</Tooltip>",
      'const lazy = () => import("./heavy.js");',
    ].join("\n");
    expect(extractImportSpecifiers(source)).toEqual([
      { specifier: "./heavy.js", kind: "dynamic-import", isTypeOnly: false },
    ]);
  });

  it("does not blank the file after useState<Item> when ItemList appears later", () => {
    const source = [
      "const [value, setValue] = useState<Item>(null);",
      "<ItemList>items</ItemList>",
      'import { helper } from "./helper.js";',
    ].join("\n");
    expect(extractImportSpecifiers(source)).toEqual([
      { specifier: "./helper.js", kind: "import", isTypeOnly: false },
    ]);
  });
});
