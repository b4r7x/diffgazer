import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateManifest, ArtifactManifestSchema, createArtifactManifest } from "../manifest.js";
import type { ArtifactManifest } from "../manifest.js";

const validManifest: ArtifactManifest = {
  schemaVersion: 1,
  library: "ui",
  package: "@diffgazer/ui",
  version: "0.5.0",
  artifactRoot: "dist/artifacts",
  inputs: ["docs/content", "registry", "public/r", "styles"],
  docs: {
    contentDir: "docs/content",
    metaFile: "docs/meta.json",
  },
  registry: {
    namespace: "@ui",
    basePath: "/r/ui",
    publicDir: "public/r",
    index: "public/r/registry.json",
  },
  integrity: {
    algorithm: "sha256",
    fingerprintFile: "fingerprint.sha256",
  },
};

describe("ArtifactManifestSchema", () => {
  it("should validate a valid manifest", () => {
    const result = ArtifactManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  it("should reject missing required fields", () => {
    const { library, ...noLibrary } = validManifest;
    const result = ArtifactManifestSchema.safeParse(noLibrary);
    expect(result.success).toBe(false);
  });

  it("should reject invalid schemaVersion", () => {
    const result = ArtifactManifestSchema.safeParse({ ...validManifest, schemaVersion: 2 });
    expect(result.success).toBe(false);
  });

  it("should reject invalid namespace format", () => {
    const result = ArtifactManifestSchema.safeParse({
      ...validManifest,
      registry: { ...validManifest.registry, namespace: "no-at-sign" },
    });
    expect(result.success).toBe(false);
  });

  it("should accept scoped package namespace format", () => {
    const result = ArtifactManifestSchema.safeParse({
      ...validManifest,
      registry: { ...validManifest.registry, namespace: "@diffgazer/keys" },
    });
    expect(result.success).toBe(true);
  });

  it("should accept optional source field", () => {
    const result = ArtifactManifestSchema.safeParse({
      ...validManifest,
      source: { registryDir: "registry", stylesDir: "styles" },
    });
    expect(result.success).toBe(true);
  });

  it("should accept optional generated field", () => {
    const result = ArtifactManifestSchema.safeParse({
      ...validManifest,
      generated: { "components.json": "dist/artifacts/generated/components.json" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty inputs array", () => {
    const result = ArtifactManifestSchema.safeParse({ ...validManifest, inputs: [] });
    expect(result.success).toBe(false);
  });
});

describe("createArtifactManifest", () => {
  const testDir = resolve(tmpdir(), "manifest-factory-test");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  const baseOptions = {
    rootDir: "", // set per test
    library: "test-lib",
    inputs: ["docs", "registry"],
    docs: { contentDir: "docs", metaFile: "docs/meta.json" } as const,
    registry: { namespace: "@testlib", basePath: "/r/test-lib", publicDir: "registry", index: "registry/registry.json" } as const,
  };

  it("should fill in fixed fields", () => {
    writeFileSync(resolve(testDir, "package.json"), JSON.stringify({ name: "test-lib", version: "1.0.0" }));
    const manifest = createArtifactManifest({ ...baseOptions, rootDir: testDir });
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.artifactRoot).toBe("dist/artifacts");
    expect(manifest.integrity).toEqual({ algorithm: "sha256", fingerprintFile: "fingerprint.sha256" });
  });

  it("should read version from package.json", () => {
    writeFileSync(resolve(testDir, "package.json"), JSON.stringify({ name: "test-lib", version: "2.3.4" }));
    const manifest = createArtifactManifest({ ...baseOptions, rootDir: testDir });
    expect(manifest.version).toBe("2.3.4");
  });

  it("should fall back to 0.0.0 when version is missing", () => {
    writeFileSync(resolve(testDir, "package.json"), JSON.stringify({ name: "test-lib" }));
    const manifest = createArtifactManifest({ ...baseOptions, rootDir: testDir });
    expect(manifest.version).toBe("0.0.0");
  });

  it("should use packageName when provided", () => {
    writeFileSync(resolve(testDir, "package.json"), JSON.stringify({ name: "pkg-from-json", version: "1.0.0" }));
    const manifest = createArtifactManifest({ ...baseOptions, rootDir: testDir, packageName: "custom-pkg" });
    expect(manifest.package).toBe("custom-pkg");
  });

  it("should fall back to pkg.name when packageName is not provided", () => {
    writeFileSync(resolve(testDir, "package.json"), JSON.stringify({ name: "pkg-from-json", version: "1.0.0" }));
    const manifest = createArtifactManifest({ ...baseOptions, rootDir: testDir });
    expect(manifest.package).toBe("pkg-from-json");
  });

  it("should omit source and generated when not provided", () => {
    writeFileSync(resolve(testDir, "package.json"), JSON.stringify({ name: "test-lib", version: "1.0.0" }));
    const manifest = createArtifactManifest({ ...baseOptions, rootDir: testDir });
    expect(manifest).not.toHaveProperty("source");
    expect(manifest).not.toHaveProperty("generated");
  });

  it("should include source and generated when provided", () => {
    writeFileSync(resolve(testDir, "package.json"), JSON.stringify({ name: "test-lib", version: "1.0.0" }));
    const manifest = createArtifactManifest({
      ...baseOptions,
      rootDir: testDir,
      source: { registryDir: "registry" },
      generated: { hooksFile: "generated/hooks.json" },
    });
    expect(manifest.source).toEqual({ registryDir: "registry" });
    expect(manifest.generated).toEqual({ hooksFile: "generated/hooks.json" });
  });

  it("should produce a valid manifest according to schema", () => {
    writeFileSync(resolve(testDir, "package.json"), JSON.stringify({ name: "test-lib", version: "1.0.0" }));
    const manifest = createArtifactManifest({ ...baseOptions, rootDir: testDir });
    const result = ArtifactManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });
});

describe("validateManifest", () => {
  it("should return errors array for invalid input", () => {
    const result = validateManifest({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
