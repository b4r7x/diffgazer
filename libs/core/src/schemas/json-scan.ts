/**
 * The repo's one bounded duplicate-key-rejecting JSON validator.
 *
 * This is a leaf utility: it is generic, depends on nothing else in the
 * codebase, and must not import schema, review, or provider modules.
 */

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
