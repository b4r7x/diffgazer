import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { resolveSyncOutputPaths } from "../docs/paths.js";
import { DEFAULT_OUTPUT_PATHS } from "../docs/types.js";

describe("resolveSyncOutputPaths", () => {
  const docsRoot = "/project/docs";

  it("resolves default paths relative to docsRoot", () => {
    const paths = resolveSyncOutputPaths(docsRoot);

    expect(paths.contentDir).toBe(resolve(docsRoot, DEFAULT_OUTPUT_PATHS.contentDir));
    expect(paths.generatedDir).toBe(resolve(docsRoot, DEFAULT_OUTPUT_PATHS.generatedDir));
    expect(paths.registryDir).toBe(resolve(docsRoot, DEFAULT_OUTPUT_PATHS.registryDir));
    expect(paths.stylesDir).toBe(resolve(docsRoot, DEFAULT_OUTPUT_PATHS.stylesDir));
    expect(paths.publicRegistryDir).toBe(resolve(docsRoot, DEFAULT_OUTPUT_PATHS.publicRegistryDir));
    expect(paths.libraryAssetsDir).toBe(resolve(docsRoot, DEFAULT_OUTPUT_PATHS.libraryAssetsDir));
    expect(paths.stateFilePath).toBe(resolve(docsRoot, DEFAULT_OUTPUT_PATHS.stateFile));
  });

  it("applies overrides while keeping other defaults", () => {
    const paths = resolveSyncOutputPaths(docsRoot, {
      contentDir: "custom/content",
      generatedDir: "custom/generated",
    });

    expect(paths.contentDir).toBe(resolve(docsRoot, "custom/content"));
    expect(paths.generatedDir).toBe(resolve(docsRoot, "custom/generated"));
    expect(paths.registryDir).toBe(resolve(docsRoot, DEFAULT_OUTPUT_PATHS.registryDir));
  });
});
