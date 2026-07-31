import { type RefinementCtx, z } from "zod";
import {
  isPinnedDownstreamRouteModelId,
  type ModelPolicy,
  PRODUCT_REGISTRY,
} from "../../providers/product-registry.js";
import {
  ConfigurationIdSchema,
  ConfigurationRevisionSchema,
  ExactModelIdSchema,
} from "../config/provider-config.js";
import {
  HostedApiEndpointSchema,
  LOCAL_OPENAI_PRESET_ENDPOINTS,
  LocalCliInstallationIdSchema,
  LocalHttpAuthenticationModeSchema,
  LocalHttpProductIdSchema,
  LoopbackHttpEndpointSchema,
  RunnableProductIdSchema,
  type TransportFamily,
  TransportFamilySchema,
} from "../config/transports.js";
import { ReviewResultSchema } from "./issues.js";

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const LATEST_ALIAS_PATTERN = /(?:^|[/:._-])latest(?:$|[/:._-])/i;
export const Sha256HexSchema = z.string().regex(SHA256_HEX_PATTERN);
export type Sha256Hex = z.infer<typeof Sha256HexSchema>;

const PositiveIntegerSchema = z.number().int().positive();
const NonnegativeIntegerSchema = z.number().int().nonnegative();
const SafeReferenceDigestSchema = Sha256HexSchema;
const SafeIdentitySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const SafeVersionSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ._:+()-]*$/);

export const ExecutionLimitsSchema = z
  .strictObject({
    maxInputTokens: PositiveIntegerSchema,
    maxOutputTokens: PositiveIntegerSchema,
    maxResponseBytes: PositiveIntegerSchema,
    wallTimeMs: PositiveIntegerSchema,
    maxRetries: NonnegativeIntegerSchema,
    maxConcurrency: PositiveIntegerSchema,
    maxCostUsd: z.number().finite().nonnegative(),
  })
  .readonly();
export type ExecutionLimits = z.infer<typeof ExecutionLimitsSchema>;

export const RuntimeIdentitySchema = z
  .strictObject({
    identity: SafeIdentitySchema,
    version: SafeVersionSchema,
  })
  .readonly();
export type RuntimeIdentity = z.infer<typeof RuntimeIdentitySchema>;

type ExecutionIdentity = {
  authentication: z.infer<typeof LocalHttpAuthenticationModeSchema> | null;
  credentialReferenceIdentity: string | null;
  installationId: z.infer<typeof LocalCliInstallationIdSchema> | null;
  normalizedEndpoint: string | null;
  productId: z.infer<typeof RunnableProductIdSchema>;
  region: string | null;
  runtime: RuntimeIdentity | null;
  transportFamily: TransportFamily;
  workspaceAccountReference: string | null;
};

type ExecutionIdentityIssue = {
  message: string;
  path: string[];
};

/**
 * Model IDs are part of the admitted execution tuple, not an opaque value that
 * can be moved between products.  The product registry deliberately leaves
 * discovered-exact models open because they are live observations; the other
 * policy kinds still have a closed allowlist/family contract here.
 */
function matchesProductModel(productId: z.infer<typeof RunnableProductIdSchema>, modelId: string) {
  if (!ExactModelIdSchema.safeParse(modelId).success || LATEST_ALIAS_PATTERN.test(modelId)) {
    return false;
  }

  const policy: ModelPolicy = PRODUCT_REGISTRY[productId].modelPolicy;
  switch (policy.kind) {
    case "discovered-family":
      return (
        !policy.rejectedAliases.includes(modelId) &&
        policy.familyPrefixes.some(
          (prefix) => modelId === prefix || modelId.startsWith(`${prefix}-`),
        )
      );
    case "discovered-exact":
      // The execution/evidence tuple has no explicit opt-in field.  A model
      // marked as opt-in-only must therefore remain unavailable until that
      // evidence is represented and verified by the admission layer.
      return !policy.explicitOptInSuffixes?.some((suffix) => modelId.endsWith(suffix));
    case "discovered-allowlist":
      if (!policy.modelIds.includes(modelId)) return false;
      // Higher-cost evidence is deliberately not part of the client-safe
      // execution tuple yet.  Do not let a generic conformance result stand
      // in for the required provider output limit and review-conformance
      // observations.
      return !(
        policy.higherCostModelEvidence !== undefined && policy.higherCostModelIds?.includes(modelId)
      );
    case "pinned-downstream-route":
      return isPinnedDownstreamRouteModelId(modelId);
  }
}

function addModelIdentityIssue(
  productId: z.infer<typeof RunnableProductIdSchema>,
  modelId: string,
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  if (!matchesProductModel(productId, modelId)) {
    addIssue(context, {
      message: "Model does not match the selected product policy",
      path: ["modelId"],
    });
  }
}

function addIssue(
  context: Pick<RefinementCtx<unknown>, "addIssue">,
  issue: ExecutionIdentityIssue,
) {
  context.addIssue({ code: "custom", ...issue });
}

