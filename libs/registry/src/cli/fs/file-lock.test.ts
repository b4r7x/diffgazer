import {
  constants,
  existsSync,
  promises as fs,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withFileLock, withProjectFileLock } from "./file-lock.js";

const WAIT_NOTICE = "Waiting for another dgadd run to finish";

// A contender announces the wait exactly once, before its first sleep, so this
// resolves the moment it has tried to acquire, been refused, and parked behind
// the live owner. Coordinating on that event instead of a wall-clock sleep is
// what keeps the tests below honest on a loaded machine.
function contenderParked(): Promise<void> {
  return new Promise((resolveParked) => {
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      if (typeof line === "string" && line.includes(WAIT_NOTICE)) resolveParked();
    });
  });
}

// Every poll re-reads the lock file and probes the owner it names with
// `process.kill(pid, 0)`, so this resolves on the first poll that saw the
// current contents of the lock.
function ownerProbed(): Promise<void> {
  return new Promise((resolveProbed) => {
    const kill = process.kill.bind(process);
    vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
      resolveProbed();
      return kill(pid, signal);
    });
  });
}

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

    const parked = contenderParked();
    let contenderRan = false;
    const contender = withFileLock(lockPath, async () => {
      contenderRan = true;
    });
    await Promise.race([parked, contender]);

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
    const parked = contenderParked();
    let contenderRan = false;
    const contender = withFileLock(lockPath, async () => {
      contenderRan = true;
    });
    await Promise.race([parked, contender]);

    const probed = ownerProbed();
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid, token: "live-owner" }));
    // The contender either re-reads and defers to the finished owner, or recovers
    // the partial lock it snapshotted first and runs.
    await Promise.race([probed, contender]);

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

  it("re-creates a lock directory component swept away between its mkdir and identity read", async () => {
    rmSync(dirname(lockPath), { recursive: true, force: true });
    const projectLockDir = join(realpathSync(root), ".diffgazer");
    const mkdir = fs.mkdir.bind(fs);
    // A sibling's empty-directory sweep lands right after the mkdir, the way a
    // recycled inode number lets it through the sibling's identity pin.
    vi.spyOn(fs, "mkdir").mockImplementationOnce(async (path, options) => {
      const result = await mkdir(path, options);
      rmdirSync(String(path));
      return result;
    });

    let ran = false;
    await withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {
      ran = true;
    });

    expect(ran).toBe(true);
    expect(existsSync(projectLockDir)).toBe(false);
  });

  it("preserves a lock directory component a sibling re-created after sweeping ours", async () => {
    rmSync(dirname(lockPath), { recursive: true, force: true });
    const projectLockDir = join(realpathSync(root), ".diffgazer");
    const mkdir = fs.mkdir.bind(fs);
    // Our first mkdir is swept; the sibling then re-creates the component
    // before our retry, so the retry loses with EEXIST and must not keep
    // claiming ownership of a directory the sibling now owns.
    vi.spyOn(fs, "mkdir")
      .mockImplementationOnce(async (path, options) => {
        const result = await mkdir(path, options);
        rmdirSync(String(path));
        return result;
      })
      .mockImplementationOnce(async (path, options) => {
        mkdirSync(String(path));
        return mkdir(path, options);
      });

    await withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {});

    expect(existsSync(projectLockDir)).toBe(true);
  });

  it("gives up on a lock directory component that keeps being swept away", async () => {
    rmSync(dirname(lockPath), { recursive: true, force: true });
    const mkdir = fs.mkdir.bind(fs);
    vi.spyOn(fs, "mkdir").mockImplementation(async (path, options) => {
      const result = await mkdir(path, options);
      rmdirSync(String(path));
      return result;
    });

    await expect(
      withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {}),
    ).rejects.toMatchObject({ code: "ENOENT" });
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
    // Only the contender's poll sleep is faked, so the owner finishes its whole
    // cleanup (real fs work) while the contender is parked and the contender
    // wakes to a lock directory that is already gone — the case under test.
    // Left to wall-clock timing, a loaded runner woke the contender mid-cleanup
    // and it raced the directory swap instead.
    vi.useFakeTimers({ toFake: ["setTimeout"] });
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

    const parked = contenderParked();
    let contenderRan = false;
    const contender = withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {
      contenderRan = true;
    });
    await Promise.race([parked, contender]);

    expect(contenderRan).toBe(false);
    releaseOwner();
    await owner;
    expect(existsSync(dirname(lockPath))).toBe(false);

    await vi.runAllTimersAsync();
    await contender;
    expect(contenderRan).toBe(true);
    expect(existsSync(dirname(lockPath))).toBe(false);
  });

  it("leaves neither a lock nor a directory behind when a contender creates its lock while the owner removes the directory", async () => {
    rmSync(dirname(lockPath), { recursive: true, force: true });
    const projectLockDir = join(realpathSync(root), ".diffgazer");
    const mutationLockPath = join(projectLockDir, "mutation.lock");
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

    const parked = contenderParked();
    let contenderRan = false;
    const contender = withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {
      contenderRan = true;
    });
    await Promise.race([parked, contender]);
    expect(contenderRan).toBe(false);

    // Pin the interleaving that resurrected a stale lock: the contender's
    // exclusive create lands after the owner released its lock but before the
    // owner has removed the directory it created, and the owner's removal step
    // completes while the contender is still between that create and its
    // post-write validation.
    let markContenderCreated = () => {};
    const contenderCreated = new Promise<void>((resolve) => {
      markContenderCreated = resolve;
    });
    let markOwnerRemoved = () => {};
    const ownerRemoved = new Promise<void>((resolve) => {
      markOwnerRemoved = resolve;
    });
    const open = fs.open.bind(fs);
    vi.spyOn(fs, "open").mockImplementation(async (path, flags, mode) => {
      const handle = await open(path, flags, mode);
      if (typeof flags === "number" && (flags & constants.O_CREAT) !== 0) {
        markContenderCreated();
        await ownerRemoved;
      }
      return handle;
    });
    const rmdir = fs.rmdir.bind(fs);
    vi.spyOn(fs, "rmdir").mockImplementationOnce(async (path, options) => {
      await contenderCreated;
      try {
        await rmdir(path, options);
      } finally {
        markOwnerRemoved();
      }
    });
    // The owner must never move its directory out from under a contender. If a
    // quarantine rename of the created directory ever comes back, force it into
    // the same window and let the contender finish first, so its rmdir fails on
    // the stranded lock and the restore resurrects it — the defect this pins.
    const rename = fs.rename.bind(fs);
    let movedCreatedDirectory = false;
    vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
      if (String(from) !== projectLockDir || movedCreatedDirectory) return rename(from, to);
      movedCreatedDirectory = true;
      await contenderCreated;
      await rename(from, to);
      markOwnerRemoved();
      await contender;
    });

    releaseOwner();
    await Promise.all([owner, contender]);

    expect(contenderRan).toBe(true);
    expect(existsSync(mutationLockPath)).toBe(false);
    expect(existsSync(projectLockDir)).toBe(false);
    expect(readdirSync(root)).toEqual([]);
  });

  it("returns the owner's result when a contender re-creates the lock directory the owner just removed", async () => {
    rmSync(dirname(lockPath), { recursive: true, force: true });
    const projectLockDir = join(realpathSync(root), ".diffgazer");
    // Only the contender's poll sleep is faked so it cannot wake before the
    // owner's rmdir has actually landed: the owner wins the rmdir, the
    // contender re-creates the directory under a new inode, and the owner's
    // final empty-directory sweep then runs against a directory it did not
    // create. Holding the contender inside its mkdir until the owner settles
    // is what forces that sweep to see the replacement.
    vi.useFakeTimers({ toFake: ["setTimeout"] });
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
      return "owner result";
    });
    await acquired;

    const parked = contenderParked();
    let contenderRan = false;
    const contender = withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {
      contenderRan = true;
    });
    await Promise.race([parked, contender]);
    expect(contenderRan).toBe(false);

    let markOwnerRemoved = () => {};
    const ownerRemoved = new Promise<void>((resolve) => {
      markOwnerRemoved = resolve;
    });
    let markContenderRecreated = () => {};
    const contenderRecreated = new Promise<void>((resolve) => {
      markContenderRecreated = resolve;
    });
    const ownerSettled = Promise.allSettled([owner]);
    const mkdir = fs.mkdir.bind(fs);
    vi.spyOn(fs, "mkdir").mockImplementation(async (path, options) => {
      const result = await mkdir(path, options);
      if (String(path) === projectLockDir) {
        markContenderRecreated();
        await ownerSettled;
      }
      return result;
    });
    const rmdir = fs.rmdir.bind(fs);
    vi.spyOn(fs, "rmdir").mockImplementationOnce(async (path, options) => {
      await rmdir(path, options);
      markOwnerRemoved();
      await contenderRecreated;
    });

    releaseOwner();
    await ownerRemoved;
    await vi.runAllTimersAsync();
    await expect(owner).resolves.toBe("owner result");
    await contender;

    expect(contenderRan).toBe(true);
    expect(readdirSync(root)).toEqual([]);
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

    const parked = contenderParked();
    let contenderRan = false;
    const contender = withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {
      contenderRan = true;
      // Hold the lock until the owner has finished cleaning up, so the directory
      // is left behind by a creator that could not remove it.
      await owner;
    });
    await Promise.race([parked, contender]);

    releaseOwner();
    await Promise.all([owner, contender]);
    expect(contenderRan).toBe(true);
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

  it("drops the quarantine copy when the lock path is recreated before restore", async () => {
    const mutationLockPath = join(dirname(lockPath), "mutation.lock");
    const foreignOwner = JSON.stringify({ pid: process.pid, token: "foreign-owner" });
    const rename = fs.rename.bind(fs);
    vi.spyOn(fs, "rename").mockImplementationOnce(async (from, to) => {
      const activeLockPath = String(from);
      unlinkSync(activeLockPath);
      writeFileSync(activeLockPath, foreignOwner);
      await rename(from, to);
      writeFileSync(activeLockPath, foreignOwner);
    });

    await withProjectFileLock(root, ".diffgazer/mutation.lock", async () => {});

    expect(readFileSync(mutationLockPath, "utf8")).toBe(foreignOwner);
    expect(readdirSync(dirname(mutationLockPath)).filter((n) => n.endsWith(".cleanup"))).toEqual(
      [],
    );
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
