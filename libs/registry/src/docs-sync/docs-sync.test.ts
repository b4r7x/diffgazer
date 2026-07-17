import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeArtifactFingerprint } from "../fingerprint.js";
import type { ArtifactManifest } from "../manifest.js";
import { requireValue } from "../testing/assertions.js";
import { writeJson as writeJsonFile } from "../utils/json.js";
import { resolveSyncOutputPaths } from "./paths.js";
import { syncDocsFromArtifacts } from "./sync.js";
import { runDocsSyncPass } from "./sync-operations.js";
import type { LoadedLibraryArtifacts, SyncLibraryConfig } from "./types.js";

const TEST_ORIGIN = "https://diffgazer.com";
const SENTINEL_CONTENT = "preserve me\n";

function writeText(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeJsonFile(filePath, value);
}

function readOutputFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory() ? readOutputFiles(path) : [readFileSync(path, "utf-8")];
  });
}

function seedSyncSentinels(docsRoot: string, libraryId: string): string[] {
  const paths = resolveSyncOutputPaths(docsRoot);
  const sentinels = [
    join(paths.contentDir, libraryId, "sentinel.txt"),
    join(paths.generatedDir, "sentinel.txt"),
    join(paths.registryDir, "sentinel.txt"),
    join(paths.publicRegistryDir, "sentinel.txt"),
    join(paths.libraryAssetsDir, libraryId, "sentinel.txt"),
  ];
  for (const sentinel of sentinels) writeText(sentinel, SENTINEL_CONTENT);
  return sentinels;
}

