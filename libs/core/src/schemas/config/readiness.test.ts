import { describe, expect, expectTypeOf, it } from "vitest";
import {
  READINESS_PRESENTATION,
  READINESS_STATUSES,
  type Readiness,
  ReadinessAcknowledgementSchema,
  ReadinessSchema,
  type ReadinessStatus,
} from "./readiness.js";

const READINESS_ACTION_CONTRACT = {
  unconfigured: { action: "create", remediationCode: "configure" },
  "credential-invalid": { action: "update", remediationCode: "replace-credential" },
  "model-missing": { action: "select", remediationCode: "select-model" },
  "conformance-pending": { action: "test", remediationCode: "run-conformance" },
  "conformance-failed": { action: "test", remediationCode: "rerun-conformance" },
  "acknowledgement-required": { action: "update", remediationCode: "accept-notice" },
  unsupported: { action: "inspect", remediationCode: "review-support" },
  skipped: { action: "test", remediationCode: "enable-live-probe" },
  "local-conformance-failed": { action: "test", remediationCode: "rerun-conformance" },
  ready: { action: "inspect", remediationCode: "none" },
} as const satisfies Record<
  ReadinessStatus,
  { action: (typeof READINESS_PRESENTATION)[ReadinessStatus]["action"]; remediationCode: string }
>;

const CHECKED_AT = "2026-07-31T12:00:00.000Z";
const REQUIRED_ACKNOWLEDGEMENT = {
  status: "required" as const,
  noticeId: "product-notice",
  noticeVersion: 1,
};
const ACCEPTED_ACKNOWLEDGEMENT = {
  status: "accepted" as const,
  noticeId: "product-notice",
  noticeVersion: 1,
  acceptedAt: "2026-07-31T11:00:00.000Z",
};

const STATUS_CONTRACT = {
  unconfigured: { ready: false, evidenceStatus: "not-checked", checkedAt: null },
  "credential-invalid": { ready: false, evidenceStatus: "failed", checkedAt: CHECKED_AT },
  "model-missing": { ready: false, evidenceStatus: "failed", checkedAt: CHECKED_AT },
  "conformance-pending": { ready: false, evidenceStatus: "pending", checkedAt: CHECKED_AT },
  "conformance-failed": { ready: false, evidenceStatus: "failed", checkedAt: CHECKED_AT },
  "acknowledgement-required": {
    ready: false,
    evidenceStatus: "passed",
    checkedAt: CHECKED_AT,
  },
  unsupported: { ready: false, evidenceStatus: "not-checked", checkedAt: null },
  skipped: { ready: false, evidenceStatus: "skipped", checkedAt: CHECKED_AT },
  "local-conformance-failed": {
    ready: false,
    evidenceStatus: "failed",
    checkedAt: CHECKED_AT,
  },
  ready: { ready: true, evidenceStatus: "passed", checkedAt: CHECKED_AT },
} as const;

function readinessInput(status: ReadinessStatus) {
  let acknowledgement:
    | typeof ACCEPTED_ACKNOWLEDGEMENT
    | typeof REQUIRED_ACKNOWLEDGEMENT
    | { status: "not-applicable" } = REQUIRED_ACKNOWLEDGEMENT;
  if (status === "ready") acknowledgement = ACCEPTED_ACKNOWLEDGEMENT;
  if (status === "unsupported") {
    acknowledgement = { status: "not-applicable" };
  }
  return {
    status,
    ...STATUS_CONTRACT[status],
    acknowledgement,
    ...READINESS_PRESENTATION[status],
  };
}

