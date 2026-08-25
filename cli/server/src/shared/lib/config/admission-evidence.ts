import { sha256CanonicalJsonSync } from "@diffgazer/core/json";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import {
  type EvidenceKey,
  EvidenceKeySchema,
  type RuntimeIdentity,
  Sha256HexSchema,
} from "@diffgazer/core/schemas/review";
import { z } from "zod";
import { effectiveBudgetForRecord, executionLimitsFromBudget } from "./budget-ceiling.js";
import type { SupportedProviderConfigurationRecord } from "./provider-config.js";

/**
 * Evidence is an observation of one immutable provider tuple.  A missing
 * record is represented by the absence of `AdmissionEvidence`; the two statuses
 * below are the only verdicts an observation can record — the tuple answered in
 * schema, or it did not.
 */
const ADMISSION_EVIDENCE_STATUSES = ["failed", "passed"] as const;
const AdmissionEvidenceStatusSchema = z.enum(ADMISSION_EVIDENCE_STATUSES);
type AdmissionEvidenceStatus = z.infer<typeof AdmissionEvidenceStatusSchema>;

const CheckedAtSchema = z.iso.datetime().nullable();
const ExpiresAtSchema = z.iso.datetime().nullable().optional();

/**
 * The server-only evidence record.  The key carries only the credential
 * reference digest, never its literal value.  Keeping the complete key here
 * lets the server recompute readiness without trusting a client-provided
 * digest or status.
 */
export const AdmissionEvidenceSchema = z
  .strictObject({
    evidenceKey: EvidenceKeySchema,
    evidenceKeyHash: Sha256HexSchema,
    checkedAt: CheckedAtSchema,
    status: AdmissionEvidenceStatusSchema,
    expiresAt: ExpiresAtSchema,
  })
  .superRefine((evidence, context) => {
    if (evidence.checkedAt === null) {
      context.addIssue({
        code: "custom",
        message: "Observed evidence requires an observation time",
        path: ["checkedAt"],
      });
    }

    const expectedHash = sha256CanonicalJsonSync(evidence.evidenceKey);
    if (evidence.evidenceKeyHash !== expectedHash) {
      context.addIssue({
        code: "custom",
        message: "Evidence key hash does not match the canonical evidence key",
        path: ["evidenceKeyHash"],
      });
    }

    if (evidence.expiresAt !== undefined && evidence.expiresAt !== null) {
      const expiresAt = Date.parse(evidence.expiresAt);
      const checkedAt = evidence.checkedAt === null ? null : Date.parse(evidence.checkedAt);
      if (!Number.isFinite(expiresAt) || (checkedAt !== null && expiresAt <= checkedAt)) {
        context.addIssue({
          code: "custom",
          message: "Evidence expiry must be after its observation time",
          path: ["expiresAt"],
        });
      }
    }
  })
  .readonly();
export type AdmissionEvidence = z.infer<typeof AdmissionEvidenceSchema>;

/**
 * The one place an evidence key is derived from a stored configuration record.
 * Admission and readiness both compare against this projection, so it lives
 * beside the evidence record rather than inside either caller.
 */
export function buildExpectedEvidenceKey(input: {
  readonly record: SupportedProviderConfigurationRecord;
  readonly structuredOutputSchemaSha256: string;
  readonly runtime: RuntimeIdentity;
  readonly credentialReferenceIdentity: string | null;
}): EvidenceKey {
  const { record } = input;
  const product = PRODUCT_REGISTRY[record.productId];
  const expectedEndpoint =
    record.input.transportFamily === "local-cli" ? null : record.input.endpoint;

  const authentication =
    record.input.transportFamily === "local-http" ? record.input.authentication : null;
  const installationId =
    record.input.transportFamily === "local-cli" ? record.input.installationId : null;

  return EvidenceKeySchema.parse({
    authentication,
    credentialReferenceIdentity: input.credentialReferenceIdentity,
    installationId,
    productId: record.productId,
    transportFamily: record.transportFamily,
    normalizedEndpoint: expectedEndpoint,
    region: null,
    workspaceAccountReference: null,
    modelId: record.selectedModelId,
    runtime: input.runtime,
    structuredOutputSchemaSha256: input.structuredOutputSchemaSha256,
    noticeVersion: product.notice.noticeVersion,
    limits: executionLimitsFromBudget(effectiveBudgetForRecord(record)),
  });
}

export function hashAdmissionEvidenceKeySync(input: unknown): string {
  return sha256CanonicalJsonSync(EvidenceKeySchema.parse(input));
}

export type CreateAdmissionEvidenceInput = {
  readonly evidenceKey: z.input<typeof EvidenceKeySchema>;
  readonly checkedAt: string | null;
  readonly status: AdmissionEvidenceStatus;
  readonly expiresAt?: string | null;
};

export function createAdmissionEvidence(input: CreateAdmissionEvidenceInput): AdmissionEvidence {
  const evidenceKey = EvidenceKeySchema.parse(input.evidenceKey);
  return AdmissionEvidenceSchema.parse({
    evidenceKey,
    evidenceKeyHash: hashAdmissionEvidenceKeySync(evidenceKey),
    checkedAt: input.checkedAt,
    status: input.status,
    expiresAt: input.expiresAt,
  });
}

function parseNow(now: Date | string): number | null {
  const timestamp = now instanceof Date ? now.getTime() : Date.parse(now);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function evidenceMatchesKey(
  evidence: AdmissionEvidence | z.input<typeof AdmissionEvidenceSchema>,
  expectedKey: z.input<typeof EvidenceKeySchema>,
): boolean {
  const parsed = AdmissionEvidenceSchema.safeParse(evidence);
  if (!parsed.success) return false;
  return parsed.data.evidenceKeyHash === hashAdmissionEvidenceKeySync(expectedKey);
}

/**
 * Admission is fail-closed: only a passed, hash-matching observation with a
 * valid timestamp can authorize execution. Evidence is invalidated by a tuple
 * change alone; the `expiresAt` check only honours a deadline a campaign-era
 * record already carries.
 */
export function canAuthorizeEvidence(
  evidence: AdmissionEvidence | z.input<typeof AdmissionEvidenceSchema> | null | undefined,
  expectedKey: z.input<typeof EvidenceKeySchema>,
  options: { readonly now?: Date | string } = {},
): boolean {
  const parsed = AdmissionEvidenceSchema.safeParse(evidence);
  if (!parsed.success || parsed.data.status !== "passed") return false;
  // Compare hashes directly rather than re-entering `evidenceMatchesKey`, which
  // would re-parse (and re-hash) the value this function has already validated.
  if (parsed.data.checkedAt === null) return false;
  if (parsed.data.evidenceKeyHash !== hashAdmissionEvidenceKeySync(expectedKey)) return false;

  const now = parseNow(options.now ?? new Date());
  const checkedAt = Date.parse(parsed.data.checkedAt);
  if (now === null || !Number.isFinite(checkedAt) || checkedAt > now) return false;

  if (parsed.data.expiresAt !== undefined && parsed.data.expiresAt !== null) {
    const expiresAt = Date.parse(parsed.data.expiresAt);
    if (!Number.isFinite(expiresAt) || now >= expiresAt) return false;
  }

  return true;
}

export type { EvidenceKey };
export { EvidenceKeySchema };
