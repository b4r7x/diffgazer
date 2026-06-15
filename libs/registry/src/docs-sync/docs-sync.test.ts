import {
  cpSync,
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
import { computeArtifactFingerprint } from "../fingerprint.js";
import type { ArtifactManifest } from "../manifest.js";
import { requireValue } from "../testing/assertions.js";
import { writeJson as writeJsonFile } from "../utils/json.js";
import { syncDocsFromArtifacts } from "./sync.js";
import type { SyncLibraryConfig } from "./types.js";

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
      packageName: `@test/${id}`,
      workspaceDir,
    },
    libraryRoot,
    manifest,
    generatedOutputBasenames: Object.values(generated).map(
      (relPath) => relPath.split("/").at(-1) ?? relPath,
    ),
  };
}

function installFixturePackage(docsRoot: string, fixture: TestLibraryFixture): void {
  const packageRoot = join(docsRoot, "node_modules", "@test", fixture.config.id);
  mkdirSync(packageRoot, { recursive: true });
  writeJson(join(packageRoot, "package.json"), {
    name: fixture.config.packageName,
    version: fixture.manifest.version,
    type: "module",
  });
  const packageManifest = { ...fixture.manifest, artifactRoot: "artifacts" };
  cpSync(join(fixture.libraryRoot, fixture.manifest.artifactRoot), join(packageRoot, "artifacts"), {
    recursive: true,
  });
  writeJson(join(packageRoot, "artifacts/artifact-manifest.json"), packageManifest);
}

