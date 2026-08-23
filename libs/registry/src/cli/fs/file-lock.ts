import { randomBytes } from "node:crypto";
import { constants, promises as fs } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { isRelativeSubpath } from "../../utils/fs.js";
import { info } from "../terminal.js";
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
const LOCK_ACQUIRE_TIMEOUT_MS = 120_000;
// Each poll re-stats every guarded path component, so a long legitimate wait
// (an interactive init, a cold package-manager store) backs off instead of
// hammering the lock path hundreds of times a second.
const LOCK_POLL_MIN_MS = 10;
const LOCK_POLL_MAX_MS = 250;

type ValidateLockPath = () => Promise<void>;

interface PathIdentity {
  dev: number;
  ino: number;
}

interface GuardedProjectLockPath {
  cleanupCreatedDirectories: () => Promise<void>;
  hasCreatedDirectories: boolean;
  lockPath: string;
  validateLockPath: ValidateLockPath;
}

interface FileLockOptions {
  acquireTimeoutMs?: number;
  directoryReady?: boolean;
  onDidWaitForLock?: () => void;
  refreshLockPath?: () => Promise<ValidateLockPath>;
  validateLockPath?: ValidateLockPath;
}

async function ensureLockPathReady(
  validateLockPath: ValidateLockPath | undefined,
  refreshLockPath: (() => Promise<ValidateLockPath>) | undefined,
): Promise<ValidateLockPath | undefined> {
  if (!validateLockPath) return undefined;
  try {
    await validateLockPath();
    return validateLockPath;
  } catch (error) {
    if (!isEnoent(error) || !refreshLockPath) throw error;
    const refreshed = await refreshLockPath();
    await refreshed();
    return refreshed;
  }
}

