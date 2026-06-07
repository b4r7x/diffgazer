import { timingSafeEqual } from "node:crypto";

export function safeTokenMatch(header: string | undefined, expected: string): boolean {
  if (!header) return false;

  const headerBytes = Buffer.from(header, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (headerBytes.byteLength !== expectedBytes.byteLength) return false;

  return timingSafeEqual(headerBytes, expectedBytes);
}
