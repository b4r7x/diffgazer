import { describe, expect, it } from "vitest";
import { findRelativeJsSpecifiers, stripRelativeJsExtensions } from "./relative-js.js";

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

describe("findRelativeJsSpecifiers", () => {
  it("reports every executable form the writer rewrites, in source order", () => {
    const content = [
      'import { a } from "./a.js";',
      'export { b } from "../b.js";',
      'import "./styles.js";',
      'const m = import ("./m.js");',
      'const r = require ("./r.js");',
    ].join("\n");

    expect(findRelativeJsSpecifiers(content)).toEqual([
      "./a.js",
      "../b.js",
      "./styles.js",
      "./m.js",
      "./r.js",
    ]);
  });

  it("ignores package specifiers and extensionless relative imports", () => {
    expect(findRelativeJsSpecifiers('import { a } from "@scope/pkg";')).toEqual([]);
    expect(findRelativeJsSpecifiers('import { a } from "./a";')).toEqual([]);
  });
});

// The gates that guard the committed public registries once used a raw-text regex while
// the writer used the lexer. These are the cases where the two disagreed: the first two
// failed a gate the writer could never fix, the rest shipped a broken specifier past it.
describe("findRelativeJsSpecifiers agrees with stripRelativeJsExtensions", () => {
  const cases = [
    { name: "a .js specifier quoted inside a comment", content: '// re-export from "./legacy.js"' },
    {
      name: "a .js specifier inside an ordinary string",
      content: `const msg = 'import "./x.js"';`,
    },
    { name: "a template-literal dynamic import", content: "await import(`./lazy.js`);" },
    { name: "a re-export with no whitespace around from", content: 'export{a}from"./a.js";' },
    {
      name: "a specifier wrapped onto its own line",
      content: 'import {\n  a,\n} from\n  "./x.js";',
    },
  ];

  it.each(cases)("flags $name only when the writer would rewrite it", ({ content }) => {
    const rewritten = stripRelativeJsExtensions(content) !== content;
    expect(findRelativeJsSpecifiers(content).length > 0).toBe(rewritten);
  });
});
