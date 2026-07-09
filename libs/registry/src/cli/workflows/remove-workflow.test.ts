import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync as realRmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rmSyncFailPaths = vi.hoisted(() => new Set<string>());

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

vi.mock("../terminal.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../terminal.js")>();
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

import { info, success } from "../terminal.js";
import { type DerivedRemovalPlan, runRemoveWorkflow } from "./remove.js";

interface TestItem {
  name: string;
  files: Array<{ absolutePath: string }>;
}

function buildOptions(
  tempDir: string,
  item: TestItem,
  overrides: {
    updateManifest: (ctx: { cwd: string; removedNames: string[] }) => void;
    onAfterRemove: (ctx: {
      cwd: string;
      removedNames: string[];
      force: boolean;
    }) => DerivedRemovalPlan | undefined;
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
    vi.clearAllMocks();
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

  it("does not update manifest when post-removal cleanup fails", async () => {
    const filePath = join(tempDir, "component.tsx");
    writeFileSync(filePath, "export {};\n");

    const item: TestItem = {
      name: "test-component",
      files: [{ absolutePath: filePath }],
    };
    const updateManifest = vi.fn();
    const onAfterRemove = vi.fn(() => {
      throw new Error("css cleanup failed");
    });

    await expect(
      runRemoveWorkflow<TestItem, null>(
        buildOptions(tempDir, item, { updateManifest, onAfterRemove }),
      ),
    ).rejects.toThrow("css cleanup failed");

    expect(updateManifest).not.toHaveBeenCalled();
    expect(existsSync(filePath)).toBe(false);
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

  it("previews derived writes under --dry-run without applying them", async () => {
    const filePath = join(tempDir, "component.tsx");
    writeFileSync(filePath, "export {};\n");
    const cssPath = join(tempDir, "styles.css");
    writeFileSync(cssPath, "/* original */\n");

    const item: TestItem = { name: "test-component", files: [{ absolutePath: filePath }] };
    const updateManifest = vi.fn();
    const notice =
      "Skipping test-component: styles.css chunk has been modified (use --force to override)";
    const onAfterRemove = vi.fn(
      (): DerivedRemovalPlan => ({
        writes: [{ targetPath: cssPath, content: "/* rewritten */\n" }],
        preservedNotices: [notice],
      }),
    );

    await runRemoveWorkflow<TestItem, null>({
      ...buildOptions(tempDir, item, { updateManifest, onAfterRemove }),
      dryRun: true,
    });

    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(cssPath, "utf-8")).toBe("/* original */\n");
    expect(updateManifest).not.toHaveBeenCalled();

    const infoMessages = vi.mocked(info).mock.calls.map(([msg]) => msg);
    expect(infoMessages).toContain(notice);
    expect(infoMessages.some((msg) => msg.includes("Would update"))).toBe(true);
  });

  it("applies derived writes and prints preserved notices on a real removal", async () => {
    const filePath = join(tempDir, "component.tsx");
    writeFileSync(filePath, "export {};\n");
    const cssPath = join(tempDir, "styles.css");
    writeFileSync(cssPath, "/* original */\n");

    const item: TestItem = { name: "test-component", files: [{ absolutePath: filePath }] };
    const updateManifest = vi.fn();
    const onAfterRemove = vi.fn(
      (): DerivedRemovalPlan => ({
        writes: [{ targetPath: cssPath, content: "/* rewritten */\n" }],
        preservedNotices: ["kept a drifted chunk (use --force to override)"],
      }),
    );

    await runRemoveWorkflow<TestItem, null>(
      buildOptions(tempDir, item, { updateManifest, onAfterRemove }),
    );

    expect(readFileSync(cssPath, "utf-8")).toBe("/* rewritten */\n");
    expect(updateManifest).toHaveBeenCalled();
    const infoMessages = vi.mocked(info).mock.calls.map(([msg]) => msg);
    expect(infoMessages).toContain("kept a drifted chunk (use --force to override)");
  });

  it("passes force to onAfterRemove when source files are already gone", async () => {
    const item: TestItem = {
      name: "test-component",
      files: [{ absolutePath: join(tempDir, "component.tsx") }],
    };
    const canRemoveFile = vi.fn(() => true);
    const onAfterRemove = vi.fn((): DerivedRemovalPlan => ({ writes: [], preservedNotices: [] }));

    await runRemoveWorkflow<TestItem, null>({
      ...buildOptions(tempDir, item, { updateManifest: vi.fn(), onAfterRemove }),
      force: true,
      canRemoveFile,
    });

    expect(canRemoveFile).not.toHaveBeenCalled();
    expect(onAfterRemove).toHaveBeenCalledWith(
      expect.objectContaining({ removedNames: ["test-component"], force: true }),
    );
  });

  it("omits names kept for a preserved derived artifact from the removed summary", async () => {
    const removedFile = join(tempDir, "removed.tsx");
    const retainedFile = join(tempDir, "retained.tsx");
    writeFileSync(removedFile, "export {};\n");
    writeFileSync(retainedFile, "export {};\n");

    const items: TestItem[] = [
      { name: "item-removed", files: [{ absolutePath: removedFile }] },
      { name: "item-retained", files: [{ absolutePath: retainedFile }] },
    ];
    const notice = "Keeping item-retained tracked so the edited chunk is not orphaned";
    const onAfterRemove = vi.fn(
      (): DerivedRemovalPlan => ({
        writes: [],
        preservedNotices: [notice],
        retainedNames: ["item-retained"],
      }),
    );

    await runRemoveWorkflow<TestItem, null>({
      cwd: tempDir,
      names: items.map((i) => i.name),
      yes: true,
      dryRun: false,
      force: false,
      itemPlural: "items",
      requireConfig: () => null,
      validateNames: () => {},
      getAllItems: () => items,
      getItemOrThrow: (name: string) => {
        const found = items.find((i) => i.name === name);
        if (!found) throw new Error(`unknown item ${name}`);
        return found;
      },
      getItemName: (i: TestItem) => i.name,
      isInstalled: () => true,
      resolveFilesForItem: ({ item }: { item: TestItem }) => item.files,
      resolveAllowedBaseDirs: () => [tempDir],
      updateManifest: vi.fn(),
      onAfterRemove,
    });

    const infoMessages = vi.mocked(info).mock.calls.map(([msg]) => msg);
    expect(infoMessages).toContain(notice);

    const summary = vi
      .mocked(success)
      .mock.calls.map(([msg]) => msg)
      .join("\n");
    expect(summary).toMatch(/Removed 2 file\(s\)/);
    expect(summary).toContain("item-removed");
    expect(summary).not.toContain("item-retained");
  });

  it("refuses to apply a derived write outside the allowed base dirs", async () => {
    const filePath = join(tempDir, "component.tsx");
    writeFileSync(filePath, "export {};\n");
    const outside = join(tmpdir(), "rk-remove-escape.css");
    realRmSync(outside, { force: true });

    const item: TestItem = { name: "test-component", files: [{ absolutePath: filePath }] };
    const onAfterRemove = vi.fn(
      (): DerivedRemovalPlan => ({
        writes: [{ targetPath: outside, content: "should never be written" }],
        preservedNotices: [],
      }),
    );

    await expect(
      runRemoveWorkflow<TestItem, null>(
        buildOptions(tempDir, item, { updateManifest: vi.fn(), onAfterRemove }),
      ),
    ).rejects.toThrow(/traversal|escapes/i);

    expect(existsSync(outside)).toBe(false);
  });
});
