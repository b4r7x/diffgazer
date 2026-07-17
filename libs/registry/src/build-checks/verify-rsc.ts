import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { registryItemToDistKey } from "./dist-keys.js";

interface RscRegistryItem {
  name: string;
  type: string;
  meta?: { client?: boolean; hidden?: boolean };
}

interface RscRegistry {
  items: RscRegistryItem[];
}

interface AssertRscClientDirectivesOptions {
  rootDir: string;
  registryPath: string;
  packagePath?: string;
}

const UI_PUBLIC_CLIENT_OUTPUT_OVERRIDES = {
  "./components/code-block/highlight": "components/code-block/highlight",
  "./components/command-palette/highlight": "components/command-palette/highlight",
} as const;

// Skips a leading directive prologue's surrounding noise (BOM, whitespace, and
// line/block comments) so a license header above the directive does not hide it.
function startsWithUseClient(content: string): boolean {
  let rest = content.replace(/^﻿/, "").trimStart();
  for (;;) {
    if (rest.startsWith("//")) {
      const end = rest.indexOf("\n");
      rest = (end === -1 ? "" : rest.slice(end + 1)).trimStart();
      continue;
    }
    if (rest.startsWith("/*")) {
      const end = rest.indexOf("*/");
      rest = (end === -1 ? "" : rest.slice(end + 2)).trimStart();
      continue;
    }
    break;
  }
  return rest.startsWith('"use client"') || rest.startsWith("'use client'");
}

export function getUiPublicClientOutputMap(
  items: readonly RscRegistryItem[],
): ReadonlyMap<string, string> {
  const outputs = new Map<string, string>();
  for (const item of items) {
    if (!item.meta?.client || item.meta.hidden) continue;
    const output = registryItemToDistKey(item);
    outputs.set(`./${output}`, output);
  }
  for (const [publicSubpath, output] of Object.entries(UI_PUBLIC_CLIENT_OUTPUT_OVERRIDES)) {
    outputs.set(publicSubpath, output);
  }
  return outputs;
}

export function assertRscClientDirectives({
  rootDir,
  registryPath,
  packagePath = resolve(rootDir, "package.json"),
}: AssertRscClientDirectivesOptions): void {
  const registry = JSON.parse(readFileSync(registryPath, "utf-8")) as RscRegistry;
  const packageJson = JSON.parse(readFileSync(packagePath, "utf-8")) as {
    exports?: Record<string, string | { import?: string }>;
  };

  const missing: string[] = [];

  for (const [publicSubpath, output] of getUiPublicClientOutputMap(registry.items)) {
    const relativePath = `dist/${output}.js`;
    const exportValue = packageJson.exports?.[publicSubpath];
    const importTarget = typeof exportValue === "string" ? exportValue : exportValue?.import;
    if (importTarget !== `./${relativePath}`) {
      missing.push(`${publicSubpath} (missing package export to ./${relativePath})`);
    }
    if (!existsSync(resolve(rootDir, relativePath))) {
      missing.push(`${relativePath} (missing public client output)`);
      continue;
    }
    if (!startsWithUseClient(readFileSync(resolve(rootDir, relativePath), "utf-8"))) {
      missing.push(relativePath);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing "use client" directive in built client output:\n${missing
        .map((path) => `- ${path}`)
        .join("\n")}`,
    );
  }
}

interface AssertSourceRscClientDirectivesOptions {
  srcDir: string;
  distDir: string;
  packageLabel: string;
  skipDirs?: string[];
}

function collectSourceFiles(dir: string, skipDirs: Set<string>): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      files.push(...collectSourceFiles(join(dir, entry.name), skipDirs));
    } else if (
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx") &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

/**
 * Source-of-truth RSC guard for tsc-built packages (src→dist 1:1 layout). Every
 * source file that authors a leading "use client" directive must keep it in its
 * mapped dist output (`src/x/y.ts(x)` → `dist/x/y.js`). A missing dist file is a
 * failure, not a silent skip — a silent skip is exactly the hole this closes.
 */
export function assertSourceRscClientDirectives({
  srcDir,
  distDir,
  packageLabel,
  skipDirs = [],
}: AssertSourceRscClientDirectivesOptions): number {
  const skip = new Set(skipDirs);
  const missing: string[] = [];
  let guarded = 0;

  for (const sourceFile of collectSourceFiles(srcDir, skip)) {
    if (!startsWithUseClient(readFileSync(sourceFile, "utf-8"))) continue;

    const distPath = resolve(distDir, relative(srcDir, sourceFile).replace(/\.tsx?$/, ".js"));
    if (!existsSync(distPath)) {
      missing.push(`${distPath} (missing dist output)`);
      continue;
    }
    if (!startsWithUseClient(readFileSync(distPath, "utf-8"))) {
      missing.push(distPath);
      continue;
    }
    guarded += 1;
  }

  if (missing.length > 0) {
    throw new Error(
      [
        `Missing "use client" directive in built ${packageLabel} output:`,
        ...missing.map((path) => `- ${path}`),
        "The source authors a leading directive that did not survive into dist.",
      ].join("\n"),
    );
  }

  return guarded;
}
