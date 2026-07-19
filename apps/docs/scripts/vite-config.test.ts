import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Docs Vite aliases", () => {
  it("resolves every imported UI registry library before the Docs source alias", async () => {
    const configSource = await readFile(resolve(import.meta.dirname, "../vite.config.ts"), "utf8");
    const registryRoot = resolve(import.meta.dirname, "../../../libs/ui/registry");
    const registryFiles = (await readdir(registryRoot, { recursive: true })).filter((path) =>
      /\.[jt]sx?$/.test(path),
    );
    const registrySources = await Promise.all(
      registryFiles.map((path) => readFile(resolve(registryRoot, path), "utf8")),
    );
    const importedLibraries = new Set(
      registrySources.flatMap((source) =>
        [...source.matchAll(/["']@\/lib\/([^"']+)["']/g)].map((match) => match[1]),
      ),
    );
    const configLines = configSource.split("\n").map((line) => line.trim());
    const docsSourceAlias = '"@": resolve(import.meta.dirname, "./src"),';
    const docsSourceIndex = configLines.indexOf(docsSourceAlias);

    for (const library of importedLibraries) {
      const registryAlias = `"@/lib/${library}": uiRegistryPath("lib/${library}"),`;
      const registryAliasIndex = configLines.indexOf(registryAlias);

      expect(registryAliasIndex).toBeGreaterThanOrEqual(0);
      expect(docsSourceIndex).toBeGreaterThan(registryAliasIndex);
    }
  });
});
