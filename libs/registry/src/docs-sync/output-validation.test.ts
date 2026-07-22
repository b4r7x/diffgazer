import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertArtifactSyncOutputs,
  collectArtifactSyncValidationErrors,
} from "./output-validation.js";

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

describe("sync artifacts helper output validation", () => {
  it("reports missing namespace outputs and primary mismatch", () => {
    const tempRoot = makeTempDir();

    writeFile(tempRoot, "content/docs/meta.json");
    writeFile(tempRoot, "registry/registry.json");
    writeFile(tempRoot, "styles/styles.css", "/* styles */\n");
    writeFile(tempRoot, "content/docs/ui/meta.json");
    writeFile(tempRoot, "public/r/ui/registry.json");
    mkdirSync(resolve(tempRoot, "src/generated/ui"), { recursive: true });

    const errors = collectArtifactSyncValidationErrors({
      docsRoot: tempRoot,
      primaryLibraryId: "keys",
      libraries: [{ id: "ui", workspaceDir: "libs/ui" }],
    });

    expect(errors).toContain(
      'Primary library "keys" is not present in enabled artifact libraries: ui',
    );
    expect(errors).toContain("Generated namespace is empty: src/generated/ui");
  });

  it("rejects unsafe namespace output ids before resolving output paths", () => {
    const tempRoot = makeTempDir();

    const errors = collectArtifactSyncValidationErrors({
      docsRoot: tempRoot,
      primaryLibraryId: "ui",
      libraries: [{ id: "../ui", workspaceDir: "libs/ui" }],
    });

    expect(errors).toEqual(['Library id "../ui" must be a safe library id']);
  });

  it("reports generated sync output drift against loaded artifacts", () => {
    const tempRoot = makeTempDir();
    const artifactRoot = resolve(tempRoot, "artifact");

    writeFile(tempRoot, "content/docs/meta.json");
    writeFile(tempRoot, "registry/registry.json");
    writeFile(tempRoot, "styles/styles.css", "/* styles */\n");
    writeFile(tempRoot, "src/generated/demo-loaders.ts", "export {}\n");
    writeFile(tempRoot, "content/docs/ui/meta.json");
    writeFile(tempRoot, "content/docs/ui/index.mdx", "# Intro\n");
    writeFile(tempRoot, "public/r/ui/registry.json", '{"items":[]}\n');
    writeFile(tempRoot, "src/generated/ui/component-list.json", '["stale"]\n');

    writeFile(artifactRoot, "docs/meta.json");
    writeFile(artifactRoot, "docs/index.mdx", "# Intro\n");
    writeFile(artifactRoot, "registry/registry.json", '{"items":[]}\n');
    writeFile(artifactRoot, "generated/component-list.json", "[]\n");

    const errors = collectArtifactSyncValidationErrors({
      docsRoot: tempRoot,
      primaryLibraryId: "ui",
      libraries: [{ id: "ui", workspaceDir: "libs/ui" }],
      artifacts: [
        {
          id: "ui",
          artifactRoot,
          manifest: {
            docs: { contentDir: "docs", generatedDir: "generated" },
            registry: { publicDir: "registry" },
          },
          generatedFiles: ["generated/component-list.json"],
        },
      ],
    });

    expect(errors).toContain(
      "ui generated sync: artifact differs from source for component-list.json",
    );
  });

  it("reports stale copied assets after a manifest removes its asset declaration", () => {
    const tempRoot = makeTempDir();
    const artifactRoot = resolve(tempRoot, "artifact");

    writeFile(tempRoot, "content/docs/meta.json");
    writeFile(tempRoot, "src/generated/demo-loaders.ts", "export {}\n");
    writeFile(tempRoot, "content/docs/ui/meta.json");
    writeFile(tempRoot, "public/r/ui/registry.json", '{"items":[]}\n');
    writeFile(tempRoot, "src/generated/ui/component-list.json", "[]\n");
    writeFile(tempRoot, "public/library-assets/ui/logo.svg", "<svg />\n");
    writeFile(artifactRoot, "docs/meta.json");
    writeFile(artifactRoot, "registry/registry.json", '{"items":[]}\n');
    writeFile(artifactRoot, "generated/component-list.json", "[]\n");

    const errors = collectArtifactSyncValidationErrors({
      docsRoot: tempRoot,
      primaryLibraryId: "ui",
      libraries: [{ id: "ui", workspaceDir: "libs/ui" }],
      artifacts: [
        {
          id: "ui",
          artifactRoot,
          manifest: {
            docs: { contentDir: "docs", generatedDir: "generated" },
            registry: { publicDir: "registry" },
          },
          generatedFiles: ["generated/component-list.json"],
        },
      ],
    });

    expect(errors).toContain(
      `ui assets sync: stale output directory ${resolve(tempRoot, "public/library-assets/ui")}`,
    );
  });

  it("accepts secondary demo index imports rewritten to docs example namespace", () => {
    const tempRoot = makeTempDir();
    const artifactRoot = resolve(tempRoot, "artifact");

    writeFile(tempRoot, "content/docs/meta.json");
    writeFile(tempRoot, "registry/registry.json");
    writeFile(tempRoot, "styles/styles.css", "/* styles */\n");
    writeFile(tempRoot, "src/generated/demo-loaders.ts", "export {}\n");
    writeFile(tempRoot, "content/docs/ui/meta.json");
    writeFile(tempRoot, "public/r/ui/registry.json", '{"items":[]}\n');
    writeFile(tempRoot, "src/generated/ui/component-list.json", "[]\n");
    writeFile(tempRoot, "content/docs/keys/meta.json");
    writeFile(tempRoot, "public/r/keys/registry.json", '{"items":[]}\n');
    writeFile(
      tempRoot,
      "src/generated/keys/demo-index.ts",
      [
        'import { lazy } from "react"',
        'import type { ComponentType, LazyExoticComponent } from "react"',
        "",
        "type DemoModule = { default: ComponentType }",
        'const demoModules = import.meta.glob<DemoModule>("../../../registry/examples/**/*.tsx")',
        "",
        "function lazyDemo(path: string): LazyExoticComponent<ComponentType> {",
        "  const load = demoModules[path]",
        "  if (!load) {",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: fixture source text for a generated demo-index module, not an interpolation in this file.
        "    return lazy(() => Promise.reject(new Error(`Missing demo module: ${path}`)))",
        "  }",
        "  return lazy(load)",
        "}",
        "",
        "export const demos: Record<string, LazyExoticComponent<ComponentType>> = {",
        '  "use-key-basic": lazyDemo("../../../registry/examples/keys/use-key/use-key-basic.tsx"),',
        "}",
        "",
      ].join("\n"),
    );
    writeFile(
      tempRoot,
      "registry/examples/keys/use-key/use-key-basic.tsx",
      "export default function Demo() { return null }\n",
    );

    writeFile(artifactRoot, "docs/meta.json");
    writeFile(artifactRoot, "registry/registry.json", '{"items":[]}\n');
    writeFile(
      artifactRoot,
      "generated/demo-index.ts",
      [
        'import { lazy } from "react"',
        'import type { ComponentType, LazyExoticComponent } from "react"',
        "",
        "export const demos: Record<string, LazyExoticComponent<ComponentType>> = {",
        '  "use-key-basic": lazy(() => import("../../registry/examples/use-key/use-key-basic")),',
        "}",
        "",
      ].join("\n"),
    );
    writeFile(
      artifactRoot,
      "source/registry/examples/use-key/use-key-basic.tsx",
      "export default function Demo() { return null }\n",
    );

    const errors = collectArtifactSyncValidationErrors({
      docsRoot: tempRoot,
      primaryLibraryId: "ui",
      libraries: [
        { id: "ui", workspaceDir: "libs/ui" },
        { id: "keys", workspaceDir: "libs/keys" },
      ],
      artifacts: [
        {
          id: "keys",
          artifactRoot,
          manifest: {
            docs: { contentDir: "docs" },
            registry: { publicDir: "registry" },
            source: { registryDir: "source/registry" },
          },
          generatedFiles: ["generated/demo-index.ts"],
        },
      ],
    });

    expect(errors).toEqual([]);
  });

  it("reports missing secondary copied examples", () => {
    const tempRoot = makeTempDir();
    const artifactRoot = resolve(tempRoot, "artifact");

    writeFile(tempRoot, "content/docs/meta.json");
    writeFile(tempRoot, "registry/registry.json");
    writeFile(tempRoot, "styles/styles.css", "/* styles */\n");
    writeFile(tempRoot, "src/generated/demo-loaders.ts", "export {}\n");
    writeFile(tempRoot, "content/docs/ui/meta.json");
    writeFile(tempRoot, "public/r/ui/registry.json", '{"items":[]}\n');
    writeFile(tempRoot, "src/generated/ui/component-list.json", "[]\n");
    writeFile(tempRoot, "content/docs/keys/meta.json");
    writeFile(tempRoot, "public/r/keys/registry.json", '{"items":[]}\n');
    writeFile(tempRoot, "src/generated/keys/demo-index.ts", "export {}\n");

    writeFile(artifactRoot, "docs/meta.json");
    writeFile(artifactRoot, "registry/registry.json", '{"items":[]}\n');
    writeFile(artifactRoot, "generated/demo-index.ts", "export {}\n");
    writeFile(
      artifactRoot,
      "source/registry/examples/use-key/use-key-basic.tsx",
      "export default function Demo() { return null }\n",
    );

    const errors = collectArtifactSyncValidationErrors({
      docsRoot: tempRoot,
      primaryLibraryId: "ui",
      libraries: [
        { id: "ui", workspaceDir: "libs/ui" },
        { id: "keys", workspaceDir: "libs/keys" },
      ],
      artifacts: [
        {
          id: "keys",
          artifactRoot,
          manifest: {
            docs: { contentDir: "docs" },
            registry: { publicDir: "registry" },
            source: { registryDir: "source/registry" },
          },
          generatedFiles: ["generated/demo-index.ts"],
        },
      ],
    });

    expect(errors).toContain(
      `keys examples sync: missing artifact directory ${resolve(tempRoot, "registry/examples/keys")}`,
    );
  });

  it("rejects loaded artifact paths that escape the artifact root", () => {
    const tempRoot = makeTempDir();
    const artifactRoot = resolve(tempRoot, "artifact");

    writeFile(tempRoot, "content/docs/meta.json");
    writeFile(tempRoot, "registry/registry.json");
    writeFile(tempRoot, "styles/styles.css", "/* styles */\n");
    writeFile(tempRoot, "src/generated/demo-loaders.ts", "export {}\n");
    writeFile(tempRoot, "content/docs/ui/meta.json");
    writeFile(tempRoot, "public/r/ui/registry.json", '{"items":[]}\n');
    writeFile(tempRoot, "src/generated/ui/component-list.json", "[]\n");

    const errors = collectArtifactSyncValidationErrors({
      docsRoot: tempRoot,
      primaryLibraryId: "ui",
      libraries: [{ id: "ui", workspaceDir: "libs/ui" }],
      artifacts: [
        {
          id: "ui",
          artifactRoot,
          manifest: {
            docs: { contentDir: "../outside", generatedDir: "generated" },
            registry: { publicDir: "registry" },
          },
          generatedFiles: ["generated/component-list.json"],
        },
      ],
    });

    expect(errors).toContain(`ui docs content artifact path escapes ${artifactRoot}: ../outside`);
  });

  it("asserts sync outputs throw on validation failure", () => {
    const tempRoot = makeTempDir();

    expect(() =>
      assertArtifactSyncOutputs({
        docsRoot: tempRoot,
        primaryLibraryId: "ui",
        libraries: [{ id: "ui", workspaceDir: "libs/ui" }],
      }),
    ).toThrow(/Artifact sync validation failed in docs host\./);
  });
});
