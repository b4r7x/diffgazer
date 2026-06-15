import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
        artifactSource: { workspaceDir: "libs/ui", packageName: "@fixture/ui" },
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

describe("prepareGenerated", () => {
  it("skips library artifact rebuild in package sync mode and still runs generators", async () => {
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
        DIFFGAZER_ARTIFACT_SYNC_MODE: "package",
      },
      warn: () => {},
      ...createStepRecorder(calls),
    });

    expect(calls).toEqual([
      "sync-artifacts",
      "generate-logo-ascii",
      "generate-sections-with-index",
    ]);
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
        DIFFGAZER_ARTIFACT_SYNC_MODE: "workspace",
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
