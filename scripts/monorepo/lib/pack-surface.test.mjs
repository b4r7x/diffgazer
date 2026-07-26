import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateArtifactPackSurface } from "./pack-surface.mjs";

describe("validateArtifactPackSurface", () => {
  it("fails package artifact surface validation when packed files include leaked artifact payloads", () => {
    assert.ok(
      validateArtifactPackSurface(
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
    assert.deepEqual(
      validateArtifactPackSurface(
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
