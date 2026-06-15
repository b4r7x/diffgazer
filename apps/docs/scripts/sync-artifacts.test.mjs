import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncArtifacts } from "./sync-artifacts.mjs";

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

function installArtifactPackage(docsRoot) {
  const packageRoot = join(docsRoot, "node_modules/@fixture/ui");
  const artifactRoot = join(packageRoot, "artifacts");
  const manifest = {
    schemaVersion: 1,
    library: "ui",
    package: "@fixture/ui",
    version: "1.0.0",
    artifactRoot: "artifacts",
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

  writeJson(packageRoot, "package.json", {
    name: "@fixture/ui",
    version: "1.0.0",
    type: "module",
  });
  writeJson(artifactRoot, "artifact-manifest.json", manifest);
  writeText(artifactRoot, "fingerprint.sha256", `${"a".repeat(64)}\n`);
  writeJson(artifactRoot, "docs/content/meta.json", { title: "UI" });
  writeText(artifactRoot, "docs/content/getting-started.mdx", "# Getting started\n");
  writeJson(artifactRoot, "docs/generated/component-list.json", [{ name: "button" }]);
  writeJson(artifactRoot, "docs/generated/ui-hooks.json", { hooks: ["use-demo"] });
  writeJson(artifactRoot, "docs/generated/ui-libs.json", { libs: ["utils"] });
  writeJson(artifactRoot, "public/r/registry.json", { items: [{ name: "button" }] });
  writeText(
    artifactRoot,
    "source/registry/examples/button/basic.tsx",
    "export default function Basic() { return null }\n",
  );
}

describe("syncArtifacts", () => {
  it("copies package artifacts and replaces stale generated docs output", () => {
    const root = makeTempRoot();
    const docsRoot = join(root, "docs");
    const workspaceRoot = join(root, "workspace");
    const configPath = join(docsRoot, "config/docs-libraries.json");

    writeJson(docsRoot, "package.json", { type: "module" });
    writeJson(docsRoot, "config/docs-libraries.json", {
      primaryLibraryId: "ui",
      libraries: [
        { id: "app", enabled: true },
        {
          id: "ui",
          enabled: true,
          artifactSource: { workspaceDir: "libs/ui", packageName: "@fixture/ui" },
        },
      ],
    });
    writeText(docsRoot, "content/docs/ui/stale.mdx", "# stale\n");
    writeJson(docsRoot, "public/r/ui/stale.json", { stale: true });
    installArtifactPackage(docsRoot);

    const result = syncArtifacts({
      docsRoot,
      workspaceRoot,
      configPath,
      env: { DIFFGAZER_ARTIFACT_SYNC_MODE: "package" },
    });

    expect(result.syncMode).toBe("package");
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
    expect(readFileSync(join(docsRoot, "src/generated/library-data.ts"), "utf8")).toContain(
      'import ui_ui_hooks from "./ui/ui-hooks.json"',
    );
    expect(JSON.parse(readFileSync(join(docsRoot, "content/docs/meta.json"), "utf8"))).toEqual({
      title: "Documentation",
      root: true,
      pages: ["...app", "...ui"],
    });
  });
});
