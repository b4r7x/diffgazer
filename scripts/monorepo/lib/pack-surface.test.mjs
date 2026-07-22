import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createTempDirs } from "./fixture.mjs";
import { validateArtifactPackSurface } from "./pack-surface.mjs";

const { makeTempDir, cleanupTempDirs } = createTempDirs("pack-surface-test-");

afterEach(() => {
  cleanupTempDirs();
});

describe("validateArtifactPackSurface", () => {
  it("fails package artifact surface validation when packed files include leaked artifact payloads", () => {
    const root = makeTempDir();

    assert.ok(
      validateArtifactPackSurface(
        root,
        {
          id: "test",
          packageName: "@test/lib",
          workspaceDir: ".",
        },
        ["dist/artifacts/artifact-manifest.json", "dist/artifacts/fingerprint.sha256"],
      ).includes(
        "@test/lib npm pack must not ship dist/artifacts: dist/artifacts/artifact-manifest.json, dist/artifacts/fingerprint.sha256",
      ),
    );
  });

  it("passes package artifact surface validation when packed files exclude artifact payloads", () => {
    const root = makeTempDir();

    assert.deepEqual(
      validateArtifactPackSurface(
        root,
        {
          id: "test",
          packageName: "@test/lib",
          workspaceDir: ".",
        },
        ["package.json", "README.md", "dist/index.js"],
      ),
      [],
    );
  });
});
