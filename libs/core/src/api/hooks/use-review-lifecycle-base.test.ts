import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import { READINESS_PRESENTATION, ReadinessSchema } from "../../schemas/config/index.js";
import type { ReadinessStatus } from "../../schemas/config/readiness.js";
import {
  buildReviewStartIdentity,
  canStartReview,
  deriveReviewGate,
  resolveReviewReadinessGate,
  resolveReviewStartReady,
} from "./use-review-lifecycle-base.js";

function makeReadiness(status: ReadinessStatus) {
  const product = PRODUCT_REGISTRY.ollama;
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

describe("deriveReviewGate", () => {
  it("gates on loading when a loadingMessage is present, even if other flags are set", () => {
    expect(
      deriveReviewGate({
        loadingMessage: "Checking for changes...",
        isConfigured: false,
        isNoDiffError: true,
      }),
    ).toBe("loading");
  });

  it("gates on unconfigured when not loading and the provider is not configured", () => {
    expect(
      deriveReviewGate({
        loadingMessage: null,
        isConfigured: false,
        isNoDiffError: true,
      }),
    ).toBe("unconfigured");
  });

  it("gates on no-diff when loaded and configured but there is no diff to review", () => {
    expect(
      deriveReviewGate({
        loadingMessage: null,
        isConfigured: true,
        isNoDiffError: true,
      }),
    ).toBe("no-diff");
  });

  it("falls through to running once loaded, configured, and a diff exists", () => {
    expect(
      deriveReviewGate({
        loadingMessage: null,
        isConfigured: true,
        isNoDiffError: false,
      }),
    ).toBe("running");
  });
});

describe("review start readiness gate", () => {
  it("only allows review start when readiness is ready", () => {
    expect(canStartReview({ readiness: makeReadiness("ready"), isConfigured: false })).toBe(true);
    expect(
      canStartReview({ readiness: makeReadiness("credential-invalid"), isConfigured: true }),
    ).toBe(false);
  });

  it.each([
    ["unreachable", "unreachable"],
    ["local-endpoint-unreachable", "unreachable"],
    ["conformance-pending", "conformance-pending"],
    ["unsupported", "unsupported"],
    ["skipped", "skipped"],
  ] as const)("keeps %s distinct as %s", (status, expected) => {
    const gate = resolveReviewReadinessGate(makeReadiness(status));
    expect(gate).toBe(expected);
    expect(gate).not.toBe("ready");
  });

  it("does not collapse distinct non-ready gates into a single bucket", () => {
    const gates = new Set(
      (
        [
          "unreachable",
          "conformance-pending",
          "unsupported",
          "skipped",
          "credential-invalid",
        ] as const
      ).map((status) => resolveReviewReadinessGate(makeReadiness(status))),
    );

    expect(gates).toEqual(
      new Set(["unreachable", "conformance-pending", "unsupported", "skipped", "not-ready"]),
    );
  });

  it("sends exact configuration identity for review start", () => {
    expect(
      buildReviewStartIdentity({
        configurationId: "gemini-primary",
        fingerprint: '{"configurationId":"gemini-primary","revision":1}',
      }),
    ).toEqual({
      configurationId: "gemini-primary",
      fingerprint: '{"configurationId":"gemini-primary","revision":1}',
    });
  });

  it("allows completed saved review resume without readiness or secret access", () => {
    expect(
      canStartReview({
        readiness: makeReadiness("local-endpoint-unreachable"),
        isConfigured: false,
        allowResumeWithoutSetup: true,
      }),
    ).toBe(true);
    expect(
      resolveReviewStartReady({
        readiness: makeReadiness("local-endpoint-unreachable"),
        isConfigured: false,
      }),
    ).toBe(false);
  });
});
