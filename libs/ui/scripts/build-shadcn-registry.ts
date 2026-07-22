import { resolve } from "node:path";
import {
  aggregateThemeStyles,
  buildShadcnRegistryWithOrigin,
  REGISTRY_ORIGIN,
} from "@diffgazer/registry";
import {
  aggregateThemeStylesInPublicRegistry,
  applyUiRegistryTargetsInPublicRegistry,
  transformUiPublicRegistryKeysImports,
} from "./registry/rewrite-keys-imports.js";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE_REGISTRY_PATH = "registry/registry.json";

buildShadcnRegistryWithOrigin({
  rootDir: ROOT,
  defaultOrigin: REGISTRY_ORIGIN,
  afterBuild: ({ outputDir }) => {
    transformUiPublicRegistryKeysImports(outputDir);
    applyUiRegistryTargetsInPublicRegistry(outputDir);
    aggregateThemeStylesInPublicRegistry(outputDir, (seedContent) =>
      aggregateThemeStyles({
        rootDir: ROOT,
        sourceRegistryPath: SOURCE_REGISTRY_PATH,
        seedContent,
      }),
    );
  },
});
