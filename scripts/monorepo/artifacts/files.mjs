import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

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

  return files.sort((a, b) => a.localeCompare(b));
}
