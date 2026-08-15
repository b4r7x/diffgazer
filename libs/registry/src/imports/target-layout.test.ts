import { describe, expect, it } from "vitest";
import { rewriteRelativeImportsForTargetLayout } from "./target-layout.js";

// A registry item whose helpers are relocated on install: `use-demo/`, `shared/`,
// and `dom/` sources land under `hooks/utils/`, the entry hook stays put.
const PATH_MAP = new Map([
  ["src/hooks/use-demo.ts", "src/hooks/use-demo.ts"],
  ["src/hooks/use-demo/core.ts", "src/hooks/utils/demo-core.ts"],
  ["src/hooks/use-demo/index.ts", "src/hooks/utils/demo-index.ts"],
  ["src/hooks/shared/index.ts", "src/hooks/utils/shared.ts"],
  ["src/hooks/setup.ts", "src/hooks/utils/setup.ts"],
  ["src/dom/focusable.ts", "src/hooks/utils/focusable.ts"],
  ["src/dom/panel.tsx", "src/hooks/utils/panel.tsx"],
]);

function rewrite(content: string, unresolved: "keep" | "throw" = "keep"): string {
  return rewriteRelativeImportsForTargetLayout({
    content,
    sourcePath: "src/hooks/use-demo.ts",
    targetPath: "src/hooks/use-demo.ts",
    pathMap: PATH_MAP,
    unresolved,
  });
}

describe("rewriteRelativeImportsForTargetLayout", () => {
  it("relocates static named, default, and type-only imports", () => {
    expect(rewrite('import { core } from "./use-demo/core.js";')).toBe(
      'import { core } from "./utils/demo-core";',
    );
    expect(rewrite('import Panel from "../dom/panel";')).toBe('import Panel from "./utils/panel";');
    expect(rewrite('import type { Focusable } from "../dom/focusable.js";')).toBe(
      'import type { Focusable } from "./utils/focusable";',
    );
  });

  it("relocates export-from re-exports", () => {
    expect(rewrite('export { isFocusable } from "../dom/focusable.js";')).toBe(
      'export { isFocusable } from "./utils/focusable";',
    );
    expect(rewrite('export * from "./setup";')).toBe('export * from "./utils/setup";');
  });

  it("relocates side-effect imports", () => {
    expect(rewrite('import "./setup.js";')).toBe('import "./utils/setup";');
  });

  it("relocates dynamic import() and require()", () => {
    expect(rewrite('const m = import("./setup.js");')).toBe('const m = import("./utils/setup");');
    expect(rewrite('const r = require("./setup.js");')).toBe('const r = require("./utils/setup");');
    expect(rewrite("await import(`../dom/focusable`);")).toBe("await import(`./utils/focusable`);");
  });

  it("resolves a directory specifier through its index file", () => {
    expect(rewrite('import { shared } from "./shared";')).toBe(
      'import { shared } from "./utils/shared";',
    );
  });

  it("prefers a sibling file over a same-named directory, as a bundler does", () => {
    expect(rewrite('import { demo } from "./use-demo";')).toBe(
      'import { demo } from "./use-demo";',
    );
  });

  it("re-expresses imports from the importer's install directory, not its source directory", () => {
    const rewritten = rewriteRelativeImportsForTargetLayout({
      content: 'import { core } from "./core.js";',
      sourcePath: "src/hooks/use-demo/index.ts",
      targetPath: "src/hooks/utils/demo-index.ts",
      pathMap: PATH_MAP,
      unresolved: "throw",
    });

    expect(rewritten).toBe('import { core } from "./demo-core";');
  });

  it("leaves package and bare specifiers untouched", () => {
    expect(rewrite('import { useRef } from "react";')).toBe('import { useRef } from "react";');
    expect(rewrite('import { x } from "@diffgazer/keys";')).toBe(
      'import { x } from "@diffgazer/keys";',
    );
  });

  it("preserves the surrounding quote style", () => {
    expect(rewrite("import { setup } from './setup.js';")).toBe(
      "import { setup } from './utils/setup';",
    );
  });
});

describe("rewriteRelativeImportsForTargetLayout ignores non-executable text", () => {
  const cases = [
    { name: "a line comment", content: '// import { x } from "./setup.js";' },
    { name: "a block comment", content: "/* import { x } from './setup.js'; */" },
    { name: "an ordinary string", content: `const example = 'import "./setup.js"';` },
    { name: "a template literal", content: 'const code = `import "./setup.js"`;' },
    { name: "a JSX string", content: `const jsx = <code>{'import("./setup.js")'}</code>;` },
    { name: "a regex literal", content: 'const re = /import\\("\\.\\/setup\\.js"\\)/;' },
  ];

  // `throw` is the strict policy: an unresolved match would fail loudly here, so
  // these also prove the scanner never treats the text as a specifier at all.
  it.each(cases)("leaves a relative-looking specifier inside $name alone", ({ content }) => {
    expect(rewrite(content, "throw")).toBe(content);
  });

  it("still relocates a real import sitting beside a commented-out one", () => {
    const content = ['// import "./setup.js";', 'import { core } from "./use-demo/core.js";'].join(
      "\n",
    );

    expect(rewrite(content)).toBe(
      ['// import "./setup.js";', 'import { core } from "./utils/demo-core";'].join("\n"),
    );
  });
});

describe("rewriteRelativeImportsForTargetLayout unresolved policy", () => {
  it("keeps a specifier that resolves to no copied file when the caller asks to keep it", () => {
    expect(rewrite('import { gone } from "./missing";')).toBe('import { gone } from "./missing";');
  });

  it("throws naming the specifier and the importer when the caller asks to throw", () => {
    expect(() => rewrite('import { gone } from "./missing";', "throw")).toThrowError(
      /Cannot rewrite \.\/missing in src\/hooks\/use-demo\.ts/,
    );
  });
});
