import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectRemovalTargets } from "./targets.js";
import type { FileRemovalVerdict } from "./types.js";

interface TestItem {
  name: string;
  files: Array<{ absolutePath: string }>;
  requires?: string[];
}

function buildOptions(
  tempDir: string,
  items: TestItem[],
  names: string[],
  checkFileRemoval?: (path: string) => FileRemovalVerdict,
) {
  return {
    cwd: tempDir,
    names,
    yes: true,
    dryRun: false,
    force: false,
    itemPlural: "items",
    requireConfig: () => null,
    validateNames: () => {},
    getAllItems: () => items,
    getItemOrThrow: (name: string) => {
      const found = items.find((item) => item.name === name);
      if (!found) throw new Error(`unknown item ${name}`);
      return found;
    },
    getItemName: (item: TestItem) => item.name,
    isInstalled: () => true,
    resolveFilesForItem: ({ item }: { item: TestItem }) => item.files,
    resolveAllowedBaseDirs: () => [tempDir],
    updateManifest: () => {},
    checkFileRemoval: checkFileRemoval
      ? ({ file }: { file: { absolutePath: string } }) => checkFileRemoval(file.absolutePath)
      : undefined,
  };
}

describe("collectRemovalTargets", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-remove-targets-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("keeps shared files when a co-requested item is blocked by integrity", () => {
    const sharedPath = join(tempDir, "hooks", "use-focus-restore.ts");
    const restoreOnlyPath = join(tempDir, "hooks", "utils", "focus-restore.ts");
    const trapOnlyPath = join(tempDir, "hooks", "use-focus-trap.ts");
    mkdirSync(join(tempDir, "hooks", "utils"), { recursive: true });
    writeFileSync(sharedPath, "export const shared = true;\n");
    writeFileSync(restoreOnlyPath, "export const restoreOnly = true;\n");
    writeFileSync(trapOnlyPath, "export const trapOnly = true;\n");

    const items: TestItem[] = [
      {
        name: "keys/focus-restore",
        files: [{ absolutePath: sharedPath }, { absolutePath: restoreOnlyPath }],
      },
      {
        name: "keys/focus-trap",
        files: [{ absolutePath: sharedPath }, { absolutePath: trapOnlyPath }],
      },
    ];

    const targets = collectRemovalTargets(
      buildOptions(
        tempDir,
        items,
        items.map((item) => item.name),
        (path) => (path === trapOnlyPath ? "modified" : "removable"),
      ),
      null,
      items.map((item) => item.name),
    );

    expect(targets.removedNames).toEqual(["keys/focus-restore"]);
    expect([...targets.files]).toEqual([restoreOnlyPath]);
    expect(targets.files.has(sharedPath)).toBe(false);
    expect(targets.files.has(trapOnlyPath)).toBe(false);
  });

  it("keeps shared files regardless of requested item order", () => {
    const sharedPath = join(tempDir, "shared.ts");
    const firstOnlyPath = join(tempDir, "first-only.ts");
    const secondOnlyPath = join(tempDir, "second-only.ts");
    writeFileSync(sharedPath, "export const shared = true;\n");
    writeFileSync(firstOnlyPath, "export const first = true;\n");
    writeFileSync(secondOnlyPath, "export const second = true;\n");

    const items: TestItem[] = [
      {
        name: "item-first",
        files: [{ absolutePath: sharedPath }, { absolutePath: firstOnlyPath }],
      },
      {
        name: "item-second",
        files: [{ absolutePath: sharedPath }, { absolutePath: secondOnlyPath }],
      },
    ];
    const checkFileRemoval = (path: string): FileRemovalVerdict =>
      path === secondOnlyPath ? "modified" : "removable";

    const forward = collectRemovalTargets(
      buildOptions(tempDir, items, ["item-first", "item-second"], checkFileRemoval),
      null,
      ["item-first", "item-second"],
    );
    const reverse = collectRemovalTargets(
      buildOptions(tempDir, items, ["item-second", "item-first"], checkFileRemoval),
      null,
      ["item-second", "item-first"],
    );

    expect(forward).toEqual(reverse);
    expect(forward.removedNames).toEqual(["item-first"]);
    expect([...forward.files]).toEqual([firstOnlyPath]);
  });

  it("removes a pristine unique owner when a non-requested co-owner keeps a dirty shared file", () => {
    const sharedPath = join(tempDir, "hooks", "use-focus-restore.ts");
    const restoreOnlyPath = join(tempDir, "hooks", "utils", "focus-restore.ts");
    const trapOnlyPath = join(tempDir, "hooks", "use-focus-trap.ts");
    mkdirSync(join(tempDir, "hooks", "utils"), { recursive: true });
    writeFileSync(sharedPath, "export const shared = true;\n");
    writeFileSync(restoreOnlyPath, "export const restoreOnly = true;\n");
    writeFileSync(trapOnlyPath, "export const trapOnly = true;\n");

    const items: TestItem[] = [
      {
        name: "keys/focus-restore",
        files: [{ absolutePath: sharedPath }, { absolutePath: restoreOnlyPath }],
      },
      {
        name: "keys/focus-trap",
        files: [{ absolutePath: sharedPath }, { absolutePath: trapOnlyPath }],
      },
    ];

    const targets = collectRemovalTargets(
      buildOptions(tempDir, items, ["keys/focus-restore"], (path) =>
        path === sharedPath ? "modified" : "removable",
      ),
      null,
      ["keys/focus-restore"],
    );

    expect(targets.removedNames).toEqual(["keys/focus-restore"]);
    expect([...targets.files]).toEqual([restoreOnlyPath]);
    expect(targets.files.has(sharedPath)).toBe(false);
    expect(targets.files.has(trapOnlyPath)).toBe(false);
  });

  it("keeps cascade-expanded transitives when a retained owner is blocked", () => {
    const parentPath = join(tempDir, "button", "index.ts");
    const spinnerPath = join(tempDir, "spinner", "spinner.tsx");
    const utilsPath = join(tempDir, "lib", "utils.ts");
    mkdirSync(join(tempDir, "button"), { recursive: true });
    mkdirSync(join(tempDir, "spinner"), { recursive: true });
    mkdirSync(join(tempDir, "lib"), { recursive: true });
    writeFileSync(parentPath, "export const parent = true;\n");
    writeFileSync(spinnerPath, "export const spinner = true;\n");
    writeFileSync(utilsPath, "export const utils = true;\n");

    const items: TestItem[] = [
      {
        name: "ui/button",
        requires: ["ui/spinner", "ui/utils"],
        files: [{ absolutePath: parentPath }],
      },
      { name: "ui/spinner", files: [{ absolutePath: spinnerPath }] },
      { name: "ui/utils", files: [{ absolutePath: utilsPath }] },
    ];

    const targets = collectRemovalTargets(
      buildOptions(
        tempDir,
        items,
        items.map((item) => item.name),
        (path) => (path === parentPath ? "modified" : "removable"),
      ),
      null,
      items.map((item) => item.name),
      new Map(items.map((item) => [item.name, item.requires ?? []])),
    );

    expect(targets.removedNames).toEqual([]);
    expect(targets.files.size).toBe(0);
  });

  it("rejects expanded removal without its planning dependency graph", () => {
    const parentPath = join(tempDir, "parent.ts");
    const dependencyPath = join(tempDir, "dependency.ts");
    writeFileSync(parentPath, "// modified\n");
    writeFileSync(dependencyPath, "export const dependency = true;\n");

    const items: TestItem[] = [
      {
        name: "ui/parent",
        requires: ["ui/dependency"],
        files: [{ absolutePath: parentPath }],
      },
      { name: "ui/dependency", files: [{ absolutePath: dependencyPath }] },
    ];
    const options = {
      ...buildOptions(
        tempDir,
        items,
        items.map((item) => item.name),
        (path) => (path === parentPath ? "modified" : "removable"),
      ),
      expandRequestedNames: () => ({
        toRemove: items.map((item) => item.name),
        blocked: [],
        dependencyGraph: new Map(items.map((item) => [item.name, item.requires ?? []])),
      }),
    };

    expect(() =>
      collectRemovalTargets(
        options,
        null,
        items.map((item) => item.name),
      ),
    ).toThrow("Removal expansion must provide a dependency graph.");
  });

  it("uses the planning dependency graph for retained legacy owners", () => {
    const buttonPath = join(tempDir, "button", "index.ts");
    const spinnerPath = join(tempDir, "spinner", "spinner.tsx");
    const utilsPath = join(tempDir, "lib", "utils.ts");
    const themePath = join(tempDir, "styles", "theme.css");
    mkdirSync(join(tempDir, "button"), { recursive: true });
    mkdirSync(join(tempDir, "spinner"), { recursive: true });
    mkdirSync(join(tempDir, "lib"), { recursive: true });
    mkdirSync(join(tempDir, "styles"), { recursive: true });
    writeFileSync(buttonPath, "// modified\n");
    writeFileSync(spinnerPath, "export const spinner = true;\n");
    writeFileSync(utilsPath, "export const utils = true;\n");
    writeFileSync(themePath, ":root {}\n");

    const items: TestItem[] = [
      { name: "ui/button", files: [{ absolutePath: buttonPath }] },
      { name: "ui/spinner", files: [{ absolutePath: spinnerPath }] },
      { name: "ui/utils", files: [{ absolutePath: utilsPath }] },
      { name: "ui/theme", files: [{ absolutePath: themePath }] },
    ];
    const targets = collectRemovalTargets(
      buildOptions(
        tempDir,
        items,
        items.map((item) => item.name),
        (path) => (path === buttonPath ? "modified" : "removable"),
      ),
      null,
      items.map((item) => item.name),
      new Map([
        ["ui/button", ["ui/spinner", "ui/utils"]],
        ["ui/spinner", ["ui/theme"]],
        ["ui/utils", []],
        ["ui/theme", []],
      ]),
    );

    expect(targets.removedNames).toEqual([]);
    expect(targets.files.size).toBe(0);
  });

  it("still deletes shared files when every co-requested owner is removable", () => {
    const sharedPath = join(tempDir, "shared.ts");
    const firstOnlyPath = join(tempDir, "first-only.ts");
    const secondOnlyPath = join(tempDir, "second-only.ts");
    writeFileSync(sharedPath, "export const shared = true;\n");
    writeFileSync(firstOnlyPath, "export const first = true;\n");
    writeFileSync(secondOnlyPath, "export const second = true;\n");

    const items: TestItem[] = [
      {
        name: "item-first",
        files: [{ absolutePath: sharedPath }, { absolutePath: firstOnlyPath }],
      },
      {
        name: "item-second",
        files: [{ absolutePath: sharedPath }, { absolutePath: secondOnlyPath }],
      },
    ];

    const targets = collectRemovalTargets(
      buildOptions(
        tempDir,
        items,
        items.map((item) => item.name),
      ),
      null,
      items.map((item) => item.name),
    );

    expect(targets.removedNames).toEqual(["item-first", "item-second"]);
    expect([...targets.files].sort()).toEqual([sharedPath, firstOnlyPath, secondOnlyPath].sort());
  });

  it("treats all-owned-files-missing items as removable without --force", () => {
    const missingPath = join(tempDir, "missing-only.ts");
    const items: TestItem[] = [
      {
        name: "stale-item",
        files: [{ absolutePath: missingPath }],
      },
    ];

    const targets = collectRemovalTargets(buildOptions(tempDir, items, ["stale-item"]), null, [
      "stale-item",
    ]);

    expect(targets.removedNames).toEqual(["stale-item"]);
    expect(targets.files.size).toBe(0);
  });
});
