import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import {
  type FailureDiagnosticInput,
  PROVIDER_REJECTED_DIAGNOSTIC_CODE,
} from "../../diagnostics.js";

/**
 * Pool-aware copy for a product whose endpoints are separate billing pools:
 * the failure is the bound pool's, not the product's, and the other pool is a
 * remedy worth naming when it is known to serve the same model. Absent, every
 * string is the product-named one every other product gets.
 */
export interface FailureCopyOptions {
  readonly poolLabel?: string;
  readonly siblingLabel?: string;
}

/**
 * A pool-bound failure says what to do in *this* pool, and — when the other
 * pool is known to serve the same model — names the picker action that moves
 * there, because switching pools is now one confirm in Select Model rather than
 * a second configuration. Each status gets its own remedy: the four ways a pool
 * can refuse a dispatch have four different fixes.
 */
function remediationFor(
  productCopy: string,
  poolCopy: string,
  options: FailureCopyOptions | undefined,
): string {
  if (options?.poolLabel === undefined) return productCopy;
  const { siblingLabel } = options;
  return siblingLabel === undefined
    ? `${poolCopy}.`
    : `${poolCopy}, or switch to ${siblingLabel} in Select Model.`;
}

/**
 * The bounded reason for a non-2xx provider response. The statuses a user can
 * fix on the providers screen name the fix; everything else is the provider's
 * own outage and stays a plain transport failure. 400 stays transport-failed
 * but names the likely context-window cause.
 */
export function describeHttpFailure(
  productId: HostedApiProductId,
  status: number,
  options?: FailureCopyOptions,
): Pick<FailureDiagnosticInput, "code" | "message" | "retryable" | "remediation"> {
  const pool = options?.poolLabel;
  const name = pool ?? PRODUCT_REGISTRY[productId].presentation.name;
  const rejected = { code: PROVIDER_REJECTED_DIAGNOSTIC_CODE, retryable: false };
  switch (status) {
    case 400:
      return {
        code: "transport-failed",
        retryable: false,
        message: `${name} rejected the request as invalid (HTTP 400).`,
        remediation:
          "Often the diff is too large for the model's context window. Reduce the review scope, or choose a model with a larger context.",
      };
    case 401:
      return {
        ...rejected,
        // Never pool-named: one credential serves both pools, so a rejected key
        // is a product-level fact and naming a wallet would misdirect the fix.
        message: `${PRODUCT_REGISTRY[productId].presentation.name} rejected the credential (HTTP 401).`,
        remediation: "Update the configuration with a valid API key.",
      };
    case 403:
      return {
        ...rejected,
        message: `${name} refused access (HTTP 403).`,
        // Hedged on purpose: whether an unentitled key is refused with 403 or
        // 401 was never measured, so the copy suggests the cause, never asserts
        // a classification the code cannot make.
        remediation: remediationFor(
          "Check the API key and the account's access to the selected model.",
          "The key may not be entitled to this pool. Check the account",
          options,
        ),
      };
    case 402:
      return {
        ...rejected,
        message: `${name} reported billing or quota exhausted (HTTP 402).`,
        remediation: remediationFor(
          "Check the account balance or plan, or change the model.",
          "Check the plan for this pool",
          options,
        ),
      };
    case 404:
      return {
        ...rejected,
        // A pool-bound dispatch reached the endpoint the pool publishes, so the
        // model is the only half of the pair still in question.
        message: pool
          ? `${name} could not find the selected model (HTTP 404).`
          : `${name} could not find the selected model or endpoint (HTTP 404).`,
        remediation: remediationFor(
          "Select a different model.",
          "Choose a model this pool serves",
          options,
        ),
      };
    case 413:
      return {
        ...rejected,
        message: `${name} rejected the request as too large (HTTP 413).`,
        remediation: "Reduce the review scope, or change the model or plan.",
      };
    case 429:
      return {
        ...rejected,
        retryable: true,
        message: `${name} rate limited the request (HTTP 429).`,
        remediation:
          "Wait and retry. If Agent Execution is set to Parallel, switching it to Sequential can help.",
      };
    default:
      return {
        code: "transport-failed",
        retryable: status >= 500,
        message: `${name} returned HTTP ${status}.`,
      };
  }
}

/**
 * A 429 whose body marks the account's balance or quota as exhausted rather
 * than the request as too fast. Waiting cannot clear it, so it names the
 * account fix instead of the pacing remediation.
 */
export function describeExhaustedRateLimit(
  productId: HostedApiProductId,
  options?: FailureCopyOptions,
): Pick<FailureDiagnosticInput, "code" | "message" | "retryable" | "remediation"> {
  const pool = options?.poolLabel;
  const name = pool ?? PRODUCT_REGISTRY[productId].presentation.name;
  return {
    code: PROVIDER_REJECTED_DIAGNOSTIC_CODE,
    retryable: false,
    // A pool's cap is an allowance window, not a balance the user tops up.
    message: pool
      ? `${name} reported the account's allowance is exhausted (HTTP 429).`
      : `${name} reported the account's balance or quota is exhausted (HTTP 429).`,
    remediation: remediationFor(
      "Check the account balance or plan, or change the model.",
      "Check the allowance for this pool",
      options,
    ),
  };
}
