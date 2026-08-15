import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function listRepoFiles(rootDir = process.cwd()) {
  // `-z` is required: without it git prints its display form, C-quoting any
  // pathname with non-ASCII bytes, control characters, quotes, or backslashes
  // (`"caf\303\251.ts"`). That quoted token is not a filesystem path, so the
  // `existsSync` filter below would silently drop the file and every scanner
  // built on this listing would skip its content.
  const output = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    {
      cwd: rootDir,
      encoding: "utf8",
    },
  );

  // `--cached` still lists files deleted in the worktree, so callers that read
  // every returned path would crash with ENOENT on an uncommitted deletion.
  return output
    .split("\0")
    .filter(Boolean)
    .filter((repoPath) => existsSync(join(rootDir, repoPath)));
}

// Filesystem walk, not a git listing: callers pass a directory that may hold
// generated (gitignored) output they still need to read.
export function listFilesByExtension(dir, extension) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => join(entry.parentPath, entry.name));
}

export function isPackageManifestPath(repoPath) {
  return repoPath.endsWith("package.json") && !repoPath.includes("node_modules/");
}
