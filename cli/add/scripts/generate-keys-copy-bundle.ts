import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCopyBundle, rewriteRelativeImportsForTargetLayout } from "@diffgazer/registry";
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

function main(): void {
  const keysRoot = resolveKeysRoot(WORKSPACE_ROOT);
  writeKeysVersion(keysRoot);
  const installPaths = buildInstallPathMap(keysRoot);
  const result = buildCopyBundle({
    sourceRoot: keysRoot,
    outputPath: OUTPUT_PATH,
    itemType: REGISTRY_ITEM_TYPE.hook,
    pathMapping: { from: "src/", to: "" },
    // The bundle carries the whole keys registry, so every relative import must
    // land inside it — an unresolved one is a broken copy install, not a miss.
    transformContent: (content, sourcePath) =>
      rewriteRelativeImportsForTargetLayout({
        content,
        sourcePath,
        targetPath: installPaths.get(sourcePath) ?? sourcePath,
        pathMap: installPaths,
        unresolved: "throw",
      }),
    includeHidden: true,
  });
  console.log(`Wrote keys copy bundle: ${result.outputPath} (${result.itemCount} items)`);
}

main();
