import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { computeRequiredArtifactFingerprint, REGISTRY_ORIGIN } from "@diffgazer/registry";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectSecretFindings,
  formatSecretFindings,
  MAX_FILE_BYTES,
} from "../../../scripts/monorepo/secret-scan.mjs";
import { syncArtifacts } from "./sync-artifacts.mjs";

const BUTTON_SOURCE_ARCHIVE =
  '{"source":{"@ui/button/button.tsx":{"raw":"export function Button() {}","highlighted":[]}},"mergedSource":"{\\n  \\"name\\": \\"button-copy-archive\\"\\n}"}\n';
const UPDATED_BUTTON_SOURCE_ARCHIVE = BUTTON_SOURCE_ARCHIVE.replace(
  "export function Button() {}",
  "export function UpdatedButton() {}",
);
const tempRoots = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

function makeTempRoot() {
  const root = mkdtempSync(join(tmpdir(), "dg-docs-sync-"));
  tempRoots.push(root);
  return root;
}

function writeText(root, relPath, content) {
  const path = join(root, relPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function writeJson(root, relPath, value) {
  writeText(root, relPath, `${JSON.stringify(value, null, 2)}\n`);
}

function collectSourceArchives(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceArchives(path);
    return entry.name.endsWith(".source.json") ? [path] : [];
  });
}

function createManifest(artifactRoot) {
  return {
    schemaVersion: 1,
    origin: REGISTRY_ORIGIN,
    library: "ui",
    package: "@fixture/ui",
    version: "1.0.0",
    artifactRoot,
    inputs: ["src/input.txt"],
    docs: {
      contentDir: "docs/content",
      metaFile: "docs/content/meta.json",
      generatedDir: "docs/generated",
    },
    registry: {
      namespace: "@fixture/ui",
      basePath: "/r/ui",
      publicDir: "public/r",
      index: "public/r/registry.json",
    },
    source: {
      registryDir: "source/registry",
    },
    generated: {
      componentList: "docs/generated/component-list.json",
      hooks: "docs/generated/ui-hooks.json",
      libs: "docs/generated/ui-libs.json",
    },
    integrity: {
      algorithm: "sha256",
      fingerprintFile: "fingerprint.sha256",
    },
  };
}

function writeArtifactContents(artifactRoot, manifest, fingerprint) {
  writeJson(artifactRoot, "artifact-manifest.json", manifest);
  writeText(artifactRoot, "fingerprint.sha256", `${fingerprint}\n`);
  writeJson(artifactRoot, "docs/content/meta.json", { title: "UI" });
  writeText(artifactRoot, "docs/content/getting-started.mdx", "# Getting started\n");
  writeJson(artifactRoot, "docs/generated/component-list.json", [{ name: "button" }]);
  writeJson(artifactRoot, "docs/generated/components/button.json", {
    name: "button",
    files: ["@ui/button/button.tsx"],
  });
  writeText(artifactRoot, "docs/generated/components/button.source.json", BUTTON_SOURCE_ARCHIVE);
  writeJson(artifactRoot, "docs/generated/ui-hooks.json", { hooks: ["use-demo"] });
  writeJson(artifactRoot, "docs/generated/ui-libs.json", { libs: ["utils"] });
  writeJson(artifactRoot, "public/r/registry.json", { items: [{ name: "button" }] });
  writeText(
    artifactRoot,
    "source/registry/examples/button/basic.tsx",
    "export default function Basic() { return null }\n",
  );
}

function installWorkspaceArtifact(workspaceRoot) {
  const libraryRoot = join(workspaceRoot, "libs/ui");
  const artifactRoot = join(libraryRoot, "dist/artifacts");
  const manifest = createManifest("dist/artifacts");
  writeText(libraryRoot, "src/input.txt", "fixture input\n");
  const fingerprint = computeRequiredArtifactFingerprint(
    libraryRoot,
    manifest.inputs,
    REGISTRY_ORIGIN,
    "fixture artifacts",
  );
  writeArtifactContents(artifactRoot, manifest, fingerprint);
  return artifactRoot;
}

