import { constants, type Stats } from "node:fs";
import { lstat, mkdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { restrictDirectoryMode } from "../../fs.js";
import { getGlobalDiffgazerDir } from "../../paths.js";

const CREDENTIAL_DIRECTORY_MODE = 0o700;

export const CREDENTIAL_FILE_MODE = 0o600;

/** POSIX-only; Windows opens the leaf without symlink protection. */
export const CREDENTIAL_OPEN_NOFOLLOW = constants.O_NOFOLLOW ?? 0;

/** Fixed and path-free: a rejected credential path must never reach a caller or a log. */
const UNCONTAINED_MESSAGE = "Credential file path is outside the Diffgazer credentials directory";

const credentialsDirectory = (): string => join(getGlobalDiffgazerDir(), "credentials");

export const literalCredentialFilePath = (configurationId: string, revision: number): string =>
  join(credentialsDirectory(), `${configurationId}-${revision}.key`);

const isInside = (candidate: string, root: string): boolean => candidate.startsWith(root + sep);

const lstatOrNull = async (path: string): Promise<Stats | null> => {
  try {
    return await lstat(path);
  } catch {
    return null;
  }
};

/**
 * Canonicalizes a credential file path and proves it stays inside the app-owned
 * credentials directory: relative paths, traversal, absolute escapes, and any
 * other file in the Diffgazer home fail the lexical check, and a symlinked
 * parent is rejected before anything follows it. The leaf is guarded at open
 * time by {@link CREDENTIAL_OPEN_NOFOLLOW}.
 */
export async function resolveContainedCredentialPath(
  filePath: string,
  options: { readonly createDirectory?: boolean } = {},
): Promise<string> {
  const root = getGlobalDiffgazerDir();
  const resolved = resolve(filePath);
  if (!isAbsolute(filePath) || !isInside(resolved, credentialsDirectory())) {
    throw new Error(UNCONTAINED_MESSAGE);
  }

  const directory = dirname(resolved);
  let stats = await lstatOrNull(directory);
  if (stats === null) {
    if (!options.createDirectory) return resolved;
    await mkdir(directory, { recursive: true, mode: CREDENTIAL_DIRECTORY_MODE });
    stats = await lstatOrNull(directory);
    if (stats === null) throw new Error(UNCONTAINED_MESSAGE);
  }

  if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error(UNCONTAINED_MESSAGE);
  if (!isInside(await realpath(directory), await realpath(root))) {
    throw new Error(UNCONTAINED_MESSAGE);
  }
  if (options.createDirectory) await restrictDirectoryMode(directory, CREDENTIAL_DIRECTORY_MODE);
  return resolved;
}
