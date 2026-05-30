import { resolve } from "node:path";
import { buildCopyBundle } from "@diffgazer/registry";
import { rewriteRelativeJsExtensionsForCopy } from "../src/utils/transform.js";
import { resolveKeysRoot } from "./keys-root.js";

const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "../..");
const OUTPUT_PATH = resolve(PACKAGE_ROOT, "src/generated/keys-copy-bundle.json");

function rewriteHookInternalImports(content: string, sourcePath: string): string {
  // Hook sources live in src/hooks/ but their siblings (core/, dom/, internal/, utils/)
  // land under src/hooks/utils/* on install. Rewrite "../<dir>/" to "./utils/" (or
  // "./internal/") so copied hooks resolve their helpers from the installed layout.
  // The dom/core/internal sources copied alongside them keep their own sibling
  // imports, so relocation is hooks-only — but every copied file must shed the
  // Node-ESM ".js" specifiers, which shadcn/copy consumers resolve extensionless.
  const relocated = sourcePath.startsWith("src/hooks/")
    ? content
        .replace(/(["'])\.\.\/core\//g, "$1./utils/")
        .replace(/(["'])\.\.\/dom\//g, "$1./utils/")
        .replace(/(["'])\.\.\/internal\//g, "$1./internal/")
        .replace(/(["'])\.\.\/utils\//g, "$1./utils/")
    : content;
  return rewriteRelativeJsExtensionsForCopy(relocated);
}

function main(): void {
  const keysRoot = resolveKeysRoot(WORKSPACE_ROOT);
  const result = buildCopyBundle({
    sourceRoot: keysRoot,
    outputPath: OUTPUT_PATH,
    itemType: "registry:hook",
    pathMapping: { from: "src/", to: "" },
    transformContent: rewriteHookInternalImports,
    includeHidden: true,
  });
  console.log(`Wrote keys copy bundle: ${result.outputPath} (${result.itemCount} items)`);
}

main();