function samePathIdentity(left: PathIdentity, right: PathIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

async function readDirectoryIdentity(path: string): Promise<PathIdentity> {
  const stat = await fs.lstat(path);
  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing project lock path with symlink component: "${path}".`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`Project lock path component is not a directory: "${path}".`);
  }
  return { dev: stat.dev, ino: stat.ino };
}

async function assertDirectoryIdentity(path: string, expected: PathIdentity): Promise<void> {
  const current = await readDirectoryIdentity(path);
  if (!samePathIdentity(current, expected)) {
    throw new Error(`Project lock path changed while in use: "${path}".`);
  }
}

async function restoreMovedDirectory(from: string, to: string): Promise<void> {
  try {
    await fs.rename(from, to);
  } catch (error) {
    if (!hasErrorCode(error, "EEXIST") && !hasErrorCode(error, "ENOTEMPTY")) throw error;
  }
}

async function restoreMovedFile(from: string, to: string): Promise<void> {
  try {
    await fs.link(from, to);
    await fs.unlink(from);
  } catch (error) {
    if (!hasErrorCode(error, "EEXIST")) throw error;
  }
}

async function cleanupCreatedDirectory(
  path: string,
  expected: PathIdentity,
  validateParent: ValidateLockPath,
): Promise<void> {
  try {
    await validateParent();
    const current = await readDirectoryIdentity(path);
    if (!samePathIdentity(current, expected)) return;
    await validateParent();

    const quarantinePath = resolve(
      dirname(path),
      `.${basename(path)}.${randomBytes(12).toString("hex")}.cleanup`,
    );
    await fs.rename(path, quarantinePath);
    const moved = await readDirectoryIdentity(quarantinePath);
    if (!samePathIdentity(moved, expected)) {
      await restoreMovedDirectory(quarantinePath, path);
      return;
    }

    try {
      await fs.rmdir(quarantinePath);
    } catch (error) {
      await restoreMovedDirectory(quarantinePath, path);
      if (!hasErrorCode(error, "ENOTEMPTY") && !hasErrorCode(error, "EEXIST")) throw error;
    }
  } catch (error) {
    if (isEnoent(error)) return;
    throw error;
  }
}

async function prepareProjectLockPath(
  projectRoot: string,
  lockPath: string,
): Promise<GuardedProjectLockPath> {
  const directoryEntries: Array<{ identity: PathIdentity; path: string }> = [
    { identity: await readDirectoryIdentity(projectRoot), path: projectRoot },
  ];
  const createdEntries: Array<{ identity: PathIdentity; path: string }> = [];
  const lockDirectory = dirname(lockPath);
  const relativeDirectory = relative(projectRoot, lockDirectory);
  let parentPath = projectRoot;

  for (const component of relativeDirectory === "" || relativeDirectory === "."
    ? []
    : relativeDirectory.split(sep)) {
    const parentEntries = [...directoryEntries];
    const validateParent = async () => {
      for (const entry of parentEntries) {
        await assertDirectoryIdentity(entry.path, entry.identity);
      }
    };
    const path = resolve(parentPath, component);
    await validateParent();

    let identity: PathIdentity;
    try {
      identity = await readDirectoryIdentity(path);
    } catch (error) {
      if (!isEnoent(error)) throw error;
      await validateParent();
      let didCreate = false;
      try {
        await fs.mkdir(path, { mode: 0o700 });
        didCreate = true;
      } catch (mkdirError) {
        if (!hasErrorCode(mkdirError, "EEXIST")) throw mkdirError;
      }
      identity = await readDirectoryIdentity(path);
      try {
        await validateParent();
      } catch (error) {
        if (didCreate) await cleanupCreatedDirectory(path, identity, async () => {});
        throw error;
      }
      if (didCreate) createdEntries.push({ identity, path });
    }
    directoryEntries.push({ identity, path });
    parentPath = path;
  }

  const validateLockPath = async () => {
    for (const entry of directoryEntries) {
      await assertDirectoryIdentity(entry.path, entry.identity);
    }
  };
  const cleanupCreatedDirectories = async () => {
    for (let index = createdEntries.length - 1; index >= 0; index -= 1) {
      const created = createdEntries[index];
      if (!created) continue;
      const createdIndex = directoryEntries.findIndex((entry) => entry.path === created.path);
      const parentEntries = directoryEntries.slice(0, createdIndex);
      await cleanupCreatedDirectory(created.path, created.identity, async () => {
        for (const entry of parentEntries) {
          await assertDirectoryIdentity(entry.path, entry.identity);
        }
      });
    }
  };

  return {
    cleanupCreatedDirectories,
    hasCreatedDirectories: createdEntries.length > 0,
    lockPath,
    validateLockPath,
  };
}

async function tryRemoveEmptyLockDirectory(
  lockPath: string,
  validateLockPath?: ValidateLockPath,
): Promise<void> {
  const lockDirectory = dirname(lockPath);
  try {
    await validateLockPath?.();
    const entries = await fs.readdir(lockDirectory);
    if (entries.length > 0) return;
    await validateLockPath?.();
    await fs.rmdir(lockDirectory);
  } catch (error) {
    if (isEnoent(error) || hasErrorCode(error, "ENOTEMPTY") || hasErrorCode(error, "EEXIST")) {
      return;
    }
    throw error;
  }
}

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

async function readFileLockSnapshot(
  lockPath: string,
  validateLockPath?: ValidateLockPath,
): Promise<FileLockSnapshot | null> {
  try {
    await validateLockPath?.();
    const handle = await fs.open(lockPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    let before: Awaited<ReturnType<typeof handle.stat>>;
    let content: string;
    let after: Awaited<ReturnType<typeof handle.stat>>;
    try {
      before = await handle.stat();
      content = await handle.readFile("utf8");
      after = await handle.stat();
    } finally {
      await handle.close();
    }
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
  } catch (error) {
    if (isEnoent(error)) return null;
    throw error;
  }
}

function sameFileLock(left: FileLockSnapshot, right: FileLockSnapshot): boolean {
  return left.content === right.content && sameFileStat(left.stat, right.stat);
}

function sameFileIdentity(left: FileLockSnapshot, right: FileLockSnapshot): boolean {
  return (
    left.content === right.content &&
    left.stat.dev === right.stat.dev &&
    left.stat.ino === right.stat.ino
  );
}

async function removeFileLockIfUnchanged(
  lockPath: string,
  expected: FileLockSnapshot,
  validateLockPath?: ValidateLockPath,
): Promise<boolean> {
  const confirmed = await readFileLockSnapshot(lockPath, validateLockPath);
  if (!confirmed || !sameFileLock(confirmed, expected)) return false;

  try {
    await validateLockPath?.();
    const beforeMove = await readFileLockSnapshot(lockPath, validateLockPath);
    if (!beforeMove || !sameFileLock(beforeMove, expected)) return false;

    const quarantinePath = resolve(
      dirname(lockPath),
      `.${basename(lockPath)}.${randomBytes(12).toString("hex")}.cleanup`,
    );
    await fs.rename(lockPath, quarantinePath);
    const moved = await readFileLockSnapshot(quarantinePath);
    if (!moved || !sameFileIdentity(moved, expected)) {
      await restoreMovedFile(quarantinePath, lockPath);
      return false;
    }

    const beforeUnlink = await readFileLockSnapshot(quarantinePath);
    if (!beforeUnlink || !sameFileLock(beforeUnlink, moved)) {
      await restoreMovedFile(quarantinePath, lockPath);
      return false;
    }
    await fs.unlink(quarantinePath);
    return true;
  } catch (error) {
    if (isEnoent(error)) return false;
    throw error;
  }
}

async function createFileLock(
  lockPath: string,
  content: string,
  validateLockPath?: ValidateLockPath,
): Promise<void> {
  await validateLockPath?.();
  const handle = await fs.open(
    lockPath,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(content, "utf8");
  } finally {
    await handle.close();
  }
  try {
    await validateLockPath?.();
  } catch (error) {
    const created = await readFileLockSnapshot(lockPath);
    if (created?.content === content) await removeFileLockIfUnchanged(lockPath, created);
    throw error;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !hasErrorCode(error, "ESRCH");
  }
}

function waitForFileLock(delayMs: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, delayMs));
}

function formatLockOwner(owner: FileLockOwner | null | undefined): string {
  return owner ? ` (owned by pid ${owner.pid})` : "";
}

export async function withFileLock<T>(
  lockPath: string,
  operation: () => Promise<T>,
  options?: { acquireTimeoutMs?: number },
): Promise<T> {
  return runWithFileLock(lockPath, operation, options);
}

async function runWithFileLock<T>(
  lockPath: string,
  operation: () => Promise<T>,
  options?: FileLockOptions,
): Promise<T> {
  const acquireTimeoutMs = options?.acquireTimeoutMs ?? LOCK_ACQUIRE_TIMEOUT_MS;
  let validateLockPath = await ensureLockPathReady(
    options?.validateLockPath,
    options?.refreshLockPath,
  );
  if (!options?.directoryReady) {
    await fs.mkdir(dirname(lockPath), { recursive: true });
  }
  validateLockPath = await ensureLockPathReady(validateLockPath, options?.refreshLockPath);
  const owner: FileLockOwner = {
    pid: process.pid,
    token: randomBytes(12).toString("hex"),
  };
  const serializedOwner = JSON.stringify(owner);
  let malformedLock: { firstSeenAt: number; snapshot: FileLockSnapshot } | null = null;
  const waitStartedAt = Date.now();
  let reportedWait = false;
  let pollDelayMs = LOCK_POLL_MIN_MS;

  while (true) {
    if (Date.now() - waitStartedAt >= acquireTimeoutMs) {
      const current = await readFileLockSnapshot(lockPath, validateLockPath);
      throw new Error(
        `Timed out after ${acquireTimeoutMs / 1000}s waiting for lock at ${lockPath}${formatLockOwner(current?.owner)}`,
      );
    }

    try {
      validateLockPath = await ensureLockPathReady(validateLockPath, options?.refreshLockPath);
      try {
        await createFileLock(lockPath, serializedOwner, validateLockPath);
      } catch (createError) {
        if (isEnoent(createError) && options?.refreshLockPath) {
          validateLockPath = await options.refreshLockPath();
          await validateLockPath();
          continue;
        }
        throw createError;
      }
      if (reportedWait) options?.onDidWaitForLock?.();
      break;
    } catch (error) {
      if (!hasErrorCode(error, "EEXIST")) throw error;
      const current = await readFileLockSnapshot(lockPath, validateLockPath);
      if (current?.owner) {
        malformedLock = null;
        if (!isProcessRunning(current.owner.pid)) {
          await removeFileLockIfUnchanged(lockPath, current, validateLockPath);
          continue;
        }
      } else if (current) {
        if (!malformedLock || !sameFileLock(malformedLock.snapshot, current)) {
          malformedLock = { firstSeenAt: Date.now(), snapshot: current };
        } else if (Date.now() - malformedLock.firstSeenAt >= MALFORMED_LOCK_GRACE_MS) {
          await removeFileLockIfUnchanged(lockPath, current, validateLockPath);
          malformedLock = null;
          continue;
        }
      } else {
        malformedLock = null;
      }
      if (!reportedWait) {
        info(`Waiting for another dgadd run to finish (${lockPath})…`);
        reportedWait = true;
      }
      await waitForFileLock(pollDelayMs);
      pollDelayMs = Math.min(pollDelayMs * 2, LOCK_POLL_MAX_MS);
    }
  }

  try {
    return await operation();
  } finally {
    const current = await readFileLockSnapshot(lockPath, validateLockPath);
    if (current?.owner?.token === owner.token) {
      await removeFileLockIfUnchanged(lockPath, current, validateLockPath);
    }
  }
}

export async function withProjectFileLock<T>(
  cwd: string,
  relativeLockPath: string,
  operation: () => Promise<T>,
  options?: { acquireTimeoutMs?: number },
): Promise<T> {
  if (!isRelativeSubpath(relativeLockPath)) {
    throw new Error(`Project lock path must be relative: "${relativeLockPath}".`);
  }

  const projectRoot = await fs.realpath(resolve(cwd));
  const lockPath = resolve(projectRoot, relativeLockPath);
  const guardedPaths: GuardedProjectLockPath[] = [];
  let guardedPath = await prepareProjectLockPath(projectRoot, lockPath);
  guardedPaths.push(guardedPath);
  let didWaitForLock = false;
  try {
    return await runWithFileLock(guardedPath.lockPath, operation, {
      acquireTimeoutMs: options?.acquireTimeoutMs,
      directoryReady: true,
      onDidWaitForLock: () => {
        didWaitForLock = true;
      },
      refreshLockPath: async () => {
        guardedPath = await prepareProjectLockPath(projectRoot, lockPath);
        guardedPaths.push(guardedPath);
        return guardedPath.validateLockPath;
      },
      validateLockPath: guardedPath.validateLockPath,
    });
  } finally {
    for (const path of guardedPaths) {
      await path.cleanupCreatedDirectories();
    }
    if (didWaitForLock || guardedPaths.some((path) => path.hasCreatedDirectories)) {
      const activePath = guardedPaths[guardedPaths.length - 1];
      if (activePath) {
        await tryRemoveEmptyLockDirectory(activePath.lockPath, activePath.validateLockPath);
      }
    }
  }
}
