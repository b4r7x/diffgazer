import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertCatalogProviders,
  collectReachableBundleFiles,
  enabledSnapshotProviders,
  findSnapshotInBundle,
} from "./smoke-modelsdev.mjs";

// assertCatalogProviders owns the catalog smoke contract shared by the offline
// snapshot path and the live models.dev path: every enabled provider must
// resolve to at least one model, otherwise the picker would be blank.

test("assertCatalogProviders returns a summary line per provider when all resolve to models", () => {
  const resolve = (_catalog, provider) => ({ gemini: [1, 2], groq: [1, 2, 3] })[provider];
  const lines = assertCatalogProviders({}, ["gemini", "groq"], resolve, "test source");
  assert.deepEqual(lines, [
    "OK: gemini -> 2 models (test source)",
    "OK: groq -> 3 models (test source)",
  ]);
});

test("assertCatalogProviders throws attributing the failure to the injected source", () => {
  const resolve = (_catalog, provider) => (provider === "groq" ? [] : [1]);
  assert.throws(
    () => assertCatalogProviders({}, ["gemini", "groq"], resolve, "bundled snapshot"),
    /bundled snapshot: provider 'groq' resolved to zero models/,
  );
});

test("enabledSnapshotProviders returns enabled providers that ship in the snapshot, excluding the OpenRouter live path", () => {
  const overlay = {
    gemini: { enabled: true, sdkKind: "google" },
    zai: { enabled: true, sdkKind: "zhipu" },
    "zai-coding": { enabled: true, sdkKind: "zhipu" },
    openrouter: { enabled: true, sdkKind: "openrouter" },
    groq: { enabled: true, sdkKind: "openai-compatible" },
    cerebras: { enabled: true, sdkKind: "openai-compatible" },
    mistral: { enabled: false, sdkKind: "openai-compatible" },
  };
  assert.deepEqual(enabledSnapshotProviders(overlay), [
    "gemini",
    "zai",
    "zai-coding",
    "groq",
    "cerebras",
  ]);
});

test("findSnapshotInBundle returns the first bundle file containing every snapshot marker", () => {
  const files = ["chunk-a.js", "chunk-b.js"];
  const contents = {
    "chunk-a.js": "...snapshot-model-id...but no display name",
    "chunk-b.js": "...snapshot-model-id...Snapshot Model Name...",
  };
  assert.equal(
    findSnapshotInBundle(files, (path) => contents[path], [
      "snapshot-model-id",
      "Snapshot Model Name",
    ]),
    "chunk-b.js",
  );
});

test("findSnapshotInBundle rejects a complete overlay when its snapshot-only evidence is absent", () => {
  const files = ["chunk-a.js", "chunk-b.js"];
  const completeOverlayWithoutSnapshot = JSON.stringify({
    cerebras: {
      enabled: true,
      defaultModel: "gpt-oss-120b",
      recommendedModelId: "gpt-oss-120b",
    },
  });
  assert.equal(
    findSnapshotInBundle(files, () => completeOverlayWithoutSnapshot, [
      "llama3.1-8b",
      "Llama 3.1 8B",
    ]),
    null,
  );
});

test("collectReachableBundleFiles excludes stale chunks outside the current entry graph", () => {
  const contents = {
    "/dist/index.js": 'import "./current.js"; void import("./lazy.js");',
    "/dist/current.js": 'export { value } from "./shared.js";',
    "/dist/lazy.js": "export const lazy = true;",
    "/dist/shared.js": "export const value = true;",
    "/dist/stale.js": "snapshot-only evidence from an obsolete build",
  };

  assert.deepEqual(
    collectReachableBundleFiles(
      "/dist/index.js",
      (file) => contents[file],
      (_file, specifier) => `/dist/${specifier.slice(2)}`,
    ),
    ["/dist/index.js", "/dist/current.js", "/dist/lazy.js", "/dist/shared.js"],
  );
});
