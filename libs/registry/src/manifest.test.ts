import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildRegistryArtifacts } from "./artifacts.js";
import { DEFAULT_OUTPUT_PATHS } from "./docs-sync/types.js";
import type { ArtifactManifest } from "./manifest.js";
import {
  ArtifactManifestSchema,
  createArtifactManifest,
  loadValidatedManifest,
  validateManifest,
} from "./manifest.js";

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
  it("accepts a complete valid manifest", () => {
    const result = ArtifactManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  it("accepts scoped package namespace format", () => {
    const result = ArtifactManifestSchema.safeParse({
      ...validManifest,
      registry: { ...validManifest.registry, namespace: "@diffgazer/keys" },
    });
    expect(result.success).toBe(true);
  });

  it.each([
    {
      label: "optional source field",
      manifest: {
        ...validManifest,
        source: { registryDir: "registry", stylesDir: "styles" },
      } as ArtifactManifest,
    },
    {
      label: "optional generated field",
      manifest: {
        ...validManifest,
        generated: { "components.json": "dist/artifacts/generated/components.json" },
      } as ArtifactManifest,
    },
  ])("accepts manifest with $label", ({ manifest }) => {
    expect(ArtifactManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it("keeps source styles as handoff metadata outside the docs-sync output contract", () => {
    const result = ArtifactManifestSchema.safeParse({
      ...validManifest,
      source: { registryDir: "registry", stylesDir: "source/styles" },
    });

    expect(result.success).toBe(true);
    expect(DEFAULT_OUTPUT_PATHS).not.toHaveProperty("stylesDir");
  });

  it.each([
    {
      label: "missing required library field",
      manifest: (() => {
        const { library: _omit, ...rest } = validManifest;
        return rest;
      })(),
    },
    {
      label: "invalid schemaVersion 2",
      manifest: { ...validManifest, schemaVersion: 2 },
    },
    {
      label: "namespace without @ prefix",
      manifest: {
        ...validManifest,
        registry: { ...validManifest.registry, namespace: "no-at-sign" },
      },
    },
    {
      label: "empty inputs array",
      manifest: { ...validManifest, inputs: [] },
    },
  ])("rejects manifest with $label", ({ manifest }) => {
    expect(ArtifactManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it.each([
    {
      label: "artifactRoot escaping with ..",
      manifest: { ...validManifest, artifactRoot: "../artifacts" },
    },
    {
      label: "absolute artifactRoot",
      manifest: { ...validManifest, artifactRoot: "/tmp/artifacts" },
    },
    {
      label: "input escaping with ..",
      manifest: { ...validManifest, inputs: ["../package.json"] },
    },
    {
      label: "docs.contentDir escaping with ..",
      manifest: { ...validManifest, docs: { ...validManifest.docs, contentDir: "../docs" } },
    },
    {
      label: "absolute docs.generatedDir",
      manifest: {
        ...validManifest,
        docs: { ...validManifest.docs, generatedDir: "/tmp/generated" },
      },
    },
    {
      label: "registry.publicDir escaping with ..",
      manifest: {
        ...validManifest,
        registry: { ...validManifest.registry, publicDir: "../registry" },
      },
    },
    {
      label: "source.registryDir escaping with ..",
      manifest: { ...validManifest, source: { registryDir: "../source" } },
    },
    {
      label: "generated path escaping with ..",
      manifest: { ...validManifest, generated: { demoIndex: "../demo-index.ts" } },
    },
    {
      label: "fingerprintFile escaping with ..",
      manifest: {
        ...validManifest,
        integrity: { ...validManifest.integrity, fingerprintFile: "../fingerprint.sha256" },
      },
    },
  ])("rejects manifest path escape via $label", ({ manifest }) => {
    expect(ArtifactManifestSchema.safeParse(manifest as ArtifactManifest).success).toBe(false);
  });
});

describe("createArtifactManifest", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "manifest-factory-"));
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
    registry: {
      namespace: "@testlib",
      basePath: "/r/test-lib",
      publicDir: "registry",
      index: "registry/registry.json",
    } as const,
  };

  it("produces a manifest that artifact consumers can load", () => {
    writeFileSync(
      resolve(testDir, "package.json"),
      JSON.stringify({ name: "test-lib", version: "1.0.0" }),
    );
    const manifest = createArtifactManifest({ ...baseOptions, rootDir: testDir });
    const result = buildRegistryArtifacts({
      rootDir: testDir,
      manifest,
      defaultOrigin: "https://example.com",
      inputs: [],
    });

    expect(loadValidatedManifest(result.manifestPath, "test-lib")).toMatchObject({
      schemaVersion: 1,
      artifactRoot: "dist/artifacts",
      integrity: { algorithm: "sha256", fingerprintFile: "fingerprint.sha256" },
    });
  });

  it("reads version from package.json", () => {
    writeFileSync(
      resolve(testDir, "package.json"),
      JSON.stringify({ name: "test-lib", version: "2.3.4" }),
    );
    const manifest = createArtifactManifest({ ...baseOptions, rootDir: testDir });
    expect(manifest.version).toBe("2.3.4");
  });

  it("falls back to 0.0.0 when package.json version is missing", () => {
    writeFileSync(resolve(testDir, "package.json"), JSON.stringify({ name: "test-lib" }));
    const manifest = createArtifactManifest({ ...baseOptions, rootDir: testDir });
    expect(manifest.version).toBe("0.0.0");
  });

  it("uses the explicit packageName option over package.json name", () => {
    writeFileSync(
      resolve(testDir, "package.json"),
      JSON.stringify({ name: "pkg-from-json", version: "1.0.0" }),
    );
    const manifest = createArtifactManifest({
      ...baseOptions,
      rootDir: testDir,
      packageName: "custom-pkg",
    });
    expect(manifest.package).toBe("custom-pkg");
  });

  it("falls back to package.json name when packageName option is omitted", () => {
    writeFileSync(
      resolve(testDir, "package.json"),
      JSON.stringify({ name: "pkg-from-json", version: "1.0.0" }),
    );
    const manifest = createArtifactManifest({ ...baseOptions, rootDir: testDir });
    expect(manifest.package).toBe("pkg-from-json");
  });

  it("omits source and generated when caller does not supply them", () => {
    writeFileSync(
      resolve(testDir, "package.json"),
      JSON.stringify({ name: "test-lib", version: "1.0.0" }),
    );
    const manifest = createArtifactManifest({ ...baseOptions, rootDir: testDir });
    expect(manifest).not.toHaveProperty("source");
    expect(manifest).not.toHaveProperty("generated");
  });

  it("includes source and generated when caller supplies them", () => {
    writeFileSync(
      resolve(testDir, "package.json"),
      JSON.stringify({ name: "test-lib", version: "1.0.0" }),
    );
    const manifest = createArtifactManifest({
      ...baseOptions,
      rootDir: testDir,
      source: { registryDir: "registry" },
      generated: { hooksFile: "generated/hooks.json" },
    });
    expect(manifest.source).toEqual({ registryDir: "registry" });
    expect(manifest.generated).toEqual({ hooksFile: "generated/hooks.json" });
  });

  it("produces a manifest that passes schema validation", () => {
    writeFileSync(
      resolve(testDir, "package.json"),
      JSON.stringify({ name: "test-lib", version: "1.0.0" }),
    );
    const manifest = createArtifactManifest({ ...baseOptions, rootDir: testDir });
    const result = ArtifactManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });
});

describe("validateManifest", () => {
  it("returns a non-empty errors array for invalid input", () => {
    const result = validateManifest({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
