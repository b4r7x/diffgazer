import { UuidSchema } from "@diffgazer/core/schemas/fields";

const CURSOR_PREFIX = "dg1_";
const ENCODED_PAYLOAD_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface ReviewCursorBoundary {
  createdAt: string;
  id: string;
}

function isCanonicalIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function encodeReviewCursor(boundary: ReviewCursorBoundary): string {
  const createdAt = new Date(boundary.createdAt).toISOString();
  const payload = Buffer.from(JSON.stringify([createdAt, boundary.id])).toString("base64url");
  return `${CURSOR_PREFIX}${payload}`;
}

export function decodeReviewCursor(cursor: string): ReviewCursorBoundary | null {
  if (!cursor.startsWith(CURSOR_PREFIX)) return null;
  const encoded = cursor.slice(CURSOR_PREFIX.length);
  if (!ENCODED_PAYLOAD_PATTERN.test(encoded)) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [createdAt, id] = parsed;
    if (!isCanonicalIsoDate(createdAt) || !UuidSchema.safeParse(id).success) return null;

    const boundary = { createdAt, id };
    return encodeReviewCursor(boundary) === cursor ? boundary : null;
  } catch {
    return null;
  }
}

export function isReviewCursor(cursor: string): boolean {
  return decodeReviewCursor(cursor) !== null;
}
