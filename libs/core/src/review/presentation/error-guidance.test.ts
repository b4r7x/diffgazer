import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import { READINESS_PRESENTATION, ReadinessSchema } from "../../schemas/config/index.js";
import type { ReadinessStatus } from "../../schemas/config/readiness.js";
import { TERMINAL_OUTCOMES } from "../../schemas/review/execution.js";
import {
  CONFIGURATION_ERROR_COPY,
  CONFIGURE_PROVIDER_LABEL,
  classifyReviewStreamError,
  describeReviewCancellation,
  describeReviewStartError,
  describeTerminalOutcome,
  describeUsageAvailability,
  getApiKeyMissingCopy,
  getConfigurationNotReadyCopy,
  readinessUsesTransportNeutralCopy,
  sanitizePresentationText,
  TERMINAL_OUTCOME_PRESENTATION,
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
    const readiness = makeReadiness("local-endpoint-unreachable");

    expect(getConfigurationNotReadyCopy({ productLabel: "ollama", readiness })).toEqual({
      title: "Configuration Not Ready (ollama)",
      body: "The configured local server could not be reached. Start the selected local server, then test the configuration again.",
    });
    expect(getApiKeyMissingCopy({ productLabel: "ollama", readiness })).toEqual({
      title: "Configuration Not Ready (ollama)",
      body: "The configured local server could not be reached. Start the selected local server, then test the configuration again.",
    });
    expect(CONFIGURATION_ERROR_COPY).toEqual({
      title: "Configuration Unavailable",
      body: "Diffgazer could not load the current configuration. Retry the request or return home.",
    });
    expect(CONFIGURE_PROVIDER_LABEL).toBe("Configure Provider");
  });

  it.each([
    "local-endpoint-unreachable",
    "unsupported",
    "skipped",
  ] as const)("never says API key for %s readiness", (status) => {
    const readiness = makeReadiness(status);
    const copy = getConfigurationNotReadyCopy({ readiness });
    expect(readinessUsesTransportNeutralCopy(readiness)).toBe(true);
    expect(copy.title.toLowerCase()).not.toContain("api key");
    expect(copy.body.toLowerCase()).not.toContain("api key");
  });

  it.each(TERMINAL_OUTCOMES)("distinguishes terminal outcome %s with shared copy", (outcome) => {
    expect(describeTerminalOutcome(outcome)).toEqual(TERMINAL_OUTCOME_PRESENTATION[outcome]);
    expect(describeTerminalOutcome(outcome).title.length).toBeGreaterThan(0);
    expect(describeTerminalOutcome(outcome).message.length).toBeGreaterThan(0);
  });

  it("describes usage, budget, and cancellation guidance without raw diagnostics", () => {
    expect(describeUsageAvailability("reported")).toEqual(USAGE_AVAILABILITY_PRESENTATION.reported);
    expect(describeUsageAvailability("required-missing")).toEqual(
      USAGE_AVAILABILITY_PRESENTATION["required-missing"],
    );
    expect(describeUsageAvailability("unavailable")).toEqual(
      USAGE_AVAILABILITY_PRESENTATION.unavailable,
    );
    expect(describeReviewCancellation()).toEqual(TERMINAL_OUTCOME_PRESENTATION.cancelled);
    expect(describeTerminalOutcome("budget-exhausted").title).toBe("Budget Exhausted");
  });

  it.each([
    {
      code: "API_KEY_MISSING",
      title: "API Key Missing",
      message: "API key not found. Add one in Settings → Providers.",
    },
    {
      code: "UNSUPPORTED_PROVIDER",
      title: "Provider Not Configured",
      message: "Pick an AI provider in Settings → Providers.",
    },
    {
      code: "MODEL_ERROR",
      title: "Model Not Selected",
      message: "API key not found",
    },
    {
      code: "KEYRING_READ_FAILED",
      title: "Credential Storage Unavailable",
      message: "API key not found. Check Settings → Storage.",
    },
  ])("describes $code review start failures", ({ code, title, message }) => {
    const error = Object.assign(new Error("API key not found"), { code, status: 400 });

    expect(describeReviewStartError(error)).toEqual({ title, message });
  });

  it("falls back for unstructured review start failures", () => {
    expect(describeReviewStartError(new Error("network failed"))).toEqual({
      title: "Failed to Start Review",
      message: "Could not create a review session.",
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
    expect(classifyReviewStreamError("API-key rejected", "SESSION_STALE").kind).toBe("other");
    expect(classifyReviewStreamError("API-key rejected", null, "local-http").kind).toBe("other");
    expect(classifyReviewStreamError("API-key rejected", null, "local-cli").kind).toBe("other");
    expect(classifyReviewStreamError("API-key rejected", null, "hosted-api").kind).toBe("api-key");
  });

  it("fails neutral when the admitted transport family is unknown", () => {
    expect(classifyReviewStreamError("API-key rejected", null).kind).toBe("other");
    expect(classifyReviewStreamError("credentials rejected", "API_KEY_MISSING").kind).toBe("other");
  });

  it("exposes no raw diagnostics in presentation text", () => {
    const unsafe = "Bearer sk-live-secret /Users/voitz/.config/codex correlationId=abc";
    expect(sanitizePresentationText(unsafe)).toBe(
      "Diffgazer could not present this failure safely. Return home and retry the review.",
    );
    expect(classifyReviewStreamError(unsafe, "STREAM_ERROR").guidance).not.toContain("Bearer");
  });
});
