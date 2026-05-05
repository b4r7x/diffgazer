import { resolve } from "node:path";
import {
  buildRegistryArtifacts,
  createArtifactManifest,
  REGISTRY_ORIGIN,
} from "@diffgazer/registry";

const ROOT = resolve(import.meta.dirname, "..");

const INPUTS = [
  "docs/content",
  "docs/generated",
  "registry",
  "styles",
  "public/r",
  "internal-docs-manifest.json",
  "package.json",
];

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