function validateHostedTuple(identity: ExecutionIdentity): ExecutionIdentityIssue[] {
  const issues: ExecutionIdentityIssue[] = [];
  if (identity.authentication !== null) {
    issues.push({
      message: "Hosted execution cannot record local HTTP authentication",
      path: ["authentication"],
    });
  }
  const product = PRODUCT_REGISTRY[identity.productId];
  const endpoint = identity.normalizedEndpoint;

  if (identity.runtime === null) {
    issues.push({
      message: "Hosted execution requires runtime identity",
      path: ["runtime"],
    });
  }
  if (identity.credentialReferenceIdentity === null) {
    issues.push({
      message: "Hosted execution requires a credential reference identity",
      path: ["credentialReferenceIdentity"],
    });
  }
  if (identity.installationId !== null) {
    issues.push({
      message: "Hosted execution cannot record a CLI installation",
      path: ["installationId"],
    });
  }
  if (endpoint === null || !HostedApiEndpointSchema.safeParse(endpoint).success) {
    issues.push({
      message: "Hosted execution requires a normalized HTTPS endpoint",
      path: ["normalizedEndpoint"],
    });
    return issues;
  }

  const matchingProfile = product.configuration.endpoints.find(
    (profile) =>
      profile.endpoint === endpoint &&
      (("region" in profile ? profile.region : undefined) ?? null) === identity.region,
  );
  if (!matchingProfile) {
    const endpointMatches = product.configuration.endpoints.some(
      (profile) => profile.endpoint === endpoint,
    );
    issues.push({
      message: endpointMatches
        ? "Region does not match the selected product endpoint"
        : "Endpoint does not match the selected product transport tuple",
      path: [endpointMatches ? "region" : "normalizedEndpoint"],
    });
    return issues;
  }

  if (
    "workspaceBound" in matchingProfile &&
    matchingProfile.workspaceBound === true &&
    identity.workspaceAccountReference === null
  ) {
    issues.push({
      message: "Selected product endpoint requires a workspace or account reference",
      path: ["workspaceAccountReference"],
    });
  }
  if (!("workspaceBound" in matchingProfile) && identity.workspaceAccountReference !== null) {
    issues.push({
      message: "Selected product endpoint does not accept a workspace or account reference",
      path: ["workspaceAccountReference"],
    });
  }

  return issues;
}

function validateLocalHttpTuple(identity: ExecutionIdentity): ExecutionIdentityIssue[] {
  const issues: ExecutionIdentityIssue[] = [];
  if (identity.authentication === null) {
    issues.push({
      message: "Local HTTP execution requires an authentication mode",
      path: ["authentication"],
    });
  }
  if (identity.authentication === "none" && identity.credentialReferenceIdentity !== null) {
    issues.push({
      message: "Local HTTP execution without authentication cannot record a credential reference",
      path: ["credentialReferenceIdentity"],
    });
  }
  if (
    identity.normalizedEndpoint === null ||
    !LoopbackHttpEndpointSchema.safeParse(identity.normalizedEndpoint).success
  ) {
    issues.push({
      message: "Local HTTP execution requires a normalized loopback endpoint",
      path: ["normalizedEndpoint"],
    });
  }
  if (identity.region !== null) {
    issues.push({ message: "Local HTTP execution cannot record a region", path: ["region"] });
  }
  if (identity.workspaceAccountReference !== null) {
    issues.push({
      message: "Local HTTP execution cannot record a workspace or account reference",
      path: ["workspaceAccountReference"],
    });
  }
  if (identity.installationId !== null) {
    issues.push({
      message: "Local HTTP execution cannot record a CLI installation",
      path: ["installationId"],
    });
  }
  if (identity.runtime === null) {
    issues.push({ message: "Local HTTP execution requires runtime identity", path: ["runtime"] });
  }
  return issues;
}

function validateLocalCliTuple(identity: ExecutionIdentity): ExecutionIdentityIssue[] {
  const issues: ExecutionIdentityIssue[] = [];
  if (identity.authentication !== null) {
    issues.push({
      message: "Local CLI execution cannot record local HTTP authentication",
      path: ["authentication"],
    });
  }
  if (identity.normalizedEndpoint !== null) {
    issues.push({
      message: "Local CLI execution cannot record an endpoint",
      path: ["normalizedEndpoint"],
    });
  }
  if (identity.region !== null) {
    issues.push({ message: "Local CLI execution cannot record a region", path: ["region"] });
  }
  if (identity.workspaceAccountReference !== null) {
    issues.push({
      message: "Local CLI execution cannot record a workspace or account reference",
      path: ["workspaceAccountReference"],
    });
  }
  if (identity.credentialReferenceIdentity !== null) {
    issues.push({
      message: "Local CLI execution uses vendor-managed authentication, not a credential reference",
      path: ["credentialReferenceIdentity"],
    });
  }
  if (identity.installationId === null) {
    issues.push({
      message: "Local CLI execution requires installation identity",
      path: ["installationId"],
    });
  }
  if (identity.runtime === null) {
    issues.push({ message: "Local CLI execution requires runtime identity", path: ["runtime"] });
  }
  return issues;
}

/**
 * Runtime identity is part of the admitted tuple, not a free-form label.  The
 * local transports have a closed runtime vocabulary: an Ollama endpoint must
 * be probed as Ollama, the two local-openai presets retain their server
 * identity, and a CLI runtime must be the selected vendor CLI.  Hosted
 * products intentionally leave this field to the Diffgazer server identity;
 * no made-up provider version range is inferred here.
 */
