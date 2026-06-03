/**
 * A provider that resolves to zero models would render a blank picker (the
 * design D6 "never a blank picker" guarantee), so it is the smoke's hard
 * failure. `resolve` is the `(catalog, provider) -> models[]` transform,
 * injected so the offline snapshot and the live models.dev response run through
 * identical assertions, with the failure attributed to the active `source`.
 */
export function assertCatalogProviders(catalog, providers, resolve, source) {
  return providers.map((provider) => {
    const models = resolve(catalog, provider);
    if (models.length === 0) {
      throw new Error(`${source}: provider '${provider}' resolved to zero models`);
    }
    return `OK: ${provider} -> ${models.length} models (${source})`;
  });
}

/**
 * The snapshot-backed enabled roster: providers whose offline picker is served
 * from the bundled CATALOG_SNAPSHOT. Derived from PROVIDER_OVERLAY so it can
 * never drift from the roster, and auto-extends when a provider is enabled.
 * OpenRouter is excluded — it resolves through its own live key-gated path.
 */
export function enabledSnapshotProviders(overlay) {
  return Object.entries(overlay)
    .filter(([, o]) => o.enabled && o.sdkKind !== "openrouter")
    .map(([id]) => id);
}

/**
 * Return the first bundle file whose contents inline `marker`, or null if none
 * do. Reads via the injected `readFile` so the scan is unit-testable without a
 * real tsup build.
 */
export function findSnapshotInBundle(files, readFile, marker) {
  return files.find((path) => readFile(path).includes(marker)) ?? null;
}
