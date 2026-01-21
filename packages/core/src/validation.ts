import { z } from "zod";
import type { Result } from "./result.js";
import { ok, err } from "./result.js";
import type { AppError } from "./errors.js";
import { createError } from "./errors.js";

/** Zod schema for UUID validation - reusable across codebase */
export const UuidSchema = z.string().uuid();

/** Check if a string is a valid UUID */
export function isValidUuid(id: string): boolean {
  return UuidSchema.safeParse(id).success;
}

/** Assert a string is a valid UUID, throw if not.
 *  Use this for defensive checks in internal code paths.
 */
export function assertValidUuid(id: string): string {
  if (!UuidSchema.safeParse(id).success) {
    throw new Error(`Invalid UUID format: ${id}`);
  }
  return id;
}

/** Validation error type */
export type ValidationError = AppError<"VALIDATION_ERROR">;

/** Validate a UUID and return Result. Use for user-facing validation. */
export function validateUuid(id: string): Result<string, ValidationError> {
  if (!UuidSchema.safeParse(id).success) {
    return err(createError("VALIDATION_ERROR", `Invalid UUID format: ${id}`));
  }
  return ok(id);
}
