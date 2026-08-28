// Pure logic for the opt-in live review e2e (`pnpm run smoke:review`): the
// disposition model, the SSE frame parser, and the verdict rules. No I/O and no
// network so `test:scripts` can exercise every branch offline.

import { ENV } from "./env.mjs";

export const E2E_OPT_IN_ENV = "DIFFGAZER_LIVE_E2E";
export const E2E_PRODUCT_ENV = "DIFFGAZER_LIVE_E2E_PRODUCT";
export const E2E_MODEL_ENV = "DIFFGAZER_LIVE_E2E_MODEL";
export const DEFAULT_E2E_PRODUCT = "openrouter";
// A published free OpenRouter route proven to reach `completed` in the manual
// live sessions; override with DIFFGAZER_LIVE_E2E_MODEL when it rots.
export const DEFAULT_OPENROUTER_E2E_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
// Live evidence: a full 5-lens review took 3m21s-16m30s on free routes; one
// lens fits this cap with margin.
export const HARD_TIMEOUT_MS = 600_000;
export const E2E_LENS = "correctness";

function parseProductIds(raw) {
  const ids = (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)] : [DEFAULT_E2E_PRODUCT];
}

function resolveProduct({ productId, modelOverride, env, credentialEnvFor, suggestedModelFor }) {
  const credentialEnv = credentialEnvFor(productId);
  if (!credentialEnv) {
    return { kind: "unavailable", reason: "unknown-product", productId };
  }
  const modelId =
    modelOverride ||
    suggestedModelFor(productId) ||
    (productId === DEFAULT_E2E_PRODUCT ? DEFAULT_OPENROUTER_E2E_MODEL : null);
  if (!modelId) {
    return { kind: "unavailable", reason: "model-unresolved", productId, credentialEnv };
  }
  if (!env[credentialEnv]) {
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
 * ignores it and each product falls back to its suggested model.
 */
export function resolveE2eDispositions({
  env,
  networkEnabled,
  credentialEnvFor,
  suggestedModelFor,
  hasCoreDist,
  coreDistError = null,
  hasServerDist,
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
  const modelOverride = productIds.length === 1 ? env[E2E_MODEL_ENV] : null;
  return productIds.map((productId) =>
    resolveProduct({ productId, modelOverride, env, credentialEnvFor, suggestedModelFor }),
  );
}

/** The one-line notice for a model pin that a multi-product matrix ignores. */
export function modelOverrideNotice(env) {
  if (env[E2E_OPT_IN_ENV] !== "1" || !env[E2E_MODEL_ENV]) return null;
  if (parseProductIds(env[E2E_PRODUCT_ENV]).length < 2) return null;
  return `NOTE: ${E2E_MODEL_ENV} ignored for a multi-product matrix; each product uses its suggested model.`;
}

export function e2eCommand({ credentialEnv = "OPENROUTER_API_KEY", productId } = {}) {
  const product =
    productId && productId !== DEFAULT_E2E_PRODUCT ? `${E2E_PRODUCT_ENV}=${productId} ` : "";
  return `${ENV.smokeAllowNetwork}=1 ${E2E_OPT_IN_ENV}=1 ${product}${credentialEnv}=... pnpm run smoke:review`;
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
  "credential-missing": (disposition) => `set ${disposition.credentialEnv}`,
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

/**
 * Incremental server-sent-events parser: feed raw chunks, get completed
 * `{ event, data }` frames. Handles frames split across chunks, several frames
 * per chunk, multi-line `data:`, CRLF, and ignores comment/`id:` lines. A
 * trailing partial frame stays buffered until its blank-line terminator.
 */
export function createSseFrameParser() {
  let buffer = "";
  let eventName = "message";
  let dataLines = [];

  const takeFrame = () => {
    if (dataLines.length === 0) {
      eventName = "message";
      return null;
    }
    const frame = { event: eventName, data: dataLines.join("\n") };
    eventName = "message";
    dataLines = [];
    return frame;
  };

  return {
    feed(chunk) {
      buffer += chunk;
      const frames = [];
      let boundary = buffer.indexOf("\n");
      while (boundary !== -1) {
        let line = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);

        if (line === "") {
          const frame = takeFrame();
          if (frame) frames.push(frame);
        } else if (line.startsWith("event:")) {
          eventName = line.slice("event:".length).replace(/^ /, "");
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice("data:".length).replace(/^ /, ""));
        }
        // Comments (`:`), `id:`, and `retry:` lines carry nothing the harness reads.
        boundary = buffer.indexOf("\n");
      }
      return frames;
    },
  };
}

const RATE_LIMIT_RE = /\b429\b|rate.?limit/i;

function isRateLimitedError(error) {
  // PROVIDER_REJECTED also covers credential/billing/model rejections, so only
  // the message decides: real 429s carry `HTTP 429` from the server.
  return RATE_LIMIT_RE.test(error.message ?? "");
}

const REPORTED_SCHEMA_ERRORS = 3;

/**
 * The honesty contract. PASS only on: real streaming observed, every frame
 * matching the published event schema, terminal `complete` inside the cap, and
 * the run fetchable + listed afterwards. A terminal `error` (the pipeline's
 * zero-successful-lenses outcome included), a timeout, a frame that does not
 * match the wire contract, or missing persistence is a FAIL with the honest
 * diagnostic. Per-lens failures and a finding-free run on a completed review
 * WARN but pass — free routes miss the planted bug often enough that model
 * quality must not decide an integration gate.
 */
export function evaluateRun({
  sawNonTerminalEvent,
  terminal,
  timedOut,
  persisted,
  listed,
  failedLenses = [],
  schemaErrors = [],
}) {
  if (timedOut) {
    return {
      verdict: "fail",
      lines: [
        `FAIL: live review e2e did not reach a terminal event within ${HARD_TIMEOUT_MS}ms; session cancelled.`,
      ],
    };
  }
  if (!terminal) {
    return {
      verdict: "fail",
      lines: ["FAIL: live review e2e stream ended without a terminal event."],
    };
  }
  if (terminal.type === "error") {
    const lines = [
      `FAIL: live review e2e terminal error ${terminal.error.code}: ${terminal.error.message}`,
    ];
    if (isRateLimitedError(terminal.error)) {
      lines.push(`HINT: upstream rate limit — rerun, or set ${E2E_MODEL_ENV}.`);
    }
    return { verdict: "fail", lines };
  }
  if (schemaErrors.length > 0) {
    return {
      verdict: "fail",
      lines: [
        `FAIL: live review e2e saw ${schemaErrors.length} stream payload(s) that do not match the published schema: ${schemaErrors.slice(0, REPORTED_SCHEMA_ERRORS).join("; ")}`,
      ],
    };
  }
  if (!sawNonTerminalEvent) {
    return {
      verdict: "fail",
      lines: ["FAIL: live review e2e completed without any non-terminal stream event."],
    };
  }
  if (!persisted || !listed) {
    const missing = [!persisted && "detail fetch", !listed && "history listing"]
      .filter(Boolean)
      .join(" and ");
    return {
      verdict: "fail",
      lines: [`FAIL: live review e2e completed but persistence is missing (${missing}).`],
    };
  }
  const lines = [
    `OK: live review e2e — completed, ${terminal.result.issues.length} issue(s), lens ${E2E_LENS}`,
  ];
  if (failedLenses.length > 0) {
    lines.push(`WARN: ${failedLenses.length} lens(es) failed honestly: ${failedLenses.join("; ")}`);
  }
  if (terminal.result.issues.length === 0) {
    lines.push("WARN: the planted bug produced no findings; the model missed it.");
  }
  return { verdict: "pass", lines };
}
