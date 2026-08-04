import { z } from "zod";

export const READINESS_STATUSES = [
  "unconfigured",
  "credential-invalid",
  "endpoint-invalid",
  "unreachable",
  "model-missing",
  "conformance-pending",
  "conformance-failed",
  "acknowledgement-required",
  "unsupported",
  "skipped",
  "local-endpoint-unreachable",
  "local-endpoint-forbidden",
  "local-api-incompatible",
  "local-no-review-capable-model",
  "local-selected-model-missing",
  "local-conformance-failed",
  "local-cancellation-failed",
  "ready",
] as const;
export const ReadinessStatusSchema = z.enum(READINESS_STATUSES);
export type ReadinessStatus = z.infer<typeof ReadinessStatusSchema>;

export const READINESS_ACTIONS = ["create", "inspect", "select", "test", "update"] as const;
export const ReadinessActionSchema = z.enum(READINESS_ACTIONS);
export type ReadinessAction = z.infer<typeof ReadinessActionSchema>;

export const READINESS_EVIDENCE_STATUSES = [
  "not-checked",
  "pending",
  "failed",
  "skipped",
  "passed",
] as const;
export const ReadinessEvidenceStatusSchema = z.enum(READINESS_EVIDENCE_STATUSES);
export type ReadinessEvidenceStatus = z.infer<typeof ReadinessEvidenceStatusSchema>;

export const READINESS_REMEDIATION_CODES = [
  "configure",
  "replace-credential",
  "correct-endpoint",
  "retry-connection",
  "select-model",
  "run-conformance",
  "rerun-conformance",
  "accept-notice",
  "review-support",
  "enable-live-probe",
  "start-local-server",
  "use-loopback-endpoint",
  "use-compatible-api",
  "install-review-capable-model",
  "select-listed-model",
  "repair-cancellation",
  "none",
] as const;
export const ReadinessRemediationCodeSchema = z.enum(READINESS_REMEDIATION_CODES);
export type ReadinessRemediationCode = z.infer<typeof ReadinessRemediationCodeSchema>;

interface ReadinessPresentation {
  readonly action: ReadinessAction;
  readonly explanation: string;
  readonly remediation: {
    readonly code: ReadinessRemediationCode;
    readonly message: string;
  };
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
  "endpoint-invalid": {
    action: "update",
    explanation: "The configured endpoint is not allowed for this product.",
    remediation: {
      code: "correct-endpoint",
      message: "Choose an allowed endpoint for this product and transport.",
    },
  },
  unreachable: {
    action: "test",
    explanation: "The configured service could not be reached.",
    remediation: {
      code: "retry-connection",
      message: "Check service availability, then test the configuration again.",
    },
  },
  "model-missing": {
    action: "select",
    explanation: "The selected model is not available for this configuration.",
    remediation: { code: "select-model", message: "Select an available exact model." },
  },
  "conformance-pending": {
    action: "test",
    explanation: "Structured review conformance has not been checked yet.",
    remediation: {
      code: "run-conformance",
      message: "Run Test readiness to verify structured review support.",
    },
  },
  "conformance-failed": {
    action: "test",
    explanation: "The exact review path did not satisfy the structured output contract.",
    remediation: {
      code: "rerun-conformance",
      message: "Review the safe failure guidance, then test the exact model again.",
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
      message: "Satisfy the live-check prerequisites, then test the configuration again.",
    },
  },
  "local-endpoint-unreachable": {
    action: "test",
    explanation: "The configured local server could not be reached.",
    remediation: {
      code: "start-local-server",
      message: "Start the selected local server, then test the configuration again.",
    },
  },
  "local-endpoint-forbidden": {
    action: "update",
    explanation: "The configured local endpoint is not an allowed loopback endpoint.",
    remediation: {
      code: "use-loopback-endpoint",
      message: "Choose a validated loopback endpoint on this machine.",
    },
  },
  "local-api-incompatible": {
    action: "update",
    explanation: "The local server does not expose a compatible review API.",
    remediation: {
      code: "use-compatible-api",
      message: "Use a supported local server and API configuration.",
    },
  },
  "local-no-review-capable-model": {
    action: "test",
    explanation: "The local server listed no review-capable model.",
    remediation: {
      code: "install-review-capable-model",
      message: "Make a review-capable model available in the local server.",
    },
  },
  "local-selected-model-missing": {
    action: "select",
    explanation: "The exact selected model is no longer listed by the local server.",
    remediation: {
      code: "select-listed-model",
      message: "Select an exact model currently listed by the local server.",
    },
  },
  "local-conformance-failed": {
    action: "test",
    explanation: "The local model failed the structured review conformance check.",
    remediation: {
      code: "rerun-conformance",
      message: "Review the safe failure guidance, then test the local model again.",
    },
  },
  "local-cancellation-failed": {
    action: "test",
    explanation: "The local runtime did not satisfy the cancellation contract.",
    remediation: {
      code: "repair-cancellation",
      message: "Resolve the local runtime cancellation failure before retrying.",
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

function readinessVariant<
  const Status extends ReadinessStatus,
  const Ready extends boolean,
  const EvidenceStatus extends ReadinessEvidenceStatus,
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
  return z.strictObject({
    status: z.literal(status),
    ready: z.literal(ready),
    evidenceStatus: z.literal(evidenceStatus),
    checkedAt,
    acknowledgement,
    action: z.literal(presentation.action),
    explanation: z.literal(presentation.explanation),
    remediation: z.strictObject({
      code: z.literal(presentation.remediation.code),
      message: z.literal(presentation.remediation.message),
    }),
  });
}

const observedFailure = <const Status extends ReadinessStatus>(status: Status) =>
  readinessVariant(status, false, "failed", CheckedAtSchema, ReadinessAcknowledgementSchema);

export const ReadinessSchema = z.discriminatedUnion("status", [
  readinessVariant(
    "unconfigured",
    false,
    "not-checked",
    NotCheckedAtSchema,
    ReadinessAcknowledgementSchema,
  ),
  observedFailure("credential-invalid"),
  observedFailure("endpoint-invalid"),
  observedFailure("unreachable"),
  observedFailure("model-missing"),
  readinessVariant(
    "conformance-pending",
    false,
    "pending",
    CheckedAtSchema,
    ReadinessAcknowledgementSchema,
  ),
  observedFailure("conformance-failed"),
  readinessVariant(
    "acknowledgement-required",
    false,
    "passed",
    CheckedAtSchema,
    RequiredAcknowledgementSchema,
  ),
  readinessVariant(
    "unsupported",
    false,
    "not-checked",
    NotCheckedAtSchema,
    NotApplicableAcknowledgementSchema,
  ),
  readinessVariant("skipped", false, "skipped", CheckedAtSchema, ReadinessAcknowledgementSchema),
  observedFailure("local-endpoint-unreachable"),
  observedFailure("local-endpoint-forbidden"),
  observedFailure("local-api-incompatible"),
  observedFailure("local-no-review-capable-model"),
  observedFailure("local-selected-model-missing"),
  observedFailure("local-conformance-failed"),
  observedFailure("local-cancellation-failed"),
  readinessVariant("ready", true, "passed", CheckedAtSchema, AcceptedAcknowledgementSchema),
]);
export type Readiness = z.infer<typeof ReadinessSchema>;
