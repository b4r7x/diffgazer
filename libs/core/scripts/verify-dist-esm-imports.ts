import { resolve } from "node:path";
import { assertDistEsmRelativeImports } from "@diffgazer/registry/cli";

assertDistEsmRelativeImports({
  distDir: resolve(import.meta.dirname, "..", "dist"),
  packageLabel: "@diffgazer/core",
});

console.log("[core] dist ESM relative imports carry .js OK");
