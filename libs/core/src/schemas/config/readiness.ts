import { z } from "zod";

export const READINESS_STATUSES = [
  "unconfigured",
  "credential-invalid",
  "model-missing",
  "conformance-pending",
  "conformance-failed",
  "acknowledgement-required",
  "unsupported",
  "skipped",
  "local-conformance-failed",
  "ready",
] as const;
export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

export const READINESS_ACTIONS = ["create", "inspect", "select", "test", "update"] as const;
export type ReadinessAction = (typeof READINESS_ACTIONS)[number];

export const READINESS_EVIDENCE_STATUSES = [
  "not-checked",
  "pending",
  "failed",
  "skipped",
  "passed",
] as const;
export type ReadinessEvidenceStatus = (typeof READINESS_EVIDENCE_STATUSES)[number];

export const READINESS_REMEDIATION_CODES = [
  "configure",
  "replace-credential",
  "select-model",
  "run-conformance",
  "rerun-conformance",
  "accept-notice",
  "review-support",
  "enable-live-probe",
  "none",
] as const;
export type ReadinessRemediationCode = (typeof READINESS_REMEDIATION_CODES)[number];

interface ReadinessPresentation {
  readonly action: ReadinessAction;
  readonly explanation: string;
  readonly remediation: {
    readonly code: ReadinessRemediationCode;
    readonly message: string;
  };
}

/**
 * Every surface that offers Verify must say what it costs before the user
 * triggers it. The conformance remediation messages below carry it into the
 * provider surfaces.
 */
export const CONFORMANCE_TEST_COST_DISCLOSURE =
  "Verify makes one small billed API call to the provider (typically under $0.02; free for local endpoints; codex and copilot use your CLI subscription quota).";

/**
 * The statuses a review may still be attempted under. Structured-output
 * conformance is the only thing a review can prove for itself, so an unproven
 * or cached-failed conformance never blocks the attempt: the review validates
 * inline and the admission path turns a cached failure into a free fast-fail.
 * Every other not-ready status is a free local check that must pass first.
 */
export const REVIEW_ATTEMPTABLE_STATUSES = [
  "ready",
  "conformance-pending",
  "skipped",
  "conformance-failed",
  "local-conformance-failed",
] as const satisfies readonly ReadinessStatus[];

export function canAttemptReview(status: ReadinessStatus): boolean {
  return (REVIEW_ATTEMPTABLE_STATUSES as readonly ReadinessStatus[]).includes(status);
}

/**
 * The statuses a provider surface offers "Select configuration" for as the
 * primary action: ready, or unverified — the first review verifies structured
 * output inline, so nothing has to run before the configuration is picked.
 * A cached failure is attemptable (it fast-fails for free) but its primary
 * action stays the remediation, never selection.
 */
export function canSelectConfiguration(status: ReadinessStatus): boolean {
  return status === "ready" || status === "conformance-pending";
}

export const READINESS_PRESENTATION = {
  unconfigured: {
    action: "create",
    explanation: "This product has not been configured.",
    remediation: { code: "configure", message: "Create a configuration to continue." },
  },
  "credential-invalid": {
    action: "update",
    explanation: "The configured credential was rejected.",
    remediation: {
      code: "replace-credential",
      message: "Update the configuration with a valid credential reference.",
    },
  },
  "model-missing": {
    action: "select",
    explanation: "The selected model is not available for this configuration.",
    remediation: { code: "select-model", message: "Select an available exact model." },
  },
  "conformance-pending": {
    action: "test",
    explanation: "Structured review support has not been verified yet.",
    remediation: {
      code: "run-conformance",
      message: `Reviews can start now; the first review verifies structured review support automatically. To check sooner, run Verify. ${CONFORMANCE_TEST_COST_DISCLOSURE}`,
    },
  },
  "conformance-failed": {
    action: "test",
    explanation: "The exact review path did not satisfy the structured output contract.",
    remediation: {
      code: "rerun-conformance",
      message: `Select a different model or update the configuration; reviews with this exact setup fail immediately until it changes. Verify can re-check it. ${CONFORMANCE_TEST_COST_DISCLOSURE}`,
    },
  },
  "acknowledgement-required": {
    action: "update",
    explanation: "The current product notice has not been accepted.",
    remediation: {
      code: "accept-notice",
      message: "Review and explicitly accept the current billing and privacy notice.",
    },
  },
  unsupported: {
    action: "inspect",
    explanation: "This configuration is not supported in the current environment.",
    remediation: {
      code: "review-support",
      message: "Review the supported products and environment requirements.",
    },
  },
  skipped: {
    action: "test",
    explanation: "The live readiness check was intentionally skipped.",
    remediation: {
      code: "enable-live-probe",
      message: "Satisfy the live-check prerequisites, then run Verify again.",
    },
  },
  "local-conformance-failed": {
    action: "test",
    explanation: "The local model failed the structured review conformance check.",
    remediation: {
      code: "rerun-conformance",
      message:
        "Select a different model or update the configuration; reviews with this exact setup fail immediately until it changes. Verify can re-check it.",
    },
  },
  ready: {
    action: "inspect",
    explanation: "The exact configured review path is ready.",
    remediation: { code: "none", message: "No remediation is required." },
  },
} as const satisfies Record<ReadinessStatus, ReadinessPresentation>;

const NoticeIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const NotApplicableAcknowledgementSchema = z.strictObject({
  status: z.literal("not-applicable"),
});
export const RequiredAcknowledgementSchema = z.strictObject({
  status: z.literal("required"),
  noticeId: NoticeIdSchema,
  noticeVersion: z.number().int().positive(),
});
export const AcceptedAcknowledgementSchema = z.strictObject({
  status: z.literal("accepted"),
  noticeId: NoticeIdSchema,
  noticeVersion: z.number().int().positive(),
  acceptedAt: z.iso.datetime(),
});
export const ReadinessAcknowledgementSchema = z.discriminatedUnion("status", [
  NotApplicableAcknowledgementSchema,
  RequiredAcknowledgementSchema,
  AcceptedAcknowledgementSchema,
]);
export type ReadinessAcknowledgement = z.infer<typeof ReadinessAcknowledgementSchema>;

const CheckedAtSchema = z.iso.datetime();
const NotCheckedAtSchema = z.null();

/**
 * Reads one presentation field while keeping its literal type tied to `Status`.
 * A direct `presentation.action` on a status-generic table lookup widens to
 * every status's action, which would let `Readiness` admit another status's
 * copy; an indexed read stays correlated.
 */
function presentationField<Source, const Field extends keyof Source>(
  source: Source,
  field: Field,
): Source[Field] {
  return source[field];
}

function readinessVariant<
  const Status extends ReadinessStatus,
  const Ready extends boolean,
  EvidenceStatus extends z.ZodType,
  CheckedAt extends z.ZodType,
  Acknowledgement extends z.ZodType,
>(
  status: Status,
  ready: Ready,
  evidenceStatus: EvidenceStatus,
  checkedAt: CheckedAt,
  acknowledgement: Acknowledgement,
) {
  const presentation = READINESS_PRESENTATION[status];
  const remediation = presentationField(presentation, "remediation");
  return z.strictObject({
    status: z.literal(status),
    ready: z.literal(ready),
    evidenceStatus,
    checkedAt,
    acknowledgement,
    action: z.literal(presentationField(presentation, "action")),
    explanation: z.literal(presentationField(presentation, "explanation")),
    remediation: z.strictObject({
      code: z.literal(presentationField(remediation, "code")),
      message: z.literal(presentationField(remediation, "message")),
    }),
  });
}

const observedFailure = <const Status extends ReadinessStatus>(status: Status) =>
  readinessVariant(
    status,
    false,
    z.literal("failed"),
    CheckedAtSchema,
    ReadinessAcknowledgementSchema,
  );

export const ReadinessSchema = z.discriminatedUnion("status", [
  readinessVariant(
    "unconfigured",
    false,
    z.literal("not-checked"),
    NotCheckedAtSchema,
    ReadinessAcknowledgementSchema,
  ),
  observedFailure("credential-invalid"),
  observedFailure("model-missing"),
  readinessVariant(
    "conformance-pending",
    false,
    z.literal("pending"),
    CheckedAtSchema,
    ReadinessAcknowledgementSchema,
  ),
  observedFailure("conformance-failed"),
  // The notice gates the first context send, so an outstanding acknowledgement
  // is reported ahead of whatever the evidence says about the tuple.
  readinessVariant(
    "acknowledgement-required",
    false,
    z.enum(["pending", "failed", "passed"]),
    CheckedAtSchema,
    RequiredAcknowledgementSchema,
  ),
  readinessVariant(
    "unsupported",
    false,
    z.literal("not-checked"),
    NotCheckedAtSchema,
    NotApplicableAcknowledgementSchema,
  ),
  readinessVariant(
    "skipped",
    false,
    z.literal("skipped"),
    CheckedAtSchema,
    ReadinessAcknowledgementSchema,
  ),
  observedFailure("local-conformance-failed"),
  readinessVariant(
    "ready",
    true,
    z.literal("passed"),
    CheckedAtSchema,
    AcceptedAcknowledgementSchema,
  ),
]);
export type Readiness = z.infer<typeof ReadinessSchema>;
