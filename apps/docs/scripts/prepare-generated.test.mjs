import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { computeRequiredArtifactFingerprint, REGISTRY_ORIGIN } from "@diffgazer/registry";
import { afterEach, describe, expect, it } from "vitest";
import { prepareGenerated } from "./prepare-generated.mjs";

const tempRoots = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

function makeTempRoot() {
  const root = mkdtempSync(join(tmpdir(), "dg-docs-prepare-"));
  tempRoots.push(root);
  return root;
}

function writeText(root, relPath, content) {
  const path = join(root, relPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function writeJson(root, relPath, value) {
  writeText(root, relPath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeDocsConfig(docsRoot) {
  const configPath = join(docsRoot, "config/docs-libraries.json");
  writeJson(docsRoot, "config/docs-libraries.json", {
    primaryLibraryId: "ui",
    libraries: [
      {
        id: "ui",
        enabled: true,
        artifactSource: { workspaceDir: "libs/ui" },
      },
    ],
  });
  return configPath;
}

function createStepRecorder(calls) {
  return {
    runPrepareLibraryArtifacts: () => calls.push("prepare-library-artifacts"),
    runSyncArtifacts: () => calls.push("sync-artifacts"),
    runGenerateLogoAscii: () => calls.push("generate-logo-ascii"),
    runGenerateSectionsWithIndex: () => calls.push("generate-sections-with-index"),
  };
}

function installWorkspaceArtifact(workspaceRoot) {
  const libraryRoot = join(workspaceRoot, "libs/ui");
  const artifactRoot = join(libraryRoot, "dist/artifacts");
  const manifest = {
    schemaVersion: 1,
    origin: REGISTRY_ORIGIN,
    library: "ui",
    package: "@fixture/ui",
    version: "1.0.0",
    artifactRoot: "dist/artifacts",
    inputs: ["src/input.txt"],
    docs: {
      contentDir: "docs/content",
      metaFile: "docs/content/meta.json",
      generatedDir: "docs/generated",
    },
    registry: {
      namespace: "@fixture/ui",
      basePath: "/r/ui",
      publicDir: "public/r",
      index: "public/r/registry.json",
    },
    source: { registryDir: "source/registry" },
    generated: { componentList: "docs/generated/component-list.json" },
    integrity: { algorithm: "sha256", fingerprintFile: "fingerprint.sha256" },
  };

  writeText(libraryRoot, "src/input.txt", "fixture input\n");
  writeJson(artifactRoot, "artifact-manifest.json", manifest);
  writeJson(artifactRoot, "docs/content/meta.json", { title: "UI" });
  writeText(artifactRoot, "docs/content/getting-started.mdx", "# Getting started\n");
  writeJson(artifactRoot, "docs/generated/component-list.json", []);
  writeJson(artifactRoot, "public/r/registry.json", { items: [] });
  writeJson(artifactRoot, "source/registry/registry.json", { items: [] });
  writeText(artifactRoot, "source/registry/examples/example.tsx", "export default null;\n");
  writeText(
    artifactRoot,
    "fingerprint.sha256",
    `${computeRequiredArtifactFingerprint(
      libraryRoot,
      manifest.inputs,
      REGISTRY_ORIGIN,
      "fixture artifacts",
    )}\n`,
  );
}

describe("prepareGenerated", () => {
  it("runs the documented workspace command against configured workspace artifacts", async () => {
    const root = makeTempRoot();
    const docsRoot = join(root, "docs");
    const workspaceRoot = join(root, "workspace");
    const calls = [];
    installWorkspaceArtifact(workspaceRoot);

    await prepareGenerated({
      docsRoot,
      workspaceRoot,
      configPath: writeDocsConfig(docsRoot),
      env: {
        DIFFGAZER_SKIP_ARTIFACT_PREPARE: "1",
      },
      warn: () => {},
      runPrepareLibraryArtifacts: () => calls.push("prepare-library-artifacts"),
      runGenerateLogoAscii: () => calls.push("generate-logo-ascii"),
      runGenerateSectionsWithIndex: () => calls.push("generate-sections-with-index"),
    });

    expect(calls).toEqual(["generate-logo-ascii", "generate-sections-with-index"]);
    expect(existsSync(join(docsRoot, "content/docs/ui/getting-started.mdx"))).toBe(true);
    expect(existsSync(join(docsRoot, "public/r/ui/registry.json"))).toBe(true);
  });

  it("rebuilds library artifacts before generators when workspace artifacts are missing", async () => {
    const root = makeTempRoot();
    const docsRoot = join(root, "docs");
    const workspaceRoot = join(root, "workspace");
    const calls = [];

    await prepareGenerated({
      docsRoot,
      workspaceRoot,
      configPath: writeDocsConfig(docsRoot),
      env: {
        DIFFGAZER_SKIP_ARTIFACT_PREPARE: "1",
      },
      warn: () => {},
      ...createStepRecorder(calls),
    });

    expect(calls).toEqual([
      "prepare-library-artifacts",
      "sync-artifacts",
      "generate-logo-ascii",
      "generate-sections-with-index",
    ]);
  });
});
