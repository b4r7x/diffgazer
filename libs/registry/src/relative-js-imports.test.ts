import { describe, expect, it } from "vitest";
import { RELATIVE_JS_IMPORT_RE, stripRelativeJsExtensions } from "./relative-js-imports.js";

function matches(content: string): boolean {
  return new RegExp(RELATIVE_JS_IMPORT_RE.source, "g").test(content);
}

describe("stripRelativeJsExtensions", () => {
  it("strips .js from named, default, and re-export specifiers", () => {
    expect(stripRelativeJsExtensions('import { a } from "./a.js";')).toBe(
      'import { a } from "./a";',
    );
    expect(stripRelativeJsExtensions('import Foo from "../foo.js";')).toBe(
      'import Foo from "../foo";',
    );
    expect(stripRelativeJsExtensions('export { b } from "./b.js";')).toBe(
      'export { b } from "./b";',
    );
  });

  it("strips bare side-effect imports (the form ui's copy used to miss without a quote lookahead is still covered)", () => {
    expect(stripRelativeJsExtensions('import "./styles.js";')).toBe('import "./styles";');
  });

  it("strips dynamic import() and require() including whitespace before the paren", () => {
    expect(stripRelativeJsExtensions('const m = import("./m.js");')).toBe(
      'const m = import("./m");',
    );
    expect(stripRelativeJsExtensions('const m = import ("./m.js");')).toBe(
      'const m = import ("./m");',
    );
    expect(stripRelativeJsExtensions('const r = require("./r.js");')).toBe(
      'const r = require("./r");',
    );
    expect(stripRelativeJsExtensions('const r = require ("./r.js");')).toBe(
      'const r = require ("./r");',
    );
  });

  it("preserves single quotes", () => {
    expect(stripRelativeJsExtensions("import { a } from './a.js';")).toBe(
      "import { a } from './a';",
    );
  });

  it("leaves package specifiers and extensionless relative imports untouched", () => {
    expect(stripRelativeJsExtensions('import { a } from "@scope/pkg";')).toBe(
      'import { a } from "@scope/pkg";',
    );
    expect(stripRelativeJsExtensions('import { a } from "./a";')).toBe('import { a } from "./a";');
  });
});

describe("RELATIVE_JS_IMPORT_RE", () => {
  it("catches whitespace-before-paren forms the no-whitespace copies missed", () => {
    expect(matches('import ("./m.js")')).toBe(true);
    expect(matches('require ("./m.js")')).toBe(true);
  });

  it("does not match non-string parenthesized calls (quote-lookahead discipline)", () => {
    expect(matches("import(variable)")).toBe(false);
    expect(matches('import somethingNamed from "./a.js"')).toBe(true);
  });

  it("exposes the specifier (without .js) in capture group 3 for exec consumers", () => {
    const re = new RegExp(RELATIVE_JS_IMPORT_RE.source, "g");
    const match = re.exec('import { a } from "./nested/a.js";');
    expect(match?.[3]).toBe("./nested/a");
  });
});
