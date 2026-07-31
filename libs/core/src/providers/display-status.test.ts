import { describe, expect, it } from "vitest";
import {
  READINESS_PRESENTATION,
  type Readiness,
  ReadinessSchema,
} from "../schemas/config/readiness.js";
import type { TransportFamily } from "../schemas/config/transports.js";
import {
  getDisplayStatusBadge,
  getProviderDisplay,
  getProviderDisplayStatus,
} from "./display-status.js";

const CHECKED_AT = "2026-07-31T10:00:00.000Z";
type TestedReadinessStatus =
  | "ready"
  | "acknowledgement-required"
  | "local-endpoint-unreachable"
  | "unsupported"
  | "removed";

function readiness(status: TestedReadinessStatus): Readiness {
  const presentation = READINESS_PRESENTATION[status];

  if (status === "ready") {
    return ReadinessSchema.parse({
      status,
      ready: true,
      evidenceStatus: "passed",
      checkedAt: CHECKED_AT,
      acknowledgement: {
        status: "accepted",
        noticeId: "provider-notice",
        noticeVersion: 1,
        acceptedAt: CHECKED_AT,
      },
      ...presentation,
    });
  }

  if (status === "acknowledgement-required") {
    return ReadinessSchema.parse({
      status,
      ready: false,
      evidenceStatus: "passed",
      checkedAt: CHECKED_AT,
      acknowledgement: {
        status: "required",
        noticeId: "provider-notice",
        noticeVersion: 1,
      },
      ...presentation,
    });
  }

  if (status === "local-endpoint-unreachable") {
    return ReadinessSchema.parse({
      status,
      ready: false,
      evidenceStatus: "failed",
      checkedAt: CHECKED_AT,
      acknowledgement: { status: "not-applicable" },
      ...presentation,
    });
  }

  return ReadinessSchema.parse({
    status,
    ready: false,
    evidenceStatus: "not-checked",
    checkedAt: null,
    acknowledgement: { status: "not-applicable" },
    ...presentation,
  });
}

function display(status: TestedReadinessStatus, family: TransportFamily) {
  return getProviderDisplayStatus(readiness(status), family);
}

describe("getProviderDisplayStatus", () => {
  it.each([
    ["removed", "hosted-api", "Removed", "delete"],
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
      display("removed", "hosted-api"),
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

describe("getDisplayStatusBadge", () => {
  it("keeps readable text alongside the visual variant", () => {
    expect(getDisplayStatusBadge(readiness("unsupported"), "local-cli")).toEqual({
      label: "CLI unsupported",
      variant: "warning",
    });
    expect(getDisplayStatusBadge(readiness("ready"), "hosted-api")).toEqual({
      label: "Ready",
      variant: "success",
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