function getExpectedLocalRuntimeIdentities(identity: ExecutionIdentity): readonly string[] | null {
  switch (identity.productId) {
    case "ollama":
      return ["ollama"];
    case "local-openai":
      if (identity.normalizedEndpoint === LOCAL_OPENAI_PRESET_ENDPOINTS["lm-studio"])
        return ["lm-studio"];
      if (identity.normalizedEndpoint === LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"])
        return ["llama-cpp"];
      return ["lm-studio", "llama-cpp"];
    case "codex-cli":
      return ["codex-cli"];
    case "copilot-cli":
      return ["copilot-cli"];
    default:
      return null;
  }
}

function validateRuntimeIdentity(identity: ExecutionIdentity): ExecutionIdentityIssue[] {
  if (identity.runtime === null) return [];
  const expectedIdentities = getExpectedLocalRuntimeIdentities(identity);
  if (expectedIdentities === null || expectedIdentities.includes(identity.runtime.identity)) {
    return [];
  }
  return [
    {
      message: "Runtime identity does not match the selected local product and endpoint",
      path: ["runtime", "identity"],
    },
  ];
}

function getExecutionIdentityIssues(identity: ExecutionIdentity): ExecutionIdentityIssue[] {
  const product = PRODUCT_REGISTRY[identity.productId];
  const issues: ExecutionIdentityIssue[] = [];

  if (product.transportFamily !== identity.transportFamily) {
    issues.push({
      message: "Product does not belong to the transport family",
      path: ["transportFamily"],
    });
    return issues;
  }

  switch (identity.transportFamily) {
    case "hosted-api":
      issues.push(...validateHostedTuple(identity));
      break;
    case "local-http":
      if (!LocalHttpProductIdSchema.safeParse(identity.productId).success) {
        issues.push({
          message: "Product does not belong to the local HTTP transport family",
          path: ["productId"],
        });
      }
      issues.push(...validateLocalHttpTuple(identity));
      break;
    case "local-cli":
      issues.push(...validateLocalCliTuple(identity));
      break;
  }

  issues.push(...validateRuntimeIdentity(identity));

  return issues;
}

function addExecutionIdentityIssues(
  identity: ExecutionIdentity,
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  for (const issue of getExecutionIdentityIssues(identity)) addIssue(context, issue);
}

function serializeCanonicalJson(value: unknown, ancestors: Set<object>): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new TypeError("Canonical JSON requires finite numbers");
      return String(value);
    case "string": {
      const serialized = JSON.stringify(value);
      if (serialized === undefined)
        throw new TypeError("Canonical JSON string serialization failed");
      return serialized;
    }
    case "object": {
      if (ancestors.has(value))
        throw new TypeError("Canonical JSON does not support cyclic values");
      ancestors.add(value);
      try {
        if (Array.isArray(value)) {
          const items: string[] = [];
          for (let index = 0; index < value.length; index += 1) {
            if (!Object.hasOwn(value, index)) {
              throw new TypeError("Canonical JSON does not accept sparse arrays");
            }
            items.push(serializeCanonicalJson(value[index], ancestors));
          }
          if (
            Object.getOwnPropertySymbols(value).some((key) => Object.hasOwn(value, key)) ||
            Object.getOwnPropertyNames(value).some(
              (key) => key !== "length" && !/^(?:0|[1-9]\d*)$/.test(key),
            )
          ) {
            throw new TypeError("Canonical JSON arrays cannot have named properties");
          }
          return `[${items.join(",")}]`;
        }

        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
          throw new TypeError("Canonical JSON requires plain objects");
        }
        if (Object.getOwnPropertySymbols(value).some((key) => Object.hasOwn(value, key))) {
          throw new TypeError("Canonical JSON requires string object keys");
        }

        const record = value as Record<string, unknown>;
        const properties = Object.keys(record)
          .sort()
          .map(
            (key) =>
              `${serializeCanonicalJson(key, ancestors)}:${serializeCanonicalJson(record[key], ancestors)}`,
          );
        return `{${properties.join(",")}}`;
      } finally {
        ancestors.delete(value);
      }
    }
    default:
      throw new TypeError(`Canonical JSON does not support ${typeof value}`);
  }
}

export function canonicalJson(value: unknown): string {
  return serializeCanonicalJson(value, new Set());
}

export function canonicalJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalJson(value));
}

/**
 * The parser is used at an untrusted provider-output boundary. Keep its
 * limits aligned with the response-capture contract instead of allowing a
 * caller to turn a small validation helper into an unbounded JSON decoder.
 */
export const MAX_CANONICAL_JSON_BYTES = 64 * 1024;
export const MAX_CANONICAL_JSON_DEPTH = 32;
export const MAX_CANONICAL_JSON_COLLECTION_ITEMS = 4_096;
export const MAX_CANONICAL_JSON_VALUES = 16_384;

export class CanonicalJsonParseError extends TypeError {
  readonly code = "canonical-json-parse-failed" as const;
  readonly position: number;
  readonly reason: string;

