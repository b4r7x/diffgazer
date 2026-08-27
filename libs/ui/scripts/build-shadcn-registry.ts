import { resolve } from "node:path";
import {
  aggregateThemeStyles,
  buildShadcnRegistryWithOrigin,
  REGISTRY_ORIGIN,
} from "@diffgazer/registry";
import { transformUiPublicRegistryKeysImports } from "./registry/rewrite-keys-imports.js";
import {
  aggregateThemeStylesInPublicRegistry,
  createUiThemeStyleStripPolicy,
  removeDuplicateThemeStylesInPublicRegistry,
} from "./registry/theme-style-dedupe.js";
import { applyUiRegistryTargetsInPublicRegistry } from "./registry/ui-registry-targets.js";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE_REGISTRY_PATH = "registry/registry.json";
const themeStyleStripPolicy = createUiThemeStyleStripPolicy({
  rootDir: ROOT,
  sourceRegistryPath: SOURCE_REGISTRY_PATH,
});

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
    removeDuplicateThemeStylesInPublicRegistry(outputDir, themeStyleStripPolicy);
  },
});
