// The disposition model for the opt-in live review e2e (`pnpm run smoke:review`):
// which products and scenarios run, which model and credential each cell uses,
// and the skip/finalize lines for the ones that cannot. No I/O and no network so
// `test:scripts` can exercise every branch offline.

import { ENV } from "../env.mjs";

export const E2E_OPT_IN_ENV = "DIFFGAZER_LIVE_E2E";
export const E2E_PRODUCT_ENV = "DIFFGAZER_LIVE_E2E_PRODUCT";
export const E2E_MODEL_ENV = "DIFFGAZER_LIVE_E2E_MODEL";
export const E2E_SCENARIO_ENV = "DIFFGAZER_LIVE_E2E_SCENARIO";
export const E2E_SCENARIO_IDS = ["small", "medium", "large"];
export const DEFAULT_E2E_SCENARIO = "small";
export const DEFAULT_E2E_PRODUCT = "openrouter";
// A published free OpenRouter route proven to reach `completed` in the manual
// live sessions; override with DIFFGAZER_LIVE_E2E_MODEL when it rots.
export const DEFAULT_OPENROUTER_E2E_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
// Every id here is pinned by the offline snapshot test: a committed catalog
// snapshot row, priced or quota-billed (ollama-cloud's committed rows carry
// no cost), and structured-output-compatible with the product's dispatch mode.
// zai splits by scenario: the free glm-4.7-flash route is enough for one small
// call but is throttled on the multi-call scenarios, so medium and large run
// the priced glm-4.5-air (live round 2026-09-02).
export const DEFAULT_E2E_MODELS = {
  openrouter: {
    small: DEFAULT_OPENROUTER_E2E_MODEL,
    medium: "deepseek/deepseek-v4-flash-0731",
    large: "deepseek/deepseek-v4-flash-0731",
  },
  "opencode-zen": {
    small: "deepseek-v4-flash",
    medium: "deepseek-v4-flash",
    large: "deepseek-v4-flash",
  },
  zai: {
    small: "glm-4.7-flash",
    medium: "glm-4.5-air",
    large: "glm-4.5-air",
  },
  "ollama-cloud": {
    small: "deepseek-v4-flash:0731",
    medium: "deepseek-v4-flash:0731",
    large: "deepseek-v4-flash:0731",
  },
};

// Used only when the default model is refused with HTTP 402 (plan/entitlement):
// Ollama's Free plan serves starter models only; gpt-oss:20b completed a live
// small cell on this account (probe 2026-09-01). Pinned by the same snapshot
// test as the defaults.
export const FALLBACK_E2E_MODELS = {
  "ollama-cloud": "gpt-oss:20b",
};

function parseProductIds(raw) {
  const ids = (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)] : [DEFAULT_E2E_PRODUCT];
}

export function parseScenarioIds(raw) {
  const ids = (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)] : [DEFAULT_E2E_SCENARIO];
}

/** Per-cell model precedence: env pin, then the table, then the registry suggestion. */
export function resolveCellModel({ productId, scenarioId, modelOverride, suggestedModel }) {
  return modelOverride || DEFAULT_E2E_MODELS[productId]?.[scenarioId] || suggestedModel || null;
}

// The stream's terminal error object is `{message, code}` only
// (createDomainErrorSchema, libs/core/src/schemas/errors.ts:60) — no structured
// HTTP status field reaches the harness, which sees the stream event and not
// the adapter diagnostic — so the status is read out of the message.
const ENTITLEMENT_REFUSED_RE = /\bHTTP 402\b/;

/**
 * The one refusal that earns a second attempt on another model: the plan does
 * not entitle this account to the default model (HTTP 402), as opposed to a
 * rate limit, a bad credential, or a model the run itself chose. A user's
 * DIFFGAZER_LIVE_E2E_MODEL pin is exempt — their choice is not overridden — and
 * a cell already running its fallback never falls back again. Returns the
 * fallback model id, else null.
 */
