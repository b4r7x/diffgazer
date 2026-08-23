import { z } from "zod";

export const UuidSchema = z.uuid();

export function isMember<T extends string>(
  members: readonly T[],
  value: string | null,
): value is T {
  if (value === null) return false;
  return members.includes(value as T);
}
