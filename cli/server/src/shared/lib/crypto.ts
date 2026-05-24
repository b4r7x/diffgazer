import { timingSafeEqual } from "node:crypto";

export function safeTokenMatch(header: string | undefined, expected: string): boolean {
  if (!header || header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