export function entitlementFallback({ terminal, cell, modelOverride }) {
  if (terminal?.type !== "error" || terminal.error?.code !== "PROVIDER_REJECTED") return null;
  if (!ENTITLEMENT_REFUSED_RE.test(String(terminal.error.message ?? ""))) return null;
  if (modelOverride || cell.fallbackFrom) return null;
  const fallbackModelId = FALLBACK_E2E_MODELS[cell.productId];
  return fallbackModelId && fallbackModelId !== cell.modelId ? fallbackModelId : null;
}

/**
 * Lenient lookup over the user's real `~/.diffgazer` documents. On-disk shape
 * (cli/server/src/shared/lib/config/secret-bindings.ts:19-59): every binding in
 * secrets.json carries `{configurationId, revision, status}` plus its kind
 * discriminant — `environment-reference{varName}`, `keyring-reference{keyId}`,
 * `file-0600{filePath}`, `optional-local-bearer{storage, reference}`, `none`;
 * `status` defaults to `"active"`. Returns a mechanism descriptor only — never
 * a secret value. Prefers the configuration matching `selectedConfigurationId`,
 * else the first for the product with an active binding.
 */
export function findActiveLocalBinding({ configDoc, secretsDoc, productId }) {
  const configurations = (
    Array.isArray(configDoc?.configurations) ? configDoc.configurations : []
  ).filter((configuration) => configuration?.productId === productId);
  const selectedId = configDoc?.selectedConfigurationId;
  const ordered = [
    ...configurations.filter((configuration) => configuration.configurationId === selectedId),
    ...configurations.filter((configuration) => configuration.configurationId !== selectedId),
  ];
  const bindings = Array.isArray(secretsDoc?.bindings) ? secretsDoc.bindings : [];
  for (const configuration of ordered) {
    const binding = bindings.find(
      (candidate) =>
        candidate?.configurationId === configuration.configurationId &&
        (candidate.status ?? "active") === "active",
    );
    if (!binding) continue;
    if (binding.kind === "file-0600") {
      return { kind: "local-file", filePath: binding.filePath };
    }
    if (binding.kind === "environment-reference") {
      return { kind: "local-env", varName: binding.varName };
    }
    return { kind: "unsupported", bindingKind: binding.kind ?? "none" };
  }
  return null;
}

/**
 * REQ-009 sourcing order: the product's env var when set, else the supported
 * local binding. Unattended-unreadable bindings (keyring) and unset local-env
 * vars resolve to a reasoned unavailable — never a hang, never a value.
 */
export function resolveCredentialSource({ env, credentialEnv, localBinding }) {
  if (env[credentialEnv]) {
    return { source: "env" };
  }
  if (localBinding?.kind === "local-file") {
    return { source: "local-file", filePath: localBinding.filePath };
  }
  if (localBinding?.kind === "local-env" && env[localBinding.varName]) {
    return { source: "local-env", varName: localBinding.varName };
  }
  if (localBinding?.kind === "unsupported") {
    return {
      source: "none",
      reason: "credential-keyring-only",
      bindingKind: localBinding.bindingKind,
    };
  }
  return { source: "none", reason: "credential-missing" };
}

function resolveProduct({
  productId,
  modelOverride,
  env,
  credentialEnvFor,
  suggestedModelFor,
  localBindingFor,
}) {
  const credentialEnv = credentialEnvFor(productId);
  if (!credentialEnv) {
    return { kind: "unavailable", reason: "unknown-product", productId };
  }
  const modelId = resolveCellModel({
    productId,
    scenarioId: DEFAULT_E2E_SCENARIO,
    modelOverride,
    suggestedModel: suggestedModelFor(productId),
  });
  if (!modelId) {
    return { kind: "unavailable", reason: "model-unresolved", productId, credentialEnv };
  }
  const source = resolveCredentialSource({
    env,
    credentialEnv,
    localBinding: localBindingFor(productId),
  });
  if (source.reason === "credential-keyring-only") {
    return {
      kind: "unavailable",
      reason: "credential-keyring-only",
      productId,
      credentialEnv,
      bindingKind: source.bindingKind,
    };
  }
  if (source.reason) {
    return { kind: "unavailable", reason: "credential-missing", productId, credentialEnv };
  }
  return { kind: "run", productId, modelId, credentialEnv };
}

