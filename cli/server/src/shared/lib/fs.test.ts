import * as fs from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  atomicWriteFile,
  isNodeError,
  readJsonFileSync,
  removeFileSync,
  removeFileSyncDurable,
  writeJsonFile,
  writeJsonFileSync,
  writeJsonFileSyncExclusive,
} from "./fs.js";
import { log } from "./log.js";

const { randomUUIDMock } = vi.hoisted(() => ({
  randomUUIDMock: vi.fn(() => "test-temp"),
}));

vi.mock("node:crypto", async () => {
  const actual = await vi.importActual<typeof import("node:crypto")>("node:crypto");
  return { ...actual, randomUUID: randomUUIDMock };
});

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    closeSync: actual.closeSync.bind(actual),
    fsyncSync: actual.fsyncSync.bind(actual),
    linkSync: actual.linkSync.bind(actual),
    openSync: actual.openSync.bind(actual),
    renameSync: actual.renameSync.bind(actual),
    unlinkSync: actual.unlinkSync.bind(actual),
    writeFileSync: actual.writeFileSync.bind(actual),
  };
});

// Boundary mock: logging writes process-visible diagnostics; tests assert the warning without emitting it.
vi.mock("./log.js", () => ({ log: vi.fn() }));

let tempRoot: string;

const spyOnTemporaryHandle = (configure: (handle: FileHandle) => void): void => {
  const realOpen = fs.promises.open.bind(fs.promises);
  vi.spyOn(fs.promises, "open").mockImplementation(async (openedPath, flags, mode) => {
    const handle = await realOpen(openedPath, flags, mode);
    if (String(openedPath).endsWith(".tmp")) configure(handle);
    return handle;
  });
};

const withPlatform = async <T>(
  platform: NodeJS.Platform,
  callback: () => Promise<T> | T,
): Promise<T> => {
  const originalPlatform = process.platform;
  Object.defineProperty(process, "platform", { configurable: true, value: platform });
  try {
    return await callback();
  } finally {
    Object.defineProperty(process, "platform", { configurable: true, value: originalPlatform });
  }
};

beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "diffgazer-fs-"));
  randomUUIDMock.mockReset();
  randomUUIDMock.mockReturnValue("test-temp");
  vi.mocked(log).mockClear();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(tempRoot, { recursive: true, force: true });
});

