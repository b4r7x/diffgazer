import { randomUUID } from "node:crypto";
import {
  type FileHandle,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  rmdir,
  unlink,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { Result } from "@diffgazer/core/result";

const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 60_000;
const LOCK_RETRY_MS = 25;

interface FileLockMetadata {
  ownerId: string;
  pid: number;
  createdAt: number;
}

interface PreparedFileLock {
  markerName: string;
  stagingPath: string;
}

type ObservedLock =
  | {
      kind: "directory";
      entries: string[];
      metadata: FileLockMetadata | null;
      mtimeMs: number;
    }
  | {
      kind: "unsupported";
    };

interface FileLockOwner {
  markerName: string;
}

interface ObservedDirectoryLock {
  kind: "directory";
  entries: string[];
  metadata: FileLockMetadata | null;
  mtimeMs: number;
}

export interface FileTransactionLockOptions {
  timeoutMs?: number;
  staleMs?: number;
  retryMs?: number;
}

const hasErrorCode = (error: unknown, code: string): boolean =>
  error instanceof Error && "code" in error && error.code === code;

const isMissingPathError = (error: unknown): boolean =>
  hasErrorCode(error, "ENOENT") || hasErrorCode(error, "ENOTDIR");

const isDirectorySyncUnsupported = (error: unknown): boolean => {
  if (hasErrorCode(error, "EINVAL") || hasErrorCode(error, "ENOTSUP")) return true;
  if (process.platform !== "win32") return false;
  return (
    hasErrorCode(error, "EACCES") || hasErrorCode(error, "EISDIR") || hasErrorCode(error, "EPERM")
  );
};

const syncDirectory = async (directoryPath: string): Promise<void> => {
  let handle: FileHandle | undefined;
  try {
    handle = await open(directoryPath, "r");
    await handle.sync();
  } catch (error) {
    if (!isDirectorySyncUnsupported(error)) throw error;
  } finally {
    await handle?.close();
  }
};

const parseLockMetadata = (content: string): FileLockMetadata | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  if (!("ownerId" in parsed) || typeof parsed.ownerId !== "string") return null;
  if (
    !("pid" in parsed) ||
    typeof parsed.pid !== "number" ||
    !Number.isSafeInteger(parsed.pid) ||
    parsed.pid <= 0
  ) {
    return null;
  }
  if (!("createdAt" in parsed) || typeof parsed.createdAt !== "number") return null;
  if (!Number.isFinite(parsed.createdAt) || parsed.createdAt <= 0) return null;

  return {
    ownerId: parsed.ownerId,
    pid: parsed.pid,
    createdAt: parsed.createdAt,
  };
};

const markerNameForOwner = (ownerId: string): string => `${ownerId}.json`;

const observeLock = async (lockPath: string): Promise<ObservedLock | null> => {
  let lockStat: Awaited<ReturnType<typeof lstat>>;
  try {
    lockStat = await lstat(lockPath);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return null;
    throw error;
  }

  if (!lockStat.isDirectory()) return { kind: "unsupported" };

  let entries: string[];
  try {
    entries = (await readdir(lockPath)).sort();
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return null;
    if (hasErrorCode(error, "ENOTDIR")) return { kind: "unsupported" };
    throw error;
  }

  let metadata: FileLockMetadata | null = null;
  const onlyEntry = entries.length === 1 ? entries[0] : undefined;
  if (onlyEntry !== undefined) {
    try {
      const parsed = parseLockMetadata(await readFile(join(lockPath, onlyEntry), "utf8"));
      if (parsed && markerNameForOwner(parsed.ownerId) === onlyEntry) metadata = parsed;
    } catch (error) {
      if (!isMissingPathError(error) && !hasErrorCode(error, "EISDIR")) throw error;
    }
  }

  return {
    kind: "directory",
    entries,
    metadata,
    mtimeMs: lockStat.mtimeMs,
  };
};

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !hasErrorCode(error, "ESRCH");
  }
};

