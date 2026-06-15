import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
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

for (const file of collectSourceFiles(srcRoot)) {
  const source = readFileSync(file, "utf-8");
  for (const match of source.matchAll(/@diffgazer\/[a-z0-9-]+/g)) {
    workspaceImports.add(match[0]);
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

  it("imports only @diffgazer/ui from workspace packages in source", () => {
    expect([...workspaceImports]).toEqual(
      workspaceImports.has("@diffgazer/ui") ? ["@diffgazer/ui"] : [],
    );
  });

  it("keeps test setup free of private workspace imports", () => {
    const setup = readFileSync(join(srcRoot, "test-setup.ts"), "utf-8");
    expect(setup).not.toMatch(/@diffgazer\/(?!ui\b)/);
    expect(relative(landingRoot, join(srcRoot, "test-setup.ts"))).toBe("src/test-setup.ts");
  });
});
