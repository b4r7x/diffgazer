import { resolve } from "node:path";
import { buildCopyBundle } from "@diffgazer/registry";
import { resolveKeysRoot } from "./keys-root.js";

const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "../..");
const OUTPUT_PATH = resolve(PACKAGE_ROOT, "src/generated/keys-copy-bundle.json");

function rewriteHookInternalImports(content: string, sourcePath: string): string {
  if (!sourcePath.startsWith("src/hooks/")) return content;
  return content.replace(/(["'])\.\.\/internal\//g, "$1./internal/");
}

function main(): void {
  const keysRoot = resolveKeysRoot(WORKSPACE_ROOT);
  const result = buildCopyBundle({
    sourceRoot: keysRoot,
    outputPath: OUTPUT_PATH,
    itemType: "registry:hook",
    pathMapping: { from: "src/", to: "" },
    transformContent: rewriteHookInternalImports,
  });
  console.log(`Wrote keys copy bundle: ${result.outputPath} (${result.itemCount} items)`);
}

main();
