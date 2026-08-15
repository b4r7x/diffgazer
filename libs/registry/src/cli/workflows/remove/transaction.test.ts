import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { writeFileSyncMock, rmSyncMock } = vi.hoisted(() => ({
  writeFileSyncMock: vi.fn(),
  rmSyncMock: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) => {
      writeFileSyncMock(...args);
      return actual.writeFileSync(...args);
    },
    rmSync: (...args: Parameters<typeof actual.rmSync>) => {
      rmSyncMock(...args);
      return actual.rmSync(...args);
    },
  };
});

import { type RemovalSnapshot, restoreFileSnapshots } from "./transaction.js";

describe("restoreFileSnapshots", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-remove-restore-"));
    writeFileSyncMock.mockClear();
    rmSyncMock.mockClear();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("skips rewriting snapshotted paths whose bytes never changed", () => {
    const filePath = join(tempDir, "unchanged.ts");
    const content = Buffer.from("original\n");
    writeFileSync(filePath, content);
    const snapshot: RemovalSnapshot = new Map([[filePath, content]]);
    writeFileSyncMock.mockClear();

    restoreFileSnapshots(snapshot, new Error("primary failure"));

    expect(writeFileSyncMock).not.toHaveBeenCalled();
    expect(readFileSync(filePath, "utf-8")).toBe("original\n");
  });

  it("still restores snapshotted paths whose bytes changed during removal", () => {
    const filePath = join(tempDir, "changed.ts");
    const original = Buffer.from("original\n");
    const snapshot: RemovalSnapshot = new Map([[filePath, original]]);
    writeFileSync(filePath, "mutated during removal\n");
    writeFileSyncMock.mockClear();

    restoreFileSnapshots(snapshot, new Error("primary failure"));

    expect(readFileSync(filePath)).toEqual(original);
    expect(writeFileSyncMock).toHaveBeenCalled();
  });

  it("skips deleting snapshotted paths that were already absent", () => {
    const missingPath = join(tempDir, "never-created.ts");
    const snapshot: RemovalSnapshot = new Map([[missingPath, null]]);

    restoreFileSnapshots(snapshot, new Error("primary failure"));

    expect(rmSyncMock).not.toHaveBeenCalled();
    expect(existsSync(missingPath)).toBe(false);
  });
});
