import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { hasErrorCode, isEnoent } from "./path-safety.js";

// Prepares (and rolls back) the directory chain a project lock file lives in.
// Every component is pinned by dev/ino so a concurrent rename or symlink swap
// between the mkdir and the lock write is detected instead of followed.

export type ValidateLockPath = () => Promise<void>;

interface PathIdentity {
  dev: number;
  ino: number;
}

export interface GuardedProjectLockPath {
  cleanupCreatedDirectories: () => Promise<void>;
  hasCreatedDirectories: boolean;
  lockPath: string;
  validateLockPath: ValidateLockPath;
}

function samePathIdentity(left: PathIdentity, right: PathIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino;
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

export async function prepareProjectLockPath(
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

export async function tryRemoveEmptyLockDirectory(
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
