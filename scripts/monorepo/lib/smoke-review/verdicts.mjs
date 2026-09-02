// The verdict rules for the live review e2e: what a run must show to pass, what
// a fixture scenario (medium, large) must show to prove batching, and how a
// matrix labels its verdict lines. The lens and the default hard cap live here
// too; the timeout and batching-proof lines are stated against the bounds the
// harness actually enforced. No I/O and no network so `test:scripts` can
// exercise every branch offline.

import { E2E_MODEL_ENV } from "./dispositions.mjs";

// Live evidence: a full 5-lens review took 3m21s-16m30s on free routes; one
// lens fits this cap with margin.
export const HARD_TIMEOUT_MS = 600_000;
export const E2E_LENS = "correctness";

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
  timeoutMs = HARD_TIMEOUT_MS,
}) {
  if (timedOut) {
    return {
      verdict: "fail",
      lines: [
        `FAIL: live review e2e did not reach a terminal event within ${timeoutMs}ms; session cancelled.`,
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
      // The pin advice is single-product only: a multi-product matrix ignores
      // DIFFGAZER_LIVE_E2E_MODEL (singleProductModelOverride).
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

/**
 * REQ-006: batching is proven, not assumed. A fixture cell fails unless a
 * `review_size_warning` reported >= minBatchCount batches, the review lens
 * dispatched every batchIndex in 0..minBatchCount-1, and a synthesis row
 * exists. A synthesis row that failed honestly WARNs but passes — synthesis
 * ran, which is what the proof needs. The OK line is grep-distinguishable from
 * evaluateRun's `— completed` line. minBatchCount is REQUIRED: an omitted
 * argument would make `batchCount < undefined` false and silently weaken the
 * proof, so a missing or sub-2 bar is a wiring error and throws.
 */
export function evaluateBatchingProof({ sizeWarnings, lensStats, minBatchCount }) {
  if (!Number.isInteger(minBatchCount) || minBatchCount < 2) {
    throw new Error(`evaluateBatchingProof needs minBatchCount >= 2, got ${minBatchCount}`);
  }
  const batchCount = Math.max(0, ...sizeWarnings.map((warning) => warning?.batchCount ?? 0));
  const reviewLens = lensStats.find((row) => row.lensId === E2E_LENS);
  const batchIndexes = new Set(
    (reviewLens?.dispatches ?? []).map((dispatch) => dispatch.batchIndex),
  );
  const synthesis = lensStats.find((row) => row.lensId === "synthesis");

  const missing = [];
  if (batchCount < minBatchCount) {
    missing.push(`no review_size_warning with batchCount >= ${minBatchCount}`);
  }
  const requiredIndexes = Array.from({ length: minBatchCount }, (_, index) => index);
  if (!requiredIndexes.every((index) => batchIndexes.has(index))) {
    missing.push(`${E2E_LENS} lens dispatches do not cover batchIndex 0..${minBatchCount - 1}`);
  }
  if (!synthesis) {
    missing.push('no lensId "synthesis" row in lensStats');
  }
  if (missing.length > 0) {
    return {
      verdict: "fail",
      lines: [`FAIL: live review e2e batching proof missing: ${missing.join("; ")}`],
    };
  }
  const lines = [
    `OK: live review e2e — batching proven: ${batchCount} batches (>= ${minBatchCount}) + synthesis`,
  ];
  if (synthesis.status === "failed") {
    lines.push(
      `WARN: synthesis lens failed honestly (${synthesis.errorCode ?? "no errorCode"}); batching itself is proven.`,
    );
  }
  return { verdict: "pass", lines };
}

/**
 * The superseded attempt's only line: this cell's model was refused on plan
 * grounds, so the run retries it on the product's fallback instead of reporting
 * a verdict on a model it is abandoning. `WARN:` so `labelCellLines` labels it,
 * and the wording is grep-distinguishable from every other WARN.
 */
export function fallbackLine(cell, fallbackModelId) {
  return `WARN: live review e2e — ${cell.modelId} refused with HTTP 402 (plan/entitlement); retrying the cell on fallback ${fallbackModelId}`;
}

const VERDICT_PREFIX_RE = /^(OK|WARN|FAIL): /;

/**
 * Labels verdict lines with their `(productId/scenarioId)` cell. The harness
 * applies it only for multi-cell invocations, so the legacy single-cell output
 * stays byte-identical (REQ-017).
 */
export function labelCellLines(lines, cell) {
  return lines.map((line) => {
    const match = line.match(VERDICT_PREFIX_RE);
    if (!match) return line;
    return `${match[0]}(${cell.productId}/${cell.scenarioId}) ${line.slice(match[0].length)}`;
  });
}
