import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertCatalogProviders,
  buildHostedProbeTuples,
  collectReachableBundleFiles,
  emitProviderProbeResults,
  finalizeStrictProbeResults,
  findSnapshotInBundle,
  formatProviderProbeLine,
  PROVIDER_PROBE_REASONS,
  probeDispositionKind,
  resolveLiveProbeDisposition,
} from "./smoke-modelsdev.mjs";

// assertCatalogProviders owns the catalog smoke contract shared by the offline
// snapshot path and the live models.dev path: every enabled provider must
// resolve to at least one model, otherwise the picker would be blank.

test("formatProviderProbeLine keeps the frozen key order and reason vocabulary", () => {
  const line = formatProviderProbeLine({
    providerId: "groq",
    modelId: "gpt-oss-120b",
    status: "skipped",
    reason: "network-disabled",
    checkedAt: "2026-07-31T12:00:00.000Z",
  });
  assert.equal(
    line,
    '{"type":"provider-probe","providerId":"groq","modelId":"gpt-oss-120b","status":"skipped","reason":"network-disabled","checkedAt":"2026-07-31T12:00:00.000Z"}',
  );
  for (const reason of PROVIDER_PROBE_REASONS) {
    assert.match(
      formatProviderProbeLine({
        providerId: "groq",
        modelId: null,
        status: reason === "none" ? "passed" : "skipped",
        reason,
        checkedAt: "2026-07-31T12:00:00.000Z",
      }),
      new RegExp(`"reason":"${reason}"`),
    );
  }
});

test("resolveLiveProbeDisposition types every prerequisite as not-requested or unavailable", () => {
  const tuple = { providerId: "groq", credentialEnv: "GROQ_API_KEY", modelId: "gpt-oss-120b" };
  assert.deepEqual(resolveLiveProbeDisposition(tuple, {}, false), {
    kind: "not-requested",
    reason: "network-disabled",
  });
  assert.deepEqual(resolveLiveProbeDisposition(tuple, {}, true), {
    kind: "not-requested",
    reason: "live-opt-in-missing",
  });
  assert.deepEqual(resolveLiveProbeDisposition(tuple, { DIFFGAZER_LIVE_PROBES: "1" }, true), {
    kind: "unavailable",
    reason: "credential-missing",
  });
  assert.deepEqual(
    resolveLiveProbeDisposition(
      tuple,
      { DIFFGAZER_LIVE_PROBES: "1", GROQ_API_KEY: "present" },
      true,
    ),
    { kind: "ready", reason: "none" },
  );

  assert.equal(probeDispositionKind("runner-unavailable"), "unavailable");
  assert.equal(probeDispositionKind("network-disabled"), "not-requested");
});

test("buildHostedProbeTuples derives hosted credentials from the canonical map and fails if one is missing", () => {
  const productRegistry = {
    gemini: {
      id: "gemini",
      transportFamily: "hosted-api",
      modelPolicy: { suggestedModelId: "gemini-2.5-flash" },
    },
    zai: {
      id: "zai",
      transportFamily: "hosted-api",
      modelPolicy: { suggestedModelId: "glm-5" },
    },
    ollama: {
      id: "ollama",
      transportFamily: "local-http",
      modelPolicy: {},
    },
  };

  assert.deepEqual(
    buildHostedProbeTuples(productRegistry, {
      gemini: "GOOGLE_API_KEY",
      zai: "ZAI_API_KEY",
    }),
    [
      {
        providerId: "gemini",
        credentialEnv: "GOOGLE_API_KEY",
        modelId: "gemini-2.5-flash",
      },
      {
        providerId: "zai",
        credentialEnv: "ZAI_API_KEY",
        modelId: "glm-5",
      },
    ],
  );
  assert.throws(
    () => buildHostedProbeTuples(productRegistry, {}),
    /No credential environment variable mapped for hosted product 'gemini'/,
  );
});

