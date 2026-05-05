import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildRegistryArtifacts,
  copyArtifactsToPackage,
  createArtifactManifest,
  REGISTRY_ORIGIN,
} from "@diffgazer/registry";

const ROOT = resolve(import.meta.dirname, "..");

const INPUTS = [
  "docs/content",
  "docs/assets",
  "docs/generated",
  "registry",
  "public/r",
  "internal-docs-manifest.json",
  "package.json",
];

function main(): void {
  const manifest = createArtifactManifest({
    rootDir: ROOT,
    library: "keys",
    inputs: INPUTS,
    docs: {
      contentDir: "docs",
      metaFile: "docs/meta.json",
      assetsDir: "assets",
      generatedDir: "generated",
    },
    registry: {
      namespace: "@diffgazer/keys",
      basePath: "/r/keys",
      publicDir: "registry",
      index: "registry/registry.json",
    },
    source: {
      registryDir: "source/registry",
    },
    generated: {
      keysHooksFile: "generated/keys-hooks.json",
      hookList: "generated/hook-list.json",
      hooksDir: "generated/hooks",
      demoIndex: "generated/demo-index.ts",
    },
  });

  const copyDirs = [
    { from: "docs/content", to: "docs" },
    { from: "public/r", to: "registry" },
    { from: "registry", to: "source/registry" },
  ];

  const assetsDir = resolve(ROOT, "docs/assets");
  if (existsSync(assetsDir)) {
    copyDirs.push({ from: "docs/assets", to: "assets" });
  }

  copyDirs.push({ from: "docs/generated", to: "generated" });

  const result = buildRegistryArtifacts({
    rootDir: ROOT,
    manifest,
    defaultOrigin: REGISTRY_ORIGIN,
    ensurePublicRegistry: {
      fixCommand: "pnpm --dir libs/keys build:shadcn",
      label: "keys public registry index",
    },
    requiredPaths: [
      { path: "docs/content", label: "keys docs content" },
      { path: "registry", label: "keys registry source" },
      { path: "public/r", label: "keys public registry" },
      { path: "public/r/registry.json", label: "keys public registry index" },
      { path: "docs/generated/keys-hooks.json", label: "keys hooks data" },
      { path: "docs/generated/hook-list.json", label: "keys hook list" },
    ],
    copyDirs,
    rewriteDirs: ["registry", "source/registry"],
    afterCopy: ({ artifactRoot }) => {
      // Verify expected generated files were copied
      const expectedFiles = ["generated/keys-hooks.json", "generated/hook-list.json"];
      for (const file of expectedFiles) {
        const filePath = resolve(artifactRoot, file);
        if (!existsSync(filePath)) {
          throw new Error(`Expected artifact file missing: ${file}`);
        }
      }
    },
  });

  console.log(`[keys] artifact manifest written: ${result.manifestPath}`);
  console.log(`[keys] artifact fingerprint: ${result.fingerprint}`);

  copyArtifactsToPackage({
    sourceRoot: ROOT,
    packageRoot: resolve(ROOT, "artifacts"),
    label: "keys-artifacts",
    rebuildHint: "pnpm --filter @diffgazer/keys build:artifacts",
  });
}

main();