  constructor(position: number, reason: string) {
    super(`Canonical JSON parse failed at ${position}: ${reason}`);
    this.name = "CanonicalJsonParseError";
    this.position = position;
    this.reason = reason;
  }
}

function utf8ByteLengthAtMost(text: string, maximum: number): boolean {
  let byteLength = 0;
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    if (codeUnit <= 0x7f) {
      byteLength += 1;
    } else if (codeUnit <= 0x7ff) {
      byteLength += 2;
    } else if (
      codeUnit >= 0xd800 &&
      codeUnit <= 0xdbff &&
      index + 1 < text.length &&
      text.charCodeAt(index + 1) >= 0xdc00 &&
      text.charCodeAt(index + 1) <= 0xdfff
    ) {
      byteLength += 4;
      index += 1;
    } else {
      // TextEncoder encodes an unpaired surrogate as U+FFFD (three bytes).
      byteLength += 3;
    }
    if (byteLength > maximum) return false;
  }
  return true;
}

function isJsonWhitespace(character: string | undefined): boolean {
  return character === " " || character === "\t" || character === "\n" || character === "\r";
}

/**
 * Parses JSON while retaining duplicate-key detection that `JSON.parse` loses.
 * `canonicalJson` receives materialized values, so duplicate provenance cannot
 * be recovered there; callers handling raw JSON should use this parser first.
 */
export function parseCanonicalJson(text: string): unknown {
  if (typeof text !== "string") {
    throw new CanonicalJsonParseError(0, "input must be a string");
  }
  if (!utf8ByteLengthAtMost(text, MAX_CANONICAL_JSON_BYTES)) {
    throw new CanonicalJsonParseError(0, "input exceeds the bounded 64 KiB limit");
  }

  let position = 0;
  let valueCount = 0;

  const fail = (message: string): never => {
    throw new CanonicalJsonParseError(position, message);
  };
  const skipWhitespace = () => {
    while (isJsonWhitespace(text[position])) position += 1;
  };
  function parseString(): string {
    const start = position;
    if (text[position] !== '"') fail("expected string");
    position += 1;
    while (position < text.length) {
      const character = text[position];
      if (character === undefined) break;
      if (character === '"') {
        position += 1;
        try {
          return JSON.parse(text.slice(start, position)) as string;
        } catch {
          fail("invalid string escape");
        }
      }
      if (character < " ") fail("unescaped control character");
      if (character === "\\") {
        position += 1;
        if (position >= text.length) fail("unterminated escape");
        if (text[position] === "u") position += 4;
      }
      position += 1;
    }
    return fail("unterminated string");
  }
  function parseNumber(): number {
    const start = position;
    if (text[position] === "-") position += 1;
    if (text[position] === "0") {
      position += 1;
    } else {
      if (!/[1-9]/.test(text[position] ?? "")) fail("invalid number");
      while (/\d/.test(text[position] ?? "")) position += 1;
    }
    if (text[position] === ".") {
      position += 1;
      if (!/\d/.test(text[position] ?? "")) fail("invalid number fraction");
      while (/\d/.test(text[position] ?? "")) position += 1;
    }
    if (text[position] === "e" || text[position] === "E") {
      position += 1;
      if (text[position] === "+" || text[position] === "-") position += 1;
      if (!/\d/.test(text[position] ?? "")) fail("invalid number exponent");
      while (/\d/.test(text[position] ?? "")) position += 1;
    }
    const number = Number(text.slice(start, position));
    if (!Number.isFinite(number)) fail("number must be finite");
    return number;
  }
  function parseValue(depth: number): unknown {
    valueCount += 1;
    if (valueCount > MAX_CANONICAL_JSON_VALUES) fail("maximum JSON value count exceeded");
    skipWhitespace();
    const character = text[position];
    if (character === '"') return parseString();
    if (character === "{") return parseObject(depth);
    if (character === "[") return parseArray(depth);
    if (character === "-") return parseNumber();
    if (character && /\d/.test(character)) return parseNumber();
    for (const [literal, value] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ] as const) {
      if (text.startsWith(literal, position)) {
        position += literal.length;
        return value;
      }
    }
    return fail("expected JSON value");
  }
  function parseArray(depth: number): unknown[] {
    if (depth >= MAX_CANONICAL_JSON_DEPTH) fail("maximum JSON depth exceeded");
    position += 1;
    const values: unknown[] = [];
    skipWhitespace();
    if (text[position] === "]") {
      position += 1;
      return values;
    }
    while (true) {
      if (values.length >= MAX_CANONICAL_JSON_COLLECTION_ITEMS) {
        fail("maximum JSON collection size exceeded");
      }
      values.push(parseValue(depth + 1));
      skipWhitespace();
      if (text[position] === "]") {
        position += 1;
        return values;
      }
      if (text[position] !== ",") fail("expected array separator");
      position += 1;
    }
  }
  function parseObject(depth: number): Record<string, unknown> {
    if (depth >= MAX_CANONICAL_JSON_DEPTH) fail("maximum JSON depth exceeded");
    position += 1;
    const record: Record<string, unknown> = Object.create(null);
    const keys = new Set<string>();
    skipWhitespace();
    if (text[position] === "}") {
      position += 1;
      return record;
    }
    while (true) {
      if (keys.size >= MAX_CANONICAL_JSON_COLLECTION_ITEMS) {
        fail("maximum JSON collection size exceeded");
      }
      skipWhitespace();
      const key = parseString();
      if (keys.has(key)) fail("duplicate object key");
      keys.add(key);
      skipWhitespace();
      if (text[position] !== ":") fail("expected object separator");
      position += 1;
      const value = parseValue(depth + 1);
      Object.defineProperty(record, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      });
      skipWhitespace();
      if (text[position] === "}") {
        position += 1;
        return record;
      }
      if (text[position] !== ",") fail("expected object separator");
      position += 1;
    }
  }

  const value = parseValue(0);
  skipWhitespace();
  if (position !== text.length) fail("unexpected trailing input");
  return value;
}

