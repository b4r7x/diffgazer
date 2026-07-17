import { describe, expect, it } from "vitest";
import {
  extractImportSpecifiers,
  extractStaticNamedImports,
  stripTemplateLiterals,
} from "./import-specifiers.js";

describe("extractImportSpecifiers", () => {
  it("extracts static, type-only, side-effect, dynamic, and require specifiers", () => {
    const source = [
      'import { value } from "pkg-a";',
      'import type { TypeValue } from "pkg-type";',
      'export { other } from "pkg-export";',
      'export type { OtherType } from "pkg-export-type";',
      'import "pkg-side-effect";',
      'const lazy = import("pkg-dynamic");',
      'const required = require("pkg-require");',
    ].join("\n");

    expect(extractImportSpecifiers(source)).toEqual([
      { specifier: "pkg-a", kind: "import", isTypeOnly: false },
      { specifier: "pkg-type", kind: "import", isTypeOnly: true },
      { specifier: "pkg-export", kind: "export", isTypeOnly: false },
      { specifier: "pkg-export-type", kind: "export", isTypeOnly: true },
      { specifier: "pkg-dynamic", kind: "dynamic-import", isTypeOnly: false },
      { specifier: "pkg-require", kind: "require", isTypeOnly: false },
      { specifier: "pkg-side-effect", kind: "side-effect", isTypeOnly: false },
    ]);
  });

  it("extracts multi-line static imports and exports", () => {
    const source = `
      import {
        Button,
        type ButtonProps,
      } from "@scope/ui";

      export {
        createThing,
      } from "./thing";
    `;

    expect(extractImportSpecifiers(source)).toEqual([
      { specifier: "@scope/ui", kind: "import", isTypeOnly: false },
      { specifier: "./thing", kind: "export", isTypeOnly: false },
    ]);
  });

  it("ignores import-looking text inside template literals", () => {
    const source = 'const code = `import { x } from "fake"; const y = require("nope");`;';

    expect(extractImportSpecifiers(source)).toEqual([]);
  });

  it("ignores import syntax in ordinary strings and regexes without losing real declarations", () => {
    const source = [
      `const staticExample = 'import { fake } from "fake-static"';`,
      `const exportExample = "export { fake } from 'fake-export'";`,
      `const sideEffectExample = 'import "fake-side-effect"';`,
      `const dynamicExample = 'import("fake-dynamic")';`,
      `const requireExample = 'require("fake-require")';`,
      `const matcher = /import\\("fake-regex"\\)/;`,
      `const jsxExample = <code>{'import("fake-jsx-string")'}</code>;`,
      'import { real } from "real-static";',
      'export { realExport } from "real-export";',
      'const lazy = import("real-dynamic");',
      'const required = require("real-require");',
      'import "real-side-effect";',
    ].join("\n");

    expect(extractImportSpecifiers(source)).toEqual([
      { specifier: "real-static", kind: "import", isTypeOnly: false },
      { specifier: "real-export", kind: "export", isTypeOnly: false },
      { specifier: "real-dynamic", kind: "dynamic-import", isTypeOnly: false },
      { specifier: "real-require", kind: "require", isTypeOnly: false },
      { specifier: "real-side-effect", kind: "side-effect", isTypeOnly: false },
    ]);
  });

  it("rejects member calls, control-flow regexes, and raw JSX text without losing real forms", () => {
    const source = [
      'client?.import("phantom-optional-import");',
      'client?.require("phantom-optional-require");',
      'if (ok) /import("phantom-regex-import")/.test(text);',
      'while (ok) /require("phantom-regex-require")/.test(text);',
      'if (ok) {} /require("phantom-block-regex")/.test(text);',
      'function check() {} /import("phantom-function-regex")/.test(text);',
      'class Check {} /require("phantom-class-regex")/.test(text);',
      'const example = <code>import("phantom-jsx-import") require("phantom-jsx-require")</code>;',
      'const templateExample = `import("phantom-template-import") require("phantom-template-require")`;',
      'import DefaultValue from "real-default";',
      'import * as RealNamespace from "real-namespace";',
      'import type { RealType } from "real-type";',
      'export * from "real-export-all";',
      'export type { ExportedType } from "real-export-type";',
      'const jsxValue = <code>{import("real-jsx-expression")}</code>;',
      'const lazy = import("real-dynamic");',
      "const templateLazy = import(`real-template-literal`);",
      `const templateValue = \`raw \${import("real-template-expression")} \${require("real-template-expression-require")} \${\`nested \${import("real-nested-template-expression")}\`}\`;`,
      `const nestedBraceTemplate = \`\${({ nested: { lazy: import("real-template-brace-expression") } }).nested}\`;`,
      'const required = require("real-require");',
      "const templateRequired = require(`real-template-require-literal`);",
      'const objectRatio = {} / require("real-object-require");',
      'const functionRatio = function named() {} / require("real-function-expression-require");',
      'const arrowRatio = (() => {}) / require("real-arrow-expression-require");',
      'const classRatio = class Named {} / require("real-class-expression-require");',
      'if (ok) {} import("real-after-block");',
      'import "real-side-effect";',
    ].join("\n");

    expect(extractImportSpecifiers(source)).toEqual([
      { specifier: "real-default", kind: "import", isTypeOnly: false },
      { specifier: "real-namespace", kind: "import", isTypeOnly: false },
      { specifier: "real-type", kind: "import", isTypeOnly: true },
      { specifier: "real-export-all", kind: "export", isTypeOnly: false },
      { specifier: "real-export-type", kind: "export", isTypeOnly: true },
      { specifier: "real-jsx-expression", kind: "dynamic-import", isTypeOnly: false },
      { specifier: "real-dynamic", kind: "dynamic-import", isTypeOnly: false },
      { specifier: "real-template-literal", kind: "dynamic-import", isTypeOnly: false },
      { specifier: "real-template-expression", kind: "dynamic-import", isTypeOnly: false },
      {
        specifier: "real-nested-template-expression",
        kind: "dynamic-import",
        isTypeOnly: false,
      },
      {
        specifier: "real-template-brace-expression",
        kind: "dynamic-import",
        isTypeOnly: false,
      },
      { specifier: "real-after-block", kind: "dynamic-import", isTypeOnly: false },
      {
        specifier: "real-template-expression-require",
        kind: "require",
        isTypeOnly: false,
      },
      { specifier: "real-require", kind: "require", isTypeOnly: false },
      {
        specifier: "real-template-require-literal",
        kind: "require",
        isTypeOnly: false,
      },
      { specifier: "real-object-require", kind: "require", isTypeOnly: false },
      {
        specifier: "real-function-expression-require",
        kind: "require",
        isTypeOnly: false,
      },
      {
        specifier: "real-arrow-expression-require",
        kind: "require",
        isTypeOnly: false,
      },
      {
        specifier: "real-class-expression-require",
        kind: "require",
        isTypeOnly: false,
      },
      { specifier: "real-side-effect", kind: "side-effect", isTypeOnly: false },
    ]);
  });

  it("ignores import-looking text inside line comments", () => {
    const source = [
      '// import { fake } from "fake-import";',
      '// export { fake } from "fake-export";',
      '// import "fake-side-effect";',
      '// const lazy = import("fake-dynamic");',
      '// const required = require("fake-require");',
      'import { real } from "real-import";',
      'export { realExport } from "real-export";',
      'const lazy = import("real-dynamic");',
      'const required = require("real-require");',
      'import "real-side-effect";',
    ].join("\n");

    expect(extractImportSpecifiers(source)).toEqual([
      { specifier: "real-import", kind: "import", isTypeOnly: false },
      { specifier: "real-export", kind: "export", isTypeOnly: false },
      { specifier: "real-dynamic", kind: "dynamic-import", isTypeOnly: false },
      { specifier: "real-require", kind: "require", isTypeOnly: false },
      { specifier: "real-side-effect", kind: "side-effect", isTypeOnly: false },
    ]);
  });

  it("ignores import-looking text inside block comments", () => {
    const source = `
      /*
        import { fake } from "fake-import";
        export { fake } from "fake-export";
        import "fake-side-effect";
        const lazy = import("fake-dynamic");
        const required = require("fake-require");
      */

      import { real } from "real-import";
      export { realExport } from "real-export";
      const lazy = import("real-dynamic");
      const required = require("real-require");
      import "real-side-effect";
    `;

    expect(extractImportSpecifiers(source)).toEqual([
      { specifier: "real-import", kind: "import", isTypeOnly: false },
      { specifier: "real-export", kind: "export", isTypeOnly: false },
      { specifier: "real-dynamic", kind: "dynamic-import", isTypeOnly: false },
      { specifier: "real-require", kind: "require", isTypeOnly: false },
      { specifier: "real-side-effect", kind: "side-effect", isTypeOnly: false },
    ]);
  });
});

