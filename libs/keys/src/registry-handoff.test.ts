import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  rewriteImportsForTargetLayout,
  transformKeysPublicRegistryImportContent,
} from "../scripts/transform-public-registry-imports.js";
import {
  extractRelativeImports as extractRegistryRelativeImports,
} from "../scripts/validate-registry-closure.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_ROOT = resolve(__dirname, "..");
const PUBLIC_DIR = resolve(KEYS_ROOT, "public", "r");
const REGISTRY_PATH = resolve(KEYS_ROOT, "registry", "registry.json");
const DEMO_INDEX_PATH = resolve(KEYS_ROOT, "docs", "generated", "demo-index.ts");
const RELATIVE_JS_IMPORT =
  /((?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(["']))(\.{1,2}\/[^"']+)\.js\2/g;

interface RegistryFile {
  path: string;
  type: string;
  target?: string;
  content?: string;
}

interface RegistryItem {
  name: string;
  type: string;
  files: RegistryFile[];
  meta?: { client?: boolean; hidden?: boolean };
}

interface Registry {
  items: RegistryItem[];
}

function loadRegistry(): Registry {
  return JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
}

function loadPublicItem(name: string): RegistryItem {
  const itemPath = join(PUBLIC_DIR, `${name}.json`);
  return JSON.parse(readFileSync(itemPath, "utf-8"));
}

function loadPublicRegistry(): Registry {
  return JSON.parse(readFileSync(join(PUBLIC_DIR, "registry.json"), "utf-8"));
}

function getRegistryItem(registry: Registry, name: string): RegistryItem {
  const item = registry.items.find((item) => item.name === name);
  if (!item) {
    throw new Error(`Missing registry item: ${name}`);
  }
  return item;
}

interface MissingTargetImport {
  importPath: string;
  importer: string;
  resolved: string;
}

function collectMissingTargetImports(item: RegistryItem): MissingTargetImport[] {
  const targetPaths = new Set(
    item.files.map((file) => (file.target ?? file.path).replace(/\.(ts|tsx)$/, "")),
  );
  const missing: MissingTargetImport[] = [];

  for (const file of item.files) {
    if (typeof file.content !== "string") continue;

    const importer = file.target ?? file.path;
    const targetDir = posix.dirname(importer);
    for (const importPath of extractRegistryRelativeImports(file.content)) {
      const resolved = posix.normalize(posix.join(targetDir, importPath))
        .replace(/\.(ts|tsx)$/, "");
      if (!targetPaths.has(resolved)) {
        missing.push({ importPath, importer, resolved });
      }
    }
  }

  return missing;
}

describe("public registry target paths", () => {
  const registry = loadRegistry();
  const publicRegistry = loadPublicRegistry();

  // The source registry is the single source of truth for install layout.
  // The public registry must mirror it exactly (hidden items are excluded
  // from the public index but still have per-item JSON files).
  const visibleItems = registry.items.filter(
    (item) => !item.meta?.hidden,
  );
  for (const sourceItem of visibleItems) {
    const expectedTargets = sourceItem.files
      .map((file) => file.target ?? file.path)
      .sort();

    it(`${sourceItem.name} public registry targets match source registry`, () => {
      const publicItem = getRegistryItem(publicRegistry, sourceItem.name);
      const publicTargets = publicItem.files
        .map((file) => file.target ?? file.path)
        .sort();
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

describe("public registry import rewriting", () => {
  const publicItems = readdirSync(PUBLIC_DIR)
    .filter((entry) => entry.endsWith(".json") && entry !== "registry.json")
    .map((entry) => entry.replace(/\.json$/, ""));

  for (const itemName of publicItems) {
    describe(itemName, () => {
      const item = loadPublicItem(itemName);

      it("has no relative .js imports in content", () => {
        for (const file of item.files) {
          if (typeof file.content !== "string") continue;
          const jsImports = file.content.match(RELATIVE_JS_IMPORT);
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

    expect(transformKeysPublicRegistryImportContent(input)).toBe([
      'import { value } from "./value";',
      'export { value } from "./exported";',
      'import "./setup";',
      'const lazy = import("./lazy");',
      'const required = require("./required");',
    ].join("\n"));
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

    expect(rewriteImportsForTargetLayout(
      stripped,
      "src/hooks/use-demo.ts",
      "src/hooks/use-demo.ts",
      pathMap,
    )).toBe([
      'import { value } from "./value";',
      'import "./utils/setup";',
      'const lazy = import("./lazy");',
      'const required = require("./utils/required");',
    ].join("\n"));
  });

  it("extracts static, side-effect, dynamic, and require relative imports", () => {
    const imports = extractRegistryRelativeImports([
      'import { value } from "./value.js";',
      'export { value } from "./exported.js";',
      'import "./setup.js";',
      'const lazy = import("./lazy.js");',
      'const required = require("./required.js");',
    ].join("\n"));

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
      publicRegistry.items
        .filter((item) => !item.meta?.hidden)
        .map((item) => item.name),
    );

    for (const [hookName, registryName] of Object.entries(STANDALONE_REGISTRY_NAMES)) {
      expect(publicNames.has(registryName), `${hookName} should be public as ${registryName}`).toBe(true);
    }
  });

  it("README documents package-only APIs", () => {
    const readme = readFileSync(resolve(KEYS_ROOT, "README.md"), "utf-8");
    expect(readme).toContain("Package-only");
    for (const api of ["KeyboardProvider", "useKey", "useScope", "useScopedNavigation", "useActionRowNavigation", "useFocusZone"]) {
      expect(readme).toContain(api);
    }
  });

  it("package-only hook docs do not render copy-install commands", () => {
    for (const name of packageOnlyHookDocs) {
      const doc = readFileSync(resolve(KEYS_ROOT, "docs", "content", "hooks", `${name}.mdx`), "utf-8");
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
    for (const entry of readdirSync(PUBLIC_DIR)) {
      if (!entry.endsWith(".json") || entry === "registry.json") continue;

      const item: RegistryItem = JSON.parse(
        readFileSync(join(PUBLIC_DIR, entry), "utf-8"),
      );
      if (item.type !== "registry:hook") continue;

      expect(collectMissingTargetImports(item)).toEqual([]);
    }
  });

  it("detects broken target-path imports in a synthetic bad item", () => {
    const badItem: RegistryItem = {
      name: "test-bad",
      type: "registry:hook",
      files: [
        {
          path: "src/hooks/use-test.ts",
          target: "src/hooks/use-test.ts",
          content: 'import { foo } from "./utils/missing";\n',
          type: "registry:hook",
        },
      ],
    };

    expect(collectMissingTargetImports(badItem)).toEqual([
      {
        importPath: "./utils/missing",
        importer: "src/hooks/use-test.ts",
        resolved: "src/hooks/utils/missing",
      },
    ]);
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
