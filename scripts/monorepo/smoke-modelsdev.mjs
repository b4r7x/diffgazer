#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENV } from "./lib/env.mjs";
import { errorMessage } from "./lib/error-message.mjs";
import {
  assertCatalogProviders,
  buildHostedProbeTuples,
  collectReachableBundleFiles,
  emitProviderProbeResults,
  finalizeStrictProbeResults,
  findSnapshotInBundle,
  LIVE_PROBE_OPT_IN_ENV,
} from "./lib/smoke-modelsdev.mjs";
import { fetchJsonWithLimit, networkAllowed } from "./smoke-shared/network.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LABEL = "live models.dev catalog";
const DIFFGAZER_DIST = resolve(root, "cli/diffgazer/dist");
const DIFFGAZER_ENTRY = resolve(DIFFGAZER_DIST, "index.js");
const MAX_LIVE_CATALOG_BYTES = 4 * 1024 * 1024;

async function loadHostedLiveProbeRunner() {
  try {
    const hostedFixtures = await import(
      resolve(root, "cli/server/dist/shared/lib/ai/providers/hosted/fixtures.js")
    );
    return hostedFixtures.runHostedLiveProbe;
  } catch {
    return null;
  }
}

// design D6: the diffgazer binary is tsup-bundled with `noExternal`, so the
// CATALOG_SNAPSHOT must be INLINED into the emitted bundle (not loaded from a
// runtime fs json). The evidence is a model id/name pair derived from the
// snapshot and absent from the separately bundled overlays.
function assertSnapshotInlinedInBundle(evidence, assertEvidence) {
  if (!existsSync(DIFFGAZER_ENTRY)) {
    const message =
      `diffgazer bundle not built at ${DIFFGAZER_DIST}; cannot verify the snapshot is ` +
      `inlined. Run \`pnpm --filter diffgazer build\` first`;
    if (process.env[ENV.smokeStrictSkips] === "1") {
      throw new Error(`${message} (or unset ${ENV.smokeStrictSkips}).`);
    }
    console.log(
      `SKIP: snapshot tsup-inlining check (${message}; set ${ENV.smokeStrictSkips}=1 to fail).`,
    );
    return;
  }

  const readBundle = (path) => readFileSync(path, "utf8");
  const bundleFiles = collectReachableBundleFiles(DIFFGAZER_ENTRY, readBundle, (file, specifier) =>
    resolve(dirname(file), specifier),
  );
  assertEvidence(bundleFiles.map(readBundle).join("\n"), evidence);

  const match = findSnapshotInBundle(bundleFiles, readBundle, evidence);
  const location = match ?? "across emitted chunks";
  console.log(
    `OK: CATALOG_SNAPSHOT inlined in diffgazer bundle (${evidence.join(" + ")} in ${location})`,
  );
}

async function run() {
  const {
    CATALOG_SNAPSHOT,
    parseModelsDevCatalog,
    PROVIDER_DERIVED,
    PROVIDER_OVERLAY,
    transformCatalogObservation,
  } = await import(resolve(root, "libs/core/dist/catalog/index.js"));
  const { assertCatalogSnapshotBundleEvidence, getCatalogSnapshotBundleEvidence } = await import(
    resolve(root, "libs/core/dist/testing/catalog-bundle-evidence.js")
  );
  const { CREDENTIAL_ENV_VARS, PRODUCT_REGISTRY } = await import(
    resolve(root, "libs/core/dist/providers/index.js")
  );

  const catalogToModelInfo = (catalog, productId) => {
    const observation = transformCatalogObservation({
      source: "models.dev-snapshot",
      checkedAt: "2020-01-01T00:00:00.000Z",
      catalog,
    }).find((entry) => entry.productId === productId);
    return observation?.models ?? [];
  };

  // Every overlay product's offline picker is served from the bundled snapshot;
  // deriving the roster from PROVIDER_OVERLAY keeps the smoke from drifting.
  const enabledProviders = Object.keys(PROVIDER_OVERLAY);
  const probeTuples = buildHostedProbeTuples(PRODUCT_REGISTRY, CREDENTIAL_ENV_VARS);
  const strictSkips = process.env[ENV.smokeStrictSkips] === "1";
  const runHostedLiveProbe =
    networkAllowed() && process.env[LIVE_PROBE_OPT_IN_ENV] === "1"
      ? await loadHostedLiveProbeRunner()
      : null;

  // The bundled snapshot is the always-available offline guarantee (design D6:
  // the picker must never be blank on first run/offline). Validate it on every
  // run so a bad snapshot regenerate is caught even without network.
  for (const line of assertCatalogProviders(
    CATALOG_SNAPSHOT,
    enabledProviders,
    catalogToModelInfo,
    "bundled snapshot",
  )) {
    console.log(line);
  }

  const snapshotEvidence = getCatalogSnapshotBundleEvidence(CATALOG_SNAPSHOT, [
    { PROVIDER_OVERLAY, PROVIDER_DERIVED, PRODUCT_REGISTRY },
  ]);
  assertSnapshotInlinedInBundle(snapshotEvidence, assertCatalogSnapshotBundleEvidence);

  const { results } = await emitProviderProbeResults(probeTuples, {
    env: process.env,
    networkEnabled: networkAllowed(),
    emit: (line) => console.log(line),
    runProbe: async (tuple) => {
      if (!runHostedLiveProbe) {
        // The probe runner lives in the cli/server build; an unbuilt dist is an
        // absent prerequisite, not a provider that failed its probe.
        return { unavailable: "runner-unavailable" };
      }
      const descriptor = {
        productId: tuple.providerId,
        credentialEnv: tuple.credentialEnv,
        modelId: tuple.modelId,
        requiresEntitlement: tuple.requiresEntitlement,
        workspaceAccountId: process.env.QWEN_WORKSPACE_ID ?? null,
      };
      const observation = await runHostedLiveProbe(descriptor);
      return { passed: observation.status === "passed" };
    },
  });
  finalizeStrictProbeResults(results, strictSkips);

  if (!networkAllowed()) {
    console.log(`OK: ${LABEL} offline snapshot smoke passed`);
    return;
  }

  const liveCatalog = await fetchJsonWithLimit("https://models.dev/api.json", {
    label: LABEL,
    maxBytes: MAX_LIVE_CATALOG_BYTES,
    signal: AbortSignal.timeout(15_000),
  });
  const catalog = parseModelsDevCatalog(liveCatalog);

  for (const line of assertCatalogProviders(
    catalog,
    enabledProviders,
    catalogToModelInfo,
    "live models.dev",
  )) {
    console.log(line);
  }
  console.log(`OK: ${LABEL} smoke passed`);
}

run().catch((error) => {
  console.error(errorMessage(error));
  process.exit(1);
});
