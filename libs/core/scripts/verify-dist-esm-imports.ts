import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const DIST = resolve(import.meta.dirname, "..", "dist");

// @diffgazer/core builds with moduleResolution "Bundler", which passes relative
// specifiers through to dist unchanged. The published dist is consumed under Node
// ESM (direct imports such as @diffgazer/core/api and the bench server), where
// relative specifiers must carry an explicit ".js". A missing ".js" in src ships
// an unresolvable dist; this guard fails the build before that reaches consumers.
const RELATIVE_IMPORT =
  /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']+)\1/g;

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...collectFiles(join(dir, entry.name)));
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts")) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

const offenders: string[] = [];

for (const file of collectFiles(DIST)) {
  const content = readFileSync(file, "utf-8");
  for (const match of content.matchAll(RELATIVE_IMPORT)) {
    const specifier = match[2];
    if (specifier && !specifier.endsWith(".js") && !specifier.endsWith(".json")) {
      offenders.push(`${file}: ${match[0].trim()}`);
    }
  }
}

if (offenders.length > 0) {
  throw new Error(
    [
      "Built @diffgazer/core dist has relative imports without a .js extension:",
      ...offenders,
      "Node ESM cannot resolve extensionless relative specifiers. Add .js to the",
      "matching libs/core/src import; tsc (moduleResolution Bundler) does not add it.",
    ].join("\n"),
  );
}

console.log("[core] dist ESM relative imports carry .js OK");
