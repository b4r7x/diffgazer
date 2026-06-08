import { describe, expect, test } from "vitest";
import {
  rewriteKeysPackageImportsForCopy,
  rewriteLocalImportsForKeysPackage,
  rewriteRelativeJsExtensionsForCopy,
} from "./transform.js";

describe("rewriteLocalImportsForKeysPackage", () => {
  test("consolidates mixed type and value @/hooks imports into one @diffgazer/keys import", () => {
    const source = [
      `import { useNavigation } from "@/hooks/use-navigation";`,
      `import type { NavigationOptions } from "@/hooks/use-navigation";`,
      `export function Component() {}`,
    ].join("\n");

    const result = rewriteLocalImportsForKeysPackage(source);
    const importLines = result.split("\n").filter((line) => line.includes("@diffgazer/keys"));

    expect(importLines).toHaveLength(1);
    expect(importLines[0]).toContain(`from "@diffgazer/keys"`);
    expect(importLines[0]).toContain("useNavigation");
    expect(importLines[0]).toContain("type NavigationOptions");
  });

  test("does not double the type keyword when a type-only import is consolidated", () => {
    const source = [
      `import { useNavigation } from "@/hooks/use-navigation";`,
      `import type { NavigationOptions, NavigationDirection } from "@/hooks/use-navigation";`,
    ].join("\n");

    const result = rewriteLocalImportsForKeysPackage(source);

    expect(result).not.toMatch(/type\s+type/);
    expect(result).toContain("type NavigationOptions");
    expect(result).toContain("type NavigationDirection");
  });

  test("leaves content without @/hooks keys imports unchanged", () => {
    const source = `import { cn } from "@/lib/utils";\nexport const x = 1;`;
    expect(rewriteLocalImportsForKeysPackage(source)).toBe(source);
  });
});

describe("rewriteKeysPackageImportsForCopy", () => {
  test("rewrites multiline @diffgazer/keys imports", () => {
    const source = [
      "import {",
      "  type UseFocusRestoreOptions,",
      "  useFocusRestore,",
      '} from "@diffgazer/keys";',
    ].join("\n");

    const result = rewriteKeysPackageImportsForCopy(source);
    expect(result).toContain("@/hooks/use-focus-restore");
    expect(result).not.toContain("@diffgazer/keys");
  });

  test("throws when an @diffgazer/keys specifier has no local hook target", () => {
    const source = `import { thisExportDoesNotExist } from "@diffgazer/keys";`;
    expect(() => rewriteKeysPackageImportsForCopy(source)).toThrow(
      /Unknown @diffgazer\/keys import specifiers/,
    );
  });
});

describe("rewriteRelativeJsExtensionsForCopy", () => {
  // Copy/shadcn consumers resolve relative specifiers extensionless. The strip
  // must cover every form the validate-artifacts gate flags, including the bare
  // side-effect import, or the gate could fail a copied file with no fixer.
  test("strips .js from static, side-effect, dynamic, and require relative imports", () => {
    const source = [
      `import { value } from "./value.js";`,
      `export { value } from "./exported.js";`,
      `import "./setup.js";`,
      `const lazy = import("./lazy.js");`,
      `const required = require("./required.js");`,
    ].join("\n");

    expect(rewriteRelativeJsExtensionsForCopy(source)).toBe(
      [
        `import { value } from "./value";`,
        `export { value } from "./exported";`,
        `import "./setup";`,
        `const lazy = import("./lazy");`,
        `const required = require("./required");`,
      ].join("\n"),
    );
  });

  test("leaves package and extensionless relative specifiers unchanged", () => {
    const source = [
      `import { useNavigation } from "@diffgazer/keys";`,
      `import { x } from "./already-clean";`,
    ].join("\n");
    expect(rewriteRelativeJsExtensionsForCopy(source)).toBe(source);
  });
});
