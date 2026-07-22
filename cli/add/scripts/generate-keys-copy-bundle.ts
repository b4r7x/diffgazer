import { readFileSync, writeFileSync } from "node:fs";
import { posix, resolve } from "node:path";
import { buildCopyBundle } from "@diffgazer/registry";
import { REGISTRY_ITEM_TYPE, RegistrySchema } from "@diffgazer/registry/schemas";
import { resolveKeysRoot } from "./keys-root.js";

const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "../..");
const OUTPUT_PATH = resolve(PACKAGE_ROOT, "src/generated/keys-copy-bundle.json");
const VERSION_PATH = resolve(PACKAGE_ROOT, "src/generated/keys-version.json");

function writeKeysVersion(keysRoot: string): void {
  const pkg = JSON.parse(readFileSync(resolve(keysRoot, "package.json"), "utf-8")) as {
    version: string;
  };
  writeFileSync(VERSION_PATH, `${JSON.stringify({ versionSpec: `^${pkg.version}` }, null, 2)}\n`);
}

// Maps every registry file's source path to its install (target) path. Split keys
// hooks source their helpers from core/, dom/, and nested hook subdirs, but the
// registry relocates them all under src/hooks/utils/* on install — so a copied
// file's relative imports must be recomputed against the installed layout, not the
// source layout, or they resolve to non-existent modules.
function buildInstallPathMap(keysRoot: string): Map<string, string> {
  const registry = RegistrySchema.parse(
    JSON.parse(readFileSync(resolve(keysRoot, "registry/registry.json"), "utf-8")),
  );
  const map = new Map<string, string>();
  for (const item of registry.items) {
    for (const file of item.files) {
      map.set(file.path, file.target ?? file.path);
    }
  }
  return map;
}

const RELATIVE_IMPORT_RE = /(["'])(\.\.?\/[^"']+)\1/g;

function makeHookImportRewriter(installPaths: Map<string, string>) {
  return (content: string, sourcePath: string): string => {
    const installPath = installPaths.get(sourcePath) ?? sourcePath;
    const installDir = posix.dirname(installPath);
    return content.replace(RELATIVE_IMPORT_RE, (_match, quote, specifier) => {
      const withoutExt = specifier.replace(/\.js$/, "");
      // Resolve the specifier against the importer's SOURCE directory to find the
      // imported registry file, then re-express it from the importer's INSTALL dir
      // to that file's install path. Try .ts / .tsx / index.ts like a bundler would.
      const sourceDir = posix.dirname(sourcePath);
      const candidates = [`${withoutExt}.ts`, `${withoutExt}.tsx`, `${withoutExt}/index.ts`].map(
        (candidate) => posix.normalize(posix.join(sourceDir, candidate)),
      );
      const importedSource = candidates.find((candidate) => installPaths.has(candidate));
      if (!importedSource) {
        throw new Error(
          `Cannot rewrite ${specifier} in ${sourcePath}: it resolves to no registry file`,
        );
      }
      const importedInstall = installPaths.get(importedSource) ?? importedSource;
      let rewritten = posix.relative(installDir, importedInstall).replace(/\.(tsx?|jsx?)$/, "");
      if (!rewritten.startsWith(".")) rewritten = `./${rewritten}`;
      return `${quote}${rewritten}${quote}`;
    });
  };
}

function main(): void {
  const keysRoot = resolveKeysRoot(WORKSPACE_ROOT);
  writeKeysVersion(keysRoot);
  const result = buildCopyBundle({
    sourceRoot: keysRoot,
    outputPath: OUTPUT_PATH,
    itemType: REGISTRY_ITEM_TYPE.hook,
    pathMapping: { from: "src/", to: "" },
    transformContent: makeHookImportRewriter(buildInstallPathMap(keysRoot)),
    includeHidden: true,
  });
  console.log(`Wrote keys copy bundle: ${result.outputPath} (${result.itemCount} items)`);
}

main();
