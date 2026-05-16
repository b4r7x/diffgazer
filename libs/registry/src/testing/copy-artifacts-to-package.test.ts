import { describe, expect, it, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { copyArtifactsToPackage } from "../artifacts.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rk-copy-pkg-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function setupSourceArtifacts(root: string): string {
  const artifactsDir = join(root, "dist/artifacts");
  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(join(artifactsDir, "artifact-manifest.json"), JSON.stringify({ schemaVersion: 1 }));
  writeFileSync(join(artifactsDir, "fingerprint.sha256"), "abc123\n");
  writeFileSync(join(artifactsDir, "some-file.json"), '{"test": true}');
  return artifactsDir;
}

describe("copyArtifactsToPackage", () => {
  it("copies artifacts from source to package dist/artifacts", () => {
    const sourceRoot = createTempDir();
    const packageRoot = createTempDir();
    setupSourceArtifacts(sourceRoot);

    copyArtifactsToPackage({
      sourceRoot,
      packageRoot,
      label: "test-lib",
    });

    const target = join(packageRoot, "dist/artifacts");
    expect(existsSync(join(target, "artifact-manifest.json"))).toBe(true);
    expect(existsSync(join(target, "fingerprint.sha256"))).toBe(true);
    expect(existsSync(join(target, "some-file.json"))).toBe(true);
    expect(readFileSync(join(target, "some-file.json"), "utf-8")).toBe('{"test": true}');
  });

  it("throws with label and rebuildHint when source artifacts directory does not exist", () => {
    const sourceRoot = createTempDir();
    const packageRoot = createTempDir();

    const call = () =>
      copyArtifactsToPackage({
        sourceRoot,
        packageRoot,
        label: "test-lib",
        rebuildHint: "pnpm --filter test-lib build:artifacts",
      });

    expect(call).toThrow("test-lib artifacts not found");
    expect(call).toThrow("pnpm --filter test-lib build:artifacts");
  });

  it.each([
    {
      label: "manifest",
      existingFile: { name: "fingerprint.sha256", body: "abc123\n" },
      expectedMessage: "artifact manifest",
    },
    {
      label: "fingerprint",
      existingFile: { name: "artifact-manifest.json", body: "{}" },
      expectedMessage: "artifact fingerprint",
    },
  ])("throws when artifact $label file is missing during manifest validation", ({ existingFile, expectedMessage }) => {
    const sourceRoot = createTempDir();
    const packageRoot = createTempDir();
    const artifactsDir = join(sourceRoot, "dist/artifacts");
    mkdirSync(artifactsDir, { recursive: true });
    writeFileSync(join(artifactsDir, existingFile.name), existingFile.body);

    expect(() =>
      copyArtifactsToPackage({
        sourceRoot,
        packageRoot,
        label: "test-lib",
      }),
    ).toThrow(expectedMessage);
  });

  it("skips manifest validation when validateManifest is false", () => {
    const sourceRoot = createTempDir();
    const packageRoot = createTempDir();
    const artifactsDir = join(sourceRoot, "dist/artifacts");
    mkdirSync(artifactsDir, { recursive: true });
    writeFileSync(join(artifactsDir, "data.json"), "{}");

    copyArtifactsToPackage({
      sourceRoot,
      packageRoot,
      label: "test-lib",
      validateManifest: false,
    });

    expect(existsSync(join(packageRoot, "dist/artifacts/data.json"))).toBe(true);
  });

  it("cleans entire dist/ with parent-dist strategy (default)", () => {
    const sourceRoot = createTempDir();
    const packageRoot = createTempDir();
    setupSourceArtifacts(sourceRoot);

    const distDir = join(packageRoot, "dist");
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, "stale.txt"), "should be removed");

    copyArtifactsToPackage({
      sourceRoot,
      packageRoot,
      label: "test-lib",
    });

    expect(existsSync(join(distDir, "stale.txt"))).toBe(false);
    expect(existsSync(join(packageRoot, "dist/artifacts/artifact-manifest.json"))).toBe(true);
  });

  it("only cleans artifact dir with artifact-dir strategy", () => {
    const sourceRoot = createTempDir();
    const packageRoot = createTempDir();
    setupSourceArtifacts(sourceRoot);

    const distDir = join(packageRoot, "dist");
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, "index.js"), "compiled output");

    const targetArtifacts = join(distDir, "artifacts");
    mkdirSync(targetArtifacts, { recursive: true });
    writeFileSync(join(targetArtifacts, "stale.json"), "old");

    copyArtifactsToPackage({
      sourceRoot,
      packageRoot,
      label: "test-lib",
      cleanStrategy: "artifact-dir",
    });

    expect(existsSync(join(distDir, "index.js"))).toBe(true);
    expect(existsSync(join(targetArtifacts, "stale.json"))).toBe(false);
    expect(existsSync(join(targetArtifacts, "artifact-manifest.json"))).toBe(true);
  });

  it("supports custom artifactDir", () => {
    const sourceRoot = createTempDir();
    const packageRoot = createTempDir();
    const customDir = join(sourceRoot, "output/build-artifacts");
    mkdirSync(customDir, { recursive: true });
    writeFileSync(join(customDir, "artifact-manifest.json"), "{}");
    writeFileSync(join(customDir, "fingerprint.sha256"), "abc\n");
    writeFileSync(join(customDir, "data.json"), '{"custom": true}');

    copyArtifactsToPackage({
      sourceRoot,
      packageRoot,
      label: "test-lib",
      artifactDir: "output/build-artifacts",
    });

    expect(existsSync(join(packageRoot, "output/build-artifacts/data.json"))).toBe(true);
    expect(readFileSync(join(packageRoot, "output/build-artifacts/data.json"), "utf-8")).toBe('{"custom": true}');
  });
});
