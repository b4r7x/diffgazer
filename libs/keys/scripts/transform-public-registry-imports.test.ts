import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RELATIVE_JS_IMPORT_RE } from "@diffgazer/registry";
import type { RegistryItem } from "@diffgazer/registry/schemas";
import { RegistrySchema } from "@diffgazer/registry/schemas";
import { afterEach, describe, expect, it } from "vitest";
import { requireValue } from "../src/testing/assertions.js";
import {
  assertNoRelativeJsImports,
  rewriteImportsForTargetLayout,
  transformKeysPublicRegistryImportContent,
  transformKeysPublicRegistryImports,
} from "./transform-public-registry-imports.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_ROOT = resolve(__dirname, "..");
const PUBLIC_DIR = resolve(KEYS_ROOT, "public", "r");

function loadPublicItem(name: string): RegistryItem {
  const itemPath = join(PUBLIC_DIR, `${name}.json`);
  return parseRegistryEntry(JSON.parse(readFileSync(itemPath, "utf-8")));
}

function parseRegistryEntry(raw: unknown): RegistryItem {
  const [item] = RegistrySchema.parse({ items: [raw] }).items;
  if (!item) throw new Error("Missing registry item");
  return item;
}

describe("public registry import rewriting", () => {
  const publicItems = readdirSync(PUBLIC_DIR)
    .filter((entry) => entry.endsWith(".json") && entry !== "registry.json")
    .map((entry) => entry.replace(/\.json$/, ""));

  for (const itemName of publicItems) {
    describe(itemName, () => {
      const item = loadPublicItem(itemName);

      it("keeps the shadcn $schema metadata", () => {
        const raw: unknown = JSON.parse(
          readFileSync(join(PUBLIC_DIR, `${itemName}.json`), "utf-8"),
        );
        expect(raw).toMatchObject({
          $schema: "https://ui.shadcn.com/schema/registry-item.json",
        });
      });

      it("has no relative .js imports in content", () => {
        for (const file of item.files) {
          if (typeof file.content !== "string") continue;
          const jsImports = file.content.match(RELATIVE_JS_IMPORT_RE);
          expect(
            jsImports,
            `${file.target ?? file.path} has .js imports: ${jsImports?.join(", ")}`,
          ).toBeNull();
        }
      });

      it("has no @diffgazer/keys package imports in content", () => {
        const packageImport = /(?:from|import)\s+["']@diffgazer\/keys["']/;
        for (const file of item.files) {
          if (typeof file.content !== "string") continue;
          expect(
            file.content,
            `${file.target ?? file.path} has @diffgazer/keys package import`,
          ).not.toMatch(packageImport);
        }
      });
    });
  }
});

describe("public registry import parser coverage", () => {
  it("strips .js from static, side-effect, dynamic, and require imports", () => {
    const input = [
      'import { value } from "./value.js";',
      'export { value } from "./exported.js";',
      'import "./setup.js";',
      'const lazy = import("./lazy.js");',
      'const required = require("./required.js");',
    ].join("\n");

    expect(transformKeysPublicRegistryImportContent(input)).toBe(
      [
        'import { value } from "./value";',
        'export { value } from "./exported";',
        'import "./setup";',
        'const lazy = import("./lazy");',
        'const required = require("./required");',
      ].join("\n"),
    );
  });

  it("rewrites side-effect imports for the installed target layout", () => {
    const pathMap = new Map([
      ["src/hooks/use-demo.ts", "src/hooks/use-demo.ts"],
      ["src/hooks/setup.ts", "src/hooks/utils/setup.ts"],
      ["src/hooks/lazy.ts", "src/hooks/lazy.ts"],
      ["src/hooks/required.ts", "src/hooks/utils/required.ts"],
      ["src/hooks/value.ts", "src/hooks/value.ts"],
    ]);
    const input = [
      'import { value } from "./value.js";',
      'import "./setup.js";',
      'const lazy = import("./lazy.js");',
      'const required = require("./required.js");',
    ].join("\n");
    const stripped = transformKeysPublicRegistryImportContent(input);

    expect(
      rewriteImportsForTargetLayout(
        stripped,
        "src/hooks/use-demo.ts",
        "src/hooks/use-demo.ts",
        pathMap,
      ),
    ).toBe(
      [
        'import { value } from "./value";',
        'import "./utils/setup";',
        'const lazy = import("./lazy");',
        'const required = require("./utils/required");',
      ].join("\n"),
    );
  });
});

describe("transformKeysPublicRegistryImports metadata preservation", () => {
  let dir: string | null = null;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  it("preserves top-level $schema metadata when rewriting changed item content", () => {
    dir = mkdtempSync(join(tmpdir(), "keys-transform-meta-"));
    writeFileSync(
      join(dir, "registry.json"),
      JSON.stringify({
        $schema: "https://ui.shadcn.com/schema/registry.json",
        name: "keys",
        items: [],
      }),
    );
    writeFileSync(
      join(dir, "use-demo.json"),
      JSON.stringify({
        $schema: "https://ui.shadcn.com/schema/registry-item.json",
        name: "use-demo",
        type: "registry:hook",
        files: [
          {
            path: "src/hooks/use-demo.ts",
            target: "src/hooks/use-demo.ts",
            content: 'import { x } from "./utils/x.js";\n',
            type: "registry:hook",
          },
        ],
      }),
    );

    transformKeysPublicRegistryImports(dir);

    const raw: unknown = JSON.parse(readFileSync(join(dir, "use-demo.json"), "utf-8"));
    expect(raw).toMatchObject({
      $schema: "https://ui.shadcn.com/schema/registry-item.json",
      files: [{ content: 'import { x } from "./utils/x";\n' }],
    });
  });
});

describe("build-side relative .js assertion", () => {
  let dir: string | null = null;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  function writeItem(name: string, content: string): void {
    dir ??= mkdtempSync(join(tmpdir(), "keys-build-assert-"));
    writeFileSync(
      join(dir, `${name}.json`),
      JSON.stringify({
        name,
        type: "registry:hook",
        files: [{ path: `src/hooks/${name}.ts`, target: `src/hooks/${name}.ts`, content }],
      }),
    );
  }

  it("throws when generated registry content carries a relative .js specifier", () => {
    writeItem("use-bad", 'import { x } from "./utils/x.js";\n');

    expect(() =>
      assertNoRelativeJsImports(requireValue(dir, "test registry directory")),
    ).toThrowError(/relative \.js import specifiers/);
  });

  it("passes when generated registry content has no relative .js specifiers", () => {
    writeItem("use-good", 'import { x } from "./utils/x";\n');

    expect(() =>
      assertNoRelativeJsImports(requireValue(dir, "test registry directory")),
    ).not.toThrow();
  });

  it("ignores the generated registry index", () => {
    dir ??= mkdtempSync(join(tmpdir(), "keys-build-assert-"));
    writeFileSync(join(dir, "registry.json"), JSON.stringify({ name: "keys", items: [] }));

    expect(() =>
      assertNoRelativeJsImports(requireValue(dir, "test registry directory")),
    ).not.toThrow();
  });
});
