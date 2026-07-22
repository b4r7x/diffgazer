import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withFileLock } from "./file-lock.js";

describe("withFileLock", () => {
  let root: string;
  let lockPath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "registry-file-lock-"));
    lockPath = join(root, ".diffgazer", "add.lock");
    mkdirSync(dirname(lockPath), { recursive: true });
  });

  afterEach(() => {
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
});
