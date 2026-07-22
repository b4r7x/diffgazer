import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { rollbackFiles, writeFilesWithRollback } from "./file-write-rollback.js";

describe("writeFilesWithRollback filesystem result", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-rollback-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("rollback removes the whole created ancestor chain while pre-existing dirs survive", () => {
    const preExisting = resolve(tempDir, "src");
    mkdirSync(preExisting, { recursive: true });

    const targetPath = resolve(tempDir, "src/components/ui/widget.tsx");
    const result = writeFilesWithRollback(
      [
        {
          targetPath,
          content: "export const widget = 1;\n",
          relativePath: "components/ui/widget.tsx",
          installDir: "src",
        },
      ],
      false,
    );

    expect(existsSync(targetPath)).toBe(true);

    rollbackFiles(result.newFiles, result.backups, result.createdDirs);

    expect(existsSync(targetPath)).toBe(false);
    expect(existsSync(resolve(tempDir, "src/components/ui"))).toBe(false);
    expect(existsSync(resolve(tempDir, "src/components"))).toBe(false);
    expect(existsSync(preExisting)).toBe(true);
  });

  test("rollback removes created dirs when the first write fails before a new file is recorded", () => {
    const targetDir = resolve(tempDir, "src/components/ui");
    const targetPath = resolve(targetDir, `${"a".repeat(300)}.tsx`);

    expect(() =>
      writeFilesWithRollback(
        [
          {
            targetPath,
            content: "export const widget = 1;\n",
            relativePath: "components/ui/widget.tsx",
            installDir: "src",
          },
        ],
        false,
      ),
    ).toThrow(/Failed to write files:/);

    expect(existsSync(targetDir)).toBe(false);
    expect(existsSync(resolve(tempDir, "src/components"))).toBe(false);
    expect(existsSync(resolve(tempDir, "src"))).toBe(false);
  });
});
