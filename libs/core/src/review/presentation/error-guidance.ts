import { isApiError } from "../../api/types.js";
import type { Readiness } from "../../schemas/config/index.js";
import type { TransportFamily } from "../../schemas/config/transports.js";
import { ErrorCode } from "../../schemas/errors.js";
import type { TerminalOutcome, UsageAvailability } from "../../schemas/review/execution.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";

export interface ConfigurationNotReadyCopy {
  title: string;
  body: string;
}

export const CONFIGURE_PROVIDER_LABEL = "Configure Provider";
export const ENTER_API_KEY_LABEL = "Enter API Key";

export const CONFIGURATION_ERROR_COPY = {
  title: "Configuration Unavailable",
  body: "Diffgazer could not load the current configuration. Retry the request or return home.",
} as const;

/**
 * A configuration load that failed on the stored credential is a setup
 * condition, not a server fault: gates render it warning-toned with this copy
 * instead of the generic load-failure gate.
 */
export const CREDENTIAL_ERROR_COPY = {
  title: "Reconnect Provider",
  body: "The saved provider credential could not be read. Re-enter the API key in provider settings, or retry.",
} as const;

// Declared over ErrorCode so renaming a member fails to compile here instead of
// silently dropping its failures onto the generic configuration gate.
const CREDENTIAL_SETUP_ERROR_CODES: ReadonlySet<string> = new Set<ErrorCode>([
  ErrorCode.CREDENTIAL_INVALID,
  ErrorCode.API_KEY_MISSING,
  ErrorCode.SETUP_REQUIRED,
  ErrorCode.SECRET_BINDING_FAILED,
  ErrorCode.STORAGE_NOT_CONFIGURED,
  ErrorCode.KEYRING_UNAVAILABLE,
  ErrorCode.KEYRING_READ_FAILED,
]);

/**
 * True when a configuration load failed because the stored credential or the
 * secrets storage holding it is the problem — fixed by re-entering the key,
 * never by the app. A 401 is deliberately excluded: that is a session-token
 * mismatch provider setup cannot repair.
 */
export function isCredentialSetupError(error: unknown): boolean {
  return (
    isApiError(error) && error.code !== undefined && CREDENTIAL_SETUP_ERROR_CODES.has(error.code)
  );
}

/** The configuration exists but its credential is missing or rejected and needs re-entry. */
export function isCredentialReconnectReadiness(readiness: Readiness): boolean {
  return readiness.remediation.code === "replace-credential";
}

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

export function getConfigurationNotReadyCopy(input: {
  productLabel?: string;
  readiness: Readiness;
}): ConfigurationNotReadyCopy {
  // A missing/rejected credential is a calm reconnect state, not a generic
  // not-ready failure: the views keep the configuration's identity visible
  // beside this copy, so the title stays clean of the product label.
  if (isCredentialReconnectReadiness(input.readiness)) {
    return {
      title: "Reconnect Provider",
      body: "The saved credential for this configuration is missing or was rejected. Enter the API key again to reconnect.",
    };
  }
  const productLabel = input.productLabel ? ` (${input.productLabel})` : "";
  return {
    title: `Configuration Not Ready${productLabel}`,
    body: `${input.readiness.explanation} ${input.readiness.remediation.message}`,
  };
}

export interface ReviewStartErrorDescription {
  title: string;
  message: string;
  /** Set when the failure has a forward path: the providers screen, or the review already running. */
  recovery: "configure-provider" | "open-active-review" | null;
}

