import { z } from "zod";
import { scanJsonRejectingDuplicateKeys } from "../canonical-json.js";

export const LEGACY_V1_HAS_API_KEY_PROPERTY = "hasApiKey" as const;

export const LEGACY_PROVIDER_IDS_V1 = ["gemini", "zai", "openrouter", "groq", "cerebras"] as const;
export const LegacyProviderIdV1Schema = z.enum(LEGACY_PROVIDER_IDS_V1);
export type LegacyProviderIdV1 = z.infer<typeof LegacyProviderIdV1Schema>;

export const LegacyProviderConfigV1Schema = z.strictObject({
  provider: LegacyProviderIdV1Schema,
  hasApiKey: z.boolean(),
  isActive: z.boolean(),
  model: z.string().optional(),
});
export type LegacyProviderConfigV1 = z.infer<typeof LegacyProviderConfigV1Schema>;

export const DecodedProviderConfigurationRecordSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("migrate-v1"),
    record: LegacyProviderConfigV1Schema,
  }),
  z.strictObject({
    status: z.literal("unknown"),
    rawBytes: z.instanceof(Uint8Array),
  }),
]);
export type DecodedProviderConfigurationRecord = z.infer<
  typeof DecodedProviderConfigurationRecordSchema
>;

function copyBytes(rawBytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(rawBytes.byteLength);
  copy.set(rawBytes);
  return copy;
}

// V1 records are untrusted bytes, so they go through the shared bounded scanner
// in canonical-json.ts, which rejects a repeated object key before JSON.parse
// can collapse it to the last value (and so relabel one provider as another).
const MAX_LEGACY_RECORD_BYTES = 64 * 1024;
const MAX_LEGACY_JSON_DEPTH = 32;

export function decodeProviderConfigurationRecord(
  inputBytes: Uint8Array,
): DecodedProviderConfigurationRecord {
  const rawBytes = copyBytes(inputBytes);
  let input: unknown;

  try {
    if (rawBytes.byteLength > MAX_LEGACY_RECORD_BYTES) {
      throw new TypeError("legacy record exceeds the bounded decoder limit");
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);
    scanJsonRejectingDuplicateKeys(text, {
      maxBytes: MAX_LEGACY_RECORD_BYTES,
      maxDepth: MAX_LEGACY_JSON_DEPTH,
      onFail: ({ position, reason }) => {
        throw new TypeError(`Legacy JSON parse failed at ${position}: ${reason}`);
      },
    });
    input = JSON.parse(text) as unknown;
  } catch {
    return { status: "unknown", rawBytes };
  }

  const legacyRecord = LegacyProviderConfigV1Schema.safeParse(input);
  if (!legacyRecord.success) return { status: "unknown", rawBytes };

  return { status: "migrate-v1", record: legacyRecord.data };
}