describe("extractStaticNamedImports", () => {
  it("returns exact multiline type-import ranges from the shared lexer", () => {
    const declaration = [
      "import type {",
      "  UseFocusRestoreOptions,",
      "  type InternalAlias as PublicAlias,",
      '} from "@diffgazer/keys";',
    ].join("\n");
    const source = `const before = true;\n${declaration}\nconst after = true;`;
    const declarationStart = source.indexOf("import type");
    const specifiersStart = source.indexOf("{", declarationStart) + 1;
    const specifiersEnd = source.indexOf("}", specifiersStart);

    expect(extractStaticNamedImports(source)).toEqual([
      {
        declarationStart,
        declarationEnd: declarationStart + declaration.length,
        specifiersStart,
        specifiersEnd,
        specifier: "@diffgazer/keys",
        quote: '"',
        typePrefix: "type ",
        isTypeOnly: true,
      },
    ]);
    expect(source.slice(specifiersStart, specifiersEnd)).toContain("UseFocusRestoreOptions");
  });

  it.each([
    `const known = 'import { useScrollLock } from "@diffgazer/keys"';`,
    `const unknown = 'import { unknownExport } from "@diffgazer/keys"';`,
    `const jsx = <code>import { useScrollLock } from "@diffgazer/keys"</code>;`,
  ])("returns no declaration range for static-import text in non-code content", (source) => {
    expect(extractStaticNamedImports(source)).toEqual([]);
  });
});

describe("stripTemplateLiterals", () => {
  it("blanks template-literal contents before import extraction", () => {
    expect(stripTemplateLiterals("a `import x` b")).toBe("a `` b");
  });
});
