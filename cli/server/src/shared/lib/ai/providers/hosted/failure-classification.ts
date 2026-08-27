import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import {
  type FailureDiagnosticInput,
  PROVIDER_REJECTED_DIAGNOSTIC_CODE,
} from "../../diagnostics.js";

/**
 * The bounded reason for a non-2xx provider response. The statuses a user can
 * fix on the providers screen name the fix; everything else is the provider's
 * own outage and stays a plain transport failure. 400 stays transport-failed
 * but names the likely context-window cause.
 */
export function describeHttpFailure(
  productId: HostedApiProductId,
  status: number,
): Pick<FailureDiagnosticInput, "code" | "message" | "retryable" | "remediation"> {
  const name = PRODUCT_REGISTRY[productId].presentation.name;
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
        message: `${name} rejected the credential (HTTP 401).`,
        remediation: "Update the configuration with a valid API key.",
      };
    case 403:
      return {
        ...rejected,
        message: `${name} refused access (HTTP 403).`,
        remediation: "Check the API key and the account's access to the selected model.",
      };
    case 402:
      return {
        ...rejected,
        message: `${name} reported billing or quota exhausted (HTTP 402).`,
        remediation: "Check the account balance or plan, or change the model.",
      };
    case 404:
      return {
        ...rejected,
        message: `${name} could not find the selected model or endpoint (HTTP 404).`,
        remediation: "Select a different model.",
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
): Pick<FailureDiagnosticInput, "code" | "message" | "retryable" | "remediation"> {
  const name = PRODUCT_REGISTRY[productId].presentation.name;
  return {
    code: PROVIDER_REJECTED_DIAGNOSTIC_CODE,
    retryable: false,
    message: `${name} reported the account's balance or quota is exhausted (HTTP 429).`,
    remediation: "Check the account balance or plan, or change the model.",
  };
}
