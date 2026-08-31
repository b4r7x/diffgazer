/**
 * Byte-preserving JSON scanning: it hands back the offsets of a document's own
 * property values so the bytes on disk can be re-emitted verbatim, which is
 * what the config codec and the secrets store both need and what JSON.parse
 * plus re-serialization cannot give them.
 */

const textEncoder = new TextEncoder();

/** Detaches a slice from the buffer it was read out of, so a later write cannot alias it. */
export const copyBytes = (bytes: Uint8Array): Uint8Array => new Uint8Array(bytes);

export const byteArraysEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);

const skipJsonWhitespace = (text: string, start: number): number => {
  let cursor = start;
  while (cursor < text.length && " \t\n\r".includes(text[cursor] ?? "")) cursor += 1;
  return cursor;
};

const scanJsonStringEnd = (text: string, start: number): number => {
  if (text[start] !== '"') throw new Error("Expected a JSON string");
  let cursor = start + 1;
  let escaped = false;
  while (cursor < text.length) {
    const character = text[cursor];
    if (escaped) {
      escaped = false;
      cursor += 1;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      cursor += 1;
      continue;
    }
    if (character === '"') return cursor + 1;
    if (character === undefined || character < " ") throw new Error("Invalid JSON string");
    cursor += 1;
  }
  throw new Error("Unterminated JSON string");
};

const scanJsonValueEnd = (text: string, start: number): number => {
  const valueStart = skipJsonWhitespace(text, start);
  const opening = text[valueStart];
  if (opening === '"') return scanJsonStringEnd(text, valueStart);
  if (opening !== "{" && opening !== "[") {
    let cursor = valueStart;
    while (cursor < text.length && !",]}".includes(text[cursor] ?? "")) cursor += 1;
    return cursor;
  }

  const stack = [opening === "{" ? "}" : "]"];
  let cursor = valueStart + 1;
  let inString = false;
  let escaped = false;
  while (cursor < text.length && stack.length > 0) {
    const character = text[cursor];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      cursor += 1;
      continue;
    }
    if (character === '"') {
      inString = true;
      cursor += 1;
      continue;
    }
    if (character === "{" || character === "[") stack.push(character === "{" ? "}" : "]");
    else if (character === "}" || character === "]") {
      if (stack.at(-1) !== character) throw new Error("Mismatched JSON container");
      stack.pop();
      if (stack.length === 0) return cursor + 1;
    }
    cursor += 1;
  }
  throw new Error("Unterminated JSON value");
};

/** Byte-offset span of one property value inside the document text it was scanned from. */
export interface JsonPropertySlice {
  readonly start: number;
  readonly end: number;
}

export interface JsonObjectScanObserver {
  readonly continueAfterDuplicate?: boolean;
  readonly onDuplicate: (key: string) => void;
  readonly onProperty: (key: string, slice: JsonPropertySlice) => void;
}

export const scanJsonObjectPropertiesWithObserver = (
  text: string,
  observer?: JsonObjectScanObserver,
): Map<string, JsonPropertySlice> => {
  const properties = new Map<string, JsonPropertySlice>();
  let cursor = skipJsonWhitespace(text, 0);
  if (text[cursor] !== "{") throw new Error("Configuration root must be an object");
  cursor = skipJsonWhitespace(text, cursor + 1);
  if (text[cursor] === "}") {
    if (skipJsonWhitespace(text, cursor + 1) !== text.length) {
      throw new Error("Unexpected trailing configuration input");
    }
    return properties;
  }

  while (cursor < text.length) {
    const keyEnd = scanJsonStringEnd(text, cursor);
    const key = JSON.parse(text.slice(cursor, keyEnd)) as string;
    if (properties.has(key)) {
      observer?.onDuplicate(key);
      if (!observer?.continueAfterDuplicate) {
        throw new Error("Configuration file contains a duplicate key");
      }
    }
    cursor = skipJsonWhitespace(text, keyEnd);
    if (text[cursor] !== ":") throw new Error("Invalid configuration object");
    const valueStart = skipJsonWhitespace(text, cursor + 1);
    const valueEnd = scanJsonValueEnd(text, valueStart);
    const slice = { start: valueStart, end: valueEnd } satisfies JsonPropertySlice;
    properties.set(key, slice);
    observer?.onProperty(key, slice);
    cursor = skipJsonWhitespace(text, valueEnd);
    if (text[cursor] === "}") {
      if (skipJsonWhitespace(text, cursor + 1) !== text.length) {
        throw new Error("Unexpected trailing configuration input");
      }
      return properties;
    }
    if (text[cursor] !== ",") throw new Error("Invalid configuration object separator");
    cursor = skipJsonWhitespace(text, cursor + 1);
  }
  throw new Error("Unterminated configuration object");
};

export const scanJsonObjectProperties = (text: string): Map<string, JsonPropertySlice> =>
  scanJsonObjectPropertiesWithObserver(text);

export const splitJsonArrayElements = (arrayText: string): Uint8Array[] => {
  let cursor = skipJsonWhitespace(arrayText, 0);
  if (arrayText[cursor] !== "[") throw new Error("Configuration records must be an array");
  cursor = skipJsonWhitespace(arrayText, cursor + 1);
  const values: Uint8Array[] = [];
  if (arrayText[cursor] === "]") return values;
  while (cursor < arrayText.length) {
    const valueEnd = scanJsonValueEnd(arrayText, cursor);
    values.push(textEncoder.encode(arrayText.slice(cursor, valueEnd)));
    cursor = skipJsonWhitespace(arrayText, valueEnd);
    if (arrayText[cursor] === "]") return values;
    if (arrayText[cursor] !== ",") throw new Error("Invalid configuration array separator");
    cursor = skipJsonWhitespace(arrayText, cursor + 1);
  }
  throw new Error("Unterminated configuration array");
};
