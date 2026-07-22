import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyArtifactsToPackage } from "./artifacts.js";

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
  writeFileSync(
    join(artifactsDir, "artifact-manifest.json"),
    JSON.stringify({ schemaVersion: 1, origin: "https://registry.example.com" }),
  );
  writeFileSync(join(artifactsDir, "fingerprint.sha256"), "abc123\n");
  writeFileSync(join(artifactsDir, "some-file.json"), '{"test": true}');
  return artifactsDir;
}

function seedPackageOutputs(packageRoot: string): { distMarker: string; artifactsMarker: string } {
  const distMarker = join(packageRoot, "dist", "prior-dist.txt");
  const artifactsMarker = join(packageRoot, "artifacts", "prior-artifact.txt");
  mkdirSync(join(packageRoot, "dist"), { recursive: true });
  mkdirSync(join(packageRoot, "artifacts"), { recursive: true });
  writeFileSync(distMarker, "prior-dist-bytes");
  writeFileSync(artifactsMarker, "prior-artifact-bytes");
  return { distMarker, artifactsMarker };
}

describe("copyArtifactsToPackage", () => {
  it("copies artifacts from source dist/artifacts to package artifacts", () => {
    const sourceRoot = createTempDir();
    const packageRoot = createTempDir();
    setupSourceArtifacts(sourceRoot);

    copyArtifactsToPackage({
      sourceRoot,
      packageRoot,
      label: "test-lib",
    });

    const target = join(packageRoot, "artifacts");
    expect(existsSync(join(target, "fingerprint.sha256"))).toBe(true);
    expect(readFileSync(join(target, "some-file.json"), "utf-8")).toBe('{"test": true}');
    expect(readFileSync(join(target, "artifact-manifest.json"), "utf-8")).toContain(
      '"artifactRoot": "artifacts"',
    );
    expect(JSON.parse(readFileSync(join(target, "artifact-manifest.json"), "utf-8")).origin).toBe(
      "https://registry.example.com",
    );
    expect(existsSync(join(packageRoot, "dist/artifacts"))).toBe(false);
  });

  it("throws with label and rebuildHint when source artifacts directory does not exist", () => {
    const sourceRoot = createTempDir();
    const packageRoot = createTempDir();
    const { distMarker, artifactsMarker } = seedPackageOutputs(packageRoot);

    const call = () =>
      copyArtifactsToPackage({
        sourceRoot,
        packageRoot,
        label: "test-lib",
        rebuildHint: "pnpm --filter test-lib build:artifacts",
      });

    expect(call).toThrow("test-lib artifacts not found");
    expect(call).toThrow("pnpm --filter test-lib build:artifacts");
    expect(readFileSync(distMarker, "utf-8")).toBe("prior-dist-bytes");
    expect(readFileSync(artifactsMarker, "utf-8")).toBe("prior-artifact-bytes");
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
  ])("throws when artifact $label file is missing during manifest validation", ({
    existingFile,
    expectedMessage,
  }) => {
    const sourceRoot = createTempDir();
    const packageRoot = createTempDir();
    const artifactsDir = join(sourceRoot, "dist/artifacts");
    mkdirSync(artifactsDir, { recursive: true });
    writeFileSync(join(artifactsDir, existingFile.name), existingFile.body);
    const { distMarker, artifactsMarker } = seedPackageOutputs(packageRoot);

    expect(() =>
      copyArtifactsToPackage({
        sourceRoot,
        packageRoot,
        label: "test-lib",
      }),
    ).toThrow(expectedMessage);
    expect(readFileSync(distMarker, "utf-8")).toBe("prior-dist-bytes");
    expect(readFileSync(artifactsMarker, "utf-8")).toBe("prior-artifact-bytes");
  });

  it("cleans package dist before copying artifacts", () => {
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
    expect(existsSync(join(packageRoot, "artifacts/artifact-manifest.json"))).toBe(true);
  });
});
