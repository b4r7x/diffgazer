import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function listRepoFiles(rootDir = process.cwd()) {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: rootDir,
    encoding: "utf8",
  });

  // `--cached` still lists files deleted in the worktree, so callers that read
  // every returned path would crash with ENOENT on an uncommitted deletion.
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((repoPath) => existsSync(join(rootDir, repoPath)));
}