const SHA256_ROUND_CONSTANTS: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

const SHA256_INITIAL_STATE: readonly number[] = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
] as const;

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function readByte(bytes: Uint8Array, index: number): number {
  return bytes[index] ?? 0;
}

function readWord(words: Uint32Array | readonly number[], index: number): number {
  return words[index] ?? 0;
}

/**
 * A synchronous SHA-256 implementation keeps receipt validation synchronous.
 * Core is browser-safe and cannot import node:crypto; Web Crypto is async and
 * therefore cannot be used from Zod's synchronous `safeParse` refinements.
 */
function sha256Bytes(bytes: Uint8Array): string {
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const lengthOffset = paddedLength - 8;
  const high = Math.floor(bitLength / 0x1_0000_0000);
  const low = bitLength >>> 0;
  padded[lengthOffset] = (high >>> 24) & 0xff;
  padded[lengthOffset + 1] = (high >>> 16) & 0xff;
  padded[lengthOffset + 2] = (high >>> 8) & 0xff;
  padded[lengthOffset + 3] = high & 0xff;
  padded[lengthOffset + 4] = (low >>> 24) & 0xff;
  padded[lengthOffset + 5] = (low >>> 16) & 0xff;
  padded[lengthOffset + 6] = (low >>> 8) & 0xff;
  padded[lengthOffset + 7] = low & 0xff;

  const state: number[] = [...SHA256_INITIAL_STATE];
  const words = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const position = offset + index * 4;
      words[index] =
        (readByte(padded, position) << 24) |
        (readByte(padded, position + 1) << 16) |
        (readByte(padded, position + 2) << 8) |
        readByte(padded, position + 3);
    }
    for (let index = 16; index < 64; index += 1) {
      const value = readWord(words, index - 15);
      const sigma0 = rotateRight(value, 7) ^ rotateRight(value, 18) ^ (value >>> 3);
      const prior = readWord(words, index - 2);
      const sigma1 = rotateRight(prior, 17) ^ rotateRight(prior, 19) ^ (prior >>> 10);
      words[index] =
        (readWord(words, index - 16) + sigma0 + readWord(words, index - 7) + sigma1) >>> 0;
    }

    let a = readWord(state, 0);
    let b = readWord(state, 1);
    let c = readWord(state, 2);
    let d = readWord(state, 3);
    let e = readWord(state, 4);
    let f = readWord(state, 5);
    let g = readWord(state, 6);
    let h = readWord(state, 7);
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temporary1 =
        (h + sum1 + choose + readWord(SHA256_ROUND_CONSTANTS, index) + readWord(words, index)) >>>
        0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    state[0] = (readWord(state, 0) + a) >>> 0;
    state[1] = (readWord(state, 1) + b) >>> 0;
    state[2] = (readWord(state, 2) + c) >>> 0;
    state[3] = (readWord(state, 3) + d) >>> 0;
    state[4] = (readWord(state, 4) + e) >>> 0;
    state[5] = (readWord(state, 5) + f) >>> 0;
    state[6] = (readWord(state, 6) + g) >>> 0;
    state[7] = (readWord(state, 7) + h) >>> 0;
  }

  return state.map((word) => word.toString(16).padStart(8, "0")).join("");
}

export function sha256CanonicalJsonSync(value: unknown): string {
  return sha256Bytes(canonicalJsonBytes(value));
}

export async function sha256CanonicalJson(value: unknown): Promise<string> {
  return sha256CanonicalJsonSync(value);
}

export const EvidenceKeySchema = z
  .strictObject({
    authentication: LocalHttpAuthenticationModeSchema.nullable(),
    credentialReferenceIdentity: SafeReferenceDigestSchema.nullable(),
    installationId: LocalCliInstallationIdSchema.nullable(),
    productId: RunnableProductIdSchema,
    transportFamily: TransportFamilySchema,
    normalizedEndpoint: z.union([HostedApiEndpointSchema, LoopbackHttpEndpointSchema]).nullable(),
    region: SafeIdentitySchema.nullable(),
    workspaceAccountReference: SafeReferenceDigestSchema.nullable(),
    modelId: ExactModelIdSchema,
    // Evidence is executable only when the runtime/server/CLI identity that was
    // probed is part of the immutable tuple.  Receipts keep this field optional
    // for terminal records produced before a runtime observation is available;
    // an admitted EvidenceKey cannot omit it.
    runtime: RuntimeIdentitySchema,
    structuredOutputSchemaSha256: Sha256HexSchema,
    noticeVersion: PositiveIntegerSchema,
    limits: ExecutionLimitsSchema,
  })
  .superRefine((evidence, context) => {
    addModelIdentityIssue(evidence.productId, evidence.modelId, context);
    addExecutionIdentityIssues(evidence, context);
  })
  .readonly();
