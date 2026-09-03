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
// Mirrors libs/core REVIEW_WALL_TIME_CAP.min: the engine never accepts a
// review wall below one dispatch wall's floor.
export const REVIEW_WALL_TIME_CAP_MIN_MS = 60_000;
// Room for the terminal event and persistence to land before the harness
// watchdog cancels the session.
export const REVIEW_WALL_CAP_MARGIN_MS = 30_000;
// 2026-09-03: the flash set (owner decision). qwen3.8-flash / glm-5.3-flash are
// served by Zen only on the Go endpoint (401 "not supported" on /zen/v1);
// deepseek-v4-flash stalls pre-headers unless the wire sends its reasoning
// control (profiles.ts REASONING_EFFORT_OVERRIDES). One primary per product; the
// other set members are an ordered fallback walked only when a member is down
// (402, 401/404, 429, 400, 5xx, timed-out — see downClass). Every id here is
// pinned by the offline snapshot test against the bound pool's models.dev source.
export const DEFAULT_E2E_MODELS = {
  openrouter: {
    small: "qwen/qwen3.8-flash",
    medium: "qwen/qwen3.8-flash",
    large: "qwen/qwen3.8-flash",
  },
  "opencode-zen": {
    small: "qwen3.8-flash",
    medium: "qwen3.8-flash",
    large: "qwen3.8-flash",
  },
  zai: {
    small: "glm-5.3-flash",
    medium: "glm-5.3-flash",
    large: "glm-5.3-flash",
  },
  "ollama-cloud": {
    small: "glm-5.3-flash",
    medium: "glm-5.3-flash",
    large: "glm-5.3-flash",
  },
};

// Ordered: cheapest flash first, DeepSeek 0731 last, gpt-oss:20b as the Ollama
// Free-plan terminal. Z.AI serves neither Qwen nor DeepSeek, so its chain ends on
// the priced incumbent glm-4.5-air — outside the flash set, green in every
// 2026-09-02 live round (owner ruling C2).
export const FALLBACK_E2E_MODELS = {
  openrouter: ["z-ai/glm-5.3-flash", "deepseek/deepseek-v4-flash-0731"],
  "opencode-zen": ["glm-5.3-flash", "deepseek-v4-flash"],
  zai: ["glm-4.5-air"],
  "ollama-cloud": ["deepseek-v4-flash:0731", "gpt-oss:20b"],
};

// The endpoint profile a product's cells bind; absent = the registry's
// endpoints[0]. opencode-zen: qwen3.8-flash / glm-5.3-flash are served only by
// the Go pool (HTTP 401 "not supported" on /zen/v1, probed 2026-09-03).
export const E2E_ENDPOINT_PROFILES = { "opencode-zen": "go" };

/** The registry endpoint profile a cell binds; a declared profile the registry lacks is a wiring error. */
export function resolveCellEndpoint(endpoints, productId) {
  const profileId = E2E_ENDPOINT_PROFILES[productId];
  if (profileId === undefined) return endpoints[0];
  const profile = endpoints.find((candidate) => candidate.id === profileId);
  if (!profile) {
    throw new Error(`${productId}: endpoint profile '${profileId}' is not in the registry`);
  }
  return profile;
}

function parseProductIds(raw) {
  const ids = (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)] : [DEFAULT_E2E_PRODUCT];
}

/** The review wall cap sent per cell so the engine ends honestly before the watchdog fires. */
export function reviewWallCapMs(watchdogMs) {
  return Math.max(REVIEW_WALL_TIME_CAP_MIN_MS, watchdogMs - REVIEW_WALL_CAP_MARGIN_MS);
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
// the adapter diagnostic — so every down class reads the status out of the message.

// The engine's own timeout copy, verbatim from execute.ts (wall, headers budget,
// answer-idle budget, client timeout) and generate.ts (review clock).
const TIMED_OUT_RE =
  /wall-time limit|sent no response headers for \d+s|keep-alive whitespace for \d+s|HTTP client's own response timeout|Review wall-clock budget exhausted/;

// "Down" = the provider cannot serve this model right now; in evaluation order.
const DOWN_CLASSES = [
  [
    "entitlement",
    ({ code, message }) => code === "PROVIDER_REJECTED" && /\bHTTP 402\b/.test(message),
  ],
  [
    "not-supported",
    ({ code, message }) => code === "PROVIDER_REJECTED" && /\bHTTP (401|404)\b/.test(message),
  ],
  ["capacity", ({ code, message }) => code === "PROVIDER_REJECTED" && /\bHTTP 429\b/.test(message)],
  ["model-unavailable", ({ message }) => /\bHTTP 400\b/.test(message)],
  ["outage", ({ message }) => /\bHTTP 5\d\d\b/.test(message)],
  ["timed-out", ({ message }) => TIMED_OUT_RE.test(message)],
];

/** The class that makes this attempt's model "down", else null (the verdict stands). */
export function downClass({ terminal, timedOut }) {
  if (timedOut) return "timed-out";
  if (terminal?.type !== "error") return null;
  const seen = { code: terminal.error?.code, message: String(terminal.error?.message ?? "") };
  const match = DOWN_CLASSES.find(([, isClass]) => isClass(seen));
  return match ? match[0] : null;
}

/**
 * The next chain member to run, with why, or null when the verdict stands: a
 * user's pin is never overridden, a not-down failure is never re-run, a
 * timed-out attempt hops once (never from a fallback), and the last member
 * fails honestly. The excerpt is the server-scrubbed message, nothing more.
 */
export function fallbackAfter({ terminal, timedOut, cell, modelOverride }) {
  if (modelOverride) return null;
  const reason = downClass({ terminal, timedOut });
  if (reason === null) return null;
  if (reason === "timed-out" && cell.fallbackFrom) return null;
  const chain = FALLBACK_E2E_MODELS[cell.productId] ?? [];
  const next = chain[chain.indexOf(cell.modelId) + 1];
  if (!next) return null;
  const excerpt = timedOut
    ? "harness watchdog fired"
    : String(terminal.error.message ?? "").slice(0, 120);
  return { modelId: next, downClass: reason, excerpt };
}

/** `WARN:` so labelCellLines labels it; grep-distinguishable from every other WARN. */
export function fallbackWarnLine(cell, fallback) {
  return `WARN: live review e2e — ${cell.modelId} is down (${fallback.downClass}: ${fallback.excerpt}); retrying the cell on fallback ${fallback.modelId}`;
}

/** The cell header the harness prints: model, endpoint profile, and chain position on a fallback. */
export function cellHeaderLine(cell, profileId) {
  const head = `${cell.productId}/${cell.modelId} @ ${profileId}`;
  if (!cell.fallbackFrom) return head;
  const chain = FALLBACK_E2E_MODELS[cell.productId] ?? [];
  const walk = [...cell.fallbackFrom, cell.modelId].join(" → ");
  return `${head} (fallback ${chain.indexOf(cell.modelId) + 1} of ${chain.length} after ${walk})`;
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
