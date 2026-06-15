import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCopyBundle } from "@diffgazer/registry";
import { REGISTRY_ITEM_TYPE } from "@diffgazer/registry/schemas";
import { rewriteRelativeJsExtensionsForCopy } from "../src/utils/transform.js";
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

function rewriteHookInternalImports(content: string, sourcePath: string): string {
  // Hook sources live in src/hooks/ but their siblings (core/, dom/, providers/,
  // testing/) land under src/hooks/utils/* on install. Rewrite "../<dir>/" to
  // "./utils/" so copied hooks resolve their helpers from the installed layout.
  // The core/dom sources copied alongside them keep their own sibling imports, so
  // relocation is hooks-only — but every copied file must shed the Node-ESM ".js"
  // specifiers, which shadcn/copy consumers resolve extensionless.
  const relocated = sourcePath.startsWith("src/hooks/")
    ? content
        .replace(/(["'])\.\.\/core\//g, "$1./utils/")
        .replace(/(["'])\.\.\/dom\//g, "$1./utils/")
        .replace(/(["'])\.\.\/utils\//g, "$1./utils/")
    : content;
  return rewriteRelativeJsExtensionsForCopy(relocated);
}

function main(): void {
  const keysRoot = resolveKeysRoot(WORKSPACE_ROOT);
  writeKeysVersion(keysRoot);
  const result = buildCopyBundle({
    sourceRoot: keysRoot,
    outputPath: OUTPUT_PATH,
    itemType: REGISTRY_ITEM_TYPE.hook,
    pathMapping: { from: "src/", to: "" },
    transformContent: rewriteHookInternalImports,
    includeHidden: true,
  });
  console.log(`Wrote keys copy bundle: ${result.outputPath} (${result.itemCount} items)`);
}

main();
