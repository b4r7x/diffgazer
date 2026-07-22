import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const docsRoot = resolve(import.meta.dirname, "..");
const registryRoot = resolve(import.meta.dirname, "../../../libs/ui/registry");

async function collectRegistryLibImports(): Promise<Set<string>> {
  const registryFiles = (await readdir(registryRoot, { recursive: true })).filter((path) =>
    /\.[jt]sx?$/.test(path),
  );
  const registrySources = await Promise.all(
    registryFiles.map((path) => readFile(resolve(registryRoot, path), "utf8")),
  );
  return new Set(
    registrySources.flatMap((source) =>
      [...source.matchAll(/["']@\/lib\/([^"']+)["']/g)].flatMap((match) =>
        match[1] ? [match[1]] : [],
      ),
    ),
  );
}

function resolveRegistryLibAliasesWithVite(
  libraries: ReadonlyArray<string>,
): Record<string, string | null> {
  const env = { ...process.env };
  delete env.VITEST;

  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `
import { resolve } from "node:path";
import { createServer } from "vite";

const libraries = ${JSON.stringify(libraries)};
const configFile = resolve(process.cwd(), "vite.config.ts");
const registryRoot = resolve(process.cwd(), "../../libs/ui/registry");
const registryImporter = resolve(registryRoot, "ui/button/button.tsx");

const server = await createServer({ configFile, logLevel: "silent" });
const resolvedByLibrary = {};
try {
  for (const library of libraries) {
    const specifier = \`@/lib/\${library}\`;
    const resolved = await server.pluginContainer.resolveId(specifier, registryImporter, {
      ssr: false,
    });
    resolvedByLibrary[library] = resolved?.id ?? null;
  }
} finally {
  await server.close();
}
console.log(JSON.stringify(resolvedByLibrary));
`,
    ],
    {
      cwd: docsRoot,
      encoding: "utf8",
      env,
      timeout: 60_000,
    },
  );

  expect(result.error, result.error?.message).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);

  const marker = result.stdout.lastIndexOf("{");
  expect(marker).toBeGreaterThanOrEqual(0);
  return JSON.parse(result.stdout.slice(marker)) as Record<string, string | null>;
}

describe("Docs Vite aliases", () => {
  it("resolves every imported UI registry @/lib specifier into libs/ui/registry", async () => {
    const importedLibraries = await collectRegistryLibImports();
    expect(importedLibraries.size).toBeGreaterThan(0);

    const resolvedByLibrary = resolveRegistryLibAliasesWithVite([...importedLibraries]);
    const normalizedRegistryRoot = resolve(registryRoot);

    for (const library of importedLibraries) {
      const resolvedId = resolvedByLibrary[library];
      expect(resolvedId, `@/lib/${library} should resolve`).toBeTruthy();

      const resolvedPath = resolve(resolvedId!.split("?")[0] ?? "");
      expect(
        resolvedPath.startsWith(normalizedRegistryRoot),
        `@/lib/${library} resolved to ${resolvedPath}, expected under ${normalizedRegistryRoot}`,
      ).toBe(true);
    }
  });
});
