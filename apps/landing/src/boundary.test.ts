import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const landingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(landingRoot, "src");
const packageJson = JSON.parse(readFileSync(join(landingRoot, "package.json"), "utf-8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const workspaceImports = new Set<string>();

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx|css)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const TS_IMPORT_SPECIFIER = /(?:import|export)[^;]*?\bfrom\s+["']([^"']+)["']/g;
const CSS_IMPORT_SPECIFIER = /@import\s+["']([^"']+)["']/g;

for (const file of collectSourceFiles(srcRoot)) {
  const source = readFileSync(file, "utf-8");
  const specifierPattern = file.endsWith(".css") ? CSS_IMPORT_SPECIFIER : TS_IMPORT_SPECIFIER;
  for (const match of source.matchAll(specifierPattern)) {
    const specifier = match[1];
    if (specifier?.startsWith("@diffgazer/")) {
      workspaceImports.add(specifier);
    }
  }
}

describe("landing UI-only boundary", () => {
  it("declares only @diffgazer/ui among workspace packages", () => {
    const declared = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ].filter((name) => name.startsWith("@diffgazer/"));

    // @diffgazer/ui requires @diffgazer/keys as a peer. Landing is private and
    // imports only display primitives that do not import keys, so the peer is
    // satisfied by the workspace link instead of a declared landing dependency.
    // Revisit this if landing adopts keyboard-backed UI components.
    expect(declared).toEqual(["@diffgazer/ui"]);
  });

  it("imports only @diffgazer/ui/styles.css from workspace packages in source", () => {
    expect([...workspaceImports]).toEqual(["@diffgazer/ui/styles.css"]);
  });

  it("keeps test setup free of private workspace imports", () => {
    const setup = readFileSync(join(srcRoot, "test-setup.ts"), "utf-8");
    expect(setup).not.toMatch(/@diffgazer\/(?!ui\b)/);
  });
});
