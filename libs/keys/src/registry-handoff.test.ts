import { readFileSync, readdirSync } from "node:fs";
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

function extractRelativeImports(content: string): string[] {
  const imports = new Set<string>();
  const patterns = [
    /import\s+(?:type\s+)?[^"']*?\s+from\s+["'](\.[^"']+)["']/g,
    /export\s+(?:type\s+)?[^"']*?\s+from\s+["'](\.[^"']+)["']/g,
    /import\s*\(\s*["'](\.[^"']+)["']\s*\)/g,
    /require\s*\(\s*["'](\.[^"']+)["']\s*\)/g,
    /import\s+["'](\.[^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) imports.add(match[1]);
    }
  }
  return [...imports];
}

const EXPECTED_TARGETS: Record<string, string[]> = {
  navigation: [
    "@hooks/use-navigation.ts",
    "@hooks/utils/navigation-dispatch.ts",
    "@hooks/utils/navigation-items.ts",
    "@hooks/utils/navigation-directions.ts",
    "@hooks/utils/keyboard-utils.ts",
    "@hooks/utils/focusable.ts",
  ],
  "focus-restore": [
    "@hooks/use-focus-restore.ts",
    "@hooks/utils/focus-restore.ts",
  ],
  "focus-trap": [
    "@hooks/use-focus-trap.ts",
    "@hooks/use-focus-restore.ts",
    "@hooks/utils/focus-restore.ts",
    "@hooks/utils/focusable.ts",
  ],
  "scroll-lock": [
    "@hooks/use-scroll-lock.ts",
  ],
  focusable: [
    "@hooks/utils/focusable.ts",
  ],
};

describe("public registry target paths", () => {
  const registry = loadRegistry();
  const publicRegistry = loadPublicRegistry();

  for (const [itemName, expectedTargets] of Object.entries(EXPECTED_TARGETS)) {
    it(`${itemName} has correct target paths in source registry`, () => {
      const item = registry.items.find((i) => i.name === itemName);
      expect(item).toBeDefined();
      const targets = item!.files.map((f) => f.target);
      for (const expected of expectedTargets) {
        expect(targets).toContain(expected);
      }
    });

    it(`${itemName} has correct target paths in public registry`, () => {
      const item = publicRegistry.items.find((i) => i.name === itemName);
      expect(item).toBeDefined();
      const targets = item!.files.map((f) => f.target);
      for (const expected of expectedTargets) {
        expect(targets).toContain(expected);
      }
    });
  }
});

