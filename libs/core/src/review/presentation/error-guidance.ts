import { isApiError } from "../../api/types.js";
import type { SetupStatus } from "../../schemas/config/index.js";
import { ErrorCode } from "../../schemas/errors.js";

export interface ApiKeyMissingCopy {
  title: string;
  body: string;
}

export const CONFIGURE_PROVIDER_LABEL = "Configure Provider";

export const CONFIGURATION_ERROR_COPY = {
  title: "Configuration Unavailable",
  body: "Diffgazer could not load the current configuration. Retry the request or return home.",
} as const;

export function getApiKeyMissingCopy(input: {
  provider?: string;
  missing: Readonly<SetupStatus["missing"]>;
}): ApiKeyMissingCopy {
  const forProvider = input.provider ? ` for ${input.provider}` : "";
  if (input.missing.includes("secretsStorage")) {
    return {
      title: "Secrets Storage Required",
      body: "Choose a secrets storage backend in Settings before starting a review.",
    };
  }
  if (!input.missing.includes("provider") && input.missing.includes("model")) {
    return {
      title: "Model Required",
      body: `No model selected${forProvider}. Set up a model in Settings to start reviewing code.`,
    };
  }
  return {
    title: "API Key Required",
    body: `No API key configured${forProvider}. Add your API key in Settings to start reviewing code.`,
  };
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

export function classifyReviewStreamError(
  error: string,
  errorCode?: string | null,
): ReviewStreamErrorGuidance {
  if (errorCode === ErrorCode.API_KEY_MISSING) {
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
  if (errorCode == null && API_KEY_ERROR_PATTERN.test(error)) {
    return {
      kind: "api-key",
      title: "API Key Error",
      guidance: "Your API key may be invalid or expired.",
      ctaLabel: CONFIGURE_PROVIDER_LABEL,
    };
  }
  return {
    kind: "other",
    title: "Review Error",
    guidance: "Return home and start a new review.",
    ctaLabel: "Back to Home",
  };
}
