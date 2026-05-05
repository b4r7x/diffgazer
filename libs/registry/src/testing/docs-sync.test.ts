import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { syncDocsFromArtifacts } from "../docs/index.js";
import type { SyncLibraryConfig } from "../docs/types.js";
import { computeInputsFingerprint } from "../fingerprint.js";
import { writeJson as writeJsonFile } from "../utils/json.js";
import type { ArtifactManifest } from "../manifest.js";

const TEST_ORIGIN = "https://diffgazer.com";

function writeText(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeJsonFile(filePath, value);
}

interface TestLibraryFixture {
  config: SyncLibraryConfig;
  libraryRoot: string;
  manifest: ArtifactManifest;
  generatedOutputBasenames: string[];
}

interface CreateLibraryFixtureOptions {
  workspaceRoot: string;
  id?: string;
  workspaceDir?: string;
  generated?: Record<string, string>;
  staleFingerprint?: boolean;
}

function createLibraryFixture(
  options: CreateLibraryFixtureOptions,
): TestLibraryFixture {
  const {
    workspaceRoot,
    id = "demo",
    workspaceDir = "demo-lib",
    generated = {
      "ignored-key-name": "generated/nested/actual-generated.json",
    },
    staleFingerprint = false,
  } = options;

  const libraryRoot = join(workspaceRoot, workspaceDir);
  const artifactRootRel = "dist/artifacts";
  const artifactRoot = join(libraryRoot, artifactRootRel);

  writeText(join(libraryRoot, "src/input.txt"), "docs-sync input");

  const manifest: ArtifactManifest = {
    schemaVersion: 1,
    library: id,
    package: `@test/${id}`,
    version: "1.0.0",
    artifactRoot: artifactRootRel,
    inputs: ["src/input.txt"],
    docs: {
      contentDir: "docs/content",
      metaFile: "docs/content/meta.json",
      generatedDir: "docs/generated",
    },
    registry: {
      namespace: `@${id}`,
      basePath: `/r/${id}`,
      publicDir: "public/r",
      index: "public/r/registry.json",
    },
    source: {
      registryDir: "source/registry",
      stylesDir: "source/styles",
    },
    generated,
    integrity: {
      algorithm: "sha256",
      fingerprintFile: "fingerprint.sha256",
    },
  };

  writeJson(join(artifactRoot, "artifact-manifest.json"), manifest);
  writeJson(join(artifactRoot, "docs/content/meta.json"), { title: "Demo" });
  writeText(join(artifactRoot, "docs/content/page.mdx"), "# Demo\n");
  writeJson(join(artifactRoot, "docs/generated/bootstrap.json"), {
    bootstrapped: true,
  });
  writeJson(join(artifactRoot, "public/r/registry.json"), {
    $schema: "test",
    items: [],
  });
  writeJson(join(artifactRoot, "source/registry/registry.json"), {
    $schema: "test",
    items: [],
  });
  writeText(join(artifactRoot, "source/styles/styles.css"), "/* styles */\n");

  for (const relPath of Object.values(generated)) {
    writeJson(join(artifactRoot, relPath), { from: relPath });
  }

  const currentFingerprint = computeInputsFingerprint(libraryRoot, manifest.inputs);
  writeText(
    join(artifactRoot, manifest.integrity.fingerprintFile),
    staleFingerprint ? `${currentFingerprint}-stale` : currentFingerprint,
  );

  return {
    config: {
      id,
      packageName: `@test/${id}`,
      workspaceDir,
    },
    libraryRoot,
    manifest,
    generatedOutputBasenames: Object.values(generated).map((relPath) =>
      relPath.split("/").at(-1) ?? relPath,
    ),
  };
}

describe("syncDocsFromArtifacts", () => {
  let tempRoot: string;
  let docsRoot: string;
  let workspaceRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "rk-docs-sync-"));
    docsRoot = join(tempRoot, "docs");
    workspaceRoot = join(tempRoot, "workspace");
    mkdirSync(docsRoot, { recursive: true });
    mkdirSync(workspaceRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  function runSync(config: SyncLibraryConfig) {
    return syncDocsFromArtifacts({
      docsRoot,
      workspaceRoot,
      libraries: [config],
      primaryLibraryId: config.id,
      origin: TEST_ORIGIN,
      sourceOrigin: TEST_ORIGIN,
      mode: "workspace",
    });
  }

  it("throws when manifest.generated has duplicate output basenames", () => {
    const fixture = createLibraryFixture({
      workspaceRoot,
      generated: {
        "key-a": "generated/path-a/data.json",
        "key-b": "generated/path-b/data.json", // same basename as key-a
      },
    });

    expect(() => runSync(fixture.config)).toThrow(/duplicate output name/i);
  });

  it("throws when workspace artifact fingerprint is stale", () => {
    const fixture = createLibraryFixture({
      workspaceRoot,
      staleFingerprint: true,
    });

    expect(() => runSync(fixture.config)).toThrowError(/artifacts are stale/i);
  });

  it("copies generated files using manifest values and basename extraction", () => {
    const fixture = createLibraryFixture({
      workspaceRoot,
      generated: {
        "logical-name": "generated/deep/path/components.generated.json",
        "another-name": "generated/sidebar/sidebar.generated.json",
      },
    });

    const result = runSync(fixture.config);

    expect(result.synced).toBe(true);
    expect(existsSync(join(docsRoot, "content/docs/meta.json"))).toBe(true);
    expect(existsSync(join(docsRoot, "content/docs", fixture.config.id, "meta.json"))).toBe(
      true,
    );

    for (const basename of fixture.generatedOutputBasenames) {
      const outputPath = join(docsRoot, "src/generated", fixture.config.id, basename);
      expect(existsSync(outputPath)).toBe(true);
      expect(readFileSync(outputPath, "utf-8")).toContain("\"from\":");
    }

    expect(
      existsSync(join(docsRoot, "src/generated", fixture.config.id, "logical-name")),
    ).toBe(false);
  });

  it("skips sync when fingerprint and outputs are unchanged, then resyncs if outputs are missing", () => {
    const fixture = createLibraryFixture({ workspaceRoot });

    const first = runSync(fixture.config);
    expect(first.synced).toBe(true);

    const second = runSync(fixture.config);
    expect(second.synced).toBe(false);

    const missingOutput = join(
      docsRoot,
      "src/generated",
      fixture.config.id,
      fixture.generatedOutputBasenames[0]!,
    );
    unlinkSync(missingOutput);

    const third = runSync(fixture.config);
    expect(third.synced).toBe(true);
    expect(existsSync(missingOutput)).toBe(true);
  });
});
