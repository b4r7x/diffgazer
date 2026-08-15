import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const repoRoot = resolve(import.meta.dirname, "../../../../..");

export function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

export function listRepoFiles(dir: string, extension: string): string[] {
  const root = resolve(repoRoot, dir);
  const files: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push(path);
      }
    }
  };

  visit(root);
  return files;
}

export function readAbsolute(path: string): string {
  return readFileSync(path, "utf8");
}

export function hasConsumptionMetadata(source: string): boolean {
  return (
    source.includes("<ConsumptionBlock") ||
    source.includes("<ComponentDocScaffold") ||
    source.includes("<HookDocScaffold")
  );
}

export function basename(file: string): string {
  return (
    file
      .replace(/\.(ts|tsx|mdx)$/, "")
      .split("/")
      .at(-1) ?? ""
  );
}
