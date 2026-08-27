/**
 * Canonical JSON serialization and the synchronous SHA-256 over that canonical
 * form.
 *
 * This is a leaf utility: it is generic, depends on nothing else in the
 * codebase beyond `./sha256.js`, and must not import schema, review, or
 * provider modules. Review receipts merely happen to be its first caller.
 */

import { sha256Bytes } from "./sha256.js";

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

export function sha256CanonicalJsonSync(value: unknown): string {
  return sha256Bytes(canonicalJsonBytes(value));
}
