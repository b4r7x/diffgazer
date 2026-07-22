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

describe("stripRelativeJsExtensions ignores non-executable text", () => {
  it("leaves relative .js-looking text in comments byte-identical while still stripping real imports", () => {
    const input = [
      '// import { x } from "./fake.js";',
      "/* import { y } from './fake2.js'; */",
      'import { real } from "./real.js";',
    ].join("\n");

    const result = stripRelativeJsExtensions(input);

    expect(result).toContain('// import { x } from "./fake.js";');
    expect(result).toContain("/* import { y } from './fake2.js'; */");
    expect(result).toContain('import { real } from "./real";');
  });

  it("leaves relative .js-looking text in ordinary strings byte-identical", () => {
    const input = `const example = 'import { x } from "./fake.js"';`;
    expect(stripRelativeJsExtensions(input)).toBe(input);
  });

  it("leaves relative .js-looking text in template literals byte-identical", () => {
    const input = 'const code = `import { x } from "./fake.js"`;';
    expect(stripRelativeJsExtensions(input)).toBe(input);
  });

  it("leaves relative .js-looking text in JSX strings byte-identical", () => {
    const input = `const jsxExample = <code>{'import("./fake.js")'}</code>;`;
    expect(stripRelativeJsExtensions(input)).toBe(input);
  });

  it("leaves relative .js-looking text in regex literals byte-identical", () => {
    const input = 'const matcher = /import\\("\\.\\/fake\\.js"\\)/;';
    expect(stripRelativeJsExtensions(input)).toBe(input);
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