function expectSyncSentinels(sentinels: string[]): void {
  for (const sentinel of sentinels) {
    expect(readFileSync(sentinel, "utf-8")).toBe(SENTINEL_CONTENT);
  }
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

function createLibraryFixture(options: CreateLibraryFixtureOptions): TestLibraryFixture {
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
    origin: TEST_ORIGIN,
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
  writeText(
    join(artifactRoot, "source/registry/examples/demo/demo-basic.tsx"),
    "export default function Demo() { return null }\n",
  );
  writeText(join(artifactRoot, "source/styles/styles.css"), "/* artifact-only-style-marker */\n");

  for (const relPath of Object.values(generated)) {
    writeJson(join(artifactRoot, relPath), { from: relPath });
  }

  const currentFingerprint = computeArtifactFingerprint(libraryRoot, manifest.inputs, TEST_ORIGIN);
  writeText(
    join(artifactRoot, manifest.integrity.fingerprintFile),
    staleFingerprint ? `${currentFingerprint}-stale` : currentFingerprint,
  );

  return {
    config: {
      id,
      workspaceDir,
    },
    libraryRoot,
    manifest,
    generatedOutputBasenames: Object.values(generated).map(
      (relPath) => relPath.split("/").at(-1) ?? relPath,
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

  it.each([
    ["missing", undefined],
    ["historical source", "https://r.b4r7.dev"],
    ["third-party", "https://third.example.com"],
  ])("rejects %s origin provenance before cache skip or output mutation", (_label, origin) => {
    const fixture = createLibraryFixture({ workspaceRoot });
    const manifestPath = join(
      fixture.libraryRoot,
      fixture.manifest.artifactRoot,
      "artifact-manifest.json",
    );
    writeJson(manifestPath, { ...fixture.manifest, origin });
    const sentinels = seedSyncSentinels(docsRoot, fixture.config.id);

    expect(() => runSync(fixture.config)).toThrow(
      /artifact (manifest is missing origin|origin .* does not match)/i,
    );
    expectSyncSentinels(sentinels);
  });

  it("throws when workspace artifact fingerprint is stale", () => {
    const fixture = createLibraryFixture({
      workspaceRoot,
      staleFingerprint: true,
    });

    expect(() => runSync(fixture.config)).toThrowError(/artifacts are stale/i);
  });

  it("rejects a workspace manifest whose library differs from its configured id", () => {
    const fixture = createLibraryFixture({ workspaceRoot });
    const manifestPath = join(
      fixture.libraryRoot,
      fixture.manifest.artifactRoot,
      "artifact-manifest.json",
    );
    writeJson(manifestPath, { ...fixture.manifest, library: "other" });
    const sentinels = seedSyncSentinels(docsRoot, fixture.config.id);

    expect(() => runSync(fixture.config)).toThrow(/configured library id "demo".*"other"/i);
    expectSyncSentinels(sentinels);
  });

  it("rejects unsafe library ids before writing namespace outputs", () => {
    const fixture = createLibraryFixture({ workspaceRoot });

    expect(() =>
      syncDocsFromArtifacts({
        docsRoot,
        workspaceRoot,
        libraries: [{ ...fixture.config, id: "../demo" }],
        primaryLibraryId: "../demo",
        origin: TEST_ORIGIN,
        sourceOrigin: TEST_ORIGIN,
      }),
    ).toThrow(/safe library id/);
  });

  it("rejects output path overrides outside the docs root", () => {
    const fixture = createLibraryFixture({ workspaceRoot });

    expect(() =>
      syncDocsFromArtifacts({
        docsRoot,
        workspaceRoot,
        libraries: [fixture.config],
        primaryLibraryId: fixture.config.id,
        origin: TEST_ORIGIN,
        sourceOrigin: TEST_ORIGIN,
        outputPaths: { contentDir: "../outside" },
      }),
    ).toThrow(/docs content output path must be a relative path/);

    expect(() =>
      syncDocsFromArtifacts({
        docsRoot,
        workspaceRoot,
        libraries: [fixture.config],
        primaryLibraryId: fixture.config.id,
        origin: TEST_ORIGIN,
        sourceOrigin: TEST_ORIGIN,
        outputPaths: { generatedDir: "/tmp/outside" },
      }),
    ).toThrow(/docs generated output path must be a relative path/);
  });

  it("rejects workspace directories outside the workspace root", () => {
    const fixture = createLibraryFixture({ workspaceRoot });

    expect(() =>
      syncDocsFromArtifacts({
        docsRoot,
        workspaceRoot,
        libraries: [{ ...fixture.config, workspaceDir: "../outside" }],
        primaryLibraryId: fixture.config.id,
        origin: TEST_ORIGIN,
        sourceOrigin: TEST_ORIGIN,
      }),
    ).toThrow(/workspace directory must be a relative path/);
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
    expect(existsSync(join(docsRoot, "content/docs", fixture.config.id, "meta.json"))).toBe(true);

    for (const basename of fixture.generatedOutputBasenames) {
      const outputPath = join(docsRoot, "src/generated", fixture.config.id, basename);
      expect(existsSync(outputPath)).toBe(true);
      expect(readFileSync(outputPath, "utf-8")).toContain('"from":');
    }

    expect(existsSync(join(docsRoot, "src/generated", fixture.config.id, "logical-name"))).toBe(
      false,
    );
  });

  it("does not turn source.stylesDir handoff data into a docs output", () => {
    const fixture = createLibraryFixture({ workspaceRoot });

    expect(runSync(fixture.config).synced).toBe(true);
    expect(readOutputFiles(docsRoot).join("\n")).not.toContain("artifact-only-style-marker");
  });

  it("rewrites secondary demo indexes to the copied example namespace", () => {
    const primary = createLibraryFixture({
      workspaceRoot,
      id: "ui",
      workspaceDir: "ui-lib",
    });
    const secondary = createLibraryFixture({
      workspaceRoot,
      id: "keys",
      workspaceDir: "keys-lib",
      generated: {
        demoIndex: "generated/demo-index.ts",
      },
    });

    writeText(
      join(secondary.libraryRoot, secondary.manifest.artifactRoot, "generated/demo-index.ts"),
      [
        `import { lazy } from "react"`,
        `export const demos = {`,
        `  "use-key-basic": lazy(() => import("../../registry/examples/use-key/use-key-basic")),`,
        `}`,
        "",
      ].join("\n"),
    );
    writeText(
      join(
        secondary.libraryRoot,
        secondary.manifest.artifactRoot,
        "source/registry/examples/use-key/use-key-basic.tsx",
      ),
      "export default function Demo() { return null }\n",
    );

    const result = syncDocsFromArtifacts({
      docsRoot,
      workspaceRoot,
      libraries: [primary.config, secondary.config],
      primaryLibraryId: primary.config.id,
      origin: TEST_ORIGIN,
      sourceOrigin: TEST_ORIGIN,
    });

    expect(result.synced).toBe(true);
    expect(existsSync(join(docsRoot, "registry/examples/keys/use-key/use-key-basic.tsx"))).toBe(
      true,
    );
    expect(readFileSync(join(docsRoot, "src/generated/keys/demo-index.ts"), "utf-8")).toContain(
      'import("../../../registry/examples/keys/use-key/use-key-basic")',
    );
  });

  it("resyncs when secondary copied examples are missing", () => {
    const primary = createLibraryFixture({
      workspaceRoot,
      id: "ui",
      workspaceDir: "ui-lib",
    });
    const secondary = createLibraryFixture({
      workspaceRoot,
      id: "keys",
      workspaceDir: "keys-lib",
      generated: {
        demoIndex: "generated/demo-index.ts",
      },
    });
    const examplePath = join(
      secondary.libraryRoot,
      secondary.manifest.artifactRoot,
      "source/registry/examples/use-key/use-key-basic.tsx",
    );
    writeText(examplePath, "export default function Demo() { return null }\n");

    const first = syncDocsFromArtifacts({
      docsRoot,
      workspaceRoot,
      libraries: [primary.config, secondary.config],
      primaryLibraryId: primary.config.id,
      origin: TEST_ORIGIN,
      sourceOrigin: TEST_ORIGIN,
    });
    expect(first.synced).toBe(true);

    const second = syncDocsFromArtifacts({
      docsRoot,
      workspaceRoot,
      libraries: [primary.config, secondary.config],
      primaryLibraryId: primary.config.id,
      origin: TEST_ORIGIN,
      sourceOrigin: TEST_ORIGIN,
    });
    expect(second.synced).toBe(false);

    const copiedExample = join(docsRoot, "registry/examples/keys/use-key/use-key-basic.tsx");
    unlinkSync(copiedExample);

    const third = syncDocsFromArtifacts({
      docsRoot,
      workspaceRoot,
      libraries: [primary.config, secondary.config],
      primaryLibraryId: primary.config.id,
      origin: TEST_ORIGIN,
      sourceOrigin: TEST_ORIGIN,
    });
    expect(third.synced).toBe(true);
    expect(existsSync(copiedExample)).toBe(true);
  });

  it("skips sync when fingerprint and outputs are unchanged, then resyncs if outputs are missing", () => {
    const fixture = createLibraryFixture({ workspaceRoot });

    const first = runSync(fixture.config);
    expect(first.synced).toBe(true);

    const second = runSync(fixture.config);
    expect(second.synced).toBe(false);

    const generatedOutputBasename = requireValue(
      fixture.generatedOutputBasenames[0],
      "fixture generated output basename",
    );
    const missingOutput = join(
      docsRoot,
      "src/generated",
      fixture.config.id,
      generatedOutputBasename,
    );
    unlinkSync(missingOutput);

    const third = runSync(fixture.config);
    expect(third.synced).toBe(true);
    expect(existsSync(missingOutput)).toBe(true);
  });

  it("removes copied assets when the manifest drops them and does not cache stale assets", () => {
    const fixture = createLibraryFixture({ workspaceRoot });
    const artifactRoot = join(fixture.libraryRoot, fixture.manifest.artifactRoot);
    const manifestPath = join(artifactRoot, "artifact-manifest.json");
    const manifestWithAssets: ArtifactManifest = {
      ...fixture.manifest,
      docs: { ...fixture.manifest.docs, assetsDir: "docs/assets" },
    };
    writeJson(manifestPath, manifestWithAssets);
    writeText(join(artifactRoot, "docs/assets/logo.svg"), "<svg />\n");

    expect(runSync(fixture.config).synced).toBe(true);
    const copiedAsset = join(docsRoot, "public/library-assets", fixture.config.id, "logo.svg");
    expect(existsSync(copiedAsset)).toBe(true);

    writeJson(manifestPath, fixture.manifest);
    expect(runSync(fixture.config).synced).toBe(true);
    expect(existsSync(copiedAsset)).toBe(false);

    writeText(copiedAsset, "stale\n");
    expect(runSync(fixture.config).synced).toBe(true);
    expect(existsSync(copiedAsset)).toBe(false);
  });

  it("rejects mismatched loaded artifacts before a direct sync pass writes outputs", () => {
    const fixture = createLibraryFixture({ workspaceRoot });
    const artifactRoot = join(fixture.libraryRoot, fixture.manifest.artifactRoot);
    const artifact: LoadedLibraryArtifacts = {
      id: fixture.config.id,
      manifest: { ...fixture.manifest, library: "other" },
      manifestPath: join(artifactRoot, "artifact-manifest.json"),
      artifactRoot,
      fingerprintPath: join(artifactRoot, fixture.manifest.integrity.fingerprintFile),
      fingerprint: "fixture",
      generatedFiles: Object.values(fixture.manifest.generated ?? {}),
    };
    const sentinels = seedSyncSentinels(docsRoot, fixture.config.id);

    expect(() =>
      runDocsSyncPass({
        artifacts: [artifact],
        primaryArtifact: artifact,
        paths: resolveSyncOutputPaths(docsRoot),
        origin: TEST_ORIGIN,
        sourceOrigin: TEST_ORIGIN,
      }),
    ).toThrow(/configured library id "demo".*"other"/i);
    expectSyncSentinels(sentinels);
  });
});
