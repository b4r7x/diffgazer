import { isApiError } from "../../api/types.js";
import type { Readiness, ReadinessStatus } from "../../schemas/config/index.js";
import type { TransportFamily } from "../../schemas/config/transports.js";
import { ErrorCode } from "../../schemas/errors.js";
import type { TerminalOutcome, UsageAvailability } from "../../schemas/review/execution.js";

export interface ApiKeyMissingCopy {
  title: string;
  body: string;
}

export const CONFIGURE_PROVIDER_LABEL = "Configure Provider";

export const CONFIGURATION_ERROR_COPY = {
  title: "Configuration Unavailable",
  body: "Diffgazer could not load the current configuration. Retry the request or return home.",
} as const;

export const TERMINAL_OUTCOME_PRESENTATION = {
  completed: {
    title: "Review Completed",
    message: "The review finished with schema-valid findings.",
  },
  cancelled: {
    title: "Review Cancelled",
    message: "The review was cancelled before it completed.",
  },
  "timed-out": {
    title: "Review Timed Out",
    message: "The review exceeded the configured wall-time limit.",
  },
  "transport-failed": {
    title: "Transport Failed",
    message: "The configured transport could not complete the review.",
  },
  "schema-failed": {
    title: "Schema Validation Failed",
    message: "The provider response did not match Diffgazer's review schema.",
  },
  "budget-exhausted": {
    title: "Budget Exhausted",
    message: "The review stopped because a configured budget limit was reached.",
  },
} as const satisfies Record<
  TerminalOutcome,
  {
    readonly title: string;
    readonly message: string;
  }
>;

export const USAGE_AVAILABILITY_PRESENTATION = {
  reported: {
    label: "Usage reported",
    detail: "Token usage is available for this review.",
  },
  "required-missing": {
    label: "Usage unavailable",
    detail: "This provider requires usage reporting, but none was returned.",
  },
  unavailable: {
    label: "Usage unavailable",
    detail: "Usage reporting is not available for this review.",
  },
} as const satisfies Record<
  UsageAvailability,
  {
    readonly label: string;
    readonly detail: string;
  }
>;

const LOCAL_READINESS_STATUSES = new Set<ReadinessStatus>([
  "local-endpoint-unreachable",
  "local-endpoint-forbidden",
  "local-api-incompatible",
  "local-no-review-capable-model",
  "local-selected-model-missing",
  "local-conformance-failed",
  "local-cancellation-failed",
]);

const CLI_UNSUPPORTED_STATUSES = new Set<ReadinessStatus>(["unsupported"]);

function usesApiKeyLanguage(text: string): boolean {
  return /api[\s-]?key/i.test(text);
}

export function getConfigurationNotReadyCopy(input: {
  productLabel?: string;
  readiness: Readiness;
}): ApiKeyMissingCopy {
  const productLabel = input.productLabel ? ` (${input.productLabel})` : "";
  return {
    title: `Configuration Not Ready${productLabel}`,
    body: `${input.readiness.explanation} ${input.readiness.remediation.message}`,
  };
}

export function getApiKeyMissingCopy(input: {
  productLabel?: string;
  readiness: Readiness;
}): ApiKeyMissingCopy {
  return getConfigurationNotReadyCopy(input);
}

export interface ReviewStartErrorDescription {
  title: string;
  message: string;
}

export function describeReviewStartError(error: unknown): ReviewStartErrorDescription {
  if (!isApiError(error)) {
    return {
      title: "Failed to Start Review",
      message: "Could not create a review session.",
    };
  }

  switch (error.code) {
    case ErrorCode.API_KEY_MISSING:
      return {
        title: "API Key Missing",
        message: `${error.message}. Add one in Settings → Providers.`,
      };
    case "UNSUPPORTED_PROVIDER":
      return {
        title: "Provider Not Configured",
        message: "Pick an AI provider in Settings → Providers.",
      };
    case "MODEL_ERROR":
      return { title: "Model Not Selected", message: error.message };
    case "KEYRING_READ_FAILED":
      return {
        title: "Credential Storage Unavailable",
        message: `${error.message}. Check Settings → Storage.`,
      };
    default:
      return { title: "Failed to Start Review", message: error.message };
  }
}

export type ReviewStreamErrorKind = "api-key" | "transport" | "other";

export interface ReviewStreamErrorGuidance {
  kind: ReviewStreamErrorKind;
  title: string;
  guidance: string;
  ctaLabel: string;
}

const API_KEY_ERROR_PATTERN = /api.?key/i;
const RAW_DIAGNOSTIC_PATTERN =
  /(?:\/Users\/|\/home\/|Bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]+|correlationId\s*[:=])/i;

export function sanitizePresentationText(text: string): string {
  if (!RAW_DIAGNOSTIC_PATTERN.test(text)) return text;
  return "Diffgazer could not present this failure safely. Return home and retry the review.";
}

export function describeTerminalOutcome(outcome: TerminalOutcome): {
  title: string;
  message: string;
} {
  return TERMINAL_OUTCOME_PRESENTATION[outcome];
}

export function describeUsageAvailability(usageAvailability: UsageAvailability): {
  label: string;
  detail: string;
} {
  return USAGE_AVAILABILITY_PRESENTATION[usageAvailability];
}

export function describeReviewCancellation(): { title: string; message: string } {
  return TERMINAL_OUTCOME_PRESENTATION.cancelled;
}

export function readinessUsesTransportNeutralCopy(readiness: Readiness): boolean {
  if (LOCAL_READINESS_STATUSES.has(readiness.status)) return true;
  if (CLI_UNSUPPORTED_STATUSES.has(readiness.status) && readiness.explanation.includes("CLI")) {
    return true;
  }
  return !usesApiKeyLanguage(`${readiness.explanation} ${readiness.remediation.message}`);
}

export function classifyReviewStreamError(
  error: string,
  errorCode?: string | null,
  transportFamily?: TransportFamily,
): ReviewStreamErrorGuidance {
  const safeError = sanitizePresentationText(error);
  // An unknown transport must fail neutral: local and CLI paths have no API key
  // to fix, so guessing "hosted" hands the user an impossible remediation.
  const isApiKeyError =
    transportFamily === "hosted-api" &&
    (errorCode === ErrorCode.API_KEY_MISSING ||
      (errorCode == null && API_KEY_ERROR_PATTERN.test(safeError)));
  if (isApiKeyError) {
    return {
      kind: "api-key",
      title: "API Key Error",
      guidance: "Your API key may be invalid or expired.",
      ctaLabel: CONFIGURE_PROVIDER_LABEL,
    };
  }
  if (errorCode === ErrorCode.STREAM_ERROR) {
    return {
      kind: "transport",
      title: "Connection Lost",
      guidance: "The review stream was interrupted. Retry to reconnect to the active review.",
      ctaLabel: "Retry",
    };
  }
  return {
    kind: "other",
    title: "Review Error",
    guidance: sanitizePresentationText("Return home and start a new review."),
    ctaLabel: "Back to Home",
  };
}
