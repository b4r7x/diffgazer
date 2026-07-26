import { z } from "zod";

export const UuidSchema = z.uuid();

/** Narrows a raw string to a member of a const tuple of allowed values. */
export function isMember<T extends string>(
  members: readonly T[],
  value: string | null,
): value is T {
  if (value === null) return false;
  return members.includes(value as T);
}