test("emitProviderProbeResults emits one line per tuple and never upgrades skipped probes to passed", async () => {
  const emitted = [];
  const { lines, results } = await emitProviderProbeResults(
    [
      { providerId: "groq", credentialEnv: "GROQ_API_KEY", modelId: "gpt-oss-120b" },
      { providerId: "gemini", credentialEnv: "GOOGLE_API_KEY", modelId: "gemini-2.5-flash" },
    ],
    {
      env: {},
      networkEnabled: false,
      checkedAt: "2026-07-31T12:00:00.000Z",
      emit: (line) => emitted.push(line),
      runProbe: async () => {
        throw new Error("catalog/mock probes must not run when prerequisites are missing");
      },
    },
  );

  assert.equal(lines.length, 2);
  assert.equal(results.length, 2);
  assert.ok(results.every(({ status }) => status === "skipped"));
  assert.deepEqual(emitted, lines);
  assert.ok(lines.every((line) => line.includes('"status":"skipped"')));
  assert.ok(lines.every((line) => line.includes('"reason":"network-disabled"')));
});

test("emitProviderProbeResults reports probe-failed instead of passed when a live probe does not succeed", async () => {
  const { lines } = await emitProviderProbeResults(
    [{ providerId: "groq", credentialEnv: "GROQ_API_KEY", modelId: "gpt-oss-120b" }],
    {
      env: { DIFFGAZER_LIVE_PROBES: "1", GROQ_API_KEY: "present" },
      networkEnabled: true,
      checkedAt: "2026-07-31T12:00:00.000Z",
      runProbe: async () => ({ passed: false }),
    },
  );
  assert.equal(
    lines[0],
    formatProviderProbeLine({
      providerId: "groq",
      modelId: "gpt-oss-120b",
      status: "failed",
      reason: "probe-failed",
      checkedAt: "2026-07-31T12:00:00.000Z",
    }),
  );
});

test("emitProviderProbeResults records an unavailable runner as skipped, never failed", async () => {
  const { lines, results } = await emitProviderProbeResults(
    [{ providerId: "groq", credentialEnv: "GROQ_API_KEY", modelId: "gpt-oss-120b" }],
    {
      env: { DIFFGAZER_LIVE_PROBES: "1", GROQ_API_KEY: "present" },
      networkEnabled: true,
      checkedAt: "2026-07-31T12:00:00.000Z",
      runProbe: async () => ({ unavailable: "runner-unavailable" }),
    },
  );
  assert.ok(lines[0].includes('"status":"skipped"'));
  assert.ok(lines[0].includes('"reason":"runner-unavailable"'));
  assert.deepEqual(results[0].status, "skipped");
});

// Injected fixtures stand in for probe results the real smoke would emit, so the
// strict exit code is proven for every disposition without live credentials.
const STRICT_FIXTURES = {
  passed: {
    tuple: { providerId: "groq", modelId: "gpt-oss-120b" },
    status: "passed",
    reason: "none",
  },
  failed: {
    tuple: { providerId: "groq", modelId: "gpt-oss-120b" },
    status: "failed",
    reason: "probe-failed",
  },
  unavailableRunner: {
    tuple: { providerId: "groq", modelId: null },
    status: "skipped",
    reason: "runner-unavailable",
  },
  unavailableCredential: {
    tuple: { providerId: "zai", modelId: null },
    status: "skipped",
    reason: "credential-missing",
  },
  notRequested: {
    tuple: { providerId: "groq", modelId: null },
    status: "skipped",
    reason: "network-disabled",
  },
};

test("finalizeStrictProbeResults fails strict mode on every failed or unavailable probe result", () => {
  for (const key of ["failed", "unavailableRunner", "unavailableCredential"]) {
    assert.throws(
      () => finalizeStrictProbeResults([STRICT_FIXTURES.passed, STRICT_FIXTURES[key]], true),
      /strict probes: 1 provider probe\(s\) did not pass after emission/,
      key,
    );
  }
  assert.throws(
    () =>
      finalizeStrictProbeResults(
        [STRICT_FIXTURES.failed, STRICT_FIXTURES.unavailableCredential],
        true,
      ),
    /strict probes: 2 provider probe\(s\) did not pass after emission \(groq failed\/probe-failed, zai skipped\/credential-missing\)/,
  );
});

test("finalizeStrictProbeResults passes when live probes were never requested, and never fails outside strict mode", () => {
  assert.doesNotThrow(() => finalizeStrictProbeResults([], true));
  assert.doesNotThrow(() =>
    finalizeStrictProbeResults([STRICT_FIXTURES.passed, STRICT_FIXTURES.notRequested], true),
  );
  assert.doesNotThrow(() =>
    finalizeStrictProbeResults([STRICT_FIXTURES.failed, STRICT_FIXTURES.unavailableRunner], false),
  );
});

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
