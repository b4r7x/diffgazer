import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeSyncFingerprint,
  readSyncState,
  writeSyncState,
  shouldSkipSync,
} from "../docs/cache.js";
import type { LoadedLibraryArtifacts, SyncOutputPaths, SyncState } from "../docs/types.js";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "rk-cache-"));
}

function createMockArtifact(tempDir: string, id: string): LoadedLibraryArtifacts {
  const manifestPath = join(tempDir, `${id}-manifest.json`);
  const fingerprintPath = join(tempDir, `${id}-fingerprint.sha256`);
  writeFileSync(manifestPath, JSON.stringify({ library: id }));
  writeFileSync(fingerprintPath, "abc123\n");

  return {
    id,
    manifest: {
      schemaVersion: 1,
      library: id,
      package: `@test/${id}`,
      version: "1.0.0",
      artifactRoot: "dist/artifacts",
      inputs: ["src"],
      docs: { contentDir: "docs", metaFile: "docs/meta.json" },
      registry: {
        namespace: `@${id}`,
        basePath: `/r/${id}`,
        publicDir: "public/r",
        index: "public/r/registry.json",
      },
      integrity: { algorithm: "sha256", fingerprintFile: "fingerprint.sha256" },
    },
    manifestPath,
    artifactRoot: join(tempDir, "artifacts"),
    fingerprintPath,
    fingerprint: "abc123",
    generatedFiles: [],
  };
}

describe("computeSyncFingerprint", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("produces deterministic output for same inputs", () => {
    const artifact = createMockArtifact(tempDir, "lib-a");
    const fp1 = computeSyncFingerprint("https://example.com", 2, [artifact]);
    const fp2 = computeSyncFingerprint("https://example.com", 2, [artifact]);
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(64);
  });

  it("changes when origin changes", () => {
    const artifact = createMockArtifact(tempDir, "lib-a");
    const fp1 = computeSyncFingerprint("https://a.com", 2, [artifact]);
    const fp2 = computeSyncFingerprint("https://b.com", 2, [artifact]);
    expect(fp1).not.toBe(fp2);
  });

  it("changes when schema version changes", () => {
    const artifact = createMockArtifact(tempDir, "lib-a");
    const fp1 = computeSyncFingerprint("https://a.com", 1, [artifact]);
    const fp2 = computeSyncFingerprint("https://a.com", 2, [artifact]);
    expect(fp1).not.toBe(fp2);
  });
});

describe("readSyncState / writeSyncState", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns null for non-existent file", () => {
    expect(readSyncState(join(tempDir, "missing.json"))).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const filePath = join(tempDir, "bad.json");
    writeFileSync(filePath, "not json");
    expect(readSyncState(filePath)).toBeNull();
  });

  it("returns null for JSON missing required fields", () => {
    const filePath = join(tempDir, "partial.json");
    writeFileSync(filePath, JSON.stringify({ fingerprint: "abc" }));
    expect(readSyncState(filePath)).toBeNull();
  });

  it("round-trips state through write then read", () => {
    const filePath = join(tempDir, "nested", "state.json");
    const state: SyncState = {
      fingerprint: "abc123",
      origin: "https://example.com",
      syncedAt: "2026-01-01T00:00:00.000Z",
    };

    writeSyncState(filePath, state);
    expect(existsSync(filePath)).toBe(true);

    const loaded = readSyncState(filePath);
    expect(loaded).toEqual(state);
  });
});

describe("shouldSkipSync", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns false when sync state is null", () => {
    const paths: SyncOutputPaths = {
      contentDir: join(tempDir, "content"),
      generatedDir: join(tempDir, "generated"),
      registryDir: join(tempDir, "registry"),
      stylesDir: join(tempDir, "styles"),
      publicRegistryDir: join(tempDir, "public-r"),
      libraryAssetsDir: join(tempDir, "assets"),
      stateFilePath: join(tempDir, "state.json"),
    };
    expect(
      shouldSkipSync({
        syncState: null,
        syncFingerprint: "abc",
        artifacts: [],
        paths,
      }),
    ).toBe(false);
  });

  it("returns false when fingerprint differs", () => {
    const paths: SyncOutputPaths = {
      contentDir: join(tempDir, "content"),
      generatedDir: join(tempDir, "generated"),
      registryDir: join(tempDir, "registry"),
      stylesDir: join(tempDir, "styles"),
      publicRegistryDir: join(tempDir, "public-r"),
      libraryAssetsDir: join(tempDir, "assets"),
      stateFilePath: join(tempDir, "state.json"),
    };
    const state: SyncState = {
      fingerprint: "old",
      origin: "https://example.com",
      syncedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(
      shouldSkipSync({
        syncState: state,
        syncFingerprint: "new",
        artifacts: [],
        paths,
      }),
    ).toBe(false);
  });

  it("returns true when fingerprint matches and all outputs exist", () => {
    const paths: SyncOutputPaths = {
      contentDir: join(tempDir, "content"),
      generatedDir: join(tempDir, "generated"),
      registryDir: join(tempDir, "registry"),
      stylesDir: join(tempDir, "styles"),
      publicRegistryDir: join(tempDir, "public-r"),
      libraryAssetsDir: join(tempDir, "assets"),
      stateFilePath: join(tempDir, "state.json"),
    };
    mkdirSync(paths.contentDir, { recursive: true });
    writeFileSync(join(paths.contentDir, "meta.json"), "{}");
    mkdirSync(paths.registryDir, { recursive: true });
    writeFileSync(join(paths.registryDir, "registry.json"), "{}");
    mkdirSync(paths.stylesDir, { recursive: true });
    writeFileSync(join(paths.stylesDir, "styles.css"), "");

    const state: SyncState = {
      fingerprint: "match",
      origin: "https://example.com",
      syncedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(
      shouldSkipSync({
        syncState: state,
        syncFingerprint: "match",
        artifacts: [],
        paths,
      }),
    ).toBe(true);
  });
});
