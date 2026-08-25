import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import { READINESS_PRESENTATION, ReadinessSchema } from "../../schemas/config/index.js";
import type { ReadinessStatus } from "../../schemas/config/readiness.js";
import { TERMINAL_OUTCOMES, type TerminalOutcome } from "../../schemas/review/execution.js";
import {
  CONFIGURATION_ERROR_COPY,
  CONFIGURE_PROVIDER_LABEL,
  CREDENTIAL_ERROR_COPY,
  classifyReviewStreamError,
  describeReviewStartError,
  describeTerminalOutcome,
  describeUsageAvailability,
  ENTER_API_KEY_LABEL,
  getConfigurationNotReadyCopy,
  isCredentialReconnectReadiness,
  isCredentialSetupError,
  isProviderRecoveryError,
  sanitizePresentationText,
  USAGE_AVAILABILITY_PRESENTATION,
} from "./error-guidance.js";

function makeReadiness(status: ReadinessStatus) {
  const product = status.startsWith("local-") ? PRODUCT_REGISTRY.ollama : PRODUCT_REGISTRY.gemini;
  const notice = product.notice;

  let acknowledgement: {
    status: "not-applicable" | "accepted" | "required";
    noticeId?: string;
    noticeVersion?: number;
    acceptedAt?: string;
  };
  if (status === "unsupported") {
    acknowledgement = { status: "not-applicable" };
  } else if (status === "ready") {
    acknowledgement = {
      status: "accepted",
      noticeId: notice.id,
      noticeVersion: notice.noticeVersion,
      acceptedAt: "2026-07-31T12:00:00.000Z",
    };
  } else {
    acknowledgement = {
      status: "required",
      noticeId: notice.id,
      noticeVersion: notice.noticeVersion,
    };
  }

  let evidenceStatus: "passed" | "pending" | "skipped" | "not-checked" | "failed";
  if (status === "ready" || status === "acknowledgement-required") {
    evidenceStatus = "passed";
  } else if (status === "conformance-pending") {
    evidenceStatus = "pending";
  } else if (status === "skipped") {
    evidenceStatus = "skipped";
  } else if (status === "unsupported" || status === "unconfigured") {
    evidenceStatus = "not-checked";
  } else {
    evidenceStatus = "failed";
  }

  const checkedAt = evidenceStatus === "not-checked" ? null : "2026-07-31T12:00:00.000Z";

  return ReadinessSchema.parse({
    status,
    ready: status === "ready",
    evidenceStatus,
    checkedAt,
    acknowledgement,
    ...READINESS_PRESENTATION[status],
  });
}

