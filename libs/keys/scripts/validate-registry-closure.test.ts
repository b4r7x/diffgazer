import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readRegistryItem } from "@diffgazer/registry";
import type { Registry, RegistryItem } from "@diffgazer/registry/schemas";
import { REGISTRY_ITEM_TYPE, RegistrySchema } from "@diffgazer/registry/schemas";
import { describe, expect, it, vi } from "vitest";
import {
  validateContentFreshness,
  validateMetaFreshness,
  validatePublicTargetClosure,
} from "./validate-registry-closure/public-registry.js";
import { validateClientMetadata } from "./validate-registry-closure/source-registry.js";
import { extractRelativeImports as extractRegistryRelativeImports } from "./validate-registry-closure/types.js";
import { validateRegistryClosure } from "./validate-registry-closure.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_ROOT = resolve(__dirname, "..");
const PUBLIC_DIR = resolve(KEYS_ROOT, "public", "r");
const REGISTRY_PATH = resolve(KEYS_ROOT, "registry", "registry.json");
const DEMO_INDEX_PATH = resolve(KEYS_ROOT, "docs", "generated", "demo-index.ts");

function loadRegistry(): Registry {
  return RegistrySchema.parse(JSON.parse(readFileSync(REGISTRY_PATH, "utf-8")));
}

function loadPublicItem(name: string): RegistryItem {
  return readRegistryItem(join(PUBLIC_DIR, `${name}.json`));
}

function loadPublicRegistry(): Registry {
  return RegistrySchema.parse(JSON.parse(readFileSync(join(PUBLIC_DIR, "registry.json"), "utf-8")));
}

function getRegistryItem(registry: Registry, name: string): RegistryItem {
  const item = registry.items.find((item) => item.name === name);
  if (!item) {
    throw new Error(`Missing registry item: ${name}`);
  }
  return item;
}

describe("public registry target paths", () => {
  const registry = loadRegistry();
  const publicRegistry = loadPublicRegistry();

  const visibleItems = registry.items.filter((item) => !item.meta?.hidden);
  for (const sourceItem of visibleItems) {
    const expectedSourceTargets = sourceItem.files.map((file) => file.target ?? file.path).sort();
    const expectedPublicTargets = sourceItem.files
      .map((file) => {
        const target = file.target ?? file.path;
        return target.startsWith("src/hooks/")
          ? `@hooks/${target.slice("src/hooks/".length)}`
          : target;
      })
      .sort();

    it(`${sourceItem.name} public registry targets match derived shadcn handoff`, () => {
      const publicItem = getRegistryItem(publicRegistry, sourceItem.name);
      const publicTargets = publicItem.files.map((file) => file.target ?? file.path).sort();
      expect(publicTargets).toEqual(expectedPublicTargets);
    });

    it(`${sourceItem.name} source targets land under src/hooks/`, () => {
      for (const target of expectedSourceTargets) {
        expect(
          target.startsWith("src/hooks/"),
          `${sourceItem.name}: target ${target} must live under src/hooks/ for copy/package install`,
        ).toBe(true);
      }
    });
  }
});

describe("extractRelativeImports", () => {
  it("deduplicates a repeated relative specifier and excludes bare-package specifiers", () => {
    const imports = extractRegistryRelativeImports(
      [
        'import { value } from "./value.js";',
        'import { other } from "./value.js";',
        'import { pkg } from "some-package";',
      ].join("\n"),
    );

    expect(imports).toEqual(["./value.js"]);
  });
});

describe("focusable as transitive dependency", () => {
  it("focusable is marked hidden in source registry", () => {
    const registry = loadRegistry();
    const focusable = getRegistryItem(registry, "focusable");
    expect(focusable.meta?.hidden).toBe(true);
    expect(focusable.meta?.client).toBe(false);
  });

  it("focusable is excluded from public registry index but has per-item JSON", () => {
    const publicRegistry = loadPublicRegistry();
    const inIndex = publicRegistry.items.some((item) => item.name === "focusable");
    expect(inIndex).toBe(false);

    const publicItem = loadPublicItem("focusable");
    expect(publicItem.meta?.hidden).toBe(true);
    expect(publicItem.meta?.client).toBe(false);
  });

  it("focusable is included as a file in navigation and focus-trap items", () => {
    const registry = loadRegistry();
    const navigation = getRegistryItem(registry, "navigation");
    const focusTrap = getRegistryItem(registry, "focus-trap");

    expect(navigation.files.some((file) => file.path.includes("focusable"))).toBe(true);
    expect(focusTrap.files.some((file) => file.path.includes("focusable"))).toBe(true);
  });
});

