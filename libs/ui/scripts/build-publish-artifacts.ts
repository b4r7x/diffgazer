import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  aggregateThemeStyles,
  buildRegistryArtifacts,
  createArtifactManifest,
  REGISTRY_ORIGIN,
} from "@diffgazer/registry";
import { transformUiPublicRegistrySourceItem } from "./registry/public-registry-item.js";
import {
  isHiddenKeysShim,
  transformUiPublicRegistryKeysImportContent,
  transformUiPublicRegistryKeysImports,
} from "./registry/rewrite-keys-imports.js";
import {
  aggregateThemeStylesInPublicRegistry,
  createUiThemeStyleStripPolicy,
  removeDuplicateThemeStylesInPublicRegistry,
} from "./registry/theme-style-dedupe.js";
import { applyUiRegistryTargetsInPublicRegistry } from "./registry/ui-registry-targets.js";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE_REGISTRY_PATH = "registry/registry.json";
const THEME_STYLES_PATH = "styles/styles.css";
const themeStyleStripPolicy = createUiThemeStyleStripPolicy({
  rootDir: ROOT,
  sourceRegistryPath: SOURCE_REGISTRY_PATH,
});

const INPUTS = ["docs/content", "docs/generated", "registry", "styles", "public/r", "package.json"];

function main(): void {
  const manifest = createArtifactManifest({
    rootDir: ROOT,
    library: "ui",
    inputs: INPUTS,
    docs: {
      contentDir: "docs",
      metaFile: "docs/meta.json",
      generatedDir: "generated",
    },
    registry: {
      namespace: "@diffgazer/ui",
      basePath: "/r/ui",
      publicDir: "registry",
      index: "registry/registry.json",
    },
    source: {
      registryDir: "source/registry",
      stylesDir: "source/styles",
    },
    generated: {
      uiHooksFile: "generated/ui-hooks.json",
      uiLibsFile: "generated/ui-libs.json",
      componentList: "generated/component-list.json",
      hookList: "generated/hook-list.json",
      demoIndex: "generated/demo-index.ts",
    },
  });

  const result = buildRegistryArtifacts({
    rootDir: ROOT,
    manifest,
    defaultOrigin: REGISTRY_ORIGIN,
    ensurePublicRegistry: {
      fixCommand: "pnpm --filter @diffgazer/ui build:shadcn",
      label: "ui public registry index",
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
      transformSourceItem: ({ item }) =>
        transformUiPublicRegistrySourceItem(item, {
          stylePolicy: themeStyleStripPolicy,
          readSourceFile: (path) => readFileSync(resolve(ROOT, path), "utf-8"),
        }),
      shouldSkipSourceItem: ({ item }) => isHiddenKeysShim(item),
      // The theme's styles.css ships aggregated (seed + every component CSS) so the
      // shadcn install path carries component CSS; validation must compare the
      // aggregated source against the aggregated public file.
      transformSourceContent: ({ content, itemName, filePath }) =>
        itemName === "theme" && filePath === THEME_STYLES_PATH
          ? aggregateThemeStyles({
              rootDir: ROOT,
              sourceRegistryPath: SOURCE_REGISTRY_PATH,
              seedContent: content,
            })
          : transformUiPublicRegistryKeysImportContent(content, {
              shimHookBasename: itemName.startsWith("use-") ? itemName : undefined,
            }),
    },
    requiredPaths: [
      { path: "public/r", label: "ui public registry" },
      { path: "public/r/registry.json", label: "ui public registry index" },
      { path: "docs/content", label: "ui docs content" },
      { path: "docs/generated", label: "ui docs generated data" },
      { path: "registry", label: "ui registry source" },
      { path: "styles", label: "ui styles" },
    ],
    copyDirs: [
      { from: "docs/content", to: "docs" },
      { from: "docs/generated", to: "generated" },
      { from: "registry", to: "source/registry" },
      { from: "styles", to: "source/styles" },
      { from: "public/r", to: "registry" },
    ],
    rewriteDirs: ["registry", "source/registry"],
  });

  console.log(`[ui] artifact manifest written: ${result.manifestPath}`);
  console.log(`[ui] artifact fingerprint: ${result.fingerprint}`);
}

main();