export type EvidenceKey = z.infer<typeof EvidenceKeySchema>;

export const ExecutionFingerprintInputSchema = z
  .strictObject({
    configurationId: ConfigurationIdSchema,
    configurationRevision: ConfigurationRevisionSchema,
    evidenceKey: EvidenceKeySchema,
  })
  .readonly();
export type ExecutionFingerprintInput = z.infer<typeof ExecutionFingerprintInputSchema>;

export function hashEvidenceKey(input: z.input<typeof EvidenceKeySchema>): Promise<string> {
  return sha256CanonicalJson(EvidenceKeySchema.parse(input));
}

export function hashExecutionFingerprint(
  input: z.input<typeof ExecutionFingerprintInputSchema>,
): Promise<string> {
  return sha256CanonicalJson(ExecutionFingerprintInputSchema.parse(input));
}

/**
 * The receipt relation is the immutable admitted-plan projection that can be
 * recomputed from a persisted v1 receipt.  Runtime outcome fields (usage,
 * timestamps, attempts and terminal status) intentionally do not participate:
 * retries share one admitted plan fingerprint, while any changed tuple,
 * revision, notice, schema contract or execution limit must produce a new one.
 */
export const ExecutionReceiptFingerprintInputSchema = z
  .strictObject({
    authentication: LocalHttpAuthenticationModeSchema.nullable(),
    configurationId: ConfigurationIdSchema,
    configurationRevision: ConfigurationRevisionSchema,
    credentialReferenceIdentity: SafeReferenceDigestSchema.nullable(),
    installationId: LocalCliInstallationIdSchema.nullable(),
    productId: RunnableProductIdSchema,
    transportFamily: TransportFamilySchema,
    modelId: ExactModelIdSchema,
    normalizedEndpoint: z.union([HostedApiEndpointSchema, LoopbackHttpEndpointSchema]).nullable(),
    region: SafeIdentitySchema.nullable(),
    workspaceAccountReference: SafeReferenceDigestSchema.nullable(),
    runtime: RuntimeIdentitySchema.nullable(),
    structuredOutputSchemaSha256: Sha256HexSchema,
    noticeVersion: PositiveIntegerSchema,
    limits: ExecutionLimitsSchema,
  })
  .readonly();
export type ExecutionReceiptFingerprintInput = z.infer<
  typeof ExecutionReceiptFingerprintInputSchema
>;

export function hashExecutionReceiptFingerprintSync(
  input: z.input<typeof ExecutionReceiptFingerprintInputSchema>,
): string {
  return sha256CanonicalJsonSync(ExecutionReceiptFingerprintInputSchema.parse(input));
}

export async function hashExecutionReceiptFingerprint(
  input: z.input<typeof ExecutionReceiptFingerprintInputSchema>,
): Promise<string> {
  return hashExecutionReceiptFingerprintSync(input);
}

type NormalizedUsageShape = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
};

function validateNormalizedUsage(
  usage: NormalizedUsageShape,
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  if (
    usage.totalTokens !== undefined &&
    ((usage.inputTokens !== undefined && usage.totalTokens < usage.inputTokens) ||
      (usage.outputTokens !== undefined && usage.totalTokens < usage.outputTokens) ||
      (usage.cachedTokens !== undefined && usage.totalTokens < usage.cachedTokens) ||
      (usage.reasoningTokens !== undefined && usage.totalTokens < usage.reasoningTokens))
  ) {
    context.addIssue({
      code: "custom",
      message: "Total tokens cannot be less than a reported component",
      path: ["totalTokens"],
    });
  }
  if (
    usage.inputTokens !== undefined &&
    usage.outputTokens !== undefined &&
    usage.totalTokens !== undefined &&
    usage.totalTokens !== usage.inputTokens + usage.outputTokens
  ) {
    context.addIssue({
      code: "custom",
      message: "Total tokens must equal input plus output tokens",
      path: ["totalTokens"],
    });
  }
  if (
    usage.cachedTokens !== undefined &&
    usage.inputTokens !== undefined &&
    usage.cachedTokens > usage.inputTokens
  ) {
    context.addIssue({
      code: "custom",
      message: "Cached tokens cannot exceed input tokens",
      path: ["cachedTokens"],
    });
  }
  if (
    usage.reasoningTokens !== undefined &&
    usage.outputTokens !== undefined &&
    usage.reasoningTokens > usage.outputTokens
  ) {
    context.addIssue({
      code: "custom",
      message: "Reasoning tokens cannot exceed output tokens",
      path: ["reasoningTokens"],
    });
  }
}

export const NormalizedUsageSchema = z
  .strictObject({
    inputTokens: NonnegativeIntegerSchema.optional(),
    outputTokens: NonnegativeIntegerSchema.optional(),
    totalTokens: NonnegativeIntegerSchema.optional(),
    cachedTokens: NonnegativeIntegerSchema.optional(),
    reasoningTokens: NonnegativeIntegerSchema.optional(),
  })
  .refine((usage) => Object.values(usage).some((value) => value !== undefined), {
    message: "Reported usage must contain at least one value",
  })
  .superRefine(validateNormalizedUsage)
  .readonly();
