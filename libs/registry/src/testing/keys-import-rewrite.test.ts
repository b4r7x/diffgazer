import { describe, expect, it } from "vitest";
import { rewriteKeysPackageImportsInContent } from "../keys-import-rewrite.js";

describe("rewriteKeysPackageImportsInContent", () => {
  it("rewrites multiline @diffgazer/keys imports", () => {
    const input = [
      '"use client";',
      "",
      "import {",
      "  type UseFocusRestoreOptions,",
      "  useFocusRestore,",
      '} from "@diffgazer/keys";',
    ].join("\n");

    const output = rewriteKeysPackageImportsInContent(input, {
      renderImport: (specifiers, target, quote, indent) =>
        `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
    });

    expect(output).toContain("@/hooks/use-focus-restore");
    expect(output).not.toContain("@diffgazer/keys");
  });

  it("skips shim self-import targets when shimHookBasename is set", () => {
    const input = 'import { useScrollLock } from "@diffgazer/keys";';

    const output = rewriteKeysPackageImportsInContent(input, {
      shimHookBasename: "use-scroll-lock",
      renderImport: (specifiers, target, quote, indent) =>
        `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
    });

    expect(output).toBe(input);
  });

  it("throws on unknown specifiers", () => {
    expect(() =>
      rewriteKeysPackageImportsInContent('import { unknownExport } from "@diffgazer/keys";', {
        renderImport: (specifiers, target, quote, indent) =>
          `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
      }),
    ).toThrow(/Unknown @diffgazer\/keys import specifiers/);
  });
});