/**
 * Why the e2e did or did not run, one disposition per requested product —
 * DIFFGAZER_LIVE_E2E_PRODUCT takes a comma list, so a single invocation can
 * walk a provider matrix. A gate that blocks every product (opt-in, network,
 * dists) collapses to one entry. `not-requested` (opt-in or network absent) is
 * never a strict failure; `unavailable` (requested but a prerequisite is
 * missing) fails under DIFFGAZER_SMOKE_STRICT_SKIPS=1 — the smoke-modelsdev
 * disposition model. DIFFGAZER_LIVE_E2E_MODEL pins a model for a single
 * requested product only: a model id belongs to one provider, so a matrix
 * ignores it and each product resolves its table default, else its suggested
 * model.
 */
export function resolveE2eDispositions({
  env,
  networkEnabled,
  credentialEnvFor,
  suggestedModelFor,
  hasCoreDist,
  coreDistError = null,
  hasServerDist,
  localBindingFor = () => null,
}) {
  if (env[E2E_OPT_IN_ENV] !== "1") {
    return [{ kind: "not-requested", reason: "live-e2e-disabled" }];
  }
  if (!networkEnabled) {
    return [{ kind: "not-requested", reason: "network-disabled" }];
  }
  if (!hasCoreDist) {
    return [{ kind: "unavailable", reason: "core-dist-missing", coreDistError }];
  }
  if (!hasServerDist) {
    return [{ kind: "unavailable", reason: "server-dist-missing" }];
  }
  const productIds = parseProductIds(env[E2E_PRODUCT_ENV]);
  const modelOverride = singleProductModelOverride({ env });
  return productIds.map((productId) =>
    resolveProduct({
      productId,
      modelOverride,
      env,
      credentialEnvFor,
      suggestedModelFor,
      localBindingFor,
    }),
  );
}

/**
 * The single-product-only pin rule, stated once: DIFFGAZER_LIVE_E2E_MODEL pins
 * a model only when the invocation requested exactly one product — a model id
 * belongs to one provider, so a matrix ignores it. `resolveE2eDispositions`
 * and the harness's `expandScenarioCells` wiring both derive from this.
 */
export function singleProductModelOverride({ env }) {
  return parseProductIds(env[E2E_PRODUCT_ENV]).length === 1 ? (env[E2E_MODEL_ENV] ?? null) : null;
}

/**
 * One cell per `kind: "run"` product × requested scenario, in `E2E_SCENARIO_IDS`
 * order (small, medium, large) within a product; non-run dispositions pass
 * through unexpanded. The per-cell model supersedes the product-level
 * (small-scenario) value, and each cell carries its credential-source
 * descriptor for the harness to read at dispatch time.
 */
export function expandScenarioCells({
  dispositions,
  scenarioIds,
  modelOverride,
  suggestedModelFor,
  env,
  localBindingFor,
}) {
  const rank = (scenarioId) => {
    const index = E2E_SCENARIO_IDS.indexOf(scenarioId);
    return index === -1 ? E2E_SCENARIO_IDS.length : index;
  };
  const orderedScenarioIds = [...scenarioIds].sort((a, b) => rank(a) - rank(b));
  const cells = [];
  for (const disposition of dispositions) {
    if (disposition.kind !== "run") {
      cells.push(disposition);
      continue;
    }
    const { productId, credentialEnv } = disposition;
    for (const scenarioId of orderedScenarioIds) {
      if (!E2E_SCENARIO_IDS.includes(scenarioId)) {
        cells.push({
          kind: "unavailable",
          reason: "unknown-scenario",
          scenarioId,
          scenarioIds: orderedScenarioIds,
          productId,
          credentialEnv,
        });
        continue;
      }
      const modelId = resolveCellModel({
        productId,
        scenarioId,
        modelOverride,
        suggestedModel: suggestedModelFor(productId),
      });
      if (!modelId) {
        cells.push({
          kind: "unavailable",
          reason: "model-unresolved",
          productId,
          scenarioId,
          scenarioIds: orderedScenarioIds,
          credentialEnv,
        });
        continue;
      }
      cells.push({
        kind: "run",
        productId,
        scenarioId,
        modelId,
        credentialEnv,
        credentialSource: resolveCredentialSource({
          env,
          credentialEnv,
          localBinding: localBindingFor(productId),
        }),
      });
    }
  }
  return cells;
}