export type NormalizedUsage = z.infer<typeof NormalizedUsageSchema>;

export const USAGE_AVAILABILITY = ["reported", "required-missing", "unavailable"] as const;
export const UsageAvailabilitySchema = z.enum(USAGE_AVAILABILITY);
export type UsageAvailability = z.infer<typeof UsageAvailabilitySchema>;

const FAILED_TERMINAL_OUTCOMES = [
  "cancelled",
  "timed-out",
  "transport-failed",
  "schema-failed",
  "budget-exhausted",
] as const;
export const TERMINAL_OUTCOMES = ["completed", ...FAILED_TERMINAL_OUTCOMES] as const;
export const TerminalOutcomeSchema = z.enum(TERMINAL_OUTCOMES);
export type TerminalOutcome = z.infer<typeof TerminalOutcomeSchema>;

const ExecutionReceiptBaseShape = {
  schemaVersion: z.literal(1),
  executionFingerprint: Sha256HexSchema,
  configurationId: ConfigurationIdSchema,
  configurationRevision: ConfigurationRevisionSchema,
  authentication: LocalHttpAuthenticationModeSchema.nullable().optional(),
  credentialReferenceIdentity: SafeReferenceDigestSchema.nullable().optional(),
  installationId: LocalCliInstallationIdSchema.nullable().optional(),
  productId: RunnableProductIdSchema,
  transportFamily: TransportFamilySchema,
  modelId: ExactModelIdSchema,
  normalizedEndpoint: z
    .union([HostedApiEndpointSchema, LoopbackHttpEndpointSchema])
    .nullable()
    .optional(),
  region: SafeIdentitySchema.nullable().optional(),
  workspace: SafeReferenceDigestSchema.nullable().optional(),
  runtime: RuntimeIdentitySchema.nullable().optional(),
  structuredOutputSchemaSha256: Sha256HexSchema,
  noticeVersion: PositiveIntegerSchema,
  limits: ExecutionLimitsSchema,
  attemptCount: NonnegativeIntegerSchema,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  usage: NormalizedUsageSchema.optional(),
  usageAvailability: UsageAvailabilitySchema,
} as const;

type ReceiptUsage = {
  limits: ExecutionLimits;
  outcome: TerminalOutcome;
  usage?: NormalizedUsageShape;
  usageAvailability: UsageAvailability;
};

type ReceiptIdentity = {
  authentication: z.infer<typeof LocalHttpAuthenticationModeSchema> | null;
  credentialReferenceIdentity: string | null;
  installationId: z.infer<typeof LocalCliInstallationIdSchema> | null;
  modelId: z.infer<typeof ExactModelIdSchema>;
  normalizedEndpoint: string | null;
  productId: z.infer<typeof RunnableProductIdSchema>;
  region: string | null;
  runtime: RuntimeIdentity | null;
  transportFamily: TransportFamily;
  workspaceAccountReference: string | null;
};

function validateReceiptIdentity(
  receipt: ReceiptIdentity,
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  addModelIdentityIssue(receipt.productId, receipt.modelId, context);
  addExecutionIdentityIssues(receipt, context);
}

function validateReceiptUsage(
  receipt: ReceiptUsage & { productId: z.infer<typeof RunnableProductIdSchema> },
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  if (receipt.usageAvailability === "reported" && receipt.usage === undefined) {
    context.addIssue({
      code: "custom",
      message: "Reported usage requires normalized usage values",
      path: ["usage"],
    });
  }
  if (receipt.usageAvailability !== "reported" && receipt.usage !== undefined) {
    context.addIssue({
      code: "custom",
      message: "Unavailable usage cannot include normalized usage values",
      path: ["usage"],
    });
  }
  if (receipt.usage !== undefined) {
    if (
      receipt.usage.inputTokens !== undefined &&
      receipt.usage.inputTokens > receipt.limits.maxInputTokens
    ) {
      context.addIssue({
        code: "custom",
        message: "Reported input usage exceeds the admitted input-token limit",
        path: ["usage", "inputTokens"],
      });
    }
    if (
      receipt.usage.outputTokens !== undefined &&
      receipt.usage.outputTokens > receipt.limits.maxOutputTokens
    ) {
      context.addIssue({
        code: "custom",
        message: "Reported output usage exceeds the admitted output-token limit",
        path: ["usage", "outputTokens"],
      });
    }
    if (
      receipt.usage.totalTokens !== undefined &&
      receipt.usage.totalTokens > receipt.limits.maxInputTokens + receipt.limits.maxOutputTokens
    ) {
      context.addIssue({
        code: "custom",
        message: "Reported total usage exceeds the admitted token limits",
        path: ["usage", "totalTokens"],
      });
    }
  }
  if (receipt.outcome === "completed" && receipt.usageAvailability === "required-missing") {
    context.addIssue({
      code: "custom",
      message: "Completed execution cannot be missing required usage",
      path: ["usageAvailability"],
    });
  }
  if (
    receipt.outcome === "completed" &&
    PRODUCT_REGISTRY[receipt.productId].admission.usage === "required-terminal" &&
    receipt.usageAvailability !== "reported"
  ) {
    context.addIssue({
      code: "custom",
      message: "This product requires a reported terminal usage record",
      path: ["usageAvailability"],
    });
  }
}

