import { resolve } from "node:path";
import { assertDistEsmRelativeImports } from "@diffgazer/registry/build-checks";

assertDistEsmRelativeImports({
  distDir: resolve(import.meta.dirname, "..", "dist"),
  packageLabel: "@diffgazer/core",
});

console.log("[core] dist ESM relative imports carry .js OK");
