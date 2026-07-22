import { execFileSync } from "node:child_process";

export function listRepoFiles(rootDir = process.cwd()) {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: rootDir,
    encoding: "utf8",
  });

  return output.trim().split("\n").filter(Boolean);
}
