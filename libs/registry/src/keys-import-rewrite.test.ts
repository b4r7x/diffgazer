import { describe, expect, it } from "vitest";
import { rewriteKeysPackageImportsInContent } from "./keys-import-rewrite.js";

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

  it("rewrites navigation item values and their public type to the same copy utility", () => {
    const input = [
      "import {",
      "  findNavigationItemByValue,",
      "  getNavigationItems,",
      "  type NavigationItemType,",
      '} from "@diffgazer/keys";',
    ].join("\n");

    const output = rewriteKeysPackageImportsInContent(input, {
      renderImport: (specifiers, target, quote, indent) =>
        `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
    });

    expect(output).toBe(
      'import { findNavigationItemByValue, getNavigationItems, type NavigationItemType } from "@/hooks/utils/navigation-items";',
    );
  });

  it("rewrites reachable and navigation imports to their copy utilities", () => {
    const input = 'import { findNavigationItemByValue, isReachable } from "@diffgazer/keys";';

    const output = rewriteKeysPackageImportsInContent(input, {
      renderImport: (specifiers, target, quote, indent) =>
        `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
    });

    expect(output).toBe(
      [
        'import { findNavigationItemByValue } from "@/hooks/utils/navigation-items";',
        'import { isReachable } from "@/hooks/utils/focusable";',
      ].join("\n"),
    );
  });

  it("rewrites composed tree helpers to the copied element guards", () => {
    const input =
      'import { composedClosest, composedContains, isEditableElement, useNavigation } from "@diffgazer/keys";';

    const output = rewriteKeysPackageImportsInContent(input, {
      renderImport: (specifiers, target, quote, indent) =>
        `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
    });

    expect(output).toBe(
      [
        'import { composedClosest, composedContains, isEditableElement } from "@/hooks/utils/element-guards";',
        'import { useNavigation } from "@/hooks/use-navigation";',
      ].join("\n"),
    );
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

  it("keeps mixed shim value and type specifiers while rewriting other targets", () => {
    const input =
      'import { type UseScrollLockOptions, useScrollLock, useNavigation } from "@diffgazer/keys";';

    const output = rewriteKeysPackageImportsInContent(input, {
      shimHookBasename: "use-scroll-lock",
      renderImport: (specifiers, target, quote, indent) =>
        `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
    });

    expect(output).toBe(
      [
        'import { type UseScrollLockOptions, useScrollLock } from "@diffgazer/keys";',
        'import { useNavigation } from "@/hooks/use-navigation";',
      ].join("\n"),
    );
  });

  it("rewrites declaration-level type imports", () => {
    const input = 'import type { UseFocusRestoreOptions } from "@diffgazer/keys";';

    const output = rewriteKeysPackageImportsInContent(input, {
      renderImport: (specifiers, target, quote, indent) =>
        `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
    });

    expect(output).toBe('import { type UseFocusRestoreOptions } from "@/hooks/use-focus-restore";');
  });

  it.each([
    ["default", 'import keys from "@diffgazer/keys";'],
    ["namespace", 'import * as keys from "@diffgazer/keys";'],
    ["side-effect", 'import "@diffgazer/keys";'],
    ["export", 'export { useKey } from "@diffgazer/keys";'],
    ["dynamic", 'const keys = import("@diffgazer/keys");'],
    ["require", 'const keys = require("@diffgazer/keys");'],
  ])("rejects residual %s root imports", (_form, input) => {
    expect(() =>
      rewriteKeysPackageImportsInContent(input, {
        renderImport: (specifiers, target, quote, indent) =>
          `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
      }),
    ).toThrow(/Unsupported @diffgazer\/keys root import/);
  });

  it("does not broaden the shim exception to unsupported import forms", () => {
    expect(() =>
      rewriteKeysPackageImportsInContent('const keys = import("@diffgazer/keys");', {
        shimHookBasename: "use-scroll-lock",
        renderImport: (specifiers, target, quote, indent) =>
          `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
      }),
    ).toThrow(/Unsupported @diffgazer\/keys root import/);
  });

  it.each([
    ["dynamic import", "const keys = import(`@diffgazer/keys`);"],
    ["require", "const keys = require(`@diffgazer/keys`);"],
  ])("rejects a template-literal %s", (_form, input) => {
    expect(() =>
      rewriteKeysPackageImportsInContent(input, {
        renderImport: (specifiers, target, quote, indent) =>
          `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
      }),
    ).toThrow(/Unsupported @diffgazer\/keys root import/);
  });

  it("rejects executable root imports inside template interpolations", () => {
    const input = `const keys = \`\${import("@diffgazer/keys")}:\${require("@diffgazer/keys")}\`;`;

    expect(() =>
      rewriteKeysPackageImportsInContent(input, {
        renderImport: (specifiers, target, quote, indent) =>
          `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
      }),
    ).toThrow(/Unsupported @diffgazer\/keys root import/);
  });

  it("preserves non-executable root import text inside a template literal", () => {
    const input = 'const example = `import("@diffgazer/keys"); require("@diffgazer/keys");`;';

    expect(
      rewriteKeysPackageImportsInContent(input, {
        renderImport: (specifiers, target, quote, indent) =>
          `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
      }),
    ).toBe(input);
  });

  it.each([
    ["known", `const example = 'import { useScrollLock } from "@diffgazer/keys";';`],
    ["unknown", `const example = 'import { unknownExport } from "@diffgazer/keys";';`],
  ])("ignores %s named imports inside ordinary quoted strings", (_kind, input) => {
    expect(
      rewriteKeysPackageImportsInContent(input, {
        renderImport: (specifiers, target, quote, indent) =>
          `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
      }),
    ).toBe(input);
  });

  it("throws on unknown specifiers", () => {
    expect(() =>
      rewriteKeysPackageImportsInContent(
        'import { isReachable, unknownExport } from "@diffgazer/keys";',
        {
          renderImport: (specifiers, target, quote, indent) =>
            `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`,
        },
      ),
    ).toThrow(/Unknown @diffgazer\/keys import specifiers: unknownExport/);
  });
});