describe("public registry import rewriting", () => {
  const PUBLIC_ITEMS = ["navigation", "focus-restore", "focus-trap", "scroll-lock", "focusable"];

  for (const itemName of PUBLIC_ITEMS) {
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

      it("all relative imports resolve to files within the item", () => {
        const targetPaths = new Set<string>();
        for (const file of item.files) {
          const target = file.target ?? file.path;
          targetPaths.add(target.replace(/\.(ts|tsx)$/, ""));
        }

        for (const file of item.files) {
          if (typeof file.content !== "string") continue;
          const target = file.target ?? file.path;
          const targetDir = posix.dirname(target);
          const imports = extractRelativeImports(file.content);

          for (const imp of imports) {
            const resolved = posix.normalize(posix.join(targetDir, imp));
            const resolvedNoExt = resolved.replace(/\.(ts|tsx)$/, "");

            const found =
              targetPaths.has(resolvedNoExt) ||
              targetPaths.has(resolved);

            expect(
              found,
              `In ${target}: import "${imp}" resolves to "${resolvedNoExt}" which is not in item files [${[...targetPaths].join(", ")}]`,
            ).toBe(true);
          }
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
      ["src/hooks/use-demo.ts", "@hooks/use-demo.ts"],
      ["src/hooks/setup.ts", "@hooks/utils/setup.ts"],
      ["src/hooks/lazy.ts", "@hooks/lazy.ts"],
      ["src/hooks/required.ts", "@hooks/utils/required.ts"],
      ["src/hooks/value.ts", "@hooks/value.ts"],
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
      "@hooks/use-demo.ts",
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
    const focusable = registry.items.find((i) => i.name === "focusable");
    expect(focusable).toBeDefined();
    expect(focusable!.meta?.hidden).toBe(true);
  });

  it("focusable is marked hidden in public registry", () => {
    const publicRegistry = loadPublicRegistry();
    const focusable = publicRegistry.items.find((i) => i.name === "focusable");
    expect(focusable).toBeDefined();
    expect(focusable!.meta?.hidden).toBe(true);
  });

  it("focusable is included as a file in navigation and focus-trap items", () => {
    const registry = loadRegistry();
    const navigation = registry.items.find((i) => i.name === "navigation");
    const focusTrap = registry.items.find((i) => i.name === "focus-trap");

    expect(navigation!.files.some((f) => f.path.includes("focusable"))).toBe(true);
    expect(focusTrap!.files.some((f) => f.path.includes("focusable"))).toBe(true);
  });
});

describe("provider-backed hooks are package-only", () => {
  const PACKAGE_ONLY_EXPORTS = [
    "KeyboardProvider",
    "useKey",
    "useScope",
    "useScopedNavigation",
    "useFocusZone",
    "keys",
    "useKeyboardContext",
    "useOptionalKeyboardContext",
  ];

  const STANDALONE_EXPORTS = [
    "useNavigation",
    "useFocusRestore",
    "useFocusTrap",
    "useScrollLock",
  ];

  it("package-only exports are not in any public registry item", () => {
    const publicRegistry = loadPublicRegistry();
    const allPublicContent = publicRegistry.items
      .filter((item) => !item.meta?.hidden)
      .map((item) => item.name);

    // Registry items only cover standalone hooks
    for (const hookName of PACKAGE_ONLY_EXPORTS) {
      // No registry item is named after a package-only hook
      const asRegistryName = hookName
        .replace(/^use/, "")
        .replace(/([A-Z])/g, "-$1")
        .toLowerCase()
        .replace(/^-/, "");
      const found = allPublicContent.includes(asRegistryName);
      expect(
        found,
        `Package-only export "${hookName}" should not have a public registry item`,
      ).toBe(false);
    }
  });

  it("standalone hooks have public registry items", () => {
    const publicRegistry = loadPublicRegistry();
    const publicNames = new Set(
      publicRegistry.items
        .filter((item) => !item.meta?.hidden)
        .map((item) => item.name),
    );

    const expectedNames: Record<string, string> = {
      useNavigation: "navigation",
      useFocusRestore: "focus-restore",
      useFocusTrap: "focus-trap",
      useScrollLock: "scroll-lock",
    };

    for (const hookName of STANDALONE_EXPORTS) {
      const registryName = expectedNames[hookName]!;
      expect(publicNames.has(registryName)).toBe(true);
    }
  });

  it("README documents package-only APIs", () => {
    const readme = readFileSync(resolve(KEYS_ROOT, "README.md"), "utf-8");
    expect(readme).toContain("Package-only");
    for (const api of ["KeyboardProvider", "useKey", "useScope", "useScopedNavigation", "useFocusZone"]) {
      expect(readme).toContain(api);
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

      const targetPaths = new Set<string>();
      for (const file of item.files) {
        const target = (file.target ?? file.path).replace(/\.(ts|tsx)$/, "");
        targetPaths.add(target);
      }

      for (const file of item.files) {
        if (typeof file.content !== "string") continue;

        const target = file.target ?? file.path;
        const targetDir = posix.dirname(target);
        const imports = extractRelativeImports(file.content);

        for (const imp of imports) {
          const resolved = posix.normalize(posix.join(targetDir, imp))
            .replace(/\.(ts|tsx)$/, "");

          expect(
            targetPaths.has(resolved),
            `[${item.name}] target import "${imp}" from ${target} resolves to "${resolved}" which is not in targets [${[...targetPaths].join(", ")}]`,
          ).toBe(true);
        }
      }
    }
  });

  it("detects broken target-path imports in a synthetic bad item", () => {
    const badItem: RegistryItem = {
      name: "test-bad",
      type: "registry:hook",
      files: [
        {
          path: "src/hooks/use-test.ts",
          target: "@hooks/use-test.ts",
          content: 'import { foo } from "./utils/missing";\n',
          type: "registry:hook",
        },
      ],
    };

    const targetPaths = new Set(
      badItem.files.map((f) => (f.target ?? f.path).replace(/\.(ts|tsx)$/, "")),
    );

    let brokenImportFound = false;
    for (const file of badItem.files) {
      if (typeof file.content !== "string") continue;
      const target = file.target ?? file.path;
      const targetDir = posix.dirname(target);
      for (const imp of extractRelativeImports(file.content)) {
        const resolved = posix.normalize(posix.join(targetDir, imp))
          .replace(/\.(ts|tsx)$/, "");
        if (!targetPaths.has(resolved)) brokenImportFound = true;
      }
    }

    expect(brokenImportFound).toBe(true);
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
