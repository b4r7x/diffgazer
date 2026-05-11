import { resolve } from "node:path";
import { buildShadcnRegistryWithOrigin, REGISTRY_ORIGIN } from "@diffgazer/registry";
import { transformUiPublicRegistryKeysImports } from "./transform-public-registry-keys-imports.js";

const ROOT = resolve(import.meta.dirname, "..");

buildShadcnRegistryWithOrigin({
  rootDir: ROOT,
  defaultOrigin: REGISTRY_ORIGIN,
  afterBuild: ({ outputDir }) => transformUiPublicRegistryKeysImports(outputDir),
});
