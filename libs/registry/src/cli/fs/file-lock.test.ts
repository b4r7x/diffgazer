import {
  existsSync,
  promises as fs,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withFileLock, withProjectFileLock } from "./file-lock.js";

describe("withFileLock", () => {
  let root: string;
  let lockPath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "registry-file-lock-"));
    lockPath = join(root, ".diffgazer", "add.lock");
    mkdirSync(dirname(lockPath), { recursive: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it("recovers a lock owned by a dead process", async () => {
    const deadPid = 987_654_321;
    writeFileSync(lockPath, JSON.stringify({ pid: deadPid, token: "dead-owner" }));
    vi.spyOn(process, "kill").mockImplementation((pid) => {
      if (pid === deadPid) throw Object.assign(new Error("missing process"), { code: "ESRCH" });
      return true;
    });

    let ran = false;
    await withFileLock(lockPath, async () => {
      ran = true;
    });

    expect(ran).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
  });

  it.each([
    "",
    '{"pid":',
    "{}",
  ])("recovers an unchanged malformed lock after the grace period: %j", async (content) => {
    writeFileSync(lockPath, content);
    const startedAt = Date.now();

    await withFileLock(lockPath, async () => {});

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(40);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("does not steal a valid live lock", async () => {
    let releaseOwner = () => {};
    let markAcquired = () => {};
    const acquired = new Promise<void>((resolve) => {
      markAcquired = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseOwner = resolve;
    });
    const owner = withFileLock(lockPath, async () => {
      markAcquired();
      await release;
    });
    await acquired;

    let contenderRan = false;
    const contender = withFileLock(lockPath, async () => {
      contenderRan = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 75));

    expect(contenderRan).toBe(false);
    releaseOwner();
    await Promise.all([owner, contender]);
    expect(contenderRan).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("times out when a live lock never releases", async () => {
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid, token: "live-owner" }));
    await expect(withFileLock(lockPath, async () => {}, { acquireTimeoutMs: 50 })).rejects.toThrow(
      /Timed out after 0.05s waiting for lock/,
    );
  });

  it("rechecks a partial lock before recovery when a live owner finishes writing it", async () => {
    writeFileSync(lockPath, '{"pid":');
    let contenderRan = false;
    const contender = withFileLock(lockPath, async () => {
      contenderRan = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid, token: "live-owner" }));
    await new Promise((resolve) => setTimeout(resolve, 75));

    expect(contenderRan).toBe(false);
    unlinkSync(lockPath);
    await contender;
    expect(contenderRan).toBe(true);
  });

  it("rejects a symlinked project lock directory without touching its target", async () => {
    const outside = mkdtempSync(join(tmpdir(), "registry-file-lock-outside-"));
    rmSync(dirname(lockPath), { recursive: true, force: true });
    symlinkSync(outside, dirname(lockPath), "dir");

    try {
      await expect(
        withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {}),
      ).rejects.toThrow(/symlink component/);
      expect(existsSync(join(outside, "mutation.lock"))).toBe(false);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("removes an empty project lock directory that it created", async () => {
    rmSync(dirname(lockPath), { recursive: true, force: true });

    await withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {});

    expect(existsSync(dirname(lockPath))).toBe(false);
  });

  it("preserves a pre-existing project lock directory", async () => {
    await withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {});

    expect(existsSync(dirname(lockPath))).toBe(true);
  });

  it("preserves a created project lock directory when it becomes nonempty", async () => {
    rmSync(dirname(lockPath), { recursive: true, force: true });
    const sentinelPath = join(dirname(lockPath), "sentinel");

    await withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {
      writeFileSync(sentinelPath, "keep");
    });

    expect(readFileSync(sentinelPath, "utf8")).toBe("keep");
  });

  it("preserves a replacement for a project lock directory that it created", async () => {
    const projectLockDir = dirname(lockPath);
    const movedLockDir = join(root, ".diffgazer-original");
    const sentinelPath = join(projectLockDir, "sentinel");
    rmSync(projectLockDir, { recursive: true, force: true });

    await expect(
      withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {
        renameSync(projectLockDir, movedLockDir);
        mkdirSync(projectLockDir);
        writeFileSync(sentinelPath, "replacement");
      }),
    ).rejects.toThrow(/changed while in use/);
    expect(readFileSync(sentinelPath, "utf8")).toBe("replacement");
  });

  it("rolls back a lock-directory component created through a swapped parent", async () => {
    const outside = mkdtempSync(join(tmpdir(), "registry-file-lock-outside-"));
    const projectLockDir = dirname(lockPath);
    const movedLockDir = join(root, ".diffgazer-original");
    const mkdir = fs.mkdir.bind(fs);
    vi.spyOn(fs, "mkdir").mockImplementationOnce(async (path, options) => {
      expect(String(path)).toBe(join(realpathSync(root), ".diffgazer", "locks"));
      renameSync(projectLockDir, movedLockDir);
      symlinkSync(outside, projectLockDir, "dir");
      return mkdir(path, options);
    });

    try {
      await expect(
        withProjectFileLock(root, ".diffgazer/locks/mutation.lock", async () => {}),
      ).rejects.toThrow(/symlink component|changed while in use/);
      expect(existsSync(join(outside, "locks"))).toBe(false);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rolls back its lock file when the target parent is swapped before create", async () => {
    const outside = mkdtempSync(join(tmpdir(), "registry-file-lock-outside-"));
    const projectLockDir = dirname(lockPath);
    const movedLockDir = join(root, ".diffgazer-original");
    const open = fs.open.bind(fs);
    vi.spyOn(fs, "open").mockImplementationOnce(async (path, flags, mode) => {
      expect(String(path)).toBe(join(realpathSync(root), ".diffgazer", "mutation.lock"));
      renameSync(projectLockDir, movedLockDir);
      symlinkSync(outside, projectLockDir, "dir");
      return open(path, flags, mode);
    });

    try {
      await expect(
        withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {}),
      ).rejects.toThrow(/symlink component|changed while in use/);
      expect(existsSync(join(outside, "mutation.lock"))).toBe(false);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("re-prepares the project lock directory when the owner cleans it mid-wait", async () => {
    rmSync(dirname(lockPath), { recursive: true, force: true });
    let releaseOwner = () => {};
    let markAcquired = () => {};
    const acquired = new Promise<void>((resolve) => {
      markAcquired = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseOwner = resolve;
    });
    const owner = withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {
      markAcquired();
      await release;
    });
    await acquired;

    let contenderRan = false;
    const contender = withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {
      contenderRan = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 75));

    expect(contenderRan).toBe(false);
    releaseOwner();
    await Promise.all([owner, contender]);
    expect(contenderRan).toBe(true);
    expect(existsSync(dirname(lockPath))).toBe(false);
  });

  it("removes an empty lock directory after waiting on a creator that failed cleanup", async () => {
    rmSync(dirname(lockPath), { recursive: true, force: true });
    let releaseOwner = () => {};
    let markAcquired = () => {};
    const acquired = new Promise<void>((resolve) => {
      markAcquired = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseOwner = resolve;
    });
    const owner = withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {
      markAcquired();
      await release;
    });
    await acquired;

    let contenderAcquired = () => {};
    const contenderReady = new Promise<void>((resolve) => {
      contenderAcquired = resolve;
    });
    const contender = withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {
      contenderAcquired();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    await new Promise((resolve) => setTimeout(resolve, 75));
    releaseOwner();
    await contenderReady;
    await Promise.all([owner, contender]);
    expect(existsSync(dirname(lockPath))).toBe(false);
  });

  it("does not unlink a foreign lock swapped in at cleanup", async () => {
    const mutationLockPath = join(dirname(lockPath), "mutation.lock");
    const foreignOwner = JSON.stringify({ pid: process.pid, token: "foreign-owner" });
    const rename = fs.rename.bind(fs);
    vi.spyOn(fs, "rename").mockImplementationOnce(async (from, to) => {
      const activeLockPath = String(from);
      expect(activeLockPath).toBe(join(realpathSync(root), ".diffgazer", "mutation.lock"));
      unlinkSync(activeLockPath);
      writeFileSync(activeLockPath, foreignOwner);
      return rename(from, to);
    });

    await withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {});

    expect(readFileSync(mutationLockPath, "utf8")).toBe(foreignOwner);
  });

  it("revalidates the project lock directory before cleanup", async () => {
    const outside = mkdtempSync(join(tmpdir(), "registry-file-lock-outside-"));
    const projectLockDir = dirname(lockPath);
    const movedLockDir = join(root, ".diffgazer-original");
    const outsideLock = join(outside, "mutation.lock");

    try {
      await expect(
        withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {
          renameSync(projectLockDir, movedLockDir);
          symlinkSync(outside, projectLockDir, "dir");
          writeFileSync(outsideLock, "external sentinel");
        }),
      ).rejects.toThrow(/symlink component/);
      expect(readFileSync(outsideLock, "utf8")).toBe("external sentinel");
      expect(existsSync(projectLockDir)).toBe(true);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
