import { describe, expect, it } from "vitest";
import {
  READINESS_PRESENTATION,
  READINESS_STATUSES,
  type Readiness,
  ReadinessSchema,
  type ReadinessStatus,
} from "../schemas/config/readiness.js";
import type { TransportFamily } from "../schemas/config/transports.js";
import {
  getProviderDisplay,
  getProviderDisplayStatus,
  getUnconfiguredDisplayStatus,
} from "./display-status.js";

const CHECKED_AT = "2026-07-31T10:00:00.000Z";
const NOT_APPLICABLE = { status: "not-applicable" } as const;
const REQUIRED = { status: "required", noticeId: "provider-notice", noticeVersion: 1 } as const;
const ACCEPTED = {
  status: "accepted",
  noticeId: "provider-notice",
  noticeVersion: 1,
  acceptedAt: CHECKED_AT,
} as const;

function evidence(status: ReadinessStatus) {
  if (status === "ready") {
    return {
      ready: true,
      evidenceStatus: "passed",
      checkedAt: CHECKED_AT,
      acknowledgement: ACCEPTED,
    };
  }

  if (status === "acknowledgement-required") {
    return {
      ready: false,
      evidenceStatus: "passed",
      checkedAt: CHECKED_AT,
      acknowledgement: REQUIRED,
    };
  }

  if (status === "unconfigured" || status === "unsupported") {
    return {
      ready: false,
      evidenceStatus: "not-checked",
      checkedAt: null,
      acknowledgement: NOT_APPLICABLE,
    };
  }

  if (status === "conformance-pending") {
    return {
      ready: false,
      evidenceStatus: "pending",
      checkedAt: CHECKED_AT,
      acknowledgement: NOT_APPLICABLE,
    };
  }

  if (status === "skipped") {
    return {
      ready: false,
      evidenceStatus: "skipped",
      checkedAt: CHECKED_AT,
      acknowledgement: NOT_APPLICABLE,
    };
  }

  return {
    ready: false,
    evidenceStatus: "failed",
    checkedAt: CHECKED_AT,
    acknowledgement: NOT_APPLICABLE,
  };
}

function readiness(status: ReadinessStatus): Readiness {
  return ReadinessSchema.parse({
    status,
    ...evidence(status),
    ...READINESS_PRESENTATION[status],
  });
}

function display(status: ReadinessStatus, family: TransportFamily) {
  return getProviderDisplayStatus(readiness(status), family);
}

describe("getProviderDisplayStatus", () => {
  it.each([
    ["local-endpoint-unreachable", "local-http", "Local endpoint unreachable", "test"],
    ["unsupported", "local-cli", "CLI unsupported", "inspect"],
    ["acknowledgement-required", "hosted-api", "Acknowledgement required", "update"],
    ["ready", "hosted-api", "Ready", "inspect"],
  ] as const)("presents %s as distinct non-color status text with its machine action", (status, family, label, action) => {
    const result = display(status, family);

    expect(result).toMatchObject({ status, action, label });
    expect(result.explanation).toBe(READINESS_PRESENTATION[status].explanation);
    expect(result.remediation).toBe(READINESS_PRESENTATION[status].remediation.message);
    expect(result.accessibleText).toContain(label);
    expect(result.accessibleText).toContain(result.explanation);
    expect(result.accessibleText).toContain(result.remediation);
  });

  it("does not reduce distinct machine states to color or credential-only copy", () => {
    const results = [
      display("local-endpoint-unreachable", "local-http"),
      display("unsupported", "local-cli"),
      display("acknowledgement-required", "hosted-api"),
      display("ready", "hosted-api"),
    ];

    expect(new Set(results.map(({ status }) => status))).toHaveLength(results.length);
    expect(new Set(results.map(({ label }) => label))).toHaveLength(results.length);
    expect(JSON.stringify(results).toLowerCase()).not.toContain("api key");
  });
});

describe("status badge wording", () => {
  it("keeps readable text alongside the visual variant", () => {
    expect(display("unsupported", "local-cli")).toMatchObject({
      label: "CLI unsupported",
      shortLabel: "unsupported",
      variant: "warning",
    });
    expect(display("ready", "hosted-api")).toMatchObject({
      label: "Ready",
      shortLabel: "ready",
      variant: "success",
    });
  });

  it("describes compatibility checks in product language rather than conformance jargon", () => {
    expect(display("conformance-pending", "hosted-api").label).toBe("Compatibility check needed");
    expect(display("conformance-failed", "hosted-api").label).toBe("Compatibility check failed");
  });

  it("marks a missing model as needing attention, not as a failure", () => {
    expect(display("model-missing", "hosted-api").variant).toBe("warning");
  });
});

describe("status short labels", () => {
  it.each(READINESS_STATUSES)("reduces %s to one lowercase status word", (status) => {
    expect(display(status, "hosted-api").shortLabel).toMatch(/^[a-z]+$/);
  });
});

describe("getUnconfiguredDisplayStatus", () => {
  it("carries the shared unconfigured badge wording with nothing to explain yet", () => {
    const { label, shortLabel, variant } = display("unconfigured", "hosted-api");
    expect(getUnconfiguredDisplayStatus()).toEqual({
      label,
      shortLabel,
      variant,
      status: "unconfigured",
      action: "create",
      explanation: "",
      remediation: "",
      accessibleText: "Not configured",
    });
  });

  it("lets a shell reword the status it is still resolving without losing the badge tone", () => {
    const loading = getUnconfiguredDisplayStatus({ label: "Loading", shortLabel: "loading" });

    expect(loading).toMatchObject({
      label: "Loading",
      shortLabel: "loading",
      accessibleText: "Loading",
      variant: "warning",
    });
  });
});

describe("getProviderDisplay", () => {
  it("returns the not-configured placeholder when the product is missing", () => {
    expect(getProviderDisplay()).toBe("Not configured");
    expect(getProviderDisplay(undefined, "model-id")).toBe("Not configured");
  });

  it("presents the exact product and model identities", () => {
    expect(getProviderDisplay("Gemini", "gemini-2.5-flash")).toBe("Gemini / gemini-2.5-flash");
    expect(getProviderDisplay("Gemini")).toBe("Gemini");
  });
});
