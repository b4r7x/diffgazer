import { resolve } from "node:path";
import { assertRscClientDirectives } from "@diffgazer/registry/build-checks";

const ROOT = resolve(import.meta.dirname, "..");

assertRscClientDirectives({
  rootDir: ROOT,
  registryPath: resolve(ROOT, "registry", "registry.json"),
});

console.log("[ui] RSC client directives OK");