const isStaleLock = (lock: ObservedLock, staleMs: number): boolean => {
  if (lock.kind === "unsupported") return false;
  if (lock.entries.length === 0) return true;
  if (lock.metadata) return !isProcessAlive(lock.metadata.pid);
  return Date.now() - lock.mtimeMs >= staleMs;
};

const removeLockEntry = async (entryPath: string): Promise<boolean> => {
  let entryStat: Awaited<ReturnType<typeof lstat>>;
  try {
    entryStat = await lstat(entryPath);
  } catch (error) {
    if (isMissingPathError(error)) return false;
    throw error;
  }

  try {
    if (entryStat.isDirectory()) await rmdir(entryPath);
    else await unlink(entryPath);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) return false;
    throw error;
  }
};

const removeEmptyLockDirectory = async (lockPath: string): Promise<boolean> => {
  try {
    await rmdir(lockPath);
    await syncDirectory(dirname(lockPath));
    return true;
  } catch (error) {
    if (
      hasErrorCode(error, "ENOENT") ||
      hasErrorCode(error, "ENOTEMPTY") ||
      hasErrorCode(error, "EEXIST")
    ) {
      return false;
    }
    throw error;
  }
};

const recoverObservedLock = async (
  lockPath: string,
  observed: ObservedDirectoryLock,
): Promise<boolean> => {
  const [recoveryEntry, ...remainingEntries] = observed.entries;
  if (recoveryEntry === undefined) return removeEmptyLockDirectory(lockPath);
  if (!(await removeLockEntry(join(lockPath, recoveryEntry)))) return false;

  for (const entry of remainingEntries) {
    await removeLockEntry(join(lockPath, entry));
  }

  return removeEmptyLockDirectory(lockPath);
};

const removeStaleStagingDirectories = async (lockPath: string, staleMs: number): Promise<void> => {
  const parentPath = dirname(lockPath);
  const namePrefix = `${basename(lockPath)}.`;
  const entries = await readdir(parentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith(namePrefix) || !entry.name.endsWith(".pending")) continue;

    const stagingPath = join(parentPath, entry.name);
    const observed = await observeLock(stagingPath);
    if (!observed || observed.kind === "unsupported") continue;
    const metadata =
      observed.metadata &&
      entry.name === `${basename(lockPath)}.${observed.metadata.ownerId}.pending`
        ? observed.metadata
        : null;
    const isStale = metadata
      ? !isProcessAlive(metadata.pid)
      : Date.now() - observed.mtimeMs >= staleMs;
    if (!isStale) continue;
    await rm(stagingPath, { recursive: true, force: true });
  }
};

const prepareFileLock = async (lockPath: string): Promise<PreparedFileLock> => {
  const ownerId = randomUUID();
  const markerName = markerNameForOwner(ownerId);
  const stagingPath = `${lockPath}.${ownerId}.pending`;
  let handle: FileHandle | undefined;

  await mkdir(stagingPath, { mode: 0o700 });
  try {
    handle = await open(join(stagingPath, markerName), "wx", 0o600);
    await handle.writeFile(
      `${JSON.stringify({ ownerId, pid: process.pid, createdAt: Date.now() })}\n`,
      "utf8",
    );
    await handle.sync();
    await handle.close();
    handle = undefined;
    await syncDirectory(stagingPath);
    return { markerName, stagingPath };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await rm(stagingPath, { recursive: true, force: true });
    throw error;
  }
};

const isPublishConflict = (error: unknown): boolean => {
  if (
    hasErrorCode(error, "EEXIST") ||
    hasErrorCode(error, "ENOTDIR") ||
    hasErrorCode(error, "ENOTEMPTY")
  ) {
    return true;
  }
  if (process.platform !== "win32") return false;
  return hasErrorCode(error, "EACCES") || hasErrorCode(error, "EPERM");
};

