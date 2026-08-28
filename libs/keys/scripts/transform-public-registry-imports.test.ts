import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listPublicRegistryEntries, readRegistryItem } from "@diffgazer/registry";
import type { RegistryItem } from "@diffgazer/registry/schemas";
import { afterEach, describe, expect, it } from "vitest";
import { requireValue } from "../src/testing/internal/assertions.js";
import {
  assertNoRelativeJsImports,
  transformKeysPublicRegistryImports,
  transformKeysPublicRegistrySourceItem,
} from "./transform-public-registry-imports.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_ROOT = resolve(__dirname, "..");
const PUBLIC_DIR = resolve(KEYS_ROOT, "public", "r");

function loadPublicItem(name: string): RegistryItem {
  return readRegistryItem(join(PUBLIC_DIR, `${name}.json`));
}

describe("transformKeysPublicRegistrySourceItem", () => {
  it("stamps @hooks targets onto public items during source transform", () => {
    const item = transformKeysPublicRegistrySourceItem({
      name: "navigation",
      type: "registry:hook",
      dependencies: [],
      registryDependencies: [],
      files: [
        {
          path: "src/hooks/use-navigation.ts",
          target: "src/hooks/use-navigation.ts",
          type: "registry:hook",
        },
        {
          path: "src/hooks/use-navigation/core.ts",
          target: "src/hooks/utils/navigation-core.ts",
          type: "registry:hook",
        },
      ],
    });

    expect(item.files[0]?.target).toBe("@hooks/use-navigation.ts");
    expect(item.files[1]?.target).toBe("@hooks/utils/navigation-core.ts");
  });
});

describe("public registry import rewriting", () => {
  const publicItems = listPublicRegistryEntries(PUBLIC_DIR).map(({ entry }) =>
    entry.replace(/\.json$/, ""),
  );

  it("keeps the shadcn $schema metadata on every committed public item", () => {
    for (const itemName of publicItems) {
      const raw: unknown = JSON.parse(readFileSync(join(PUBLIC_DIR, `${itemName}.json`), "utf-8"));
      expect(raw, itemName).toMatchObject({
        $schema: "https://ui.shadcn.com/schema/registry-item.json",
      });
    }
  });

  it("leaves no @diffgazer/keys package imports in committed public content", () => {
    const packageImport = /(?:from|import)\s+["']@diffgazer\/keys["']/;
    for (const itemName of publicItems) {
      for (const file of loadPublicItem(itemName).files) {
        if (typeof file.content !== "string") continue;
        expect(
          file.content,
          `${file.target ?? file.path} has @diffgazer/keys package import`,
        ).not.toMatch(packageImport);
      }
    }
  });
});

describe("target-layout import rewriting", () => {
  let dir: string | null = null;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  function writeRegistry(files: Array<{ path: string; target: string; content: string }>): string {
    dir = mkdtempSync(join(tmpdir(), "keys-target-layout-"));
    writeFileSync(join(dir, "registry.json"), JSON.stringify({ name: "keys", items: [] }));
    writeFileSync(
      join(dir, "use-demo.json"),
      JSON.stringify({
        name: "use-demo",
        type: "registry:hook",
        files: files.map((file) => ({ ...file, type: "registry:hook" })),
      }),
    );
    return dir;
  }

  function readContent(outputDir: string, index: number): string {
    const item = readRegistryItem(join(outputDir, "use-demo.json"));
    return requireValue(item.files[index]?.content, `content of file ${index}`);
  }

  it("re-expresses every executable import form against the installed layout", () => {
    const outputDir = writeRegistry([
      {
        path: "src/hooks/use-demo.ts",
        target: "src/hooks/use-demo.ts",
        content: [
          'import { value } from "./value.js";',
          'import "./setup.js";',
          'const lazy = import("./lazy.js");',
          'const required = require("./required.js");',
          "",
        ].join("\n"),
      },
      { path: "src/hooks/value.ts", target: "src/hooks/value.ts", content: "" },
      { path: "src/hooks/setup.ts", target: "src/hooks/utils/setup.ts", content: "" },
      { path: "src/hooks/lazy.ts", target: "src/hooks/lazy.ts", content: "" },
      { path: "src/hooks/required.ts", target: "src/hooks/utils/required.ts", content: "" },
    ]);

    transformKeysPublicRegistryImports(outputDir);

    expect(readContent(outputDir, 0)).toBe(
      [
        'import { value } from "./value";',
        'import "./utils/setup";',
        'const lazy = import("./lazy");',
        'const required = require("./utils/required");',
        "",
      ].join("\n"),
    );
  });

  // The public build maps one item at a time, so a specifier outside the item has
  // no target here and must survive verbatim rather than fail the build.
  it("keeps a specifier that resolves to no file in the item", () => {
    const outputDir = writeRegistry([
      {
        path: "src/hooks/use-demo.ts",
        target: "src/hooks/use-demo.ts",
        content: 'import { other } from "./other-item";\n',
      },
    ]);

    transformKeysPublicRegistryImports(outputDir);

    expect(readContent(outputDir, 0)).toBe('import { other } from "./other-item";\n');
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
