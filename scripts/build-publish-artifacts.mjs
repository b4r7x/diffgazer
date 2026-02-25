import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRegistryArtifacts } from "@b4r7x/registry-kit";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const INPUTS = [
  "docs/content",
  "docs/assets",
  "public/r",
  "internal-docs-manifest.json",
  "package.json",
];

function main() {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));

  // Create minimal generated dir so docs sync validation passes
  const generatedDir = resolve(ROOT, "docs/generated");
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(
    resolve(generatedDir, "library-info.json"),
    JSON.stringify({ id: "diffgazer", type: "content-only" }),
  );

  const manifest = {
    schemaVersion: 1,
    library: "diffgazer",
    package: pkg.name ?? "diffgazer",
    version: pkg.version ?? "0.0.0",
    artifactRoot: "dist/artifacts",
    inputs: INPUTS,
    docs: {
      contentDir: "docs",
      metaFile: "docs/meta.json",
      assetsDir: "assets",
      generatedDir: "generated",
    },
    generated: {
      libraryInfo: "generated/library-info.json",
    },
    registry: {
      namespace: "@diffgazer",
      basePath: "/r/diffgazer",
      publicDir: "registry",
      index: "registry/registry.json",
    },
    integrity: {
      algorithm: "sha256",
      fingerprintFile: "fingerprint.sha256",
    },
  };

  const copyDirs = [
    { from: "docs/content", to: "docs" },
    { from: "docs/generated", to: "generated" },
    { from: "public/r", to: "registry" },
  ];

  const assetsDir = resolve(ROOT, "docs/assets");
  if (existsSync(assetsDir)) {
    copyDirs.push({ from: "docs/assets", to: "assets" });
  }

  const result = buildRegistryArtifacts({
    rootDir: ROOT,
    inputs: INPUTS,
    manifest,
    defaultOrigin: "https://diffgazer.com",
    requiredPaths: [
      { path: "docs/content", label: "diffgazer docs content" },
      { path: "public/r", label: "diffgazer public registry" },
      { path: "public/r/registry.json", label: "diffgazer public registry index" },
    ],
    copyDirs,
    rewriteDirs: ["registry"],
  });

  console.log(`[diffgazer] artifact manifest written: ${result.manifestPath}`);
  console.log(`[diffgazer] artifact fingerprint: ${result.fingerprint}`);
}

main();
