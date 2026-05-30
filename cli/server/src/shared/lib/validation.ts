import { resolve } from "node:path";
import { realpath } from "node:fs/promises";

/**
 * Synchronous string-level guard: rejects null bytes and any `..` path segment.
 * Segment-aware so legitimate names that merely contain ".." (e.g. `foo..bar`)
 * are not rejected. Use {@link resolvesToSameProject} for symlink-aware identity.
 */
export const isValidProjectPath = (value: string): boolean => {
  if (value.includes("\0")) return false;
  return !value.split(/[\\/]/).includes("..");
};

/**
 * Resolves both paths through `realpath` (following symlinks) and asserts they
 * point at the same real location. Used to confirm a user-supplied project path
 * identifies the request's project root without being spoofed via symlink or
 * traversal. Returns false when either path cannot be resolved.
 */
export const resolvesToSameProject = async (
  candidate: string,
  projectRoot: string,
): Promise<boolean> => {
  if (candidate.includes("\0") || projectRoot.includes("\0")) return false;

  try {
    const [realCandidate, realRoot] = await Promise.all([
      realpath(resolve(candidate)),
      realpath(resolve(projectRoot)),
    ]);
    return realCandidate === realRoot;
  } catch {
    return false;
  }
};
