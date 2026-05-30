import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  transformUiPublicRegistryKeysImportContent,
} from "../../../scripts/transform-public-registry-keys-imports";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");
const PUBLIC_REGISTRY_DIR = resolve(ROOT, "public/r");
const RELATIVE_JS_IMPORT =
  /((?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(["']))(\.{1,2}\/[^"']+)\.js\2/g;

interface RegistryFile {
  path: string;
  content?: string;
  type?: string;
  target?: string;
}

interface RegistryItem {
  name: string;
  type?: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: RegistryFile[];
  meta?: {
    client?: boolean;
    hidden?: boolean;
  };
}

interface Registry {
  items?: RegistryItem[];
}

function readSourceRegistry(): Registry {
  return JSON.parse(readFileSync(resolve(ROOT, "registry/registry.json"), "utf-8")) as Registry;
}

interface PublicRegistryItem {
  name: string;
  dependencies?: string[];
  files?: Array<{ path: string; content?: string }>;
}

function readPublicRegistryItems(): PublicRegistryItem[] {
  const items: PublicRegistryItem[] = [];
  for (const entry of readdirSync(PUBLIC_REGISTRY_DIR)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;
    items.push(JSON.parse(readFileSync(resolve(PUBLIC_REGISTRY_DIR, entry), "utf-8")) as PublicRegistryItem);
  }
  return items;
}

function findRelativeJsImportSpecifiers(content: string): string[] {
  return [...content.matchAll(RELATIVE_JS_IMPORT)].map((match) => `${match[3]}.js`);
}

describe("Part A: no .js import leaks in public registry copy content", () => {
  it("public registry item files do not contain relative .js import specifiers", () => {
    const leaks: string[] = [];
    for (const item of readPublicRegistryItems()) {
      for (const file of item.files ?? []) {
        if (typeof file.content !== "string") continue;
        file.content.split("\n").forEach((line, i) => {
          if (findRelativeJsImportSpecifiers(line).length > 0) {
            leaks.push(`${item.name}/${file.path}:${i + 1}: ${line.trim()}`);
          }
        });
      }
    }
    expect(leaks, `Found .js import leaks:\n${leaks.join("\n")}`).toEqual([]);
  });

  it("detects from, side-effect, dynamic, and require .js import forms", () => {
    const content = [
      'import { value } from "./value.js";',
      'import "./setup.js";',
      'const lazy = import("./lazy.js");',
      'const required = require("./required.js");',
    ].join("\n");

    expect(findRelativeJsImportSpecifiers(content)).toEqual([
      "./value.js",
      "./setup.js",
      "./lazy.js",
      "./required.js",
    ]);
  });

  it("transform strips from, side-effect, dynamic, and require relative .js import forms", () => {
    const input = [
      'import { value } from "./value.js";',
      'import "./setup.js";',
      'const lazy = import("./lazy.js");',
      'const required = require("./required.js");',
    ].join("\n");

    const result = transformUiPublicRegistryKeysImportContent(input);

    expect(findRelativeJsImportSpecifiers(result)).toEqual([]);
    expect(result).toContain('import "./setup";');
  });
});

describe("Part B: unknown @diffgazer/keys copy imports fail validation", () => {
  it("known imports are rewritten successfully", () => {
    const input = `import { useNavigation } from "@diffgazer/keys";`;
    const result = transformUiPublicRegistryKeysImportContent(input);
    expect(result).toContain("@/hooks/use-navigation");
    expect(result).not.toContain("@diffgazer/keys");
  });

  it("throws on unknown @diffgazer/keys import specifiers", () => {
    const input = `import { unknownExport } from "@diffgazer/keys";`;
    expect(() => transformUiPublicRegistryKeysImportContent(input)).toThrow(
      /Unknown @diffgazer\/keys import specifiers/,
    );
  });

  it("throws when mixing known and unknown specifiers", () => {
    const input = `import { useNavigation, somethingUnknown } from "@diffgazer/keys";`;
    expect(() => transformUiPublicRegistryKeysImportContent(input)).toThrow(
      /somethingUnknown/,
    );
  });
});

describe("Part C: CSS-heavy components declare CSS in registry metadata", () => {
  const CSS_HEAVY_COMPONENTS = ["dialog", "command-palette"];

  it.each(CSS_HEAVY_COMPONENTS)(
    "%s depends on dialog-shell which declares component CSS",
    (componentName) => {
      const registry = readSourceRegistry();
      const item = registry.items?.find((i) => i.name === componentName);
      expect(item, `${componentName} must exist in registry`).toBeDefined();

      const deps = item?.registryDependencies ?? [];
      expect(deps).toContain("dialog-shell");

      const dialogShell = registry.items?.find((i) => i.name === "dialog-shell");
      expect(dialogShell).toBeDefined();

      const cssFile = dialogShell?.files?.find((f) => f.path.endsWith(".css"));
      expect(cssFile, "dialog-shell must include a CSS file").toBeDefined();
      expect(cssFile?.type).toBe("registry:style");
      expect(cssFile?.target).toMatch(/\.css$/);
    },
  );
});

describe("Part D: public surface items are intentional", () => {
  const HIDDEN_ITEMS = [
    "focus",
    "resolve-tab-target",
    "diff",
    "input-variants",
    "search",
    "selectable-variants",
    "step-status",
  ];

  it.each(HIDDEN_ITEMS)(
    "%s is marked hidden in registry metadata",
    (itemName) => {
      const registry = readSourceRegistry();
      const item = registry.items?.find((i) => i.name === itemName);
      expect(item, `${itemName} must exist in registry`).toBeDefined();
      expect(item?.meta?.hidden).toBe(true);
    },
  );

  it("hidden items are not exposed in package.json exports", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8")) as {
      exports?: Record<string, unknown>;
    };
    const exports = pkg.exports ?? {};

    for (const name of HIDDEN_ITEMS) {
      expect(exports).not.toHaveProperty(`./lib/${name}`);
    }
  });

  const PUBLIC_LIB_ITEMS = [
    "selectable-collection",
    "compose-refs",
  ];

  it.each(PUBLIC_LIB_ITEMS)(
    "%s is public and has a package.json export",
    (itemName) => {
      const registry = readSourceRegistry();
      const item = registry.items?.find((i) => i.name === itemName);
      expect(item, `${itemName} must exist in registry`).toBeDefined();
      expect(item?.meta?.hidden).toBeFalsy();

      const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8")) as {
        exports?: Record<string, unknown>;
      };
      expect(pkg.exports).toHaveProperty(`./lib/${itemName}`);
    },
  );
});

describe("Part E: stale dependency metadata removed", () => {
  it("overflow does not declare class-variance-authority as a dependency", () => {
    const registry = readSourceRegistry();
    const overflow = registry.items?.find((i) => i.name === "overflow");
    expect(overflow, "overflow must exist in registry").toBeDefined();
    expect(overflow?.dependencies ?? []).not.toContain("class-variance-authority");
  });

  it("overflow public registry item does not declare class-variance-authority", () => {
    const items = readPublicRegistryItems();
    const overflow = items.find((i) => i.name === "overflow");
    expect(overflow, "overflow must exist in public registry").toBeDefined();
    expect(overflow?.dependencies ?? []).not.toContain("class-variance-authority");
  });
});

describe("Part F: CSS side-effect imports stripped from public registry content", () => {
  it("no public registry file content contains JS side-effect CSS imports", () => {
    const CSS_SIDE_EFFECT_IMPORT = /^\s*import\s+["'][^"']+\.css["'];?\s*$/m;
    const leaks: string[] = [];
    for (const item of readPublicRegistryItems()) {
      for (const file of item.files ?? []) {
        if (typeof file.content !== "string") continue;
        file.content.split("\n").forEach((line, i) => {
          if (CSS_SIDE_EFFECT_IMPORT.test(line)) {
            leaks.push(`${item.name}/${file.path}:${i + 1}: ${line.trim()}`);
          }
        });
      }
    }
    expect(leaks, `Found CSS side-effect import leaks:\n${leaks.join("\n")}`).toEqual([]);
  });

  it("transform strips CSS side-effect imports from content", () => {
    const input = [
      '"use client";',
      '',
      'import "../shared/stepper.css";',
      '',
      'import { Stepper } from "./stepper";',
    ].join("\n");

    const result = transformUiPublicRegistryKeysImportContent(input);

    expect(result).not.toContain("stepper.css");
    expect(result).toContain('import { Stepper } from "./stepper";');
  });

  it("does not strip CSS @import inside CSS file content", () => {
    const cssContent = '@import "./theme-base.css";\n\n:root { --bg: #000; }';
    const result = transformUiPublicRegistryKeysImportContent(cssContent);
    expect(result).toContain('@import "./theme-base.css"');
  });
});

describe("Part G: export-from re-exports rewritten in public registry", () => {
  it("no public registry file content contains export-from @diffgazer/keys", () => {
    const EXPORT_FROM_KEYS = /export\s+\{[^}]*\}\s+from\s+["']@diffgazer\/keys["']/;
    const leaks: string[] = [];
    for (const item of readPublicRegistryItems()) {
      for (const file of item.files ?? []) {
        if (typeof file.content !== "string") continue;
        if (EXPORT_FROM_KEYS.test(file.content)) {
          leaks.push(`${item.name}/${file.path}`);
        }
      }
    }
    expect(leaks, `Found export-from @diffgazer/keys leaks:\n${leaks.join("\n")}`).toEqual([]);
  });
});

describe("Part H: stepper CSS declared in source registry", () => {
  const STEPPER_COMPONENTS = ["stepper", "horizontal-stepper"];

  it.each(STEPPER_COMPONENTS)(
    "%s declares stepper.css in its files array",
    (componentName) => {
      const registry = readSourceRegistry();
      const item = registry.items?.find((i) => i.name === componentName);
      expect(item, `${componentName} must exist in registry`).toBeDefined();

      const cssFile = item?.files?.find((f) => f.path.endsWith("stepper.css"));
      expect(cssFile, `${componentName} must include stepper.css`).toBeDefined();
      expect(cssFile?.type).toBe("registry:style");
      expect(cssFile?.target).toBe("~/styles/stepper.css");
    },
  );
});