function configureDocs(docsRoot) {
  const configPath = join(docsRoot, "config/docs-libraries.json");
  writeJson(docsRoot, "package.json", { type: "module" });
  writeJson(docsRoot, "config/docs-libraries.json", {
    primaryLibraryId: "ui",
    libraries: [
      { id: "app", enabled: true },
      {
        id: "ui",
        enabled: true,
        artifactSource: { workspaceDir: "libs/ui" },
      },
    ],
  });
  return configPath;
}

describe("syncArtifacts", () => {
  it("rejects workspace provenance for another origin before mutating docs outputs", () => {
    const root = makeTempRoot();
    const docsRoot = join(root, "docs");
    const workspaceRoot = join(root, "workspace");
    const configPath = configureDocs(docsRoot);
    const artifactRoot = installWorkspaceArtifact(workspaceRoot);
    const manifestPath = join(artifactRoot, "artifact-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    writeJson(artifactRoot, "artifact-manifest.json", {
      ...manifest,
      origin: "https://third.example.com",
    });
    writeText(docsRoot, "content/docs/ui/sentinel.mdx", "preserve me\n");

    expect(() =>
      syncArtifacts({
        docsRoot,
        workspaceRoot,
        configPath,
      }),
    ).toThrow(/artifact origin .* does not match requested origin/i);
    expect(readFileSync(join(docsRoot, "content/docs/ui/sentinel.mdx"), "utf8")).toBe(
      "preserve me\n",
    );
  });

  it("extracts workspace source archives byte-for-byte and preserves valid sidecar cache", () => {
    const root = makeTempRoot();
    const docsRoot = join(root, "docs");
    const workspaceRoot = join(root, "workspace");
    const configPath = configureDocs(docsRoot);
    const artifactRoot = installWorkspaceArtifact(workspaceRoot);
    const publicSource = join(docsRoot, "public/source-data/ui/components/button.source.json");

    writeText(docsRoot, "content/docs/ui/stale.mdx", "# stale\n");
    writeJson(docsRoot, "public/r/ui/stale.json", { stale: true });
    writeText(docsRoot, "public/source-data/ui/components/stale.source.json", '{"stale":true}\n');
    writeText(docsRoot, "public/source-data/ui/components/stale.source.json.gz", "stale gzip");

    syncArtifacts({
      docsRoot,
      workspaceRoot,
      configPath,
    });

    expect(readFileSync(publicSource, "utf8")).toBe(BUTTON_SOURCE_ARCHIVE);
    expect(collectSourceArchives(join(docsRoot, "src/generated"))).toEqual([]);
    expect(existsSync(join(docsRoot, "public/source-data/ui/components/stale.source.json"))).toBe(
      false,
    );
    expect(
      existsSync(join(docsRoot, "public/source-data/ui/components/stale.source.json.gz")),
    ).toBe(false);
    expect(readFileSync(join(docsRoot, "content/docs/ui/getting-started.mdx"), "utf8")).toBe(
      "# Getting started\n",
    );
    expect(existsSync(join(docsRoot, "content/docs/ui/stale.mdx"))).toBe(false);
    expect(existsSync(join(docsRoot, "public/r/ui/stale.json"))).toBe(false);
    expect(JSON.parse(readFileSync(join(docsRoot, "public/r/ui/registry.json"), "utf8"))).toEqual({
      items: [{ name: "button" }],
    });
    expect(
      JSON.parse(readFileSync(join(docsRoot, "src/generated/ui/component-list.json"), "utf8")),
    ).toEqual([{ name: "button" }]);
    expect(
      JSON.parse(readFileSync(join(docsRoot, "src/generated/ui/components/button.json"), "utf8")),
    ).toEqual({ name: "button", files: ["@ui/button/button.tsx"] });
    expect(
      JSON.parse(readFileSync(join(docsRoot, "src/generated/ui/ui-hooks.json"), "utf8")),
    ).toEqual({ hooks: ["use-demo"] });
    expect(
      JSON.parse(readFileSync(join(docsRoot, "src/generated/ui/ui-libs.json"), "utf8")),
    ).toEqual({ libs: ["utils"] });

    const libraryData = readFileSync(join(docsRoot, "src/generated/library-data.ts"), "utf8");
    expect(libraryData).toContain('import ui_ui_hooks from "./ui/ui-hooks.json"');
    expect(libraryData).toContain("export const hooksData");
    expect(libraryData).not.toContain("-libs.json");
    expect(libraryData).not.toContain("libsData");
    expect(JSON.parse(readFileSync(join(docsRoot, "content/docs/meta.json"), "utf8"))).toEqual({
      title: "Documentation",
      root: true,
      pages: ["...app", "...ui"],
    });

    writeText(docsRoot, "public/source-data/ui/components/button.source.json.gz", "gzip cache");
    writeText(docsRoot, "public/source-data/ui/components/button.source.json.br", "brotli cache");
    const cachedResult = syncArtifacts({
      docsRoot,
      workspaceRoot,
      configPath,
    });
    expect(cachedResult.syncResult.synced).toBe(false);
    expect(readFileSync(`${publicSource}.gz`, "utf8")).toBe("gzip cache");
    expect(readFileSync(`${publicSource}.br`, "utf8")).toBe("brotli cache");
    expect(collectSourceArchives(join(docsRoot, "src/generated"))).toEqual([]);

    writeText(
      artifactRoot,
      "docs/generated/components/button.source.json",
      UPDATED_BUTTON_SOURCE_ARCHIVE,
    );
    syncArtifacts({
      docsRoot,
      workspaceRoot,
      configPath,
    });
    expect(readFileSync(publicSource, "utf8")).toBe(UPDATED_BUTTON_SOURCE_ARCHIVE);
    expect(existsSync(`${publicSource}.gz`)).toBe(false);
    expect(existsSync(`${publicSource}.br`)).toBe(false);
    expect(collectSourceArchives(join(docsRoot, "src/generated"))).toEqual([]);
  });

  it("extracts nested source archives from workspace artifacts", () => {
    const root = makeTempRoot();
    const docsRoot = join(root, "docs");
    const workspaceRoot = join(root, "workspace");
    const configPath = configureDocs(docsRoot);
    installWorkspaceArtifact(workspaceRoot);

    syncArtifacts({
      docsRoot,
      workspaceRoot,
      configPath,
    });

    expect(
      readFileSync(join(docsRoot, "public/source-data/ui/components/button.source.json"), "utf8"),
    ).toBe(BUTTON_SOURCE_ARCHIVE);
    expect(collectSourceArchives(join(docsRoot, "src/generated"))).toEqual([]);
  });

  it("cleans generated source archives when staging fails after a valid archive", () => {
    const root = makeTempRoot();
    const docsRoot = join(root, "docs");
    const workspaceRoot = join(root, "workspace");
    const configPath = configureDocs(docsRoot);
    const artifactRoot = installWorkspaceArtifact(workspaceRoot);
    writeText(artifactRoot, "docs/generated/other/late.source.json", BUTTON_SOURCE_ARCHIVE);

    expect(() =>
      syncArtifacts({
        docsRoot,
        workspaceRoot,
        configPath,
      }),
    ).toThrow(/directly under components\/ or hooks/);
    expect(collectSourceArchives(join(docsRoot, "src/generated"))).toEqual([]);
  });
});

