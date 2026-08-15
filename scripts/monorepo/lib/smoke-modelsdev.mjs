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
 * never drift from the roster, and auto-extends when a provider is added.
 * OpenRouter is excluded — it resolves through its own live key-gated path.
 */
export function enabledSnapshotProviders(overlay) {
  return Object.keys(overlay).filter((id) => id !== "openrouter");
}

export const PROVIDER_PROBE_REASONS = [
  "none",
  "network-disabled",
  "credential-missing",
  "entitlement-missing",
  "live-opt-in-missing",
  "runner-unavailable",
  "probe-failed",
];

/**
 * Probe dispositions are typed by WHY a probe did or did not run, because strict
 * mode treats the two non-ready kinds differently:
 *
 * - `not-requested` — the run never asked for live probes (no network, or the
 *   opt-in env is unset). Emitting `skipped` is the truthful REQ-089 record and
 *   is not a strict failure; the offline release smoke is expected to report it.
 * - `unavailable` — live probing WAS requested but a prerequisite is absent
 *   (credential, entitlement, or a probe runner that was never built). Strict
 *   mode fails on these: the operator asked for evidence and got none.
 */
const NOT_REQUESTED_REASONS = new Set(["network-disabled", "live-opt-in-missing"]);

export const LIVE_PROBE_OPT_IN_ENV = "DIFFGAZER_LIVE_PROBES";

function requireCredentialEnvironmentVariable(productId, credentialEnvVars) {
  const credentialEnv = credentialEnvVars[productId];
  if (!credentialEnv) {
    throw new Error(`No credential environment variable mapped for hosted product '${productId}'`);
  }
  return credentialEnv;
}

export function buildHostedProbeTuples(productRegistry, credentialEnvVars) {
  return Object.values(productRegistry)
    .filter((product) => product.transportFamily === "hosted-api")
    .map((product) => {
      const modelPolicy = product.modelPolicy;
      const modelId =
        "suggestedModelId" in modelPolicy && modelPolicy.suggestedModelId
          ? modelPolicy.suggestedModelId
          : null;
      return {
        providerId: product.id,
        credentialEnv: requireCredentialEnvironmentVariable(product.id, credentialEnvVars),
        modelId,
        // Only qwen gates its probe behind a workspace entitlement, so only qwen
        // carries the env name; a tuple without these fields needs no entitlement.
        ...(product.id === "qwen"
          ? { requiresEntitlement: true, entitlementEnv: "QWEN_WORKSPACE_ID" }
          : {}),
      };
    });
}

export function formatProviderProbeLine({ providerId, modelId, status, reason, checkedAt }) {
  return (
    `{"type":"provider-probe","providerId":${JSON.stringify(providerId)},` +
    `"modelId":${JSON.stringify(modelId)},` +
    `"status":${JSON.stringify(status)},` +
    `"reason":${JSON.stringify(reason)},` +
    `"checkedAt":${JSON.stringify(checkedAt)}}`
  );
}

export function probeDispositionKind(reason) {
  return NOT_REQUESTED_REASONS.has(reason) ? "not-requested" : "unavailable";
}

export function resolveLiveProbeDisposition(tuple, env, networkEnabled) {
  if (!networkEnabled) {
    return { kind: "not-requested", reason: "network-disabled" };
  }
  if (env[LIVE_PROBE_OPT_IN_ENV] !== "1") {
    return { kind: "not-requested", reason: "live-opt-in-missing" };
  }
  if (!env[tuple.credentialEnv]) {
    return { kind: "unavailable", reason: "credential-missing" };
  }
  if (tuple.requiresEntitlement && !env[tuple.entitlementEnv]) {
    return { kind: "unavailable", reason: "entitlement-missing" };
  }
  return { kind: "ready", reason: "none" };
}

/**
 * `runProbe` returns the completed verdict (`{ passed }`) or, when the probe
 * could not run at all, `{ unavailable: <reason> }` — a missing prerequisite is
 * a skip, never a negative verdict (REQ-089).
 */
function resolveProbeOutcome(result) {
  if (result.unavailable) {
    return { status: "skipped", reason: result.unavailable };
  }
  return result.passed
    ? { status: "passed", reason: "none" }
    : { status: "failed", reason: "probe-failed" };
}

export async function emitProviderProbeResults(tuples, options) {
  const checkedAt = options.checkedAt ?? new Date().toISOString();
  const lines = [];
  const results = [];

  for (const tuple of tuples) {
    const disposition = resolveLiveProbeDisposition(tuple, options.env, options.networkEnabled);
    const outcome =
      disposition.kind === "ready"
        ? resolveProbeOutcome(await options.runProbe(tuple))
        : { status: "skipped", reason: disposition.reason };

    const line = formatProviderProbeLine({
      providerId: tuple.providerId,
      modelId: tuple.modelId,
      status: outcome.status,
      reason: outcome.reason,
      checkedAt,
    });
    lines.push(line);
    results.push({ tuple, status: outcome.status, reason: outcome.reason });
    options.emit?.(line);
  }

  return { lines, results, checkedAt };
}

/**
 * Strict mode fails on every emitted result that is not a pass, except skips
 * whose reason means live probing was never requested for this run.
 */
export function collectStrictProbeViolations(results) {
  return results.filter(
    ({ status, reason }) =>
      status === "failed" ||
      (status === "skipped" && probeDispositionKind(reason) === "unavailable"),
  );
}

export function finalizeStrictProbeResults(results, strictSkips) {
  if (!strictSkips) return;
  const violations = collectStrictProbeViolations(results);
  if (violations.length === 0) return;
  const detail = violations
    .map(({ tuple, status, reason }) => `${tuple.providerId} ${status}/${reason}`)
    .join(", ");
  throw new Error(
    `strict probes: ${violations.length} provider probe(s) did not pass after emission (${detail})`,
  );
}

const RELATIVE_BUNDLE_IMPORT_RE = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)(["'])(\.\/[^"']+\.js)\1/g;

export function collectReachableBundleFiles(entryFile, readFile, resolveImport) {
  const files = [];
  const seen = new Set();
  const pending = [entryFile];

  for (let index = 0; index < pending.length; index++) {
    const file = pending[index];
    if (seen.has(file)) continue;
    seen.add(file);
    files.push(file);

    for (const match of readFile(file).matchAll(RELATIVE_BUNDLE_IMPORT_RE)) {
      pending.push(resolveImport(file, match[2]));
    }
  }

  return files;
}

/**
 * Return the first bundle file whose contents inline every snapshot marker, or
 * null if none do. Reads via the injected `readFile` so the scan is unit-testable
 * without a real tsup build.
 */
export function findSnapshotInBundle(files, readFile, markers) {
  return (
    files.find((path) => {
      const source = readFile(path);
      return markers.every((marker) => source.includes(marker));
    }) ?? null
  );
}
