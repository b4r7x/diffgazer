import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  computeBundleIntegrity,
  computeStrictInputsFingerprint,
  validateArtifactMirror,
  validateIntegrityBundle,
  validateLibraryArtifacts,
} from "./artifact-validation-lib.mjs";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir() {
  const dir = mkdtempSync(resolve(tmpdir(), "artifact-validation-test-"));
  tempDirs.push(dir);
  return dir;
}

function writeFile(root: string, relPath: string, content = "{}\n") {
  const absPath = resolve(root, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, content);
}

function writeLibraryFixture(root: string) {
  writeFile(root, "docs/content/index.mdx", "# Intro\n");
  writeFile(root, "docs/generated/component-list.json", "[]\n");
  writeFile(root, "registry/registry.json", "{\"items\":[]}\n");
  writeFile(root, "public/r/registry.json", "{\"items\":[]}\n");
  writeFile(root, "package.json", "{\"name\":\"@test/lib\",\"version\":\"1.0.0\"}\n");

  const { fingerprint } = computeStrictInputsFingerprint(root, [
    "docs/content",
    "docs/generated",
    "registry",
    "public/r",
    "package.json",
  ]);

  writeFile(root, "dist/artifacts/artifact-manifest.json", JSON.stringify({
    schemaVersion: 1,
    library: "test",
    package: "@test/lib",
    version: "1.0.0",
    artifactRoot: "dist/artifacts",
    inputs: ["docs/content", "docs/generated", "registry", "public/r", "package.json"],
    docs: {
      contentDir: "docs",
      metaFile: "docs/meta.json",
      generatedDir: "generated",
    },
    registry: {
      namespace: "@test/lib",
      basePath: "/r/test",
      publicDir: "registry",
      index: "registry/registry.json",
    },
    generated: {
      componentList: "generated/component-list.json",
    },
    integrity: {
      algorithm: "sha256",
      fingerprintFile: "fingerprint.sha256",
    },
  }));
  writeFile(root, "dist/artifacts/fingerprint.sha256", `${fingerprint}\n`);
  writeFile(root, "dist/artifacts/registry/registry.json", "{\"items\":[]}\n");
  writeFile(root, "dist/artifacts/generated/component-list.json", "[]\n");
}

describe("artifact validation", () => {
  it("accepts fresh library artifacts", () => {
    const root = makeTempDir();
    writeLibraryFixture(root);

    expect(validateLibraryArtifacts({ rootDir: root, label: "fixture" })).toEqual([]);
  });

  it("fails closed when fingerprint inputs are missing", () => {
    const root = makeTempDir();
    writeLibraryFixture(root);
    rmSync(resolve(root, "docs/generated"), { recursive: true, force: true });

    expect(validateLibraryArtifacts({ rootDir: root, label: "fixture" })).toContain(
      "fixture: missing fingerprint input docs/generated",
    );
  });

  it("fails when public registry artifacts are stale or tampered", () => {
    const root = makeTempDir();
    writeLibraryFixture(root);
    writeFile(root, "dist/artifacts/registry/registry.json", "{\"items\":[{\"name\":\"stale\"}]}\n");

    expect(validateLibraryArtifacts({ rootDir: root, label: "fixture" })).toContain(
      "fixture public/r: artifact differs from source for registry.json",
    );
  });

  it("validates copied artifact mirrors without recomputing source fingerprints", () => {
    const root = makeTempDir();
    writeFile(root, "source/artifact-manifest.json", "{\"ok\":true}\n");
    writeFile(root, "mirror/artifact-manifest.json", "{\"ok\":false}\n");

    expect(validateArtifactMirror(resolve(root, "source"), resolve(root, "mirror"), "mirror")).toEqual([
      "mirror: artifact differs from source for artifact-manifest.json",
    ]);
  });

  it("fails tampered integrity bundles", () => {
    const root = makeTempDir();
    const bundle = {
      items: [{ name: "use-key", files: [{ path: "hooks/use-key.ts", content: "export {}\n" }] }],
    };
    const integrity = computeBundleIntegrity(bundle, ["items"]);
    const bundlePath = resolve(root, "bundle.json");
    writeFile(root, "bundle.json", JSON.stringify({
      ...bundle,
      items: [{ name: "use-key", files: [{ path: "hooks/use-key.ts", content: "tampered\n" }] }],
      integrity,
    }));

    expect(validateIntegrityBundle(bundlePath, ["items"], "keys bundle")[0]).toMatch(
      /keys bundle: bundle integrity mismatch/,
    );
  });
});
