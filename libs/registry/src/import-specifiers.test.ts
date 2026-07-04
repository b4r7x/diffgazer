import { describe, expect, it } from "vitest";
import { extractImportSpecifiers, stripTemplateLiterals } from "./import-specifiers.js";

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

describe("stripTemplateLiterals", () => {
  it("blanks template-literal contents before import extraction", () => {
    expect(stripTemplateLiterals("a `import x` b")).toBe("a `` b");
  });
});
