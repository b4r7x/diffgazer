import {
  type EvidenceKey,
  EvidenceKeySchema,
  hashEvidenceKey as hashCoreEvidenceKey,
  Sha256HexSchema,
  sha256CanonicalJsonSync,
} from "@diffgazer/core/schemas/review";
import { z } from "zod";

/**
 * Evidence is an observation of one immutable provider tuple.  A missing
 * record is represented by the absence of `AdmissionEvidence`; the explicit
 * statuses below describe records that were observed or deliberately skipped.
 */
export const ADMISSION_EVIDENCE_STATUSES = [
  "not-checked",
  "pending",
  "failed",
  "skipped",
  "passed",
  "expired",
] as const;
export const AdmissionEvidenceStatusSchema = z.enum(ADMISSION_EVIDENCE_STATUSES);
export type AdmissionEvidenceStatus = z.infer<typeof AdmissionEvidenceStatusSchema>;

const CheckedAtSchema = z.iso.datetime().nullable();
const ExpiresAtSchema = z.iso.datetime().nullable().optional();

/**
 * The server-only evidence record.  The key carries only credential and
 * workspace reference digests, never their literal values.  Keeping the
 * complete key here lets the server recompute readiness without trusting a
 * client-provided digest or status.
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
    if (evidence.status === "not-checked" && evidence.checkedAt !== null) {
      context.addIssue({
        code: "custom",
        message: "Not-checked evidence cannot carry an observation time",
        path: ["checkedAt"],
      });
    }

    if (evidence.status !== "not-checked" && evidence.checkedAt === null) {
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
 * This is the only evidence shape allowed to cross the client boundary.  It
 * deliberately omits the complete key, expiry policy, runtime identity and
 * all server-only observations.
 */
export const SafeEvidenceReferenceSchema = z
  .strictObject({
    evidenceKeyHash: Sha256HexSchema,
    checkedAt: CheckedAtSchema,
    status: AdmissionEvidenceStatusSchema,
  })
  .readonly();
export type SafeEvidenceReference = z.infer<typeof SafeEvidenceReferenceSchema>;

export function hashAdmissionEvidenceKeySync(input: unknown): string {
  return sha256CanonicalJsonSync(EvidenceKeySchema.parse(input));
}

export function hashAdmissionEvidenceKey(input: unknown): Promise<string> {
  return hashCoreEvidenceKey(EvidenceKeySchema.parse(input));
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

export function toSafeEvidenceReference(
  evidence: AdmissionEvidence | z.input<typeof AdmissionEvidenceSchema>,
): SafeEvidenceReference {
  const parsed = AdmissionEvidenceSchema.parse(evidence);
  return SafeEvidenceReferenceSchema.parse({
    evidenceKeyHash: parsed.evidenceKeyHash,
    checkedAt: parsed.checkedAt,
    status: parsed.status,
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

export type EvidenceFreshnessOptions = {
  readonly now?: Date | string;
  readonly maxAgeMs?: number;
};

/**
 * Admission is fail-closed: only a passed, hash-matching observation with a
 * valid timestamp and unexpired freshness window can authorize execution.
 */
export function canAuthorizeEvidence(
  evidence: AdmissionEvidence | z.input<typeof AdmissionEvidenceSchema> | null | undefined,
  expectedKey: z.input<typeof EvidenceKeySchema>,
  options: EvidenceFreshnessOptions = {},
): boolean {
  const parsed = AdmissionEvidenceSchema.safeParse(evidence);
  if (!parsed.success || parsed.data.status !== "passed") return false;
  if (parsed.data.checkedAt === null || !evidenceMatchesKey(parsed.data, expectedKey)) return false;

  const now = parseNow(options.now ?? new Date());
  const checkedAt = Date.parse(parsed.data.checkedAt);
  if (now === null || !Number.isFinite(checkedAt) || checkedAt > now) return false;

  if (parsed.data.expiresAt !== undefined && parsed.data.expiresAt !== null) {
    const expiresAt = Date.parse(parsed.data.expiresAt);
    if (!Number.isFinite(expiresAt) || now >= expiresAt) return false;
  }

  if (options.maxAgeMs !== undefined) {
    if (!Number.isFinite(options.maxAgeMs) || options.maxAgeMs < 0) return false;
    if (now - checkedAt >= options.maxAgeMs) return false;
  }

  return true;
}

export function isEvidenceExpired(
  evidence: AdmissionEvidence | z.input<typeof AdmissionEvidenceSchema>,
  options: Pick<EvidenceFreshnessOptions, "now" | "maxAgeMs"> = {},
): boolean {
  const parsed = AdmissionEvidenceSchema.safeParse(evidence);
  if (!parsed.success || parsed.data.status === "expired") return true;
  if (parsed.data.checkedAt === null) return parsed.data.status !== "passed";

  const now = parseNow(options.now ?? new Date());
  const checkedAt = Date.parse(parsed.data.checkedAt);
  if (now === null || !Number.isFinite(checkedAt)) return true;

  if (parsed.data.expiresAt !== undefined && parsed.data.expiresAt !== null) {
    const expiresAt = Date.parse(parsed.data.expiresAt);
    if (!Number.isFinite(expiresAt) || now >= expiresAt) return true;
  }

  return options.maxAgeMs !== undefined
    ? !Number.isFinite(options.maxAgeMs) ||
        options.maxAgeMs < 0 ||
        now - checkedAt >= options.maxAgeMs
    : false;
}

export type { EvidenceKey };
export { EvidenceKeySchema };