/** The one-line notice for a model pin that a multi-product matrix ignores. */
export function modelOverrideNotice(env) {
  if (env[E2E_OPT_IN_ENV] !== "1" || !env[E2E_MODEL_ENV]) return null;
  if (parseProductIds(env[E2E_PRODUCT_ENV]).length < 2) return null;
  return `NOTE: ${E2E_MODEL_ENV} ignored for a multi-product matrix; each product uses its table default, falling back to its suggested model.`;
}

function e2eCommand({ credentialEnv = "OPENROUTER_API_KEY", productId, scenarioIds } = {}) {
  const product =
    productId && productId !== DEFAULT_E2E_PRODUCT ? `${E2E_PRODUCT_ENV}=${productId} ` : "";
  const scenario =
    scenarioIds && scenarioIds.join(",") !== DEFAULT_E2E_SCENARIO
      ? `${E2E_SCENARIO_ENV}=${scenarioIds.join(",")} `
      : "";
  return `${ENV.smokeAllowNetwork}=1 ${E2E_OPT_IN_ENV}=1 ${product}${scenario}${credentialEnv}=... pnpm run smoke:review`;
}

const SKIP_DETAILS = {
  "live-e2e-disabled": () => `${E2E_OPT_IN_ENV} not set`,
  "network-disabled": () => `${ENV.smokeAllowNetwork} not set`,
  "core-dist-missing": (disposition) =>
    `libs/core dist not importable${disposition.coreDistError ? ` (${disposition.coreDistError})` : ""}; run \`turbo run build --filter=@diffgazer/core\``,
  "server-dist-missing": () =>
    "cli/server dist not built; run `turbo run build --filter=@diffgazer/server`",
  "unknown-product": (disposition) => `unknown product '${disposition.productId}'`,
  "model-unresolved": (disposition) =>
    `no model for '${disposition.productId}'; set ${E2E_MODEL_ENV}`,
  "credential-missing": (disposition) =>
    `set ${disposition.credentialEnv} or configure ${disposition.productId} in ~/.diffgazer`,
  "credential-keyring-only": (disposition) =>
    `local binding kind '${disposition.bindingKind}' cannot be read unattended; set ${disposition.credentialEnv} instead`,
  "unknown-scenario": (disposition) =>
    `unknown scenario '${disposition.scenarioId}'; valid: ${E2E_SCENARIO_IDS.join(", ")}`,
};

export function skipLine(disposition) {
  const detail = SKIP_DETAILS[disposition.reason](disposition);
  return `SKIP: live review e2e (${disposition.reason}: ${detail}). Run: ${e2eCommand(disposition)}`;
}

/** A product whose harness threw: reported, counted, and the matrix continues. */
export function runFailureLine(productId, message) {
  return `FAIL: live review e2e (${productId}) — ${message}`;
}

export function finalizeE2eDispositions(dispositions, strictSkips) {
  if (!strictSkips) return;
  const blocked = dispositions.find((disposition) => disposition.kind === "unavailable");
  if (!blocked) return;
  throw new Error(
    `strict skips: live review e2e was requested but is unavailable ` +
      `(${blocked.reason}). ${SKIP_DETAILS[blocked.reason](blocked)}`,
  );
}
