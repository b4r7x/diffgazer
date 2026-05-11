import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildRegistryArtifacts } from "../artifacts.js";

const tempRoots: string[] = [];

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "rk-artifacts-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createMinimalManifest() {
  return {
    schemaVersion: 1 as const,
    library: "test-lib",
    package: "@test/lib",
    version: "1.0.0",
    artifactRoot: "dist/artifacts",
    inputs: ["src"],
    docs: {
      contentDir: "docs/content",
      metaFile: "docs/meta.json",
    },
    registry: {
      namespace: "@test",
      basePath: "/r",
      publicDir: "public/r",
      index: "__registry__/index.json",
    },
    integrity: {
      algorithm: "sha256" as const,
      fingerprintFile: "fingerprint.sha256",
    },
  };
}

describe("buildRegistryArtifacts", () => {
  it("creates artifact directory with manifest and fingerprint files", () => {
    const root = createTempRoot();
    const artifactRoot = "dist/artifacts";

    const result = buildRegistryArtifacts({
      rootDir: root,
      artifactRoot,
      manifest: createMinimalManifest(),
      defaultOrigin: "https://example.com",
      inputs: [],
    });

    expect(existsSync(result.manifestPath)).toBe(true);
    expect(existsSync(result.fingerprintPath)).toBe(true);
    expect(result.artifactRoot).toBe(join(root, artifactRoot));
  });

  it("copies directories from copyDirs entries", () => {
    const root = createTempRoot();
    const sourceDir = join(root, "source-dir");
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, "file.txt"), "hello");

    buildRegistryArtifacts({
      rootDir: root,
      manifest: createMinimalManifest(),
      defaultOrigin: "https://example.com",
      inputs: [],
      copyDirs: [{ from: "source-dir", to: "copied" }],
    });

    const copiedFile = join(root, "dist/artifacts/copied/file.txt");
    expect(existsSync(copiedFile)).toBe(true);
    expect(readFileSync(copiedFile, "utf-8")).toBe("hello");
  });

  it("writes manifest as JSON", () => {
    const root = createTempRoot();
    const manifest = createMinimalManifest();

    const result = buildRegistryArtifacts({
      rootDir: root,
      manifest,
      defaultOrigin: "https://example.com",
      inputs: [],
    });

    const written = JSON.parse(readFileSync(result.manifestPath, "utf-8")) as Record<string, unknown>;
    expect(written.library).toBe("test-lib");
    expect(written.package).toBe("@test/lib");
    expect(written.schemaVersion).toBe(1);
  });

  it("writes fingerprint as text file with newline", () => {
    const root = createTempRoot();

    const result = buildRegistryArtifacts({
      rootDir: root,
      manifest: createMinimalManifest(),
      defaultOrigin: "https://example.com",
      inputs: [],
    });

    const content = readFileSync(result.fingerprintPath, "utf-8");
    expect(content.endsWith("\n")).toBe(true);
    expect(content.trim().length).toBeGreaterThan(0);
    expect(result.fingerprint).toBe(content.trim());
  });

  it("runs build hooks as part of produced artifact output", () => {
    const root = createTempRoot();

    buildRegistryArtifacts({
      rootDir: root,
      manifest: createMinimalManifest(),
      defaultOrigin: "https://example.com",
      inputs: [],
      copyDirs: [{ from: "source-dir", to: "copied" }],
      beforeBuild: () => {
        mkdirSync(join(root, "source-dir"), { recursive: true });
        writeFileSync(join(root, "source-dir", "file.txt"), "created before build");
      },
      afterCopy: ({ artifactRoot, origin }) => {
        writeFileSync(join(artifactRoot, "copied", "origin.txt"), origin);
      },
    });

    expect(readFileSync(join(root, "dist/artifacts/copied/file.txt"), "utf-8")).toBe("created before build");
    expect(readFileSync(join(root, "dist/artifacts/copied/origin.txt"), "utf-8")).toBe("https://example.com");
  });

  it("throws if required paths are missing", () => {
    const root = createTempRoot();

    expect(() =>
      buildRegistryArtifacts({
        rootDir: root,
        manifest: createMinimalManifest(),
        defaultOrigin: "https://example.com",
        inputs: [],
        requiredPaths: ["nonexistent/path"],
      }),
    ).toThrow("not found");
  });

  it("resets artifact directory before writing (clean slate)", () => {
    const root = createTempRoot();
    const artifactDir = join(root, "dist/artifacts");
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(join(artifactDir, "stale.txt"), "old content");

    buildRegistryArtifacts({
      rootDir: root,
      manifest: createMinimalManifest(),
      defaultOrigin: "https://example.com",
      inputs: [],
    });

    expect(existsSync(join(artifactDir, "stale.txt"))).toBe(false);
  });
});
