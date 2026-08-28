import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateNoBuildEnvReads, validateNoPublicKeysImports } from "./shipped-source.js";

let root: string | null = null;

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = null;
});

function setup(files: Record<string, string>): string {
  root = mkdtempSync(resolve(tmpdir(), "ui-shipped-source-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const path = resolve(root, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
}

function publicItem(content: string, hidden = false): string {
  return JSON.stringify({
    name: "keys-leak",
    type: "registry:ui",
    ...(hidden ? { meta: { hidden: true } } : {}),
    files: [{ path: "keys-leak.ts", content }],
  });
}

describe("validateNoBuildEnvReads", () => {
  it.each([
    { token: "process.env", source: 'export const dev = process.env.NODE_ENV !== "production";\n' },
    { token: "import.meta.env", source: "export const dev = import.meta.env.DEV;\n" },
  ])("flags $token in shipped registry source", ({ token, source }) => {
    const dir = setup({ "registry/lib/helper.ts": source });

    expect(validateNoBuildEnvReads(dir)).toEqual([
      expect.stringContaining(`registry/lib/helper.ts reads ${token}`),
    ]);
  });

  it("flags a build-env read in an example as well as in component source", () => {
    const dir = setup({
      "registry/examples/widget/widget-env.tsx": "export const mode = process.env.NODE_ENV;\n",
    });

    expect(validateNoBuildEnvReads(dir)).toEqual([
      expect.stringContaining(
        "registry/examples/widget/widget-env.tsx reads process.env, NODE_ENV",
      ),
    ]);
  });
});

describe("validateNoPublicKeysImports", () => {
  it("flags every unsupported root keys import form in public copy content", () => {
    const dir = setup({
      "public/r/keys-leak.json": publicItem(
        [
          'import keys from "@diffgazer/keys";',
          'import * as namespace from "@diffgazer/keys";',
          'import "@diffgazer/keys";',
          'export * from "@diffgazer/keys";',
          'const dynamic = import("@diffgazer/keys");',
          'const required = require("@diffgazer/keys");',
        ].join("\n"),
      ),
    });

    // The reported forms follow the order the specifiers appear in the file above,
    // not the ImportSpecifierKind union order: extractImportSpecifiers returns
    // matches in source order and the validator dedupes them first-occurrence first.
    expect(validateNoPublicKeysImports(dir)).toEqual([
      expect.stringContaining(
        "unsupported @diffgazer/keys root import (import, side-effect, export, dynamic-import, require)",
      ),
    ]);
  });

  it("flags unsupported root keys imports in hidden public dependencies", () => {
    const dir = setup({
      "public/r/keys-leak.json": publicItem(
        [
          'import keys from "@diffgazer/keys";',
          'const dynamic = import("@diffgazer/keys");',
          'const required = require("@diffgazer/keys");',
        ].join("\n"),
        true,
      ),
    });

    expect(validateNoPublicKeysImports(dir)).toEqual([
      expect.stringContaining(
        "unsupported @diffgazer/keys root import (import, dynamic-import, require)",
      ),
    ]);
  });

  it("detects executable template root imports without flagging raw template text", () => {
    const dir = setup({
      "public/r/keys-leak.json": publicItem(
        [
          "const directDynamic = import(`@diffgazer/keys`);",
          "const directRequired = require(`@diffgazer/keys`);",
          `const interpolated = \`\${import("@diffgazer/keys")}:\${require("@diffgazer/keys")}\`;`,
          'const raw = `import("@diffgazer/keys"); require("@diffgazer/keys");`;',
        ].join("\n"),
      ),
    });

    expect(validateNoPublicKeysImports(dir)).toEqual([
      expect.stringContaining("unsupported @diffgazer/keys root import (dynamic-import, require)"),
    ]);
  });
});