describe("docs artifact secret scanning", () => {
  it("detects and redacts a recognized token beyond the former file-size cap", () => {
    const root = makeTempRoot();
    const path = join(root, "oversized-artifact.json");
    const fakeToken = `ghp_${"Z".repeat(36)}`;
    writeText(root, "oversized-artifact.json", `${"x".repeat(MAX_FILE_BYTES + 1)}\n${fakeToken}`);

    const findings = collectSecretFindings([path]);
    const output = formatSecretFindings(findings).join("\n");

    expect(findings).toEqual([expect.objectContaining({ path, pattern: "github-token" })]);
    expect(output).toContain("<redacted:");
    expect(output).not.toContain(fakeToken);
  });

  it("keeps oversized binary and ignored-path exclusions", () => {
    const root = makeTempRoot();
    const binaryPath = join(root, "oversized-artifact.bin");
    const fakeToken = `ghp_${"Q".repeat(36)}`;
    const previousCwd = process.cwd();
    writeText(root, "oversized-artifact.bin", `${"x".repeat(MAX_FILE_BYTES + 1)}\0${fakeToken}`);
    writeText(root, ".nuke/ignored-artifact.json", fakeToken);

    try {
      process.chdir(root);
      expect(collectSecretFindings([binaryPath, ".nuke/ignored-artifact.json"])).toEqual([]);
    } finally {
      process.chdir(previousCwd);
    }
  });
});
