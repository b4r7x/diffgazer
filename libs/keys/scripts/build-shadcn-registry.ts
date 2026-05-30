import { resolve } from "node:path";
import { buildShadcnRegistryWithOrigin, REGISTRY_ORIGIN } from "@diffgazer/registry";
import {
  assertNoRelativeJsImports,
  transformKeysPublicRegistryImports,
} from "./transform-public-registry-imports.js";

const ROOT = resolve(import.meta.dirname, "..");

buildShadcnRegistryWithOrigin({
  rootDir: ROOT,
  defaultOrigin: REGISTRY_ORIGIN,
  afterBuild: ({ outputDir }) => {
    transformKeysPublicRegistryImports(outputDir);
    assertNoRelativeJsImports(outputDir);
  },
});
