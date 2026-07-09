import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Registry, RegistryItem } from "@diffgazer/registry/schemas";
import { REGISTRY_ITEM_TYPE, RegistrySchema } from "@diffgazer/registry/schemas";
import { describe, expect, it } from "vitest";
import {
  extractRelativeImports as extractRegistryRelativeImports,
  validateContentFreshness,
  validatePublicTargetClosure,
} from "./validate-registry-closure.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_ROOT = resolve(__dirname, "..");
const PUBLIC_DIR = resolve(KEYS_ROOT, "public", "r");
const REGISTRY_PATH = resolve(KEYS_ROOT, "registry", "registry.json");
const DEMO_INDEX_PATH = resolve(KEYS_ROOT, "docs", "generated", "demo-index.ts");

function loadRegistry(): Registry {
  return RegistrySchema.parse(JSON.parse(readFileSync(REGISTRY_PATH, "utf-8")));
}

function loadPublicItem(name: string): RegistryItem {
  const itemPath = join(PUBLIC_DIR, `${name}.json`);
  return parseRegistryEntry(JSON.parse(readFileSync(itemPath, "utf-8")));
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

function parseRegistryEntry(raw: unknown): RegistryItem {
  const [item] = RegistrySchema.parse({ items: [raw] }).items;
  if (!item) throw new Error("Missing registry item");
  return item;
}

describe("public registry target paths", () => {
  const registry = loadRegistry();
  const publicRegistry = loadPublicRegistry();

  const visibleItems = registry.items.filter((item) => !item.meta?.hidden);
  for (const sourceItem of visibleItems) {
    const expectedTargets = sourceItem.files.map((file) => file.target ?? file.path).sort();

    it(`${sourceItem.name} public registry targets match source registry`, () => {
      const publicItem = getRegistryItem(publicRegistry, sourceItem.name);
      const publicTargets = publicItem.files.map((file) => file.target ?? file.path).sort();
      expect(publicTargets).toEqual(expectedTargets);
    });

    it(`${sourceItem.name} target paths land under installable directories`, () => {
      for (const target of expectedTargets) {
        expect(
          target.startsWith("src/hooks/"),
          `${sourceItem.name}: target ${target} must live under src/hooks/ for shadcn install`,
        ).toBe(true);
      }
    });
  }
});

describe("public registry import parser coverage", () => {
  it("extracts static, side-effect, dynamic, and require relative imports", () => {
    const imports = extractRegistryRelativeImports(
      [
        'import { value } from "./value.js";',
        'export { value } from "./exported.js";',
        'import "./setup.js";',
        'const lazy = import("./lazy.js");',
        'const required = require("./required.js");',
      ].join("\n"),
    );

    expect(imports).toEqual([
      "./value.js",
      "./exported.js",
      "./lazy.js",
      "./required.js",
      "./setup.js",
    ]);
  });
});

describe("focusable as transitive dependency", () => {
  it("focusable is marked hidden in source registry", () => {
    const registry = loadRegistry();
    const focusable = getRegistryItem(registry, "focusable");
    expect(focusable.meta?.hidden).toBe(true);
  });

  it("focusable is excluded from public registry index but has per-item JSON", () => {
    const publicRegistry = loadPublicRegistry();
    const inIndex = publicRegistry.items.some((item) => item.name === "focusable");
    expect(inIndex).toBe(false);

    const publicItem = loadPublicItem("focusable");
    expect(publicItem.meta?.hidden).toBe(true);
  });

  it("focusable is included as a file in navigation and focus-trap items", () => {
    const registry = loadRegistry();
    const navigation = getRegistryItem(registry, "navigation");
    const focusTrap = getRegistryItem(registry, "focus-trap");

    expect(navigation.files.some((file) => file.path.includes("focusable"))).toBe(true);
    expect(focusTrap.files.some((file) => file.path.includes("focusable"))).toBe(true);
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

  it("standalone hooks have public registry items", () => {
    const publicRegistry = loadPublicRegistry();
    const publicNames = new Set(
      publicRegistry.items.filter((item) => !item.meta?.hidden).map((item) => item.name),
    );

    for (const [hookName, registryName] of Object.entries(STANDALONE_REGISTRY_NAMES)) {
      expect(publicNames.has(registryName), `${hookName} should be public as ${registryName}`).toBe(
        true,
      );
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
  it("all public registry items pass target closure check", () => {
    expect(validatePublicTargetClosure(PUBLIC_DIR)).toEqual([]);
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

  it("current public registry embedded content is fresh against source", () => {
    expect(validateContentFreshness(PUBLIC_DIR, KEYS_ROOT)).toEqual([]);
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

  it("declares react as a peer dependency and exports the main entry point", () => {
    const pkgPath = resolve(KEYS_ROOT, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

    expect(pkg.peerDependencies).toBeDefined();
    expect(pkg.peerDependencies.react).toBeDefined();

    expect(pkg.exports).toBeDefined();
    expect(pkg.exports["."]).toBeDefined();
    expect(pkg.exports["."].types).toBeDefined();
    expect(pkg.exports["."].import).toBeDefined();
  });
});
