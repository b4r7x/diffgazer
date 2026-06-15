import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// tsc with moduleResolution "Bundler" passes relative specifiers through to dist
// unchanged. The published dist is consumed under Node ESM, where relative
// specifiers must carry an explicit ".js". A missing ".js" in src ships an
// unresolvable dist; this guard fails the build before that reaches consumers.
const RELATIVE_IMPORT =
  /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']+)\1/g;

interface AssertDistEsmRelativeImportsOptions {
  distDir: string;
  packageLabel: string;
  skipDirs?: string[];
}

function collectFiles(dir: string, rootDir: string, skipDirs: Set<string>): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (dir === rootDir && skipDirs.has(entry.name)) continue;
      files.push(...collectFiles(join(dir, entry.name), rootDir, skipDirs));
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts")) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

export function assertDistEsmRelativeImports({
  distDir,
  packageLabel,
  skipDirs = [],
}: AssertDistEsmRelativeImportsOptions): void {
  const offenders: string[] = [];

  for (const file of collectFiles(distDir, distDir, new Set(skipDirs))) {
    const content = readFileSync(file, "utf-8");
    for (const match of content.matchAll(RELATIVE_IMPORT)) {
      const specifier = match[2];
      if (specifier && !specifier.endsWith(".js")) {
        offenders.push(`${file}: ${match[0].trim()}`);
      }
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      [
        `Built ${packageLabel} dist has relative imports without a .js extension:`,
        ...offenders,
        "Node ESM cannot resolve extensionless relative specifiers. Add .js to the",
        "matching source import; tsc (moduleResolution Bundler) does not add it.",
      ].join("\n"),
    );
  }
}
