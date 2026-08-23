/**
 * Canonical JSON serialization, the repo's one bounded duplicate-key-rejecting
 * JSON validator, and the synchronous SHA-256 over that canonical form.
 *
 * This is a leaf utility: it is generic, depends on nothing else in the
 * codebase, and must not import schema, review, or provider modules. Review
 * receipts merely happen to be its first caller; provider configuration reaches
 * the same validator through `scanJsonRejectingDuplicateKeys`.
 */

function serializeCanonicalJson(value: unknown, ancestors: Set<object>): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new TypeError("Canonical JSON requires finite numbers");
      return String(value);
    case "string":
      return JSON.stringify(value);
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

function canonicalJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalJson(value));
}

export type JsonScanFailure = Readonly<{ position: number; reason: string }>;

/**
 * Bounds for decoding one untrusted JSON document. `maxCollectionItems` and
 * `maxValues` are optional: callers that already bound the input by byte size
 * do not need a second cap. `onFail` must throw the caller's own error type.
 */
export type JsonScanLimits = Readonly<{
  maxBytes: number;
  maxDepth: number;
  maxCollectionItems?: number;
  maxValues?: number;
  onFail: (failure: JsonScanFailure) => never;
}>;

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
 * Validates untrusted JSON against `limits`, retaining the duplicate-key
 * detection `JSON.parse` loses: `JSON.parse` keeps the last occurrence, which
 * silently relabels a record when an attacker repeats a discriminant key.
 * Callers hand the same text to `JSON.parse` once it passes, so no document is
 * built here. The failure reason never echoes the offending key, so an
 * untrusted document cannot smuggle its own content into a diagnostic.
 */
export function scanJsonRejectingDuplicateKeys(text: string, limits: JsonScanLimits): void {
  const { maxBytes, maxCollectionItems, maxDepth, maxValues, onFail } = limits;
  let position = 0;
  let valueCount = 0;

  const fail = (reason: string): never => onFail({ position, reason });

  if (typeof text !== "string") fail("input must be a string");
  if (!utf8ByteLengthAtMost(text, maxBytes)) {
    fail(`input exceeds the bounded ${maxBytes / 1024} KiB limit`);
  }

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
  function parseNumber(): void {
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
  }
  function parseValue(depth: number): void {
    valueCount += 1;
    if (maxValues !== undefined && valueCount > maxValues) {
      fail("maximum JSON value count exceeded");
    }
    skipWhitespace();
    const character = text[position];
    if (character === '"') {
      parseString();
      return;
    }
    if (character === "{") {
      parseObject(depth);
      return;
    }
    if (character === "[") {
      parseArray(depth);
      return;
    }
    if (character === "-" || (character && /\d/.test(character))) {
      parseNumber();
      return;
    }
    for (const literal of ["true", "false", "null"] as const) {
      if (text.startsWith(literal, position)) {
        position += literal.length;
        return;
      }
    }
    fail("expected JSON value");
  }
  function parseArray(depth: number): void {
    if (depth >= maxDepth) fail("maximum JSON depth exceeded");
    position += 1;
    let itemCount = 0;
    skipWhitespace();
    if (text[position] === "]") {
      position += 1;
      return;
    }
    while (true) {
      if (maxCollectionItems !== undefined && itemCount >= maxCollectionItems) {
        fail("maximum JSON collection size exceeded");
      }
      parseValue(depth + 1);
      itemCount += 1;
      skipWhitespace();
      if (text[position] === "]") {
        position += 1;
        return;
      }
      if (text[position] !== ",") fail("expected array separator");
      position += 1;
    }
  }
  function parseObject(depth: number): void {
    if (depth >= maxDepth) fail("maximum JSON depth exceeded");
    position += 1;
    const keys = new Set<string>();
    skipWhitespace();
    if (text[position] === "}") {
      position += 1;
      return;
    }
    while (true) {
      if (maxCollectionItems !== undefined && keys.size >= maxCollectionItems) {
        fail("maximum JSON collection size exceeded");
      }
      skipWhitespace();
      const key = parseString();
      if (keys.has(key)) fail("duplicate object key");
      keys.add(key);
      skipWhitespace();
      if (text[position] !== ":") fail("expected object separator");
      position += 1;
      parseValue(depth + 1);
      skipWhitespace();
      if (text[position] === "}") {
        position += 1;
        return;
      }
      if (text[position] !== ",") fail("expected object separator");
      position += 1;
    }
  }

  parseValue(0);
  skipWhitespace();
  if (position !== text.length) fail("unexpected trailing input");
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
