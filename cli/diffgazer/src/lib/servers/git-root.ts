import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export function findGitRoot(startPath: string): string {
  let current = resolve(startPath);
  while (true) {
    if (existsSync(join(current, ".git"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return resolve(startPath);
    }
    current = parent;
  }
}