describe("readiness contract", () => {
  it("pins every readiness status to its action and remediation code", () => {
    expect(READINESS_STATUSES).toHaveLength(10);

    for (const status of READINESS_STATUSES) {
      const expected = READINESS_ACTION_CONTRACT[status];
      const result = ReadinessSchema.parse(readinessInput(status));

      expect(result.status).toBe(status);
      expect(result.action).toBe(expected.action);
      expect(result.remediation.code).toBe(expected.remediationCode);
      expect(result.explanation.length).toBeGreaterThan(0);
      expect(result.remediation.message.length).toBeGreaterThan(0);
    }
  });

  it("gives every hosted readiness state distinct, actionable guidance", () => {
    const statuses = [
      "unconfigured",
      "credential-invalid",
      "model-missing",
      "conformance-pending",
      "conformance-failed",
      "acknowledgement-required",
      "unsupported",
      "ready",
    ] as const;

    for (const status of statuses) {
      const result = ReadinessSchema.parse(readinessInput(status));
      expect(result.status).toBe(status);
      expect(result.explanation.length).toBeGreaterThan(0);
      expect(result.remediation.message.length).toBeGreaterThan(0);
    }
    expect(new Set(statuses)).toHaveLength(statuses.length);
  });

  it("separates a local conformance failure from the hosted one", () => {
    const local = ReadinessSchema.parse(readinessInput("local-conformance-failed"));
    const hosted = ReadinessSchema.parse(readinessInput("conformance-failed"));

    expect(local.ready).toBe(false);
    expect(local.evidenceStatus).toBe("failed");
    expect(local.explanation).not.toBe(hosted.explanation);
  });

  it("never treats a skipped check as ready or passed", () => {
    const skipped = readinessInput("skipped");

    expect(ReadinessSchema.parse(skipped)).toMatchObject({
      status: "skipped",
      ready: false,
      evidenceStatus: "skipped",
    });
    expect(ReadinessSchema.safeParse({ ...skipped, ready: true }).success).toBe(false);
    expect(ReadinessSchema.safeParse({ ...skipped, evidenceStatus: "passed" }).success).toBe(false);
  });

  it("requires explicit acknowledgement for notices and readiness", () => {
    expect(ReadinessAcknowledgementSchema.parse(REQUIRED_ACKNOWLEDGEMENT)).toEqual(
      REQUIRED_ACKNOWLEDGEMENT,
    );
    expect(ReadinessAcknowledgementSchema.parse(ACCEPTED_ACKNOWLEDGEMENT)).toEqual(
      ACCEPTED_ACKNOWLEDGEMENT,
    );

    expect(
      ReadinessSchema.safeParse({
        ...readinessInput("acknowledgement-required"),
        acknowledgement: ACCEPTED_ACKNOWLEDGEMENT,
      }).success,
    ).toBe(false);
    expect(
      ReadinessSchema.safeParse({
        ...readinessInput("ready"),
        acknowledgement: REQUIRED_ACKNOWLEDGEMENT,
      }).success,
    ).toBe(false);
  });

  it("records checkedAt for observed, failed, and skipped states", () => {
    for (const status of [
      "credential-invalid",
      "conformance-pending",
      "skipped",
      "ready",
    ] as const) {
      expect(ReadinessSchema.parse(readinessInput(status)).checkedAt).toBe(CHECKED_AT);
      expect(
        ReadinessSchema.safeParse({ ...readinessInput(status), checkedAt: null }).success,
      ).toBe(false);
    }

    expect(ReadinessSchema.parse(readinessInput("unconfigured")).checkedAt).toBeNull();
    expect(
      ReadinessSchema.safeParse({ ...readinessInput("unconfigured"), checkedAt: CHECKED_AT })
        .success,
    ).toBe(false);
  });

  it("rejects secret, account, workspace, and path details", () => {
    const ready = readinessInput("ready");
    const unsafeFields = [
      { apiKey: "secret" },
      { accessToken: "secret" },
      { accountId: "account-123" },
      { workspaceId: "workspace-123" },
      { authPath: "/home/person/.config/tool/auth.json" },
      { executablePath: "/usr/local/bin/tool" },
    ];

    for (const unsafeField of unsafeFields) {
      expect(ReadinessSchema.safeParse({ ...ready, ...unsafeField }).success).toBe(false);
    }
    expect(
      ReadinessSchema.safeParse({
        ...ready,
        explanation: "Credential: secret-value",
      }).success,
    ).toBe(false);
    expect(
      ReadinessSchema.safeParse({
        ...ready,
        remediation: { ...ready.remediation, details: "/home/person/.config/tool" },
      }).success,
    ).toBe(false);
  });

  it("ties action, explanation, and remediation copy to the status at the type level", () => {
    type ReadyReadiness = Extract<Readiness, { status: "ready" }>;
    type UnconfiguredReadiness = Extract<Readiness, { status: "unconfigured" }>;

    expectTypeOf<ReadyReadiness["action"]>().toEqualTypeOf<"inspect">();
    expectTypeOf<ReadyReadiness["remediation"]["code"]>().toEqualTypeOf<"none">();
    expectTypeOf<UnconfiguredReadiness["action"]>().toEqualTypeOf<"create">();
    expectTypeOf<UnconfiguredReadiness["remediation"]["code"]>().toEqualTypeOf<"configure">();

    const acceptReadiness = (_readiness: Readiness) => undefined;
    const readyState = {
      status: "ready",
      ready: true,
      evidenceStatus: "passed",
      checkedAt: CHECKED_AT,
      acknowledgement: ACCEPTED_ACKNOWLEDGEMENT,
    } as const;

    acceptReadiness({ ...readyState, ...READINESS_PRESENTATION.ready });
    // @ts-expect-error a ready readiness cannot carry another status's presentation copy.
    acceptReadiness({ ...readyState, ...READINESS_PRESENTATION.unconfigured });
    // @ts-expect-error a ready readiness cannot carry another status's action alone.
    acceptReadiness({ ...readyState, ...READINESS_PRESENTATION.ready, action: "create" });

    expect(
      ReadinessSchema.safeParse({ ...readyState, ...READINESS_PRESENTATION.unconfigured }).success,
    ).toBe(false);
  });
});
