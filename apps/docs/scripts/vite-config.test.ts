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

function resolveSpecifiersWithVite(
  specifiers: ReadonlyArray<string>,
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

const specifiers = ${JSON.stringify(specifiers)};
const configFile = resolve(process.cwd(), "vite.config.ts");
const registryRoot = resolve(process.cwd(), "../../libs/ui/registry");
const registryImporter = resolve(registryRoot, "ui/button/button.tsx");

const server = await createServer({ configFile, logLevel: "silent" });
const resolvedBySpecifier = {};
try {
  for (const specifier of specifiers) {
    const resolved = await server.pluginContainer.resolveId(specifier, registryImporter, {
      ssr: false,
    });
    resolvedBySpecifier[specifier] = resolved?.id ?? null;
  }
} finally {
  await server.close();
}
console.log(JSON.stringify(resolvedBySpecifier));
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

function expectAllResolvedUnder(
  resolvedBySpecifier: Record<string, string | null>,
  expectedRoot: string,
): void {
  const normalizedRoot = resolve(expectedRoot);

  for (const [specifier, resolvedId] of Object.entries(resolvedBySpecifier)) {
    expect(resolvedId, `${specifier} should resolve`).toBeTruthy();

    const resolvedPath = resolve(resolvedId?.split("?")[0] ?? "");
    expect(
      resolvedPath.startsWith(normalizedRoot),
      `${specifier} resolved to ${resolvedPath}, expected under ${normalizedRoot}`,
    ).toBe(true);
  }
}

describe("Docs Vite aliases", () => {
  it("resolves every imported UI registry @/lib specifier into libs/ui/registry", async () => {
    const importedLibraries = await collectRegistryLibImports();
    expect(importedLibraries.size).toBeGreaterThan(0);

    const specifiers = [...importedLibraries].map((library) => `@/lib/${library}`);
    expectAllResolvedUnder(resolveSpecifiersWithVite(specifiers), registryRoot);
  });

  // The blanket "@/hooks" alias points at libs/ui/registry/hooks, so every docs-owned
  // hook needs its own preceding alias entry. tsconfig resolves @/hooks/* to src/hooks
  // regardless, so a missing entry type-checks green and only fails at bundle time —
  // or, on a name collision with a libs/ui hook, resolves silently to the wrong module.
  it("resolves every docs-owned @/hooks specifier into apps/docs/src/hooks", async () => {
    const hooksRoot = resolve(docsRoot, "src/hooks");
    const hookNames = (await readdir(hooksRoot))
      .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
      .map((name) => name.replace(/\.tsx?$/, ""));
    expect(hookNames.length).toBeGreaterThan(0);

    const specifiers = hookNames.map((name) => `@/hooks/${name}`);
    expectAllResolvedUnder(resolveSpecifiersWithVite(specifiers), hooksRoot);
  });
});
