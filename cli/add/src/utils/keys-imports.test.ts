import { describe, expect, test } from "vitest";
import { rewriteLocalImportsForKeysPackage } from "./keys-imports.js";

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
