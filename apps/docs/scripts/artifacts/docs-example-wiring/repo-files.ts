import { readFileSync, readdirSync } from "node:fs";
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

export function camelToKebab(value: string): string {
  return value.replace(
    /[A-Z]/g,
    (match, index) => `${index === 0 ? "" : "-"}${match.toLowerCase()}`,
  );
}

export function collectPublicDocsSources(): Array<{ path: string; source: string }> {
  const files = [
    ...listRepoFiles("libs/ui/registry/component-docs", ".ts"),
    ...listRepoFiles("libs/ui/docs/content", ".mdx"),
    ...listRepoFiles("libs/ui/docs/generated", ".json"),
    ...listRepoFiles("libs/keys/docs/hook-docs", ".ts"),
    ...listRepoFiles("libs/keys/docs/content", ".mdx"),
    ...listRepoFiles("libs/keys/docs/generated", ".json"),
    ...listRepoFiles("libs/keys/docs/generated", ".ts"),
  ];

  return files.map((file) => ({
    path: file.slice(repoRoot.length + 1),
    source: readAbsolute(file),
  }));
}

export function collectInputLikeDocsSources(): Array<{
  path: string;
  source: string;
}> {
  const paths = [
    "libs/ui/registry/component-docs/input.ts",
    "libs/ui/registry/component-docs/textarea.ts",
    "libs/ui/registry/component-docs/search-input.ts",
    "libs/ui/docs/content/components/input.mdx",
    "libs/ui/docs/content/components/textarea.mdx",
    "libs/ui/docs/content/components/search-input.mdx",
    "libs/ui/docs/generated/components/input.json",
    "libs/ui/docs/generated/components/textarea.json",
    "libs/ui/docs/generated/components/search-input.json",
  ];

  return paths.map((path) => ({ path, source: readRepoFile(path) }));
}