describe("review error-guidance presentation", () => {
  it("derives setup copy from safe readiness guidance", () => {
    const readiness = makeReadiness("local-conformance-failed");

    expect(getConfigurationNotReadyCopy({ productLabel: "ollama", readiness })).toEqual({
      title: "Configuration Not Ready (ollama)",
      body: "The local model failed the structured review conformance check. Select a different model or update the configuration; reviews with this exact setup fail immediately until it changes. Verify can re-check it.",
    });
    expect(CONFIGURATION_ERROR_COPY).toEqual({
      title: "Configuration Unavailable",
      body: "Diffgazer could not load the current configuration. Retry the request or return home.",
    });
    expect(CONFIGURE_PROVIDER_LABEL).toBe("Configure Provider");
  });

  it.each([
    "local-conformance-failed",
    "unsupported",
    "skipped",
  ] as const)("never says API key for %s readiness", (status) => {
    const copy = getConfigurationNotReadyCopy({ readiness: makeReadiness(status) });
    expect(copy.title.toLowerCase()).not.toContain("api key");
    expect(copy.body.toLowerCase()).not.toContain("api key");
  });

  // Literal expectations so a copy regression fails here, not in a UI snapshot.
  it("turns a rejected credential into the reconnect state instead of a generic failure", () => {
    const readiness = makeReadiness("credential-invalid");

    expect(isCredentialReconnectReadiness(readiness)).toBe(true);
    // The views show the configuration's identity beside the copy, so the
    // reconnect title stays clean of the product label.
    expect(getConfigurationNotReadyCopy({ productLabel: "Google Gemini", readiness })).toEqual({
      title: "Reconnect Provider",
      body: "The saved credential for this configuration is missing or was rejected. Enter the API key again to reconnect.",
    });
    expect(ENTER_API_KEY_LABEL).toBe("Enter API Key");
  });

  it("keeps every other not-ready status out of the reconnect state", () => {
    for (const status of [
      "unconfigured",
      "model-missing",
      "conformance-failed",
      "ready",
    ] as const) {
      expect(isCredentialReconnectReadiness(makeReadiness(status))).toBe(false);
    }
  });

  it("classifies credential and secrets-storage load failures as setup conditions", () => {
    const apiError = (code: string) => Object.assign(new Error(code), { status: 500, code });

    for (const code of [
      "CREDENTIAL_INVALID",
      "API_KEY_MISSING",
      "SETUP_REQUIRED",
      "SECRET_BINDING_FAILED",
      "STORAGE_NOT_CONFIGURED",
      "KEYRING_UNAVAILABLE",
      "KEYRING_READ_FAILED",
    ]) {
      expect(isCredentialSetupError(apiError(code))).toBe(true);
    }

    // A 401 is a session-token mismatch and a plain network failure carries no
    // code: both stay on their own gates rather than the reconnect state.
    expect(isCredentialSetupError(apiError("UNAUTHORIZED"))).toBe(false);
    expect(isCredentialSetupError(apiError("INTERNAL_ERROR"))).toBe(false);
    // A second concurrent review is a conflict, never a credential to re-enter.
    expect(isCredentialSetupError(apiError("REVIEW_IN_PROGRESS"))).toBe(false);
    expect(isCredentialSetupError(new Error("fetch failed"))).toBe(false);

    expect(CREDENTIAL_ERROR_COPY).toEqual({
      title: "Reconnect Provider",
      body: "The saved provider credential could not be read. Re-enter the API key in provider settings, or retry.",
    });
  });

  // Literal expectations, not the production map: a swapped timeout/schema entry
  // must fail here rather than move the oracle with the defect.
  const TERMINAL_OUTCOME_COPY: Record<TerminalOutcome, { title: string; message: string }> = {
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
  };

  it.each(TERMINAL_OUTCOMES)("names the cause of terminal outcome %s", (outcome) => {
    expect(describeTerminalOutcome(outcome)).toEqual(TERMINAL_OUTCOME_COPY[outcome]);
  });

  it("describes usage and budget guidance without raw diagnostics", () => {
    expect(describeUsageAvailability("reported")).toEqual(USAGE_AVAILABILITY_PRESENTATION.reported);
    expect(describeUsageAvailability("required-missing")).toEqual(
      USAGE_AVAILABILITY_PRESENTATION["required-missing"],
    );
    expect(describeUsageAvailability("unavailable")).toEqual(
      USAGE_AVAILABILITY_PRESENTATION.unavailable,
    );
    expect(describeTerminalOutcome("budget-exhausted").title).toBe("Budget Exhausted");
  });

  it.each([
    {
      code: "API_KEY_MISSING",
      title: "API Key Missing",
      message: "API key not found. Add one in Settings → Providers.",
      recovery: "configure-provider",
    },
    {
      code: "UNSUPPORTED_PROVIDER",
      title: "Provider Not Configured",
      message: "Pick an AI provider in Settings → Providers.",
      recovery: "configure-provider",
    },
    {
      code: "MODEL_ERROR",
      title: "Model Not Selected",
      message: "API key not found",
      recovery: "configure-provider",
    },
    {
      code: "SETUP_REQUIRED",
      title: "Configuration Needs Attention",
      message: "API key not found",
      recovery: "configure-provider",
    },
    {
      code: "KEYRING_READ_FAILED",
      title: "Credential Storage Unavailable",
      message: "API key not found. Check Settings → Storage.",
      recovery: null,
    },
    {
      code: "REVIEW_IN_PROGRESS",
      title: "Review Already Running",
      message:
        "A review is already running for this configuration. Diffgazer runs one review at a time, so a new one cannot start until the running review finishes or is cancelled.",
      recovery: "open-active-review",
    },
  ])("describes $code review start failures", ({ code, title, message, recovery }) => {
    const error = Object.assign(new Error("API key not found"), { code, status: 400 });

    expect(describeReviewStartError(error)).toEqual({ title, message, recovery });
  });

  it("keeps the server remediation for the admission fast-fail and points at providers", () => {
    const remediation =
      "This model could not produce Diffgazer's structured review output. Select a different model or update the configuration.";
    const error = Object.assign(new Error(remediation), { code: "SETUP_REQUIRED", status: 403 });

    expect(describeReviewStartError(error)).toEqual({
      title: "Configuration Needs Attention",
      message: remediation,
      recovery: "configure-provider",
    });
  });

  it("falls back for unstructured review start failures", () => {
    expect(describeReviewStartError(new Error("network failed"))).toEqual({
      title: "Failed to Start Review",
      message: "Could not create a review session.",
      recovery: null,
    });
  });

  it("classifies review stream failures by structured code before message fallback", () => {
    expect(
      classifyReviewStreamError("credentials rejected", "API_KEY_MISSING", "hosted-api"),
    ).toEqual({
      kind: "api-key",
      title: "API Key Error",
      guidance: "Your API key may be invalid or expired.",
      ctaLabel: "Configure Provider",
    });
    expect(classifyReviewStreamError("API key connection dropped", "STREAM_ERROR")).toEqual({
      kind: "transport",
      title: "Connection Lost",
      guidance: "The review stream was interrupted. Retry to reconnect to the active review.",
      ctaLabel: "Retry",
    });
    expect(
      classifyReviewStreamError("Adapter response failed schema validation.", "MODEL_INCOMPATIBLE"),
    ).toEqual({
      kind: "model-incompatible",
      title: "Model Incompatible",
      guidance:
        "This model could not produce Diffgazer's structured review output. Change the model or update the configuration; reviews with this exact setup fail immediately until it changes.",
      ctaLabel: "Change model",
    });
    expect(
      classifyReviewStreamError("Groq rejected the credential (HTTP 401).", "PROVIDER_REJECTED"),
    ).toEqual({
      kind: "provider",
      title: "Provider Rejected the Request",
      guidance: "Fix the provider configuration or change the model, then start a new review.",
      ctaLabel: "Fix provider",
    });
    expect(classifyReviewStreamError("API-key rejected", "SESSION_STALE").kind).toBe("other");
    expect(classifyReviewStreamError("API-key rejected", null, "local-http").kind).toBe("other");
    expect(classifyReviewStreamError("API-key rejected", null, "local-cli").kind).toBe("other");
    expect(classifyReviewStreamError("API-key rejected", null, "hosted-api").kind).toBe("api-key");
  });

  it("names the budget remedy instead of only sending the user home", () => {
    expect(
      classifyReviewStreamError(
        "Review budget exhausted at maxInputTokens (119808).",
        "BUDGET_EXHAUSTED",
      ),
    ).toEqual({
      kind: "other",
      title: "Budget Exhausted",
      guidance: "Reduce the review scope or raise the configured budget, then start a new review.",
      ctaLabel: "Back to Home",
    });
  });

  it("names the narrowing remedy for an oversized diff", () => {
    expect(
      classifyReviewStreamError(
        "Diff is ~175k tokens; gemini-flash reads at most 128k.",
        "DIFF_TOO_LARGE",
      ),
    ).toEqual({
      kind: "other",
      title: "Diff Too Large",
      guidance:
        "This diff does not fit the selected model. Narrow the review to specific files, or pick a model with a larger context window.",
      ctaLabel: "Back to Home",
    });
  });

  it("routes only credential, model, and provider failures to the providers screen", () => {
    expect(isProviderRecoveryError("api-key")).toBe(true);
    expect(isProviderRecoveryError("model-incompatible")).toBe(true);
    expect(isProviderRecoveryError("provider")).toBe(true);
    expect(isProviderRecoveryError("trust")).toBe(false);
    expect(isProviderRecoveryError("transport")).toBe(false);
    expect(isProviderRecoveryError("other")).toBe(false);
  });

  it("fails neutral when the admitted transport family is unknown", () => {
    expect(classifyReviewStreamError("API-key rejected", null).kind).toBe("other");
    expect(classifyReviewStreamError("credentials rejected", "API_KEY_MISSING").kind).toBe("other");
  });

  const SAFE_PRESENTATION_FALLBACK =
    "Diffgazer could not present this failure safely. Return home and retry the review.";

  it.each([
    { label: "/Users/ path", input: "failed at /Users/voitz/.config/codex" },
    { label: "/home/ path", input: "failed at /home/voitz/.config/codex" },
    { label: "Bearer token", input: "Authorization failed Bearer abcdefghijklmnop" },
    { label: "sk- token", input: "invalid sk-abcdefghijklmnopqrst" },
    { label: "ghp_ token", input: "auth failed ghp_abcdefghijklmnopqrst" },
    { label: "correlationId", input: "upstream correlationId=abc-def-123" },
    {
      label: "benign diagnostic",
      input: "The provider dropped the connection.",
      expected: "The provider dropped the connection.",
    },
  ])("sanitizePresentationText handles $label", ({ input, expected }) => {
    expect(sanitizePresentationText(input)).toBe(expected ?? SAFE_PRESENTATION_FALLBACK);
  });

  it("keeps transport guidance generic when stream errors include raw diagnostics", () => {
    const unsafe = "Bearer sk-live-secret /Users/voitz/.config/codex correlationId=abc";
    expect(classifyReviewStreamError(unsafe, "STREAM_ERROR")).toEqual({
      kind: "transport",
      title: "Connection Lost",
      guidance: "The review stream was interrupted. Retry to reconnect to the active review.",
      ctaLabel: "Retry",
    });
  });
});
