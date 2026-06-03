#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ENV } from "./artifacts/env.mjs";
import { networkAllowed } from "./smoke-shared.mjs";
import {
  assertCatalogProviders,
  enabledSnapshotProviders,
  findSnapshotInBundle,
} from "./artifacts/smoke-modelsdev.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LABEL = "live models.dev catalog";
const DIFFGAZER_DIST = resolve(root, "cli/diffgazer/dist");

// design D6: the diffgazer binary is tsup-bundled with `noExternal`, so the
// CATALOG_SNAPSHOT must be INLINED into the emitted bundle (not loaded from a
// runtime fs json). A known snapshot model id proves the snapshot rode along;
// its absence is the opencode #4959 "blank first-run picker" regression.
function assertSnapshotInlinedInBundle(snapshotMarker) {
  if (!existsSync(DIFFGAZER_DIST)) {
    const message =
      `diffgazer bundle not built at ${DIFFGAZER_DIST}; cannot verify the snapshot is `
      + `inlined. Run \`pnpm --filter diffgazer build\` first`;
    if (process.env[ENV.smokeStrictSkips] === "1") {
      throw new Error(`${message} (or unset ${ENV.smokeStrictSkips}).`);
    }
    console.log(`SKIP: snapshot tsup-inlining check (${message}; set ${ENV.smokeStrictSkips}=1 to fail).`);
    return;
  }

  const bundleFiles = readdirSync(DIFFGAZER_DIST)
    .filter((name) => name.endsWith(".js"))
    .map((name) => resolve(DIFFGAZER_DIST, name));
  const match = findSnapshotInBundle(bundleFiles, (path) => readFileSync(path, "utf8"), snapshotMarker);
  if (!match) {
    throw new Error(
      `diffgazer bundle does not inline CATALOG_SNAPSHOT: '${snapshotMarker}' not found in `
      + `${DIFFGAZER_DIST}. A blank first-run picker would ship. Check tsup noExternal for @diffgazer/core.`,
    );
  }
  console.log(`OK: CATALOG_SNAPSHOT inlined in diffgazer bundle (found '${snapshotMarker}')`);
}

async function run() {
  const { catalogToModelInfo, CATALOG_SNAPSHOT, parseModelsDevCatalog, PROVIDER_OVERLAY } = await import(
    resolve(root, "libs/core/dist/catalog/index.js")
  );

  const enabledProviders = enabledSnapshotProviders(PROVIDER_OVERLAY);

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

  assertSnapshotInlinedInBundle(PROVIDER_OVERLAY.cerebras.defaultModel);

  if (!networkAllowed()) {
    console.log(`OK: ${LABEL} offline snapshot smoke passed`);
    return;
  }

  const response = await fetch("https://models.dev/api.json", {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${LABEL}: HTTP ${response.status}`);
  const catalog = parseModelsDevCatalog(await response.json());

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
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
