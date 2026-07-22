import {
  existsSync,
  mkdirSync,
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

vi.mock("../../terminal.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../terminal.js")>();
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

import { createRemoveCommand } from "../../command-factories.js";
import { info, success } from "../../terminal.js";
import type { DerivedRemovalPlan } from "./types.js";
import { runRemoveWorkflow } from "./workflow.js";

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
    resolveTransactionFiles?: () => string[];
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
    resolveTransactionFiles: overrides.resolveTransactionFiles,
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

  it("restores every owned source after a partial deletion failure and allows a normal retry", async () => {
    const firstPath = join(tempDir, "first.tsx");
    const secondPath = join(tempDir, "second.tsx");
    const firstBytes = Uint8Array.from([0, 1, 2, 255]);
    const secondBytes = Uint8Array.from([254, 3, 4, 0]);
    writeFileSync(firstPath, firstBytes);
    writeFileSync(secondPath, secondBytes);
    rmSyncFailPaths.add(secondPath);

    const item: TestItem = {
      name: "test-component",
      files: [{ absolutePath: firstPath }, { absolutePath: secondPath }],
    };
    const updateManifest = vi.fn();
    const onAfterRemove = vi.fn();
    const options = buildOptions(tempDir, item, {
      updateManifest,
      onAfterRemove,
    });

    const removal = runRemoveWorkflow<TestItem, null>(options);
    await expect(removal).rejects.toBeInstanceOf(AggregateError);
    await expect(removal).rejects.toEqual(
      expect.objectContaining({
        message: "Failed to remove 1 file(s): second.tsx",
        errors: [expect.objectContaining({ message: "Permission denied" })],
      }),
    );

    expect(readFileSync(firstPath)).toEqual(Buffer.from(firstBytes));
    expect(readFileSync(secondPath)).toEqual(Buffer.from(secondBytes));
    expect(updateManifest).not.toHaveBeenCalled();
    expect(onAfterRemove).not.toHaveBeenCalled();

    rmSyncFailPaths.clear();
    await runRemoveWorkflow<TestItem, null>(options);

    expect(existsSync(firstPath)).toBe(false);
    expect(existsSync(secondPath)).toBe(false);
    expect(updateManifest).toHaveBeenCalledOnce();
  });

  it("restores source and stylesheet bytes when a derived write fails, then retries cleanly", async () => {
    const filePath = join(tempDir, "component.tsx");
    const source = "export const value = 'original';\n";
    writeFileSync(filePath, source);
    const cssPath = join(tempDir, "styles.css");
    const css = "/* original css */\n";
    writeFileSync(cssPath, css);
    const missingTarget = join(tempDir, "missing", "generated.css");

    const item: TestItem = {
      name: "test-component",
      files: [{ absolutePath: filePath }],
    };
    const updateManifest = vi.fn();
    const onAfterRemove = vi.fn(
      (): DerivedRemovalPlan => ({
        writes: [
          { targetPath: cssPath, content: "/* rewritten css */\n" },
          { targetPath: missingTarget, content: "/* generated */\n" },
        ],
        preservedNotices: [],
      }),
    );
    const options = buildOptions(tempDir, item, {
      updateManifest,
      onAfterRemove,
      resolveTransactionFiles: () => [cssPath, missingTarget],
    });

    await expect(runRemoveWorkflow<TestItem, null>(options)).rejects.toThrow();

    expect(updateManifest).not.toHaveBeenCalled();
    expect(readFileSync(filePath, "utf-8")).toBe(source);
    expect(readFileSync(cssPath, "utf-8")).toBe(css);
    expect(existsSync(missingTarget)).toBe(false);

    mkdirSync(join(tempDir, "missing"));
    await runRemoveWorkflow<TestItem, null>(options);

    expect(existsSync(filePath)).toBe(false);
    expect(readFileSync(cssPath, "utf-8")).toBe("/* rewritten css */\n");
    expect(readFileSync(missingTarget, "utf-8")).toBe("/* generated */\n");
    expect(updateManifest).toHaveBeenCalledOnce();
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

  it("restores source, stylesheet, manifest, and absent targets when manifest persistence fails", async () => {
    const filePath = join(tempDir, "component.tsx");
    const source = "export const original = true;\n";
    writeFileSync(filePath, source);
    const cssPath = join(tempDir, "styles.css");
    const css = "/* original */\n";
    writeFileSync(cssPath, css);
    const manifestPath = join(tempDir, "manifest.json");
    const manifest = '{ "items": ["test-component"] }\n';
    writeFileSync(manifestPath, manifest);
    const absentPath = join(tempDir, "recovery-marker.json");

    const item: TestItem = {
      name: "test-component",
      files: [{ absolutePath: filePath }],
    };
    let failManifest = true;
    const updateManifest = vi.fn(() => {
      writeFileSync(manifestPath, '{ "items": [] }\n');
      writeFileSync(absentPath, "partial\n");
      if (failManifest) throw new Error("manifest write failed");
    });
    const options = buildOptions(tempDir, item, {
      updateManifest,
      onAfterRemove: () => ({
        writes: [{ targetPath: cssPath, content: "/* rewritten */\n" }],
        preservedNotices: [],
      }),
      resolveTransactionFiles: () => [cssPath, manifestPath, absentPath],
    });

    await expect(runRemoveWorkflow<TestItem, null>(options)).rejects.toThrow(
      "manifest write failed",
    );

    expect(readFileSync(filePath, "utf-8")).toBe(source);
    expect(readFileSync(cssPath, "utf-8")).toBe(css);
    expect(readFileSync(manifestPath, "utf-8")).toBe(manifest);
    expect(existsSync(absentPath)).toBe(false);

    failManifest = false;
    await runRemoveWorkflow<TestItem, null>(options);

    expect(existsSync(filePath)).toBe(false);
    expect(readFileSync(cssPath, "utf-8")).toBe("/* rewritten */\n");
    expect(readFileSync(manifestPath, "utf-8")).toBe('{ "items": [] }\n');
    expect(readFileSync(absentPath, "utf-8")).toBe("partial\n");
    expect(updateManifest).toHaveBeenCalledTimes(2);
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
    expect(readFileSync(filePath, "utf-8")).toBe("export {};\n");
  });

  it("carries transaction files and derived plans through the remove command factory", async () => {
    const filePath = join(tempDir, "component.tsx");
    const source = "export const commandFactory = true;\n";
    writeFileSync(filePath, source);
    const cssPath = join(tempDir, "styles.css");
    const css = "/* command factory original */\n";
    writeFileSync(cssPath, css);
    const manifestPath = join(tempDir, "manifest.json");
    const manifest = '{ "installed": true }\n';
    writeFileSync(manifestPath, manifest);
    const item: TestItem = {
      name: "test-component",
      files: [{ absolutePath: filePath }],
    };
    let failManifest = true;
    const command = createRemoveCommand<TestItem, null>({
      itemPlural: "items",
      requireConfig: () => null,
      validateNames: () => {},
      getAllItems: () => [item],
      getItemOrThrow: () => item,
      getItemName: (candidate) => candidate.name,
      isInstalled: () => true,
      resolveFilesForItem: ({ item: candidate }) => candidate.files,
      resolveAllowedBaseDirs: () => [tempDir],
      resolveTransactionFiles: () => [cssPath, manifestPath],
      updateManifest: () => {
        writeFileSync(manifestPath, '{ "installed": false }\n');
        if (failManifest) throw new Error("factory manifest failure");
      },
      onAfterRemove: () => ({
        writes: [{ targetPath: cssPath, content: "/* command factory rewritten */\n" }],
        preservedNotices: [],
      }),
    });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process exit");
    });

    try {
      await expect(
        command.parseAsync(["node", "dgadd", "test-component", "--cwd", tempDir, "--yes"]),
      ).rejects.toThrow("process exit");

      expect(readFileSync(filePath, "utf-8")).toBe(source);
      expect(readFileSync(cssPath, "utf-8")).toBe(css);
      expect(readFileSync(manifestPath, "utf-8")).toBe(manifest);

      failManifest = false;
      await command.parseAsync(["node", "dgadd", "test-component", "--cwd", tempDir, "--yes"]);

      expect(existsSync(filePath)).toBe(false);
      expect(readFileSync(cssPath, "utf-8")).toBe("/* command factory rewritten */\n");
      expect(readFileSync(manifestPath, "utf-8")).toBe('{ "installed": false }\n');
    } finally {
      exit.mockRestore();
    }
  });
});
