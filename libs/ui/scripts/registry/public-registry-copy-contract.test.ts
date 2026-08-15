import { resolve } from "node:path";
import { findRelativeJsSpecifiers, readRegistryItem } from "@diffgazer/registry";
import { describe, expect, it } from "vitest";
import { PUBLIC_REGISTRY_DIR, readPublicRegistryItems } from "./registry-test-helpers.js";

describe("committed public registry copy does not leak internal import forms", () => {
  it("public registry item files do not contain relative .js import specifiers", () => {
    const leaks: string[] = [];
    for (const item of readPublicRegistryItems()) {
      for (const file of item.files) {
        if (typeof file.content !== "string") continue;
        const specifiers = findRelativeJsSpecifiers(file.content);
        if (specifiers.length > 0) {
          leaks.push(`${item.name}/${file.path}: ${specifiers.join(", ")}`);
        }
      }
    }
    expect(leaks, `Found .js import leaks:\n${leaks.join("\n")}`).toEqual([]);
  });

  it("no public registry file content contains JS side-effect CSS imports", () => {
    const CSS_SIDE_EFFECT_IMPORT = /^\s*import\s+["'][^"']+\.css["'];?\s*$/m;
    const leaks: string[] = [];
    for (const item of readPublicRegistryItems()) {
      for (const file of item.files) {
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

  it("no public registry file content contains bare @diffgazer/keys imports", () => {
    const BARE_KEYS_IMPORT =
      /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']@diffgazer\/keys["']/;
    const leaks: string[] = [];
    for (const item of readPublicRegistryItems()) {
      for (const file of item.files) {
        if (typeof file.content !== "string") continue;
        if (BARE_KEYS_IMPORT.test(file.content)) {
          leaks.push(`${item.name}/${file.path}`);
        }
      }
    }
    expect(leaks, `Found bare @diffgazer/keys leaks:\n${leaks.join("\n")}`).toEqual([]);
  });
});

describe("copied listbox preserves the keys hook boundary", () => {
  it("ships listbox composed-tree helpers from the copied element guards", () => {
    const listbox = readRegistryItem(resolve(PUBLIC_REGISTRY_DIR, "listbox.json"));
    const hook = listbox.files?.find((file) => file.path.endsWith("use-listbox.ts"));

    expect(hook?.content).toContain(
      'import { composedClosest, composedContains, isEditableElement } from "@/hooks/utils/element-guards";',
    );
    expect(hook?.content).not.toMatch(
      /import\s*\{[^}]*composed(?:Closest|Contains)[^}]*\}\s*from\s*["']@\/hooks\/use-navigation["']/s,
    );
  });
});