function validateReceiptTiming(
  receipt: {
    attemptCount: number;
    finishedAt: string;
    limits: ExecutionLimits;
    outcome: TerminalOutcome;
    startedAt: string;
  },
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  const startedAtMs = Date.parse(receipt.startedAt);
  const finishedAtMs = Date.parse(receipt.finishedAt);
  if (
    !Number.isFinite(startedAtMs) ||
    !Number.isFinite(finishedAtMs) ||
    finishedAtMs < startedAtMs
  ) {
    context.addIssue({
      code: "custom",
      message: "Finished time cannot precede start time",
      path: ["finishedAt"],
    });
  }
  if (receipt.attemptCount > receipt.limits.maxRetries + 1) {
    context.addIssue({
      code: "custom",
      message: "Attempt count exceeds the retry limit",
      path: ["attemptCount"],
    });
  }
  if (receipt.outcome === "completed" && receipt.attemptCount < 1) {
    context.addIssue({
      code: "custom",
      message: "Completed execution requires at least one attempt",
      path: ["attemptCount"],
    });
  }
  if (
    receipt.outcome === "completed" &&
    Number.isFinite(startedAtMs) &&
    Number.isFinite(finishedAtMs) &&
    finishedAtMs - startedAtMs > receipt.limits.wallTimeMs
  ) {
    context.addIssue({
      code: "custom",
      message: "Completed execution exceeded its wall-time limit",
      path: ["finishedAt"],
    });
  }
}

type ReceiptBase = z.infer<z.ZodObject<typeof ExecutionReceiptBaseShape>>;

function getReceiptFingerprintInput(receipt: ReceiptBase): ExecutionReceiptFingerprintInput {
  return {
    authentication: receipt.authentication ?? null,
    configurationId: receipt.configurationId,
    configurationRevision: receipt.configurationRevision,
    credentialReferenceIdentity: receipt.credentialReferenceIdentity ?? null,
    installationId: receipt.installationId ?? null,
    productId: receipt.productId,
    transportFamily: receipt.transportFamily,
    modelId: receipt.modelId,
    normalizedEndpoint: receipt.normalizedEndpoint ?? null,
    region: receipt.region ?? null,
    workspaceAccountReference: receipt.workspace ?? null,
    runtime: receipt.runtime ?? null,
    structuredOutputSchemaSha256: receipt.structuredOutputSchemaSha256,
    noticeVersion: receipt.noticeVersion,
    limits: receipt.limits,
  };
}

function validateReceipt(
  receipt: ReceiptBase & { outcome: TerminalOutcome },
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  const fingerprintInput = ExecutionReceiptFingerprintInputSchema.safeParse(
    getReceiptFingerprintInput(receipt),
  );
  if (fingerprintInput.success) {
    const expectedFingerprint = sha256CanonicalJsonSync(fingerprintInput.data);
    if (receipt.executionFingerprint !== expectedFingerprint) {
      context.addIssue({
        code: "custom",
        message: "Execution fingerprint does not match the immutable admitted receipt identity",
        path: ["executionFingerprint"],
      });
    }
  }
  validateReceiptUsage(receipt, context);
  validateReceiptTiming(receipt, context);
  validateReceiptIdentity(
    {
      authentication: receipt.authentication ?? null,
      credentialReferenceIdentity: receipt.credentialReferenceIdentity ?? null,
      installationId: receipt.installationId ?? null,
      modelId: receipt.modelId,
      normalizedEndpoint: receipt.normalizedEndpoint ?? null,
      productId: receipt.productId,
      region: receipt.region ?? null,
      runtime: receipt.runtime ?? null,
      transportFamily: receipt.transportFamily,
      workspaceAccountReference: receipt.workspace ?? null,
    },
    context,
  );
}

const CompletedExecutionReceiptSchema = z
  .strictObject({
    ...ExecutionReceiptBaseShape,
    outcome: z.literal("completed"),
  })
  .superRefine(validateReceipt)
  .readonly();

const FailedExecutionReceiptSchema = z
  .strictObject({
    ...ExecutionReceiptBaseShape,
    outcome: z.enum(FAILED_TERMINAL_OUTCOMES),
  })
  .superRefine(validateReceipt)
  .readonly();

export const ExecutionReceiptSchema = z.union([
  CompletedExecutionReceiptSchema,
  FailedExecutionReceiptSchema,
]);
export type ExecutionReceipt = z.infer<typeof ExecutionReceiptSchema>;

const EmptyReviewResultSchema = z.strictObject({ issues: z.tuple([]) });

export const ExecutionResultSchema = z.union([
  z
    .strictObject({
      receipt: CompletedExecutionReceiptSchema,
      result: ReviewResultSchema,
    })
    .readonly(),
  z
    .strictObject({
      receipt: FailedExecutionReceiptSchema,
      result: EmptyReviewResultSchema,
    })
    .readonly(),
]);
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
