import { mkdtempSync, rmSync as realRmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Track which files rmSync should fail on.
const rmSyncFailPaths = vi.hoisted(() => new Set<string>());

// Boundary mock: node:fs — wraps actual rmSync to simulate deletion failures
// for specific paths. All other fs operations delegate to real implementation.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    rmSync: (path: string, opts?: Parameters<typeof actual.rmSync>[1]) => {
      if (rmSyncFailPaths.has(String(path))) {
        throw new Error("Permission denied");
      }
      return actual.rmSync(path, opts);
    },
  };
});

// Boundary mock: logger — suppress output and auto-confirm prompts.
vi.mock("../cli/terminal.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../cli/terminal.js")>();
  return {
    ...actual,
    error: vi.fn(),
    info: vi.fn(),
    heading: vi.fn(),
    newline: vi.fn(),
    success: vi.fn(),
    fileAction: vi.fn(),
    promptConfirm: vi.fn().mockResolvedValue(true),
  };
});

import { runRemoveWorkflow } from "../cli/workflows/remove.js";

interface TestItem {
  name: string;
  files: Array<{ absolutePath: string }>;
}

function buildOptions(
  tempDir: string,
  item: TestItem,
  overrides: {
    updateManifest: (ctx: { cwd: string; removedNames: string[] }) => void;
    onAfterRemove: (ctx: { cwd: string; removedNames: string[] }) => void;
  },
) {
  return {
    cwd: tempDir,
    names: [item.name],
    yes: true,
    dryRun: false,
    force: false,
    itemPlural: "items",
    requireConfig: () => null,
    validateNames: () => {},
    getAllItems: () => [item],
    getItemOrThrow: () => item,
    getItemName: (i: TestItem) => i.name,
    isInstalled: () => true,
    resolveFilesForItem: ({ item: i }: { item: TestItem }) => i.files,
    resolveAllowedBaseDirs: () => [tempDir],
    updateManifest: overrides.updateManifest,
    onAfterRemove: overrides.onAfterRemove,
  };
}

describe("runRemoveWorkflow", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-remove-"));
    rmSyncFailPaths.clear();
  });

  afterEach(() => {
    rmSyncFailPaths.clear();
    realRmSync(tempDir, { recursive: true, force: true });
  });

  it("does not update manifest when file deletion fails", async () => {
    const filePath = join(tempDir, "component.tsx");
    writeFileSync(filePath, "export {};\n");
    rmSyncFailPaths.add(filePath);

    const item: TestItem = {
      name: "test-component",
      files: [{ absolutePath: filePath }],
    };
    const updateManifest = vi.fn();
    const onAfterRemove = vi.fn();

    await runRemoveWorkflow<TestItem, null>(
      buildOptions(tempDir, item, { updateManifest, onAfterRemove }),
    );

    expect(updateManifest).not.toHaveBeenCalled();
    expect(onAfterRemove).not.toHaveBeenCalled();
  });

  it("updates manifest when all files are deleted successfully", async () => {
    const filePath = join(tempDir, "component.tsx");
    writeFileSync(filePath, "export {};\n");

    const item: TestItem = {
      name: "test-component",
      files: [{ absolutePath: filePath }],
    };
    const updateManifest = vi.fn();
    const onAfterRemove = vi.fn();

    await runRemoveWorkflow<TestItem, null>(
      buildOptions(tempDir, item, { updateManifest, onAfterRemove }),
    );

    expect(updateManifest).toHaveBeenCalledWith({
      cwd: tempDir,
      removedNames: ["test-component"],
    });
    expect(onAfterRemove).toHaveBeenCalled();
  });
});
