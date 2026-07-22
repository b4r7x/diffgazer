import { randomBytes } from "node:crypto";
import {
  lstat as lstatAsync,
  mkdir as mkdirAsync,
  readFile as readFileAsync,
  unlink as unlinkAsync,
  writeFile as writeFileAsync,
} from "node:fs/promises";
import { dirname } from "node:path";
import { isEnoent } from "./path-safety.js";

interface FileLockOwner {
  pid: number;
  token: string;
}

interface FileLockSnapshot {
  content: string;
  owner: FileLockOwner | null;
  stat: {
    ctimeMs: number;
    dev: number;
    ino: number;
    mtimeMs: number;
    size: number;
  };
}

const MALFORMED_LOCK_GRACE_MS = 50;

function isFileLockOwner(value: unknown): value is FileLockOwner {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.pid === "number" &&
    Number.isSafeInteger(record.pid) &&
    record.pid > 0 &&
    typeof record.token === "string" &&
    record.token.length > 0
  );
}

function sameFileStat(left: FileLockSnapshot["stat"], right: FileLockSnapshot["stat"]): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

async function readFileLockSnapshot(lockPath: string): Promise<FileLockSnapshot | null> {
  try {
    const before = await lstatAsync(lockPath);
    const content = await readFileAsync(lockPath, "utf8");
    const after = await lstatAsync(lockPath);
    const beforeStat = {
      ctimeMs: before.ctimeMs,
      dev: before.dev,
      ino: before.ino,
      mtimeMs: before.mtimeMs,
      size: before.size,
    };
    const afterStat = {
      ctimeMs: after.ctimeMs,
      dev: after.dev,
      ino: after.ino,
      mtimeMs: after.mtimeMs,
      size: after.size,
    };
    if (!sameFileStat(beforeStat, afterStat)) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = null;
    }
    return {
      content,
      owner: isFileLockOwner(parsed) ? parsed : null,
      stat: afterStat,
    };
  } catch {
    return null;
  }
}

function sameFileLock(left: FileLockSnapshot, right: FileLockSnapshot): boolean {
  return left.content === right.content && sameFileStat(left.stat, right.stat);
}

async function removeFileLockIfUnchanged(
  lockPath: string,
  expected: FileLockSnapshot,
): Promise<boolean> {
  const confirmed = await readFileLockSnapshot(lockPath);
  if (!confirmed || !sameFileLock(confirmed, expected)) return false;

  try {
    await unlinkAsync(lockPath);
    return true;
  } catch (error) {
    if (isEnoent(error)) return false;
    throw error;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
}

function waitForFileLock(): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, 10));
}

export async function withFileLock<T>(lockPath: string, operation: () => Promise<T>): Promise<T> {
  await mkdirAsync(dirname(lockPath), { recursive: true });
  const owner: FileLockOwner = {
    pid: process.pid,
    token: randomBytes(12).toString("hex"),
  };
  const serializedOwner = JSON.stringify(owner);
  let malformedLock: { firstSeenAt: number; snapshot: FileLockSnapshot } | null = null;

  while (true) {
    try {
      await writeFileAsync(lockPath, serializedOwner, { flag: "wx" });
      break;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      const current = await readFileLockSnapshot(lockPath);
      if (current?.owner) {
        malformedLock = null;
        if (!isProcessRunning(current.owner.pid)) {
          await removeFileLockIfUnchanged(lockPath, current);
          continue;
        }
      } else if (current) {
        if (!malformedLock || !sameFileLock(malformedLock.snapshot, current)) {
          malformedLock = { firstSeenAt: Date.now(), snapshot: current };
        } else if (Date.now() - malformedLock.firstSeenAt >= MALFORMED_LOCK_GRACE_MS) {
          await removeFileLockIfUnchanged(lockPath, current);
          malformedLock = null;
          continue;
        }
      } else {
        malformedLock = null;
      }
      await waitForFileLock();
    }
  }

  try {
    return await operation();
  } finally {
    const current = await readFileLockSnapshot(lockPath);
    if (current?.owner?.token === owner.token) {
      await removeFileLockIfUnchanged(lockPath, current);
    }
  }
}
