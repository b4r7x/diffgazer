import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { collectDocsArtifactSyncValidationErrors } from "./lib/docs-artifact-sync-validation.mjs";

const tempRoots = [];
const UI_COMPONENT_SOURCE = '{"source":{"button.tsx":{"raw":"button"}}}\n';
const UI_HOOK_SOURCE = '{"source":{"use-copy.ts":{"raw":"copy"}}}\n';
const KEYS_HOOK_SOURCE = '{"source":{"use-key.ts":{"raw":"key"}}}\n';

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

function writeText(root, relativePath, content) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function writeJson(root, relativePath, value) {
  writeText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createArtifact(root, id, generated) {
  const artifactRoot = join(root, "artifacts", id);
  const manifest = {
    docs: { contentDir: "docs", generatedDir: "generated" },
    registry: { publicDir: "registry" },
    generated,
  };

  writeJson(artifactRoot, "docs/meta.json", { title: id });
  writeJson(artifactRoot, "registry/registry.json", { items: [] });
  return { id, artifactRoot, manifest, generatedFiles: Object.values(generated) };
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "dg-artifact-validator-"));
  tempRoots.push(root);
  const docsRoot = join(root, "docs");

  writeJson(docsRoot, "content/docs/meta.json", { title: "Documentation" });
  writeText(docsRoot, "src/generated/demo-loaders.ts", "export const demoLoaders = {}\n");

  const ui = createArtifact(root, "ui", {
    componentList: "generated/component-list.json",
    demoIndex: "generated/demo-index.ts",
  });
  writeJson(ui.artifactRoot, "generated/component-list.json", [{ name: "button" }]);
  writeJson(ui.artifactRoot, "generated/components/button.json", { name: "button" });
  writeText(ui.artifactRoot, "generated/components/button.source.json", UI_COMPONENT_SOURCE);
  writeJson(ui.artifactRoot, "generated/hooks/use-copy.json", { name: "use-copy" });
  writeText(ui.artifactRoot, "generated/hooks/use-copy.source.json", UI_HOOK_SOURCE);
  writeText(ui.artifactRoot, "generated/demo-index.ts", "export const demos = {}\n");

  const keys = createArtifact(root, "keys", {
    hookList: "generated/hook-list.json",
    hooksDir: "generated/hooks",
  });
  writeJson(keys.artifactRoot, "generated/hook-list.json", [{ name: "use-key" }]);
  writeJson(keys.artifactRoot, "generated/hooks/use-key.json", { name: "use-key" });
  writeText(keys.artifactRoot, "generated/hooks/use-key.source.json", KEYS_HOOK_SOURCE);

  for (const id of ["ui", "keys"]) {
    writeJson(docsRoot, `content/docs/${id}/meta.json`, { title: id });
    writeJson(docsRoot, `public/r/${id}/registry.json`, { items: [] });
  }

  writeJson(docsRoot, "src/generated/ui/component-list.json", [{ name: "button" }]);
  writeJson(docsRoot, "src/generated/ui/components/button.json", { name: "button" });
  writeJson(docsRoot, "src/generated/ui/hooks/use-copy.json", { name: "use-copy" });
  writeText(docsRoot, "src/generated/ui/demo-index.ts", "export const demos = {}\n");
  writeJson(docsRoot, "src/generated/keys/hook-list.json", [{ name: "use-key" }]);
  writeJson(docsRoot, "src/generated/keys/hooks/use-key.json", { name: "use-key" });

  writeText(docsRoot, "public/source-data/ui/components/button.source.json", UI_COMPONENT_SOURCE);
  writeText(docsRoot, "public/source-data/ui/hooks/use-copy.source.json", UI_HOOK_SOURCE);
  writeText(docsRoot, "public/source-data/keys/hooks/use-key.source.json", KEYS_HOOK_SOURCE);

  const params = {
    docsRoot,
    primaryLibraryId: "ui",
    libraries: [
      { id: "ui", packageName: "@fixture/ui", workspaceDir: "libs/ui" },
      { id: "keys", packageName: "@fixture/keys", workspaceDir: "libs/keys" },
    ],
    artifacts: [ui, keys],
  };

  return { docsRoot, params };
}

test("validates UI component and hook archives plus Keys hook archives in public source-data", () => {
  const { docsRoot, params } = createFixture();
  writeText(docsRoot, "public/source-data/ui/components/button.source.json.gz", "cached gzip");
  writeText(docsRoot, "public/source-data/ui/components/button.source.json.br", "cached brotli");

  assert.deepEqual(collectDocsArtifactSyncValidationErrors(params), []);
});

test("requires raw public source archives even when compressed sidecars exist", () => {
  const { docsRoot, params } = createFixture();
  rmSync(join(docsRoot, "public/source-data/ui/components/button.source.json"));
  writeText(docsRoot, "public/source-data/ui/components/button.source.json.gz", "cached gzip");
  writeText(docsRoot, "public/source-data/ui/components/button.source.json.br", "cached brotli");

  const errors = collectDocsArtifactSyncValidationErrors(params);

  assert.ok(
    errors.includes(
      "docs source-data: missing public source archive ui/components/button.source.json",
    ),
  );
});

test("rejects byte-stale and extra public source archives", () => {
  const { docsRoot, params } = createFixture();
  writeText(
    docsRoot,
    "public/source-data/ui/hooks/use-copy.source.json",
    '{\n  "source": {"use-copy.ts": {"raw": "copy"}}\n}\n',
  );
  writeText(docsRoot, "public/source-data/keys/hooks/extra.source.json", '{"extra":true}\n');

  const errors = collectDocsArtifactSyncValidationErrors(params);

  assert.ok(
    errors.includes(
      "docs source-data: public source archive differs from artifact ui/hooks/use-copy.source.json",
    ),
  );
  assert.ok(
    errors.includes("docs source-data: extra public source archive keys/hooks/extra.source.json"),
  );
});

test("rejects source archives left in src/generated", () => {
  const { docsRoot, params } = createFixture();
  writeText(docsRoot, "src/generated/ui/components/button.source.json", UI_COMPONENT_SOURCE);

  assert.ok(
    collectDocsArtifactSyncValidationErrors(params).includes(
      "docs generated output contains source archive: ui/components/button.source.json",
    ),
  );
});

test("continues to validate non-source generated files", () => {
  const { docsRoot, params } = createFixture();
  rmSync(join(docsRoot, "src/generated/ui/components/button.json"));
  writeText(docsRoot, "src/generated/ui/demo-index.ts", "export const demos = { stale: true }\n");
  writeJson(docsRoot, "src/generated/keys/hooks/use-key.json", { name: "stale" });

  const errors = collectDocsArtifactSyncValidationErrors(params);

  assert.ok(errors.includes("ui generated sync: missing artifact file components/button.json"));
  assert.ok(
    errors.includes(
      "ui generated sync demo-index.ts: artifact differs from rewritten docs runtime demo index",
    ),
  );
  assert.ok(
    errors.includes("keys generated sync: artifact differs from source for hooks/use-key.json"),
  );
});
