import { resolve } from "node:path";
import { assertDistEsmRelativeImports } from "@diffgazer/registry/cli";

// dist/artifacts holds copied shadcn/copy payloads that are intentionally
// extensionless; only the tsc-emitted tree is subject to the Node ESM rule.
assertDistEsmRelativeImports({
  distDir: resolve(import.meta.dirname, "..", "dist"),
  packageLabel: "@diffgazer/keys",
  skipDirs: ["artifacts"],
});

console.log("[keys] dist ESM relative imports carry .js OK");