const removeOwnedGeneration = async (lockPath: string, markerName: string): Promise<void> => {
  if (!(await removeLockEntry(join(lockPath, markerName)))) return;
  await removeEmptyLockDirectory(lockPath);
};

const acquireFileLock = async (
  lockPath: string,
  options: FileTransactionLockOptions,
): Promise<FileLockOwner> => {
  const timeoutMs = options.timeoutMs ?? LOCK_TIMEOUT_MS;
  const staleMs = options.staleMs ?? LOCK_STALE_MS;
  const retryMs = options.retryMs ?? LOCK_RETRY_MS;
  const deadline = Date.now() + timeoutMs;

  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });
  await removeStaleStagingDirectories(lockPath, staleMs);
  const prepared = await prepareFileLock(lockPath);

  try {
    while (true) {
      try {
        await rename(prepared.stagingPath, lockPath);
      } catch (error) {
        if (!isPublishConflict(error)) throw error;

        const observed = await observeLock(lockPath);
        if (observed?.kind === "directory" && isStaleLock(observed, staleMs)) {
          if (await recoverObservedLock(lockPath, observed)) continue;
        }

        if (Date.now() >= deadline) {
          throw new Error(`Timed out waiting for config transaction lock: ${lockPath}`);
        }
        await delay(retryMs);
        continue;
      }

      try {
        await syncDirectory(dirname(lockPath));
      } catch (error) {
        await removeOwnedGeneration(lockPath, prepared.markerName);
        throw error;
      }
      return { markerName: prepared.markerName };
    }
  } finally {
    await rm(prepared.stagingPath, { recursive: true, force: true });
  }
};

const releaseFileLock = async (lockPath: string, owner: FileLockOwner): Promise<void> => {
  await removeOwnedGeneration(lockPath, owner.markerName);
};

export async function withFileTransactionLock<T>(
  filePath: string,
  operation: () => Promise<T>,
  options: FileTransactionLockOptions = {},
): Promise<T> {
  const lockPath = `${filePath}.lock`;
  const owner = await acquireFileLock(lockPath, options);
  try {
    return await operation();
  } finally {
    await releaseFileLock(lockPath, owner);
  }
}

/**
 * Serializes async mutations through a promise chain so each one observes the
 * settled state of the previous mutation before it begins. Concurrent callers
 * queue rather than interleave at their `await` points.
 */
export function createMutex(): { run<T>(fn: () => Promise<T>): Promise<T> } {
  let tail: Promise<unknown> = Promise.resolve();

  const run = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = tail.then(fn, fn);
    // Keep the chain alive even if a mutation rejects, without surfacing the
    // settled rejection to the next queued caller.
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return { run };
}

interface ConfigTransactionDeps<State, E> {
  /** Reload from disk so the mutation sees state another process may have written. */
  refresh: () => void;
  /** Capture a deep copy of the current in-memory state for rollback. */
  snapshot: () => State;
  /** Restore the in-memory state from a snapshot (no persistence). */
  restore: (snapshot: State) => void;
  /** Persist the mutated state to disk. */
  persist: () => Promise<Result<void, E>>;
}

/**
 * Runs one config/trust mutation under the shared transactional discipline:
 * refresh from disk → snapshot for rollback → mutate → persist → on persist
 * failure restore the snapshot and surface the error. The mutation runs inside
 * the caller-provided mutex so two concurrent mutators never interleave.
 */
export async function runConfigTransaction<State, T, E>(
  deps: ConfigTransactionDeps<State, E>,
  mutate: () => Result<T, E>,
): Promise<Result<T, E>> {
  deps.refresh();
  const backup = deps.snapshot();

  const mutateResult = mutate();
  if (!mutateResult.ok) {
    deps.restore(backup);
    return mutateResult;
  }

  const persistResult = await deps.persist();
  if (!persistResult.ok) {
    deps.restore(backup);
    return persistResult;
  }

  return mutateResult;
}
