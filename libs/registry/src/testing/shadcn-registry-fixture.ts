import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { RegistryFile, RegistryItem } from "../registry-types.js";

export type RegistryItemFixture = { name: string } & Partial<Omit<RegistryItem, "name">>;
export type PublicRegistryFileFixture = RegistryFile & { content: string };

function resolveFixtureSourcePath(rootDir: string, sourcePath: string): string | null {
  const normalizedPath = sourcePath.replaceAll("\\", "/");
  if (isAbsolute(normalizedPath) || /^[A-Za-z]:\//.test(normalizedPath)) return null;

  const resolvedPath = resolve(rootDir, normalizedPath);
  const relativePath = relative(rootDir, resolvedPath);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    return null;
  }
  return resolvedPath;
}

/** Writes a source registry plus its public `public/r` artifacts into `tempDir`. */
export function setupRegistry(
  tempDir: string,
  sourceItems: RegistryItemFixture[],
  publicItems?: RegistryItemFixture[],
  publicItemFiles?: Record<string, PublicRegistryFileFixture[]>,
): void {
  const normalizedSource = sourceItems.map((item) => ({ type: "registry:ui", files: [], ...item }));
  const normalizedPublic = publicItems?.map((item) => ({
    type: "registry:ui",
    files: [],
    ...item,
  }));

  const sourceDir = join(tempDir, "registry");
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(
    join(sourceDir, "registry.json"),
    JSON.stringify({ items: normalizedSource }, null, 2),
  );

  for (const item of normalizedSource) {
    for (const file of item.files ?? []) {
      const filePath = resolveFixtureSourcePath(tempDir, file.path);
      if (!filePath) continue;
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, `// ${item.name} - ${file.path}\n`);
    }
  }

  const publicDir = join(tempDir, "public", "r");
  mkdirSync(publicDir, { recursive: true });
  const pubItems = normalizedPublic ?? normalizedSource;
  writeFileSync(join(publicDir, "registry.json"), JSON.stringify({ items: pubItems }, null, 2));

  for (const item of pubItems) {
    const files =
      publicItemFiles?.[item.name] ??
      (normalizedSource.find((s) => s.name === item.name)?.files ?? []).map((f) => ({
        path: f.path,
        content: `// ${item.name} - ${f.path}\n`,
        type: f.type,
        target: f.target,
      }));
    writeFileSync(
      join(publicDir, `${item.name}.json`),
      JSON.stringify({ ...item, files }, null, 2),
    );
  }
}
