import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { invariantResult } from "./context.mjs";

const MAX_REPORTED = 5;

function listRelativeFiles(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join("/"));
}

function hasSource(srcRoot, distRelPath) {
  const base = join(srcRoot, distRelPath.replace(/\.js$/, ""));
  return existsSync(`${base}.ts`) || existsSync(`${base}.tsx`);
}

// The web dev server and every package consumer resolve these packages through
// dist, so a dist that disagrees with src silently serves pre-fix behavior (and
// stale .d.ts that masks type errors) while tests, which run on src, stay green.
// Both directions count: a source newer than its output means dist lags src, and
// an output whose source is gone means dist still ships a deleted module. A
// missing dist is fine — nothing serves it and module resolution fails loudly.
export function createDistFreshnessCheck({
  name,
  srcDir,
  distDir,
  excludedFiles = [],
  excludedPrefixes = [],
  excludedDistPrefixes = [],
  rebuildCommand,
}) {
  const excluded = new Set(excludedFiles);

  function isCompiledSource(relPath) {
    if (!/\.tsx?$/.test(relPath) || /\.test\.tsx?$/.test(relPath)) return false;
    if (excluded.has(relPath)) return false;
    return !excludedPrefixes.some((prefix) => relPath.startsWith(prefix));
  }

  function isCompiledOutput(relPath) {
    if (!relPath.endsWith(".js")) return false;
    return !excludedDistPrefixes.some((prefix) => relPath.startsWith(prefix));
  }

  return function checkDistFreshness(context) {
    const srcRoot = resolve(context.rootDir, srcDir);
    const distRoot = resolve(context.rootDir, distDir);

    if (!existsSync(srcRoot) || !existsSync(distRoot)) return invariantResult(name, true);

    const problems = [];

    for (const relPath of listRelativeFiles(srcRoot).filter(isCompiledSource)) {
      const outPath = join(distRoot, relPath.replace(/\.tsx?$/, ".js"));
      if (!existsSync(outPath)) {
        problems.push(`${relPath}: no compiled output`);
      } else if (statSync(join(srcRoot, relPath)).mtimeMs > statSync(outPath).mtimeMs) {
        problems.push(`${relPath}: src newer than dist`);
      }
    }

    for (const relPath of listRelativeFiles(distRoot).filter(isCompiledOutput)) {
      if (!hasSource(srcRoot, relPath)) {
        problems.push(`${relPath}: compiled output has no source`);
      }
    }

    const shown = problems.slice(0, MAX_REPORTED).join("; ");
    const overflow =
      problems.length > MAX_REPORTED ? ` and ${problems.length - MAX_REPORTED} more` : "";

    return invariantResult(
      name,
      problems.length === 0,
      problems.length === 0 ? "" : `${shown}${overflow}; rebuild with ${rebuildCommand}`,
    );
  };
}

// Mirrors the emit exclusions in libs/keys/tsconfig.json. A new exclusion there
// surfaces here as a loud "no compiled output" failure, never a silent skip.
// `dist/artifacts` is the docs handoff payload copied from libs/keys/{docs,
// registry,public/r} (see AGENTS.md), not tsc output, so the reverse scan skips
// it — a .js entering those trees has no libs/keys/src counterpart by design.
export const checkKeysDistFreshness = createDistFreshnessCheck({
  name: "libs/keys dist is not stale",
  srcDir: "libs/keys/src",
  distDir: "libs/keys/dist",
  excludedFiles: ["test-setup.ts"],
  excludedPrefixes: ["testing/internal/"],
  excludedDistPrefixes: ["artifacts/"],
  rebuildCommand: "pnpm --filter @diffgazer/keys exec tsc",
});

// Mirrors the emit exclusions in libs/core/tsconfig.json, whose `**/fixtures.ts`
// and `**/test-helpers.ts` globs match exactly these two sources today. A third
// one surfaces as a "no compiled output" failure naming the file.
export const checkCoreDistFreshness = createDistFreshnessCheck({
  name: "libs/core dist is not stale",
  srcDir: "libs/core/src",
  distDir: "libs/core/dist",
  excludedFiles: ["api/test-helpers.ts", "catalog/fixtures.ts"],
  rebuildCommand: "pnpm --filter @diffgazer/core exec tsc",
});
