import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const DIST = resolve(import.meta.dirname, "..", "dist");

// Counterpart to assertNoRelativeJsImports (which keeps shadcn/copy content
// extensionless): the published dist is consumed under Node ESM, where relative
// specifiers must carry an explicit ".js". tsc with moduleResolution "Bundler"
// passes specifiers through unchanged, so a missing ".js" in src silently ships
// an unresolvable dist. This guard fails the build before that reaches npm.
const RELATIVE_IMPORT =
  /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']+)\1/g;

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // dist/artifacts holds copied shadcn/copy payloads that are intentionally
    // extensionless; only the tsc-emitted tree is subject to the Node ESM rule.
    if (entry.isDirectory()) {
      if (dir === DIST && entry.name === "artifacts") continue;
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
    if (specifier && !specifier.endsWith(".js")) {
      offenders.push(`${file}: ${match[0].trim()}`);
    }
  }
}

if (offenders.length > 0) {
  throw new Error(
    [
      "Built @diffgazer/keys dist has relative imports without a .js extension:",
      ...offenders,
      "Node ESM cannot resolve extensionless relative specifiers. Add .js to the",
      "matching libs/keys/src import; tsc (moduleResolution Bundler) does not add it.",
    ].join("\n"),
  );
}

console.log("[keys] dist ESM relative imports carry .js OK");