describe("JSON file helpers", () => {
  it.skipIf(process.platform === "win32")(
    "writes and reads formatted JSON through the real filesystem",
    async () => {
      const filePath = join(tempRoot, "nested", "file.json");
      const data = { key: "value" };

      writeJsonFileSync(filePath, data);

      expect(readJsonFileSync(filePath)).toEqual(data);
      await expect(readFile(filePath, "utf-8")).resolves.toBe(`${JSON.stringify(data, null, 2)}\n`);
      expect((await stat(filePath)).mode & 0o777).toBe(0o600);
      await expect(readdir(join(tempRoot, "nested"))).resolves.toEqual(["file.json"]);
    },
  );

  it.skipIf(process.platform === "win32")(
    "creates the missing ancestors owner-only and flushes the file's directory after the rename",
    () => {
      const filePath = join(tempRoot, "first", "second", "file.json");
      const syncedDirectories: string[] = [];
      const realOpenSync = fs.openSync.bind(fs);
      const realFsyncSync = fs.fsyncSync.bind(fs);
      const descriptorPaths = new Map<number, string>();

      vi.spyOn(fs, "openSync").mockImplementation((openedPath, flags, mode) => {
        const descriptor = realOpenSync(openedPath, flags, mode);
        descriptorPaths.set(descriptor, String(openedPath));
        return descriptor;
      });
      vi.spyOn(fs, "fsyncSync").mockImplementation((descriptor) => {
        const target = descriptorPaths.get(descriptor);
        if (target !== undefined && !target.endsWith(".tmp")) syncedDirectories.push(target);
        return realFsyncSync(descriptor);
      });

      writeJsonFileSync(filePath, { key: "value" });

      expect(readJsonFileSync(filePath)).toEqual({ key: "value" });
      expect(fs.statSync(join(tempRoot, "first")).mode & 0o777).toBe(0o700);
      expect(fs.statSync(join(tempRoot, "first", "second")).mode & 0o777).toBe(0o700);
      expect(syncedDirectories).toEqual([join(tempRoot, "first", "second")]);
    },
  );

  it.skipIf(process.platform === "win32")(
    "keeps writing into a directory tree that already exists",
    async () => {
      const syncPath = join(tempRoot, "existing", "sync.json");
      const asyncPath = join(tempRoot, "existing", "async.json");

      writeJsonFileSync(syncPath, { key: "first" });
      expect(() => writeJsonFileSync(syncPath, { key: "second" })).not.toThrow();
      await expect(writeJsonFile(asyncPath, { key: "third" })).resolves.toBeUndefined();

      expect(readJsonFileSync(syncPath)).toEqual({ key: "second" });
      expect(readJsonFileSync(asyncPath)).toEqual({ key: "third" });
    },
  );

  it("flushes synchronous atomic writes in order with exclusive temp creation", () => {
    const filePath = join(tempRoot, "ordered.json");
    const events: string[] = [];
    const realOpenSync = fs.openSync.bind(fs);
    const realWriteFileSync = fs.writeFileSync.bind(fs);
    const realFsyncSync = fs.fsyncSync.bind(fs);
    const realCloseSync = fs.closeSync.bind(fs);
    const realRenameSync = fs.renameSync.bind(fs);

    vi.spyOn(fs, "openSync").mockImplementation((openedPath, flags, mode) => {
      events.push(`open:${String(openedPath)}:${String(flags)}:${String(mode)}`);
      return realOpenSync(openedPath, flags, mode);
    });
    vi.spyOn(fs, "writeFileSync").mockImplementation((descriptor, data) => {
      events.push(`write:${String(descriptor)}`);
      return realWriteFileSync(descriptor, data);
    });
    vi.spyOn(fs, "fsyncSync").mockImplementation((descriptor) => {
      events.push(`fsync:${String(descriptor)}`);
      return realFsyncSync(descriptor);
    });
    vi.spyOn(fs, "closeSync").mockImplementation((descriptor) => {
      events.push(`close:${String(descriptor)}`);
      return realCloseSync(descriptor);
    });
    vi.spyOn(fs, "renameSync").mockImplementation((oldPath, newPath) => {
      events.push(`rename:${String(oldPath)}:${String(newPath)}`);
      return realRenameSync(oldPath, newPath);
    });

    writeJsonFileSync(filePath, { key: "value" }, 0o640);

    const labels = events.map((event) => event.split(":", 1)[0]);
    expect(labels).toEqual(["open", "write", "fsync", "close", "rename", "open", "fsync", "close"]);
    expect(events[0]).toContain(".tmp:wx:416");
    expect(events[4]).toContain(filePath);
    expect(events[5]).toBe(`open:${tempRoot}:r:undefined`);
  });

  it("cleans up a synchronous temp file when writing fails", async () => {
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("sync write failed");
    });

    expect(() =>
      writeJsonFileSync(join(tempRoot, "sync-write-fails.json"), { key: "value" }),
    ).toThrow("sync write failed");
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("cleans up a synchronous temp file when file fsync fails", async () => {
    vi.spyOn(fs, "fsyncSync").mockImplementation(() => {
      throw new Error("sync fsync failed");
    });

    expect(() =>
      writeJsonFileSync(join(tempRoot, "sync-fsync-fails.json"), { key: "value" }),
    ).toThrow("sync fsync failed");
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("closes a synchronous temp descriptor before cleanup even when unlink fails", () => {
    const filePath = join(tempRoot, "sync-fsync-close-observable.json");
    const realOpenSync = fs.openSync.bind(fs);
    const realFsyncSync = fs.fsyncSync.bind(fs);
    const realCloseSync = fs.closeSync.bind(fs);
    let tempDescriptor: number | undefined;
    const fsyncError = new Error("sync fsync failed");
    vi.spyOn(fs, "openSync").mockImplementation((openedPath, flags, mode) => {
      const descriptor = realOpenSync(openedPath, flags, mode);
      if (String(openedPath).endsWith(".tmp")) tempDescriptor = descriptor;
      return descriptor;
    });
    vi.spyOn(fs, "fsyncSync").mockImplementation((descriptor) => {
      if (descriptor === tempDescriptor) throw fsyncError;
      return realFsyncSync(descriptor);
    });
    const closeSpy = vi.spyOn(fs, "closeSync").mockImplementation((descriptor) => {
      return realCloseSync(descriptor);
    });
    vi.spyOn(fs, "unlinkSync").mockImplementation(() => {
      throw new Error("cleanup unlink failed");
    });

    expect(() => writeJsonFileSync(filePath, { key: "value" })).toThrow(fsyncError);
    expect(closeSpy).toHaveBeenCalledWith(tempDescriptor);
    expect(tempDescriptor).toBeDefined();
    expect(() => fs.fstatSync(tempDescriptor as number)).toThrow();
  });

  it("cleans up a synchronous temp file when closing the file fails", async () => {
    const realCloseSync = fs.closeSync.bind(fs);
    let closeCalls = 0;
    vi.spyOn(fs, "closeSync").mockImplementation((descriptor) => {
      closeCalls += 1;
      if (closeCalls === 1) throw new Error("sync close failed");
      return realCloseSync(descriptor);
    });

    expect(() =>
      writeJsonFileSync(join(tempRoot, "sync-close-fails.json"), { key: "value" }),
    ).toThrow("sync close failed");
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("returns null for missing or corrupt JSON files", async () => {
    const corruptPath = join(tempRoot, "corrupt.json");
    await writeFile(corruptPath, "not json {{{", "utf-8");

    expect(readJsonFileSync(join(tempRoot, "missing.json"))).toBeNull();
    expect(readJsonFileSync(corruptPath)).toBeNull();
    expect(log).toHaveBeenCalledWith(
      "warn",
      "fs_json_parse_failed",
      expect.objectContaining({ filePath: corruptPath }),
    );
  });

  it("propagates synchronous directory open failures", async () => {
    const filePath = join(tempRoot, "directory-open-fails.json");
    const realOpenSync = fs.openSync.bind(fs);
    let openCalls = 0;
    vi.spyOn(fs, "openSync").mockImplementation((openedPath, flags, mode) => {
      openCalls += 1;
      if (openCalls === 2) {
        throw Object.assign(new Error("directory open denied"), { code: "EACCES" });
      }
      return realOpenSync(openedPath, flags, mode);
    });

    let error: unknown;
    try {
      writeJsonFileSync(filePath, { key: "value" });
    } catch (caught) {
      error = caught;
    }

    expect(isNodeError(error, "EACCES")).toBe(true);
    await expect(readFile(filePath, "utf-8")).resolves.toBe('{\n  "key": "value"\n}\n');
  });

  it.skipIf(process.platform === "win32")(
    "downgrades unsupported synchronous directory fsync errors",
    async () => {
      const filePath = join(tempRoot, "directory-fsync-unsupported.json");
      const realFsyncSync = fs.fsyncSync.bind(fs);
      let fsyncCalls = 0;
      vi.spyOn(fs, "fsyncSync").mockImplementation((descriptor) => {
        fsyncCalls += 1;
        if (fsyncCalls === 2) {
          throw Object.assign(new Error("directory fsync unsupported"), { code: "EINVAL" });
        }
        return realFsyncSync(descriptor);
      });

      expect(() => writeJsonFileSync(filePath, { key: "value" })).not.toThrow();
      await expect(readFile(filePath, "utf-8")).resolves.toBe('{\n  "key": "value"\n}\n');
    },
  );

  it.skipIf(process.platform === "win32")(
    "propagates EACCES from an opened directory during synchronous fsync",
    async () => {
      const filePath = join(tempRoot, "directory-fsync-eacces.json");
      const realFsyncSync = fs.fsyncSync.bind(fs);
      let fsyncCalls = 0;
      vi.spyOn(fs, "fsyncSync").mockImplementation((descriptor) => {
        fsyncCalls += 1;
        if (fsyncCalls === 2) {
          throw Object.assign(new Error("directory fsync denied"), { code: "EACCES" });
        }
        return realFsyncSync(descriptor);
      });

      expect(() => writeJsonFileSync(filePath, { key: "value" })).toThrow(
        expect.objectContaining({ code: "EACCES" }),
      );
      await expect(readFile(filePath, "utf-8")).resolves.toBe('{\n  "key": "value"\n}\n');
    },
  );

  it("downgrades Windows EACCES directory fsync errors but not directory open errors", async () => {
    await withPlatform("win32", async () => {
      const filePath = join(tempRoot, "windows-directory-fsync.json");
      const realOpenSync = fs.openSync.bind(fs);
      const realFsyncSync = fs.fsyncSync.bind(fs);
      let openCalls = 0;
      let fsyncCalls = 0;
      vi.spyOn(fs, "openSync").mockImplementation((openedPath, flags, mode) => {
        openCalls += 1;
        if (openCalls === 2) {
          throw Object.assign(new Error("directory open denied"), { code: "EACCES" });
        }
        return realOpenSync(openedPath, flags, mode);
      });
      expect(() => writeJsonFileSync(filePath, { key: "open" })).toThrow(
        expect.objectContaining({ code: "EACCES" }),
      );

      vi.restoreAllMocks();
      openCalls = 0;
      vi.spyOn(fs, "openSync").mockImplementation((openedPath, flags, mode) => {
        const descriptor = realOpenSync(openedPath, flags, mode);
        openCalls += 1;
        return descriptor;
      });
      vi.spyOn(fs, "fsyncSync").mockImplementation((descriptor) => {
        fsyncCalls += 1;
        if (fsyncCalls === 2) {
          throw Object.assign(new Error("directory fsync denied"), { code: "EACCES" });
        }
        return realFsyncSync(descriptor);
      });
      expect(() =>
        writeJsonFileSync(join(tempRoot, "windows-directory-fsync-ok.json"), { key: "sync" }),
      ).not.toThrow();
    });
  });

  it.skipIf(process.platform === "win32")(
    "preserves a synchronous directory fsync error when close also fails",
    async () => {
      const filePath = join(tempRoot, "directory-fsync-fails.json");
      const realOpenSync = fs.openSync.bind(fs);
      const realFsyncSync = fs.fsyncSync.bind(fs);
      const realCloseSync = fs.closeSync.bind(fs);
      let openCalls = 0;
      let directoryDescriptor: number | undefined;
      const syncError = Object.assign(new Error("directory fsync failed"), { code: "EIO" });
      vi.spyOn(fs, "openSync").mockImplementation((openedPath, flags, mode) => {
        const descriptor = realOpenSync(openedPath, flags, mode);
        openCalls += 1;
        if (openCalls === 2) directoryDescriptor = descriptor;
        return descriptor;
      });
      vi.spyOn(fs, "fsyncSync").mockImplementation((descriptor) => {
        if (descriptor === directoryDescriptor) throw syncError;
        return realFsyncSync(descriptor);
      });
      vi.spyOn(fs, "closeSync").mockImplementation((descriptor) => {
        if (descriptor === directoryDescriptor) {
          realCloseSync(descriptor);
          throw new Error("directory close failed");
        }
        return realCloseSync(descriptor);
      });

      let error: unknown;
      try {
        writeJsonFileSync(filePath, { key: "value" });
      } catch (caught) {
        error = caught;
      }

      expect(error).toBe(syncError);
      await expect(readFile(filePath, "utf-8")).resolves.toBe('{\n  "key": "value"\n}\n');
    },
  );

  it.skipIf(process.platform === "win32")(
    "propagates a synchronous directory close error when fsync succeeds",
    async () => {
      const filePath = join(tempRoot, "directory-close-fails.json");
      const realOpenSync = fs.openSync.bind(fs);
      const realCloseSync = fs.closeSync.bind(fs);
      let openCalls = 0;
      let directoryDescriptor: number | undefined;
      const closeError = new Error("directory close failed");
      vi.spyOn(fs, "openSync").mockImplementation((openedPath, flags, mode) => {
        const descriptor = realOpenSync(openedPath, flags, mode);
        openCalls += 1;
        if (openCalls === 2) directoryDescriptor = descriptor;
        return descriptor;
      });
      vi.spyOn(fs, "closeSync").mockImplementation((descriptor) => {
        if (descriptor === directoryDescriptor) {
          realCloseSync(descriptor);
          throw closeError;
        }
        return realCloseSync(descriptor);
      });

      expect(() => writeJsonFileSync(filePath, { key: "value" })).toThrow(closeError);
      await expect(readFile(filePath, "utf-8")).resolves.toBe('{\n  "key": "value"\n}\n');
    },
  );

  it("removes files and reports when they were already absent", async () => {
    const filePath = join(tempRoot, "delete-me.json");
    await writeFile(filePath, "{}", "utf-8");

    expect(removeFileSync(filePath)).toBe(true);
    expect(removeFileSync(filePath)).toBe(false);
  });

  it.skipIf(process.platform === "win32")(
    "durably removes an existing file and does not sync an absent one",
    async () => {
      const filePath = join(tempRoot, "durable-delete.json");
      const events: string[] = [];
      const realUnlinkSync = fs.unlinkSync.bind(fs);
      const realOpenSync = fs.openSync.bind(fs);
      const realFsyncSync = fs.fsyncSync.bind(fs);
      const realCloseSync = fs.closeSync.bind(fs);
      vi.spyOn(fs, "unlinkSync").mockImplementation((unlinkPath) => {
        events.push(`unlink:${String(unlinkPath)}`);
        return realUnlinkSync(unlinkPath);
      });
      vi.spyOn(fs, "openSync").mockImplementation((openedPath, flags, mode) => {
        events.push(`open:${String(openedPath)}:${String(flags)}:${String(mode)}`);
        return realOpenSync(openedPath, flags, mode);
      });
      vi.spyOn(fs, "fsyncSync").mockImplementation((descriptor) => {
        events.push(`fsync:${String(descriptor)}`);
        return realFsyncSync(descriptor);
      });
      vi.spyOn(fs, "closeSync").mockImplementation((descriptor) => {
        events.push(`close:${String(descriptor)}`);
        return realCloseSync(descriptor);
      });
      await writeFile(filePath, "content", "utf-8");

      expect(removeFileSyncDurable(filePath)).toBe(true);
      expect(removeFileSyncDurable(filePath)).toBe(false);

      expect(events.map((event) => event.split(":", 1)[0])).toEqual([
        "unlink",
        "open",
        "fsync",
        "close",
        "unlink",
      ]);
      expect(events[1]).toBe(`open:${tempRoot}:r:undefined`);
      expect(fs.existsSync(filePath)).toBe(false);
    },
  );

  it.skipIf(process.platform === "win32")(
    "propagates a durable unlink directory-sync failure after removing the file",
    async () => {
      const filePath = join(tempRoot, "durable-delete-fails.json");
      await writeFile(filePath, "content", "utf-8");
      vi.spyOn(fs, "fsyncSync").mockImplementation(() => {
        throw Object.assign(new Error("directory fsync failed"), { code: "EIO" });
      });

      let error: unknown;
      try {
        removeFileSyncDurable(filePath);
      } catch (caught) {
        error = caught;
      }

      expect(isNodeError(error, "EIO")).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    },
  );

  it("cleans up the temp file when writeJsonFileSync rename fails", async () => {
    // Force renameSync to throw by making the destination a non-empty directory.
    const filePath = join(tempRoot, "secrets.json");
    fs.mkdirSync(filePath);
    await writeFile(join(filePath, "child"), "x", "utf-8");

    expect(() => writeJsonFileSync(filePath, { key: "value" })).toThrow();

    const leftovers = (await readdir(tempRoot)).filter((name) => name.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("does not replace a target through a colliding temp symlink", async () => {
    const filePath = join(tempRoot, "identity.json");
    const protectedPath = join(tempRoot, "protected.json");
    const tempPath = `${filePath}.test-temp.tmp`;
    await writeFile(protectedPath, "original", "utf-8");
    await symlink(protectedPath, tempPath);

    expect(() => writeJsonFileSync(filePath, { key: "replacement" })).toThrow();

    await expect(readFile(protectedPath, "utf-8")).resolves.toBe("original");
    expect(fs.lstatSync(tempPath).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

describe("writeJsonFileSyncExclusive", () => {
  it.skipIf(process.platform === "win32")(
    "durably links the new identity before removing its temp name",
    () => {
      const filePath = join(tempRoot, "exclusive.json");
      const events: string[] = [];
      const realOpenSync = fs.openSync.bind(fs);
      const realWriteFileSync = fs.writeFileSync.bind(fs);
      const realFsyncSync = fs.fsyncSync.bind(fs);
      const realCloseSync = fs.closeSync.bind(fs);
      const realLinkSync = fs.linkSync.bind(fs);
      const realUnlinkSync = fs.unlinkSync.bind(fs);

      vi.spyOn(fs, "openSync").mockImplementation((openedPath, flags, mode) => {
        events.push(`open:${String(openedPath)}:${String(flags)}:${String(mode)}`);
        return realOpenSync(openedPath, flags, mode);
      });
      vi.spyOn(fs, "writeFileSync").mockImplementation((descriptor, data) => {
        events.push(`write:${String(descriptor)}`);
        return realWriteFileSync(descriptor, data);
      });
      vi.spyOn(fs, "fsyncSync").mockImplementation((descriptor) => {
        events.push(`fsync:${String(descriptor)}`);
        return realFsyncSync(descriptor);
      });
      vi.spyOn(fs, "closeSync").mockImplementation((descriptor) => {
        events.push(`close:${String(descriptor)}`);
        return realCloseSync(descriptor);
      });
      vi.spyOn(fs, "linkSync").mockImplementation((oldPath, newPath) => {
        events.push(`link:${String(oldPath)}:${String(newPath)}`);
        return realLinkSync(oldPath, newPath);
      });
      vi.spyOn(fs, "unlinkSync").mockImplementation((unlinkPath) => {
        events.push(`unlink:${String(unlinkPath)}`);
        return realUnlinkSync(unlinkPath);
      });

      writeJsonFileSyncExclusive(filePath, { key: "value" }, 0o640);

      const labels = events.map((event) => event.split(":", 1)[0]);
      expect(labels).toEqual([
        "open",
        "write",
        "fsync",
        "close",
        "link",
        "open",
        "fsync",
        "close",
        "unlink",
        "open",
        "fsync",
        "close",
      ]);
      expect(events[0]).toContain(".tmp:wx:416");
      expect(events[4]).toContain(filePath);
      expect(events[5]).toBe(`open:${tempRoot}:r:undefined`);
      expect(events[9]).toBe(`open:${tempRoot}:r:undefined`);
      expect(readJsonFileSync(filePath)).toEqual({ key: "value" });
    },
  );

  it("fails with EEXIST when the destination already exists, leaving the original file and any temp file untouched", async () => {
    const filePath = join(tempRoot, "exclusive.json");
    const originalContent = JSON.stringify({ key: "original" });
    await writeFile(filePath, originalContent, "utf-8");

    let error: unknown;
    try {
      writeJsonFileSyncExclusive(filePath, { key: "new" });
    } catch (caught) {
      error = caught;
    }

    expect(isNodeError(error, "EEXIST")).toBe(true);
    await expect(readFile(filePath, "utf-8")).resolves.toBe(originalContent);
    const leftovers = (await readdir(tempRoot)).filter((name) => name.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("preserves an existing temp symlink when exclusive creation collides", async () => {
    const filePath = join(tempRoot, "exclusive.json");
    const protectedPath = join(tempRoot, "protected.json");
    const tempPath = `${filePath}.test-temp.tmp`;
    await writeFile(protectedPath, "original", "utf-8");
    await symlink(protectedPath, tempPath);

    expect(() => writeJsonFileSyncExclusive(filePath, { key: "replacement" })).toThrow();

    await expect(readFile(protectedPath, "utf-8")).resolves.toBe("original");
    expect(fs.lstatSync(tempPath).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

describe("writeJsonFile", () => {
  it.skipIf(process.platform === "win32")(
    "creates the missing ancestors owner-only and flushes the file's directory after the rename",
    async () => {
      const filePath = join(tempRoot, "first", "second", "file.json");
      const syncedDirectories: string[] = [];
      const realOpen = fs.promises.open.bind(fs.promises);
      vi.spyOn(fs.promises, "open").mockImplementation(async (openedPath, flags, mode) => {
        const handle = await realOpen(openedPath, flags, mode);
        if (flags !== "r") return handle;
        const realSync = handle.sync.bind(handle);
        vi.spyOn(handle, "sync").mockImplementation(async () => {
          syncedDirectories.push(String(openedPath));
          return realSync();
        });
        return handle;
      });

      await writeJsonFile(filePath, { key: "value" });

      await expect(readFile(filePath, "utf-8")).resolves.toBe('{\n  "key": "value"\n}\n');
      expect(fs.statSync(join(tempRoot, "first")).mode & 0o777).toBe(0o700);
      expect(fs.statSync(join(tempRoot, "first", "second")).mode & 0o777).toBe(0o700);
      expect(syncedDirectories).toEqual([join(tempRoot, "first", "second")]);
    },
  );

  it.skipIf(process.platform === "win32")(
    "writes formatted JSON atomically without leaving temp files",
    async () => {
      const filePath = join(tempRoot, "nested", "file.json");
      const data = { key: "value" };

      await writeJsonFile(filePath, data);

      await expect(readFile(filePath, "utf-8")).resolves.toBe(`${JSON.stringify(data, null, 2)}\n`);
      await expect(readdir(join(tempRoot, "nested"))).resolves.toEqual(["file.json"]);
    },
  );

  it("cleans up the temp file when rename fails", async () => {
    const filePath = join(tempRoot, "file.json");
    vi.spyOn(fs.promises, "rename").mockRejectedValueOnce(new Error("rename failed"));

    await expect(writeJsonFile(filePath, { key: "value" })).rejects.toThrow("rename failed");

    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });
});

describe("atomicWriteFile", () => {
  it.skipIf(process.platform === "win32")(
    "flushes the file before rename and the containing directory after rename",
    async () => {
      const filePath = join(tempRoot, "file.txt");
      const events: string[] = [];
      const realOpen = fs.promises.open.bind(fs.promises);
      const realRename = fs.promises.rename.bind(fs.promises);

      vi.spyOn(fs.promises, "open").mockImplementation(async (openedPath, flags, mode) => {
        const openedPathString = String(openedPath);
        events.push(`open:${openedPathString}:${String(flags)}:${String(mode)}`);
        const handle = await realOpen(openedPath, flags, mode);
        const realWriteFile = handle.writeFile.bind(handle);
        const realSync = handle.sync.bind(handle);
        const realClose = handle.close.bind(handle);
        vi.spyOn(handle, "writeFile").mockImplementation(async (data) => {
          events.push(`write:${openedPathString}`);
          return realWriteFile(data);
        });
        vi.spyOn(handle, "sync").mockImplementation(async () => {
          events.push(`sync:${openedPathString}`);
          return realSync();
        });
        vi.spyOn(handle, "close").mockImplementation(async () => {
          events.push(`close:${openedPathString}`);
          return realClose();
        });
        return handle;
      });
      vi.spyOn(fs.promises, "rename").mockImplementation(async (oldPath, newPath) => {
        events.push(`rename:${String(oldPath)}:${String(newPath)}`);
        return realRename(oldPath, newPath);
      });

      await atomicWriteFile(filePath, "content", 0o640);

      const labels = events.map((event) => event.split(":", 1)[0]);
      expect(labels).toEqual(["open", "write", "sync", "close", "rename", "open", "sync", "close"]);
      expect(events[0]).toContain(".tmp:wx:416");
      expect(events[1]).toContain(".tmp");
      expect(events[2]).toContain(".tmp");
      expect(events[3]).toContain(".tmp");
      expect(events[4]).toContain(filePath);
      expect(events[5]).toBe(`open:${tempRoot}:r:undefined`);
      expect(events[6]).toBe(`sync:${tempRoot}`);
      expect(events[7]).toBe(`close:${tempRoot}`);
    },
  );

  it.skipIf(process.platform === "win32")(
    "persists content atomically without leaving temp files",
    async () => {
      const filePath = join(tempRoot, "file.txt");

      await atomicWriteFile(filePath, "content");

      await expect(readFile(filePath, "utf-8")).resolves.toBe("content");
      await expect(readdir(tempRoot)).resolves.toEqual(["file.txt"]);
    },
  );

  it("preserves a colliding temp symlink and its target", async () => {
    const filePath = join(tempRoot, "file.txt");
    const protectedPath = join(tempRoot, "protected.txt");
    const tempPath = `${filePath}.test-temp.tmp`;
    await writeFile(protectedPath, "original", "utf-8");
    await symlink(protectedPath, tempPath);

    await expect(atomicWriteFile(filePath, "replacement")).rejects.toMatchObject({
      code: "EEXIST",
    });

    await expect(readFile(protectedPath, "utf-8")).resolves.toBe("original");
    expect(fs.lstatSync(tempPath).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("cleans up its temp file when writing fails", async () => {
    spyOnTemporaryHandle((handle) => {
      vi.spyOn(handle, "writeFile").mockRejectedValueOnce(new Error("write failed"));
    });

    await expect(atomicWriteFile(join(tempRoot, "write-fails.txt"), "content")).rejects.toThrow(
      "write failed",
    );
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("cleans up its temp file when file fsync fails", async () => {
    spyOnTemporaryHandle((handle) => {
      vi.spyOn(handle, "sync").mockRejectedValueOnce(new Error("file fsync failed"));
    });

    await expect(atomicWriteFile(join(tempRoot, "sync-fails.txt"), "content")).rejects.toThrow(
      "file fsync failed",
    );
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("closes an async temp descriptor before cleanup even when unlink fails", async () => {
    const filePath = join(tempRoot, "async-fsync-close-observable.txt");
    const fsyncError = new Error("async fsync failed");
    let closeCalls = 0;
    spyOnTemporaryHandle((handle) => {
      const realClose = handle.close.bind(handle);
      vi.spyOn(handle, "sync").mockRejectedValueOnce(fsyncError);
      vi.spyOn(handle, "close").mockImplementation(async () => {
        closeCalls += 1;
        return realClose();
      });
    });
    vi.spyOn(fs.promises, "unlink").mockRejectedValueOnce(new Error("cleanup unlink failed"));

    await expect(atomicWriteFile(filePath, "content")).rejects.toBe(fsyncError);
    expect(closeCalls).toBe(1);
  });

  it("cleans up its temp file when closing the file fails", async () => {
    spyOnTemporaryHandle((handle) => {
      const realClose = handle.close.bind(handle);
      let closeCalls = 0;
      vi.spyOn(handle, "close").mockImplementation(async () => {
        closeCalls += 1;
        if (closeCalls === 1) throw new Error("file close failed");
        return realClose();
      });
    });

    await expect(atomicWriteFile(join(tempRoot, "close-fails.txt"), "content")).rejects.toThrow(
      "file close failed",
    );
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("cleans up the temp file when rename fails", async () => {
    const filePath = join(tempRoot, "file.txt");
    await writeFile(filePath, "original", "utf-8");
    vi.spyOn(fs.promises, "rename").mockRejectedValueOnce(new Error("rename failed"));

    await expect(atomicWriteFile(filePath, "content")).rejects.toThrow("rename failed");

    await expect(readFile(filePath, "utf-8")).resolves.toBe("original");
    await expect(readdir(tempRoot)).resolves.toEqual(["file.txt"]);
  });

  it.skipIf(process.platform === "win32")(
    "rejects when the directory cannot be synced after rename",
    async () => {
      const filePath = join(tempRoot, "file.txt");
      const realOpen = fs.promises.open.bind(fs.promises);
      let openCount = 0;
      vi.spyOn(fs.promises, "open").mockImplementation(async (openedPath, flags, mode) => {
        const handle = await realOpen(openedPath, flags, mode);
        openCount += 1;
        if (openCount === 2) {
          vi.spyOn(handle, "sync").mockRejectedValueOnce(new Error("directory sync failed"));
        }
        return handle;
      });

      await expect(atomicWriteFile(filePath, "content")).rejects.toThrow("directory sync failed");

      await expect(readFile(filePath, "utf-8")).resolves.toBe("content");
      await expect(readdir(tempRoot)).resolves.toEqual(["file.txt"]);
    },
  );

  it("propagates directory open failures after the rename", async () => {
    const filePath = join(tempRoot, "directory-open-fails.txt");
    const realOpen = fs.promises.open.bind(fs.promises);
    let openCalls = 0;
    vi.spyOn(fs.promises, "open").mockImplementation(async (openedPath, flags, mode) => {
      openCalls += 1;
      if (openCalls === 2) {
        throw Object.assign(new Error("directory open denied"), { code: "EACCES" });
      }
      return realOpen(openedPath, flags, mode);
    });

    await expect(atomicWriteFile(filePath, "content")).rejects.toMatchObject({ code: "EACCES" });
    await expect(readFile(filePath, "utf-8")).resolves.toBe("content");
    await expect(readdir(tempRoot)).resolves.toEqual(["directory-open-fails.txt"]);
  });

  it("downgrades only unsupported directory fsync errors", async () => {
    const filePath = join(tempRoot, "directory-fsync-unsupported.txt");
    const realOpen = fs.promises.open.bind(fs.promises);
    let openCalls = 0;
    vi.spyOn(fs.promises, "open").mockImplementation(async (openedPath, flags, mode) => {
      const handle = await realOpen(openedPath, flags, mode);
      openCalls += 1;
      if (openCalls === 2) {
        vi.spyOn(handle, "sync").mockRejectedValueOnce(
          Object.assign(new Error("directory fsync unsupported"), { code: "EINVAL" }),
        );
      }
      return handle;
    });

    await expect(atomicWriteFile(filePath, "content")).resolves.toBeUndefined();
    await expect(readFile(filePath, "utf-8")).resolves.toBe("content");
  });

  it.skipIf(process.platform === "win32")(
    "propagates EACCES from an opened directory during async fsync",
    async () => {
      const filePath = join(tempRoot, "directory-fsync-eacces.txt");
      const realOpen = fs.promises.open.bind(fs.promises);
      let openCalls = 0;
      vi.spyOn(fs.promises, "open").mockImplementation(async (openedPath, flags, mode) => {
        const handle = await realOpen(openedPath, flags, mode);
        openCalls += 1;
        if (openCalls === 2) {
          vi.spyOn(handle, "sync").mockRejectedValueOnce(
            Object.assign(new Error("directory fsync denied"), { code: "EACCES" }),
          );
        }
        return handle;
      });

      await expect(atomicWriteFile(filePath, "content")).rejects.toMatchObject({ code: "EACCES" });
      await expect(readFile(filePath, "utf-8")).resolves.toBe("content");
    },
  );

  it.skipIf(process.platform === "win32")(
    "propagates an async directory close error when fsync succeeds",
    async () => {
      const filePath = join(tempRoot, "directory-close-fails.txt");
      const realOpen = fs.promises.open.bind(fs.promises);
      let openCalls = 0;
      const closeError = new Error("directory close failed");
      vi.spyOn(fs.promises, "open").mockImplementation(async (openedPath, flags, mode) => {
        const handle = await realOpen(openedPath, flags, mode);
        openCalls += 1;
        if (openCalls === 2) {
          const realClose = handle.close.bind(handle);
          vi.spyOn(handle, "close").mockImplementation(async () => {
            await realClose();
            throw closeError;
          });
        }
        return handle;
      });

      await expect(atomicWriteFile(filePath, "content")).rejects.toBe(closeError);
      await expect(readFile(filePath, "utf-8")).resolves.toBe("content");
    },
  );

  it("downgrades Windows EACCES directory fsync errors but not directory open errors", async () => {
    await withPlatform("win32", async () => {
      const realOpen = fs.promises.open.bind(fs.promises);
      let openCalls = 0;
      vi.spyOn(fs.promises, "open").mockImplementation(async (openedPath, flags, mode) => {
        openCalls += 1;
        if (openCalls === 2) {
          throw Object.assign(new Error("directory open denied"), { code: "EACCES" });
        }
        return realOpen(openedPath, flags, mode);
      });
      await expect(
        atomicWriteFile(join(tempRoot, "windows-directory-open.txt"), "open"),
      ).rejects.toMatchObject({
        code: "EACCES",
      });

      vi.restoreAllMocks();
      openCalls = 0;
      vi.spyOn(fs.promises, "open").mockImplementation(async (openedPath, flags, mode) => {
        const handle = await realOpen(openedPath, flags, mode);
        openCalls += 1;
        if (openCalls === 2) {
          vi.spyOn(handle, "sync").mockRejectedValueOnce(
            Object.assign(new Error("directory fsync denied"), { code: "EACCES" }),
          );
        }
        return handle;
      });
      await expect(
        atomicWriteFile(join(tempRoot, "windows-directory-fsync-ok.txt"), "sync"),
      ).resolves.toBeUndefined();
    });
  });

  it("preserves a directory fsync error when directory close also fails", async () => {
    const filePath = join(tempRoot, "directory-fsync-fails.txt");
    const realOpen = fs.promises.open.bind(fs.promises);
    let openCalls = 0;
    const syncError = Object.assign(new Error("directory fsync failed"), { code: "EIO" });
    vi.spyOn(fs.promises, "open").mockImplementation(async (openedPath, flags, mode) => {
      const handle = await realOpen(openedPath, flags, mode);
      openCalls += 1;
      if (openCalls === 2) {
        const realClose = handle.close.bind(handle);
        vi.spyOn(handle, "sync").mockRejectedValueOnce(syncError);
        vi.spyOn(handle, "close").mockImplementation(async () => {
          await realClose();
          throw new Error("directory close failed");
        });
      }
      return handle;
    });

    await expect(atomicWriteFile(filePath, "content")).rejects.toBe(syncError);
    await expect(readFile(filePath, "utf-8")).resolves.toBe("content");
  });
});
