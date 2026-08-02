import { z } from "zod";

export const REMOVED_PRODUCT_IDS = ["zai-coding"] as const;
export const REMOVED_PRODUCT_ID = REMOVED_PRODUCT_IDS[0];
export const LEGACY_V1_HAS_API_KEY_PROPERTY = "hasApiKey" as const;

export const LEGACY_PROVIDER_IDS_V1 = [
  "gemini",
  "zai",
  "zai-coding",
  "openrouter",
  "groq",
  "cerebras",
] as const;
export const LegacyProviderIdV1Schema = z.enum(LEGACY_PROVIDER_IDS_V1);
export type LegacyProviderIdV1 = z.infer<typeof LegacyProviderIdV1Schema>;

export const LegacyProviderConfigV1Schema = z.strictObject({
  provider: LegacyProviderIdV1Schema,
  hasApiKey: z.boolean(),
  isActive: z.boolean(),
  model: z.string().optional(),
});
export type LegacyProviderConfigV1 = z.infer<typeof LegacyProviderConfigV1Schema>;

export const LegacyRemovedProviderRecordV1Schema = LegacyProviderConfigV1Schema.safeExtend({
  provider: z.literal(REMOVED_PRODUCT_ID),
});
export type LegacyRemovedProviderRecordV1 = z.infer<typeof LegacyRemovedProviderRecordV1Schema>;

const LegacyRunnableProviderRecordV1Schema = LegacyProviderConfigV1Schema.safeExtend({
  provider: z.enum(["gemini", "zai", "openrouter", "groq", "cerebras"]),
});

export const DecodedProviderConfigurationRecordSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("migrate-v1"),
    record: LegacyRunnableProviderRecordV1Schema,
  }),
  z.strictObject({
    status: z.literal("removed"),
    record: LegacyRemovedProviderRecordV1Schema,
    rawBytes: z.instanceof(Uint8Array),
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

// V1 records are untrusted bytes. Keep the decoder deliberately small and
// bounded: duplicate object keys are rejected before JSON.parse can collapse
// them to the last value (which could otherwise collapse duplicate provider keys).
const MAX_LEGACY_RECORD_BYTES = 64 * 1024;
const MAX_LEGACY_JSON_DEPTH = 32;

function parseLegacyJson(text: string): unknown {
  let position = 0;
  let depth = 0;

  const fail = (message: string): never => {
    throw new TypeError(`Legacy JSON parse failed at ${position}: ${message}`);
  };
  const skipWhitespace = (): void => {
    while (
      text[position] === " " ||
      text[position] === "\t" ||
      text[position] === "\n" ||
      text[position] === "\r"
    ) {
      position += 1;
    }
  };
  const parseString = (): string => {
    const start = position;
    if (text[position] !== '"') fail("expected string");
    position += 1;
    while (position < text.length) {
      const character = text[position];
      if (character === '"') {
        position += 1;
        try {
          return JSON.parse(text.slice(start, position)) as string;
        } catch {
          fail("invalid string escape");
        }
      }
      if (character === undefined || character < " ") fail("invalid string");
      if (character === "\\") {
        position += 1;
        if (position >= text.length) fail("unterminated escape");
        if (text[position] === "u") position += 4;
      }
      position += 1;
    }
    return fail("unterminated string");
  };
  const parseNumber = (): void => {
    while (
      position < text.length &&
      text[position] !== " " &&
      text[position] !== "\t" &&
      text[position] !== "\n" &&
      text[position] !== "\r" &&
      text[position] !== "," &&
      text[position] !== "]" &&
      text[position] !== "}"
    ) {
      position += 1;
    }
  };
  const parseValue = (): void => {
    skipWhitespace();
    const character = text[position];
    if (character === "{") {
      parseObject();
      return;
    }
    if (character === "[") {
      parseArray();
      return;
    }
    if (character === '"') {
      parseString();
      return;
    }
    for (const literal of ["true", "false", "null"]) {
      if (text.startsWith(literal, position)) {
        position += literal.length;
        return;
      }
    }
    if (character === "-" || (character !== undefined && /\d/.test(character))) {
      parseNumber();
      return;
    }
    fail("expected JSON value");
  };
  const parseObject = (): void => {
    if (depth >= MAX_LEGACY_JSON_DEPTH) fail("maximum JSON depth exceeded");
    depth += 1;
    try {
      position += 1;
      const keys = new Set<string>();
      skipWhitespace();
      if (text[position] === "}") {
        position += 1;
        return;
      }
      while (true) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) fail(`duplicate object key ${JSON.stringify(key)}`);
        keys.add(key);
        skipWhitespace();
        if (text[position] !== ":") fail("expected object separator");
        position += 1;
        parseValue();
        skipWhitespace();
        if (text[position] === "}") {
          position += 1;
          return;
        }
        if (text[position] !== ",") fail("expected object separator");
        position += 1;
      }
    } finally {
      depth -= 1;
    }
  };
  const parseArray = (): void => {
    if (depth >= MAX_LEGACY_JSON_DEPTH) fail("maximum JSON depth exceeded");
    depth += 1;
    try {
      position += 1;
      skipWhitespace();
      if (text[position] === "]") {
        position += 1;
        return;
      }
      while (true) {
        parseValue();
        skipWhitespace();
        if (text[position] === "]") {
          position += 1;
          return;
        }
        if (text[position] !== ",") fail("expected array separator");
        position += 1;
      }
    } finally {
      depth -= 1;
    }
  };

  parseValue();
  skipWhitespace();
  if (position !== text.length) fail("unexpected trailing input");
  return JSON.parse(text) as unknown;
}

export function decodeProviderConfigurationRecord(
  inputBytes: Uint8Array,
): DecodedProviderConfigurationRecord {
  const rawBytes = copyBytes(inputBytes);
  let input: unknown;

  try {
    if (rawBytes.byteLength > MAX_LEGACY_RECORD_BYTES) {
      throw new TypeError("legacy record exceeds the bounded decoder limit");
    }
    input = parseLegacyJson(new TextDecoder("utf-8", { fatal: true }).decode(rawBytes));
  } catch {
    return { status: "unknown", rawBytes };
  }

  const legacyRecord = LegacyProviderConfigV1Schema.safeParse(input);
  if (!legacyRecord.success) return { status: "unknown", rawBytes };

  if (legacyRecord.data.provider === "zai-coding") {
    return {
      status: "removed",
      record: LegacyRemovedProviderRecordV1Schema.parse(legacyRecord.data),
      rawBytes,
    };
  }

  return {
    status: "migrate-v1",
    record: LegacyRunnableProviderRecordV1Schema.parse(legacyRecord.data),
  };
}
