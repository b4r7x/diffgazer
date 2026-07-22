import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectMissingWorkspaceArtifactFiles } from "./artifact-availability.js";
import { syncDocsFromArtifacts } from "./sync.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(resolve(tmpdir(), "docs-sync-test-"));
  tempDirs.push(dir);
  return dir;
}

function writeFile(root: string, relPath: string, content = "{}\n"): void {
  const absPath = resolve(root, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, content);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("sync artifacts helper workspace validation", () => {
  it("rejects duplicate direct-sync ids before loading artifacts or resetting outputs", () => {
    const tempRoot = makeTempDir();
    const sentinelPath = resolve(tempRoot, "docs/content/docs/ui/sentinel.mdx");
    writeFile(tempRoot, "docs/content/docs/ui/sentinel.mdx", "keep\n");

    expect(() =>
      syncDocsFromArtifacts({
        docsRoot: resolve(tempRoot, "docs"),
        workspaceRoot: resolve(tempRoot, "workspace"),
        libraries: [
          { id: "ui", workspaceDir: "libs/ui" },
          { id: "ui", workspaceDir: "libs/ui-copy" },
        ],
        primaryLibraryId: "ui",
        origin: "https://registry.example.test",
        sourceOrigin: "https://registry.example.test",
      }),
    ).toThrow('Duplicate library id "ui".');

    expect(readFileSync(sentinelPath, "utf8")).toBe("keep\n");
  });

  it("reports missing prepared workspace artifact files", () => {
    const tempRoot = makeTempDir();
    const libraries = [
      { id: "ui", workspaceDir: "libs/ui" },
      { id: "keys", workspaceDir: "libs/keys" },
    ];

    writeFile(
      tempRoot,
      "libs/ui/dist/artifacts/artifact-manifest.json",
      JSON.stringify({
        schemaVersion: 1,
        library: "ui",
        package: "@diffgazer/ui",
        version: "1.0.0",
        artifactRoot: "dist/artifacts",
        inputs: ["docs/content"],
        docs: { contentDir: "docs", metaFile: "docs/meta.json", generatedDir: "generated" },
        registry: {
          namespace: "@diffgazer/ui",
          basePath: "/r/ui",
          publicDir: "registry",
          index: "registry/registry.json",
        },
        generated: { componentList: "generated/component-list.json" },
        integrity: { algorithm: "sha256", fingerprintFile: "fingerprint.sha256" },
      }),
    );
    writeFile(tempRoot, "libs/ui/dist/artifacts/fingerprint.sha256", "abc\n");
    writeFile(tempRoot, "libs/ui/dist/artifacts/docs/meta.json");
    writeFile(tempRoot, "libs/ui/dist/artifacts/registry/registry.json");
    writeFile(
      tempRoot,
      "libs/keys/dist/artifacts/artifact-manifest.json",
      JSON.stringify({
        schemaVersion: 1,
        library: "keys",
        package: "@diffgazer/keys",
        version: "1.0.0",
        artifactRoot: "dist/artifacts",
        inputs: ["docs/content"],
        docs: { contentDir: "docs", metaFile: "docs/meta.json" },
        registry: {
          namespace: "@diffgazer/keys",
          basePath: "/r/keys",
          publicDir: "registry",
          index: "registry/registry.json",
        },
        integrity: { algorithm: "sha256", fingerprintFile: "fingerprint.sha256" },
      }),
    );
    writeFile(tempRoot, "libs/keys/dist/artifacts/docs/meta.json");
    writeFile(tempRoot, "libs/keys/dist/artifacts/registry/registry.json");

    expect(collectMissingWorkspaceArtifactFiles(tempRoot, libraries)).toEqual([
      {
        id: "ui",
        path: resolve(tempRoot, "libs/ui/dist/artifacts/generated"),
        relativePath: "libs/ui/dist/artifacts/generated",
      },
      {
        id: "ui",
        path: resolve(tempRoot, "libs/ui/dist/artifacts/generated/component-list.json"),
        relativePath: "libs/ui/dist/artifacts/generated/component-list.json",
      },
      {
        id: "keys",
        path: resolve(tempRoot, "libs/keys/dist/artifacts/fingerprint.sha256"),
        relativePath: "libs/keys/dist/artifacts/fingerprint.sha256",
      },
    ]);
  });

  it("reports invalid prepared workspace artifact manifests as missing", () => {
    const tempRoot = makeTempDir();
    const libraries = [{ id: "ui", workspaceDir: "libs/ui" }];

    writeFile(
      tempRoot,
      "libs/ui/dist/artifacts/artifact-manifest.json",
      JSON.stringify({
        schemaVersion: 1,
        library: "ui",
        package: "@diffgazer/ui",
        version: "1.0.0",
        artifactRoot: "dist/artifacts",
        inputs: ["docs/content"],
        docs: { contentDir: "../outside", metaFile: "docs/meta.json" },
        registry: {
          namespace: "@diffgazer/ui",
          basePath: "/r/ui",
          publicDir: "registry",
          index: "registry/registry.json",
        },
        integrity: { algorithm: "sha256", fingerprintFile: "fingerprint.sha256" },
      }),
    );
    writeFile(tempRoot, "libs/ui/dist/artifacts/fingerprint.sha256", "abc\n");

    expect(collectMissingWorkspaceArtifactFiles(tempRoot, libraries)).toEqual([
      {
        id: "ui",
        path: resolve(tempRoot, "libs/ui/dist/artifacts/artifact-manifest.json"),
        relativePath: expect.stringContaining(
          "libs/ui/dist/artifacts/artifact-manifest.json (invalid: docs.contentDir: Path must be relative",
        ),
      },
    ]);
  });
});