describe("client registry metadata", () => {
  it("rejects a client item whose source has no use-client directive", () => {
    const root = mkdtempSync(join(tmpdir(), "dg-keys-client-metadata-"));
    try {
      mkdirSync(join(root, "src", "hooks"), { recursive: true });
      writeFileSync(join(root, "src", "hooks", "use-test.ts"), "export const test = true;\n");

      const registry = RegistrySchema.parse({
        items: [
          {
            name: "client-without-directive",
            type: REGISTRY_ITEM_TYPE.hook,
            meta: { client: true },
            files: [{ path: "src/hooks/use-test.ts", type: REGISTRY_ITEM_TYPE.hook }],
          },
        ],
      });

      expect(validateClientMetadata(registry, root)).toEqual([
        {
          code: "REGISTRY_CLIENT_METADATA",
          item: "client-without-directive",
          message: 'Item declares meta.client but no source file starts with "use client"',
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts a client directive after a BOM and comments", () => {
    const root = mkdtempSync(join(tmpdir(), "dg-keys-client-directive-"));
    try {
      mkdirSync(join(root, "src", "hooks"), { recursive: true });
      writeFileSync(
        join(root, "src", "hooks", "use-test.ts"),
        "﻿/* license */\n// generated\n'use client';\nexport const test = true;\n",
      );
      const registry = RegistrySchema.parse({
        items: [
          {
            name: "client-with-comments",
            type: REGISTRY_ITEM_TYPE.hook,
            meta: { client: true },
            files: [{ path: "src/hooks/use-test.ts", type: REGISTRY_ITEM_TYPE.hook }],
          },
        ],
      });

      expect(validateClientMetadata(registry, root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an expression that only prefixes the client directive", () => {
    const root = mkdtempSync(join(tmpdir(), "dg-keys-client-expression-"));
    try {
      mkdirSync(join(root, "src", "hooks"), { recursive: true });
      writeFileSync(
        join(root, "src", "hooks", "use-test.ts"),
        '"use client"\n.toString();\nexport const test = true;\n',
      );
      const registry = RegistrySchema.parse({
        items: [
          {
            name: "client-expression",
            type: REGISTRY_ITEM_TYPE.hook,
            meta: { client: true },
            files: [{ path: "src/hooks/use-test.ts", type: REGISTRY_ITEM_TYPE.hook }],
          },
        ],
      });

      expect(validateClientMetadata(registry, root)).toEqual([
        {
          code: "REGISTRY_CLIENT_METADATA",
          item: "client-expression",
          message: 'Item declares meta.client but no source file starts with "use client"',
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an instanceof expression continued after a line break", () => {
    const root = mkdtempSync(join(tmpdir(), "dg-keys-client-instanceof-"));
    try {
      mkdirSync(join(root, "src", "hooks"), { recursive: true });
      writeFileSync(
        join(root, "src", "hooks", "use-test.ts"),
        '"use client"\ninstanceof String;\nexport const test = true;\n',
      );
      const registry = RegistrySchema.parse({
        items: [
          {
            name: "client-instanceof",
            type: REGISTRY_ITEM_TYPE.hook,
            meta: { client: true },
            files: [{ path: "src/hooks/use-test.ts", type: REGISTRY_ITEM_TYPE.hook }],
          },
        ],
      });

      expect(validateClientMetadata(registry, root)).toEqual([
        {
          code: "REGISTRY_CLIENT_METADATA",
          item: "client-instanceof",
          message: 'Item declares meta.client but no source file starts with "use client"',
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("provider-backed hooks are package-only", () => {
  const PACKAGE_ONLY_EXPORTS = [
    "KeyboardProvider",
    "useKey",
    "useScope",
    "useScopedNavigation",
    "useActionRowNavigation",
    "useFocusZone",
    "keys",
    "useKeyboardContext",
    "useOptionalKeyboardContext",
  ];

  const STANDALONE_REGISTRY_NAMES = {
    useNavigation: "navigation",
    useFocusRestore: "focus-restore",
    useFocusTrap: "focus-trap",
    useScrollLock: "scroll-lock",
  } as const;

  const packageOnlyHookDocs = [
    "use-key",
    "use-scope",
    "use-scoped-navigation",
    "use-action-row-navigation",
    "use-focus-zone",
  ];

  it("package-only exports are not in any public registry item", () => {
    const publicRegistry = loadPublicRegistry();
    const publicItems = publicRegistry.items.filter((item) => !item.meta?.hidden);
    const publicNames = publicItems.map((item) => item.name).sort();

    expect(publicNames).toEqual(Object.values(STANDALONE_REGISTRY_NAMES).sort());

    const forbiddenIdentifier = new RegExp(`\\b(${PACKAGE_ONLY_EXPORTS.join("|")})\\b`);
    for (const item of publicItems) {
      for (const file of item.files) {
        expect(file.path).not.toMatch(forbiddenIdentifier);
        if (typeof file.content === "string") {
          expect(file.content).not.toMatch(forbiddenIdentifier);
        }
      }
    }
  });

  it("README documents package-only APIs", () => {
    const readme = readFileSync(resolve(KEYS_ROOT, "README.md"), "utf-8");
    expect(readme).toContain("Package-only");
    for (const api of [
      "KeyboardProvider",
      "useKey",
      "useScope",
      "useScopedNavigation",
      "useActionRowNavigation",
      "useFocusZone",
    ]) {
      expect(readme).toContain(api);
    }
  });

  it("package-only hook docs do not render copy-install commands", () => {
    for (const name of packageOnlyHookDocs) {
      const doc = readFileSync(
        resolve(KEYS_ROOT, "docs", "content", "hooks", `${name}.mdx`),
        "utf-8",
      );
      expect(doc).toContain("<ConsumptionBlock />");
      expect(doc).not.toContain("<InstallCommand />");
    }
  });

  it("generated demo lazy imports point at existing example modules", () => {
    const demoIndex = readFileSync(DEMO_INDEX_PATH, "utf-8");
    const imports = [...demoIndex.matchAll(/import\("([^"]+)"\)/g)].map((match) => match[1]);
    expect(imports.length).toBeGreaterThan(0);

    for (const specifier of imports) {
      if (!specifier) continue;
      const resolved = resolve(dirname(DEMO_INDEX_PATH), specifier);
      expect(
        existsSync(`${resolved}.tsx`) || existsSync(`${resolved}.ts`),
        `Generated demo import does not resolve: ${specifier}`,
      ).toBe(true);
    }
  });
});

describe("target-path install closure validation", () => {
  it("validateRegistryClosure passes for the real Keys registry", () => {
    expect(
      validateRegistryClosure(REGISTRY_PATH),
      'registry closure is stale or broken; run "pnpm --dir libs/keys build:shadcn"',
    ).toBe(true);
  });

  it("detects broken target-path imports in a synthetic bad item", () => {
    const publicDir = mkdtempSync(join(tmpdir(), "dg-keys-public-registry-"));
    try {
      writeFileSync(
        join(publicDir, "test-bad.json"),
        JSON.stringify({
          name: "test-bad",
          type: REGISTRY_ITEM_TYPE.hook,
          files: [
            {
              path: "src/hooks/use-test.ts",
              target: "src/hooks/use-test.ts",
              content: 'import { foo } from "./utils/missing";\n',
              type: REGISTRY_ITEM_TYPE.hook,
            },
          ],
        }),
      );

      expect(validatePublicTargetClosure(publicDir)).toEqual([
        {
          code: "PUBLIC_TARGET_CLOSURE",
          item: "test-bad",
          message:
            'Target import "./utils/missing" from src/hooks/use-test.ts does not resolve to any installed file',
        },
      ]);
    } finally {
      rmSync(publicDir, { recursive: true, force: true });
    }
  });

  it("detects stale embedded content that diverges from source", () => {
    const publicDir = mkdtempSync(join(tmpdir(), "dg-keys-freshness-"));
    try {
      const item = loadPublicItem("focus-trap");
      const firstFile = item.files[0];
      if (!firstFile || typeof firstFile.content !== "string") {
        throw new Error("focus-trap item is missing embedded content");
      }
      const staleItem = {
        ...item,
        files: [
          { ...firstFile, content: `${firstFile.content}// stale drift\n` },
          ...item.files.slice(1),
        ],
      };
      writeFileSync(join(publicDir, "focus-trap.json"), JSON.stringify(staleItem));

      expect(validateContentFreshness(publicDir, KEYS_ROOT)).toEqual([
        {
          code: "REGISTRY_STALE_CONTENT",
          item: "focus-trap",
          message:
            'Embedded content for src/hooks/use-focus-trap.ts is stale; run "pnpm --filter @diffgazer/keys build:shadcn" to regenerate',
        },
      ]);
    } finally {
      rmSync(publicDir, { recursive: true, force: true });
    }
  });

  it("detects a published item whose meta drifted from its source item", () => {
    const publicDir = mkdtempSync(join(tmpdir(), "dg-keys-meta-freshness-"));
    try {
      const item = loadPublicItem("focusable");
      writeFileSync(
        join(publicDir, "focusable.json"),
        JSON.stringify({ ...item, meta: { ...item.meta, client: true } }),
      );

      expect(validateMetaFreshness(publicDir, loadRegistry())).toEqual([
        {
          code: "REGISTRY_STALE_META",
          item: "focusable",
          message:
            'Published meta {"client":true,"hidden":true} does not match source meta {"client":false,"hidden":true}; run "pnpm --filter @diffgazer/keys build:shadcn" to regenerate',
        },
      ]);
    } finally {
      rmSync(publicDir, { recursive: true, force: true });
    }
  });

  it("validateRegistryClosure fails with grouped diagnostics for target-closure, relative-.js, and stale-content violations", () => {
    const root = mkdtempSync(join(tmpdir(), "dg-keys-closure-root-"));
    try {
      mkdirSync(join(root, "registry"), { recursive: true });
      mkdirSync(join(root, "public", "r"), { recursive: true });
      mkdirSync(join(root, "src", "hooks"), { recursive: true });

      writeFileSync(join(root, "registry", "registry.json"), JSON.stringify({ items: [] }));

      writeFileSync(
        join(root, "public", "r", "target-bad.json"),
        JSON.stringify({
          name: "target-bad",
          type: REGISTRY_ITEM_TYPE.hook,
          files: [
            {
              path: "src/hooks/use-target-bad.ts",
              target: "src/hooks/use-target-bad.ts",
              content: 'import { missing } from "./missing";\n',
              type: REGISTRY_ITEM_TYPE.hook,
            },
          ],
        }),
      );

      writeFileSync(
        join(root, "public", "r", "js-import-bad.json"),
        JSON.stringify({
          name: "js-import-bad",
          type: REGISTRY_ITEM_TYPE.hook,
          files: [
            {
              path: "src/hooks/use-js-import-bad.ts",
              target: "src/hooks/use-js-import-bad.ts",
              content: 'import { bar } from "./bar.js";\n',
              type: REGISTRY_ITEM_TYPE.hook,
            },
          ],
        }),
      );

      writeFileSync(join(root, "src", "hooks", "use-stale.ts"), "export const stale = 1;\n");
      writeFileSync(
        join(root, "public", "r", "stale.json"),
        JSON.stringify({
          name: "stale",
          type: REGISTRY_ITEM_TYPE.hook,
          files: [
            {
              path: "src/hooks/use-stale.ts",
              target: "src/hooks/use-stale.ts",
              content: "export const stale = 2;\n",
              type: REGISTRY_ITEM_TYPE.hook,
            },
          ],
        }),
      );

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        expect(validateRegistryClosure(join(root, "registry", "registry.json"))).toBe(false);

        const diagnostics = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
        expect(diagnostics).toContain("[PUBLIC_TARGET_CLOSURE]");
        expect(diagnostics).toContain("[PUBLIC_JS_IMPORT]");
        expect(diagnostics).toContain("[REGISTRY_STALE_CONTENT]");
      } finally {
        errorSpy.mockRestore();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when a closure file reads the build environment", () => {
    const root = mkdtempSync(join(tmpdir(), "dg-keys-build-env-"));
    try {
      mkdirSync(join(root, "registry"), { recursive: true });
      mkdirSync(join(root, "src", "hooks"), { recursive: true });

      writeFileSync(
        join(root, "src", "hooks", "use-env-read.ts"),
        'export const isDev = process.env.NODE_ENV !== "production";\n',
      );
      writeFileSync(
        join(root, "registry", "registry.json"),
        JSON.stringify({
          items: [
            {
              name: "env-read",
              type: REGISTRY_ITEM_TYPE.hook,
              files: [{ path: "src/hooks/use-env-read.ts", type: REGISTRY_ITEM_TYPE.hook }],
            },
          ],
        }),
      );

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        expect(validateRegistryClosure(join(root, "registry", "registry.json"))).toBe(false);

        const diagnostics = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
        expect(diagnostics).toContain("[REGISTRY_BUILD_ENV_READ]");
        expect(diagnostics).toContain("src/hooks/use-env-read.ts reads process.env, NODE_ENV");
      } finally {
        errorSpy.mockRestore();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
