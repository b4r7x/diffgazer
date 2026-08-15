import { resolve } from "node:path";
import { assertRscClientDirectives } from "@diffgazer/registry/build-checks";
import { NON_REGISTRY_CLIENT_OUTPUTS } from "./registry/client-entrypoints.js";

const ROOT = resolve(import.meta.dirname, "..");

assertRscClientDirectives({
  rootDir: ROOT,
  registryPath: resolve(ROOT, "registry", "registry.json"),
  extraClientOutputs: NON_REGISTRY_CLIENT_OUTPUTS,
});

console.log("[ui] RSC client directives OK");
