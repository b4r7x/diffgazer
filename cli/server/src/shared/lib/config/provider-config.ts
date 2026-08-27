import { TextDecoder } from "node:util";
import { scanJsonRejectingDuplicateKeys } from "@diffgazer/core/json";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import {
  ClientConfigurationInputSchema,
  type ConfigurationId,
  ConfigurationIdSchema,
  ConfigurationRevisionSchema,
  ExactModelIdSchema,
  RunnableProductIdSchema,
} from "@diffgazer/core/schemas/config";
import { z } from "zod";

/** The on-disk configuration format owned by the server. */
const PROVIDER_CONFIGURATION_SCHEMA_VERSION = 2 as const;

const TimestampSchema = z.iso.datetime();

/**
 * The transport input persisted in config.json.  These schemas deliberately do
 * not contain `credential` or `bearerToken`: those are write-only inputs owned by
 * secret-bindings.ts and must never be part of a non-secret record.
 */
export const NonSecretTransportInputSchema = z
  .strictObject({
    transportFamily: ClientConfigurationInputSchema.shape.transportFamily,
    productId: ClientConfigurationInputSchema.shape.productId,
    endpoint: ClientConfigurationInputSchema.shape.endpoint,
  })
  .superRefine((input, context) => {
    const result = ClientConfigurationInputSchema.safeParse(input);
    if (!result.success) {
      for (const issue of result.error.issues) {
        context.addIssue({ code: "custom", path: issue.path, message: issue.message });
      }
    }
  });
export type NonSecretTransportInput = z.infer<typeof NonSecretTransportInputSchema>;

const ConfigurationAcknowledgementSchema = z.strictObject({
  noticeId: z.string().min(1),
  noticeVersion: z.number().int().positive(),
  acceptedAt: TimestampSchema.nullable(),
});

/** Evidence is a non-secret identity/reference.  The evidence payload stays server-side. */
const ConfigurationEvidenceReferenceSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

const BudgetLimitSchema = z.number().int().positive().max(2_147_483_647);
const ConfigurationBudgetLimitsSchema = z.strictObject({
  inputTokens: BudgetLimitSchema,
  responseBytes: BudgetLimitSchema,
  wallTimeMs: BudgetLimitSchema,
  retries: z.number().int().nonnegative().max(100),
  concurrency: BudgetLimitSchema,
  perReview: BudgetLimitSchema,
});
export type ConfigurationBudgetLimits = z.infer<typeof ConfigurationBudgetLimitsSchema>;

const ProviderConfigurationRecordBaseShape = {
  schemaVersion: z.literal(PROVIDER_CONFIGURATION_SCHEMA_VERSION),
  configurationId: ConfigurationIdSchema,
  revision: ConfigurationRevisionSchema,
  transportFamily: z.literal("hosted-api"),
  productId: RunnableProductIdSchema,
  input: NonSecretTransportInputSchema,
  selectedModelId: ExactModelIdSchema.nullable(),
  acknowledgement: ConfigurationAcknowledgementSchema,
  evidenceReference: ConfigurationEvidenceReferenceSchema.nullable(),
  budget: ConfigurationBudgetLimitsSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
} as const;

/** A supported, executable-candidate record without any secret material. */
export const SupportedProviderConfigurationRecordSchema = z
  .strictObject({
    ...ProviderConfigurationRecordBaseShape,
    status: z.literal("supported"),
  })
  .superRefine((record, context) => {
    if (record.transportFamily !== record.input.transportFamily) {
      context.addIssue({
        code: "custom",
        path: ["transportFamily"],
        message: "Transport family must match the family input",
      });
    }
    if (record.productId !== record.input.productId) {
      context.addIssue({
        code: "custom",
        path: ["productId"],
        message: "Product id must match the family input",
      });
    }
  });
export type SupportedProviderConfigurationRecord = z.infer<
  typeof SupportedProviderConfigurationRecordSchema
>;

type UnknownProviderConfigurationRecord = {
  readonly status: "unknown";
  readonly rawBytes: Uint8Array;
  /** A non-authoritative id is useful for diagnostics, but never for selection. */
  readonly configurationId?: ConfigurationId;
};

export type ProviderConfigurationRecord =
  | SupportedProviderConfigurationRecord
  | UnknownProviderConfigurationRecord;

export type DecodedProviderConfigurationRecord =
  | {
      readonly status: "supported";
      readonly record: SupportedProviderConfigurationRecord;
      readonly rawBytes: Uint8Array;
    }
  | UnknownProviderConfigurationRecord;