function installManifestOnlyPackage(
  docsRoot: string,
  config: SyncLibraryConfig,
  manifest: ArtifactManifest,
): void {
  const packageRoot = join(docsRoot, "node_modules", "@test", config.id);
  mkdirSync(join(packageRoot, "artifacts"), { recursive: true });
  writeJson(join(packageRoot, "package.json"), {
    name: config.packageName,
    version: manifest.version,
    type: "module",
  });
  writeJson(join(packageRoot, "artifacts/artifact-manifest.json"), {
    ...manifest,
    artifactRoot: manifest.artifactRoot === "dist/artifacts" ? "artifacts" : manifest.artifactRoot,
  });
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

  function runSync(config: SyncLibraryConfig, mode: "workspace" | "package" = "workspace") {
    return syncDocsFromArtifacts({
      docsRoot,
      workspaceRoot,
      libraries: [config],
      primaryLibraryId: config.id,
      origin: TEST_ORIGIN,
      sourceOrigin: TEST_ORIGIN,
      mode,
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
        mode: "workspace",
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
        mode: "workspace",
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
        mode: "workspace",
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
        mode: "workspace",
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
    expect(existsSync(join(docsRoot, "content/docs/meta.json"))).toBe(true);
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

  it("appends configured extra root pages after the artifact namespaces", () => {
    const primary = createLibraryFixture({
      workspaceRoot,
      id: "ui",
      workspaceDir: "ui-lib",
    });
    const secondary = createLibraryFixture({
      workspaceRoot,
      id: "keys",
      workspaceDir: "keys-lib",
    });

    const result = syncDocsFromArtifacts({
      docsRoot,
      workspaceRoot,
      libraries: [primary.config, secondary.config],
      primaryLibraryId: primary.config.id,
      origin: TEST_ORIGIN,
      sourceOrigin: TEST_ORIGIN,
      mode: "workspace",
      extraRootPages: ["...app"],
    });

    expect(result.synced).toBe(true);
    const rootMeta = JSON.parse(readFileSync(join(docsRoot, "content/docs/meta.json"), "utf-8"));
    expect(rootMeta.pages).toEqual(["...ui", "...keys", "...app"]);
  });

  it("re-syncs and rewrites root pages when extra root pages change on a warm cache", () => {
    const primary = createLibraryFixture({
      workspaceRoot,
      id: "ui",
      workspaceDir: "ui-lib",
    });
    const secondary = createLibraryFixture({
      workspaceRoot,
      id: "keys",
      workspaceDir: "keys-lib",
    });

    function syncWithExtraRootPages(extraRootPages: string[]) {
      return syncDocsFromArtifacts({
        docsRoot,
        workspaceRoot,
        libraries: [primary.config, secondary.config],
        primaryLibraryId: primary.config.id,
        origin: TEST_ORIGIN,
        sourceOrigin: TEST_ORIGIN,
        mode: "workspace",
        extraRootPages,
      });
    }

    function readRootPages(): unknown {
      return JSON.parse(readFileSync(join(docsRoot, "content/docs/meta.json"), "utf-8")).pages;
    }

    const first = syncWithExtraRootPages(["...app"]);
    expect(first.synced).toBe(true);
    expect(readRootPages()).toEqual(["...ui", "...keys", "...app"]);

    // Same root → the state file from the first run persists, so this second
    // run hits the warm-cache skip path. With identical artifacts but changed
    // extraRootPages, the fingerprint must differ so the sync is NOT skipped
    // and the stale root pages are rewritten.
    const second = syncWithExtraRootPages(["...app", "...guides"]);
    expect(second.synced).toBe(true);
    expect(readRootPages()).toEqual(["...ui", "...keys", "...app", "...guides"]);
  });

  it("writes only artifact namespaces when no extra root pages are configured", () => {
    const fixture = createLibraryFixture({ workspaceRoot });

    const result = runSync(fixture.config);

    expect(result.synced).toBe(true);
    const rootMeta = JSON.parse(readFileSync(join(docsRoot, "content/docs/meta.json"), "utf-8"));
    expect(rootMeta.pages).toEqual([`...${fixture.config.id}`]);
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
      mode: "workspace",
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
      mode: "workspace",
    });
    expect(first.synced).toBe(true);

    const second = syncDocsFromArtifacts({
      docsRoot,
      workspaceRoot,
      libraries: [primary.config, secondary.config],
      primaryLibraryId: primary.config.id,
      origin: TEST_ORIGIN,
      sourceOrigin: TEST_ORIGIN,
      mode: "workspace",
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
      mode: "workspace",
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

  it("syncs package-mode artifacts from an installed node_modules package", () => {
    writeJson(join(docsRoot, "package.json"), { type: "module" });
    const fixture = createLibraryFixture({ workspaceRoot });
    installFixturePackage(docsRoot, fixture);
    rmSync(fixture.libraryRoot, { recursive: true, force: true });

    const result = runSync(fixture.config, "package");

    expect(result.synced).toBe(true);
    expect(result.artifacts[0]?.manifestPath).toContain(
      join("node_modules", "@test", "demo", "artifacts", "artifact-manifest.json"),
    );
    expect(existsSync(join(docsRoot, "node_modules", "@test", "demo", "dist", "artifacts"))).toBe(
      false,
    );
    expect(existsSync(join(docsRoot, "content/docs/demo/meta.json"))).toBe(true);
    expect(existsSync(join(docsRoot, "public/r/demo/registry.json"))).toBe(true);
    expect(
      readFileSync(join(docsRoot, "src/generated/demo/actual-generated.json"), "utf-8"),
    ).toContain("generated/nested/actual-generated.json");
  });

  it("rejects unsafe package names in package mode", () => {
    const fixture = createLibraryFixture({ workspaceRoot });

    expect(() =>
      syncDocsFromArtifacts({
        docsRoot,
        workspaceRoot,
        libraries: [{ ...fixture.config, packageName: "../outside" }],
        primaryLibraryId: fixture.config.id,
        origin: TEST_ORIGIN,
        sourceOrigin: TEST_ORIGIN,
        mode: "package",
      }),
    ).toThrow(/Artifact package name must be an npm package name/);
  });

  it("rejects package-mode manifests with escaped artifact paths", () => {
    const config = {
      id: "demo",
      packageName: "@test/demo",
      workspaceDir: "demo-lib",
    };
    const baseManifest: ArtifactManifest = {
      schemaVersion: 1,
      library: "demo",
      package: "@test/demo",
      version: "1.0.0",
      artifactRoot: "dist/artifacts",
      inputs: ["src/input.txt"],
      docs: {
        contentDir: "docs/content",
        metaFile: "docs/content/meta.json",
        generatedDir: "docs/generated",
      },
      registry: {
        namespace: "@demo",
        basePath: "/r/demo",
        publicDir: "public/r",
        index: "public/r/registry.json",
      },
      source: {
        registryDir: "source/registry",
        stylesDir: "source/styles",
      },
      generated: {
        demoIndex: "generated/demo-index.ts",
      },
      integrity: {
        algorithm: "sha256",
        fingerprintFile: "fingerprint.sha256",
      },
    };
    const invalidManifests: ArtifactManifest[] = [
      { ...baseManifest, artifactRoot: "../outside" },
      {
        ...baseManifest,
        integrity: { ...baseManifest.integrity, fingerprintFile: "../fingerprint.sha256" },
      },
      {
        ...baseManifest,
        docs: { ...baseManifest.docs, contentDir: "../docs" },
      },
      {
        ...baseManifest,
        docs: { ...baseManifest.docs, generatedDir: "../generated" },
      },
      {
        ...baseManifest,
        registry: { ...baseManifest.registry, publicDir: "../registry" },
      },
      {
        ...baseManifest,
        source: { ...baseManifest.source, registryDir: "../source" },
      },
      {
        ...baseManifest,
        generated: { demoIndex: "../demo-index.ts" },
      },
    ];

    for (const manifest of invalidManifests) {
      rmSync(join(docsRoot, "node_modules"), { recursive: true, force: true });
      installManifestOnlyPackage(docsRoot, config, manifest);

      expect(() => runSync(config, "package")).toThrow(/manifest validation failed/);
    }
  });
});