export function describeReviewStartError(error: unknown): ReviewStartErrorDescription {
  if (!isApiError(error)) {
    return {
      title: "Failed to Start Review",
      message: "Could not create a review session.",
      recovery: null,
    };
  }

  switch (error.code) {
    case ErrorCode.API_KEY_MISSING:
      return {
        title: "API Key Missing",
        message: `${error.message}. Add one in Settings → Providers.`,
        recovery: "configure-provider",
      };
    case "UNSUPPORTED_PROVIDER":
      return {
        title: "Provider Not Configured",
        message: "Pick an AI provider in Settings → Providers.",
        recovery: "configure-provider",
      };
    case "MODEL_ERROR":
      return {
        title: "Model Not Selected",
        message: error.message,
        recovery: "configure-provider",
      };
    // Admission refused the selected configuration before contacting the
    // provider — a cached structured-output failure, an unaccepted notice, or a
    // tuple that changed underneath the review. The message is the server's
    // remediation; the fix is always a change on the providers screen.
    case ErrorCode.SETUP_REQUIRED:
      return {
        title: "Configuration Needs Attention",
        message: error.message,
        recovery: "configure-provider",
      };
    case ErrorCode.REVIEW_IN_PROGRESS:
      return {
        title: "Review Already Running",
        message:
          "A review is already running for this configuration. Diffgazer runs one review at a time, so a new one cannot start until the running review finishes or is cancelled.",
        recovery: "open-active-review",
      };
    case "KEYRING_READ_FAILED":
      return {
        title: "Credential Storage Unavailable",
        message: `${error.message}. Check Settings → Storage.`,
        recovery: null,
      };
    default:
      return { title: "Failed to Start Review", message: error.message, recovery: null };
  }
}

type ReviewStreamErrorKind =
  | "api-key"
  | "model-incompatible"
  | "provider"
  | "trust"
  | "transport"
  | "other";

export interface ReviewStreamErrorGuidance {
  kind: ReviewStreamErrorKind;
  title: string;
  guidance: string;
  ctaLabel: string;
}

const API_KEY_ERROR_PATTERN = /api.?key/i;
const RAW_DIAGNOSTIC_PATTERN =
  /(?:\/Users\/|\/home\/|Bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]+|correlationId\s*[:=])/i;

/**
 * True when the text is a serialized JSON object or array — the shape a
 * stringified ZodError or dumped diagnostic takes. No intentionally-emitted
 * stream-error message is one, so firing on it is always safe.
 */
export function looksLikeSerializedDiagnostic(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

export function sanitizePresentationText(text: string): string {
  if (!RAW_DIAGNOSTIC_PATTERN.test(text) && !looksLikeSerializedDiagnostic(text)) return text;
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
  if (errorCode === ReviewErrorCode.MODEL_INCOMPATIBLE) {
    return {
      kind: "model-incompatible",
      title: "Model Incompatible",
      // The fail-immediately sentence lives with the fail-fast memo (the
      // server's structured-output guidance), which now arms only on proven
      // incapacity — this static copy must not promise it for every failure.
      guidance:
        "This model could not produce Diffgazer's structured review output. Change the model or update the configuration.",
      ctaLabel: "Change model",
    };
  }
  if (errorCode === ReviewErrorCode.PROVIDER_REJECTED) {
    return {
      kind: "provider",
      title: "Provider Rejected the Request",
      guidance: "Fix the provider configuration or change the model, then start a new review.",
      ctaLabel: "Fix provider",
    };
  }
  if (errorCode === ErrorCode.TRUST_REQUIRED || errorCode === ReviewErrorCode.TRUST_REQUIRED) {
    return {
      kind: "trust",
      title: "Repository Access Required",
      guidance: "Update Trust & Permissions to continue this review.",
      ctaLabel: "Open Trust Settings",
    };
  }
  if (errorCode === ReviewErrorCode.DIFF_TOO_LARGE) {
    return {
      kind: "other",
      title: "Diff Too Large",
      guidance:
        "This diff does not fit the selected model. Narrow the review to specific files, or pick a model with a larger context window.",
      ctaLabel: "Back to Home",
    };
  }
  if (errorCode === ReviewErrorCode.BUDGET_EXHAUSTED) {
    return {
      kind: "other",
      title: TERMINAL_OUTCOME_PRESENTATION["budget-exhausted"].title,
      guidance: "Reduce the review scope or raise the configured budget, then start a new review.",
      ctaLabel: "Back to Home",
    };
  }
  if (errorCode === ReviewErrorCode.INTERNAL_ERROR) {
    return {
      kind: "other",
      title: "Internal Error",
      guidance:
        "This is a bug in Diffgazer, not a problem with your provider or configuration. Retry the review.",
      ctaLabel: "Back to Home",
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
    guidance: "Return home and start a new review.",
    ctaLabel: "Back to Home",
  };
}

/** True when the guidance's call to action opens the providers screen. */
export function isProviderRecoveryError(kind: ReviewStreamErrorKind): boolean {
  return kind === "api-key" || kind === "model-incompatible" || kind === "provider";
}