export class ProviderConfigurationConflictError extends Error {
  readonly code = "CONFIGURATION_CONFLICT" as const;

  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigurationConflictError";
  }
}

class ProviderConfigurationDecodeError extends Error {
  readonly code = "CONFIGURATION_DECODE_FAILED" as const;

  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigurationDecodeError";
  }
}

function copyBytes(rawBytes: Uint8Array): Uint8Array {
  return new Uint8Array(rawBytes);
}

function decodeUtf8(rawBytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);
  } catch {
    return null;
  }
}

const MAX_PROVIDER_CONFIGURATION_RECORD_BYTES = 256 * 1024;
const MAX_JSON_DEPTH = 64;

/**
 * Decode one bounded provider-configuration document. The shared scanner rejects
 * a repeated object key, which `JSON.parse` alone would collapse to the last
 * value — letting a crafted file smuggle a second value past a validated field.
 */
function parseProviderConfigurationJson(text: string, maxBytes: number): unknown {
  scanJsonRejectingDuplicateKeys(text, {
    maxBytes,
    maxDepth: MAX_JSON_DEPTH,
    onFail: ({ position, reason }) => {
      throw new ProviderConfigurationDecodeError(
        `Invalid provider configuration JSON at ${position}: ${reason}`,
      );
    },
  });
  return JSON.parse(text) as unknown;
}

/**
 * Records written before acknowledgements carried a notice id are still valid
 * V2: the id is losslessly reconstructible from the product registry, and
 * readiness re-demands acceptance whenever id or version differ from the
 * current notice, so no acceptance is fabricated.
 */
function backfillAcknowledgementNoticeId(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const { acknowledgement, productId } = input as Record<string, unknown>;
  if (!acknowledgement || typeof acknowledgement !== "object" || "noticeId" in acknowledgement) {
    return input;
  }
  const parsedProductId = RunnableProductIdSchema.safeParse(productId);
  if (!parsedProductId.success) return input;
  return {
    ...input,
    acknowledgement: {
      ...acknowledgement,
      noticeId: PRODUCT_REGISTRY[parsedProductId.data].notice.id,
    },
  };
}

/**
 * No surface has ever let a user choose an output-token budget, so a persisted
 * `budget.outputTokens` is the retired default's fossil rather than a choice.
 * The strict budget schema would reject the whole record over it.
 */
function stripRetiredOutputTokensBudget(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const { budget } = input as Record<string, unknown>;
  if (!budget || typeof budget !== "object" || !("outputTokens" in budget)) return input;
  const remaining = { ...(budget as Record<string, unknown>) };
  delete remaining.outputTokens;
  return { ...input, budget: remaining };
}

/**
 * `retries: 0` was an old creation default, never a surface-exposed choice
 * (the current default is 1). It silently disables the malformed-output retry
 * the hosted profiles rely on, so reads floor it to the current default
 * without rewriting the user's file.
 */
function floorRetiredZeroRetriesBudget(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const { budget } = input as Record<string, unknown>;
  if (!budget || typeof budget !== "object") return input;
  if ((budget as Record<string, unknown>).retries !== 0) return input;
  return { ...input, budget: { ...(budget as Record<string, unknown>), retries: 1 } };
}

/** Decode one record, retaining the exact bytes for unknown/future records. */
export function decodeProviderConfigurationRecord(
  inputBytes: Uint8Array,
): DecodedProviderConfigurationRecord {
  const rawBytes = copyBytes(inputBytes);
  if (rawBytes.byteLength > MAX_PROVIDER_CONFIGURATION_RECORD_BYTES) {
    return { status: "unknown", rawBytes };
  }
  const text = decodeUtf8(rawBytes);
  if (text === null) return { status: "unknown", rawBytes };

  let input: unknown;
  try {
    input = parseProviderConfigurationJson(text, MAX_PROVIDER_CONFIGURATION_RECORD_BYTES);
  } catch {
    return { status: "unknown", rawBytes };
  }
  const supported = SupportedProviderConfigurationRecordSchema.safeParse(
    floorRetiredZeroRetriesBudget(
      stripRetiredOutputTokensBudget(backfillAcknowledgementNoticeId(input)),
    ),
  );
  if (supported.success) return { status: "supported", record: supported.data, rawBytes };

  const configurationId =
    input && typeof input === "object" && !Array.isArray(input)
      ? ConfigurationIdSchema.safeParse((input as Record<string, unknown>).configurationId)
      : null;
  return {
    status: "unknown",
    rawBytes,
    ...(configurationId?.success ? { configurationId: configurationId.data } : {}),
  };
}

export type { ConfigurationId };
