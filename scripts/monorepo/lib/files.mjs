import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// Locale-independent code-unit comparison so the committed fingerprint hashes
// files in the same order on every machine (see libs/core catalog transform).
function compareCodeUnits(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function collectFiles(dirPath, options = {}) {
  const { filter } = options;
  const files = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!existsSync(current)) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (!filter || filter(entryPath)) {
          stack.push(entryPath);
        }
      } else if (entry.isFile()) {
        if (!filter || filter(entryPath)) {
          files.push(entryPath);
        }
      }
    }
  }

  return files.sort(compareCodeUnits);
}

export function listRepoFiles(rootDir = process.cwd()) {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: rootDir,
    encoding: "utf8",
  });

  return output.trim().split("\n").filter(Boolean);
}
