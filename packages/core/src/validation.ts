import { z } from "zod";
import type { Result } from "./result.js";
import { ok, err } from "./result.js";
import type { AppError } from "./errors.js";
import { createError } from "./errors.js";

export const UuidSchema = z.string().uuid();

export function isValidUuid(id: string): boolean {
  return UuidSchema.safeParse(id).success;
}

export function assertValidUuid(id: string): string {
  if (!UuidSchema.safeParse(id).success) {
    throw new Error(`Invalid UUID format: ${id}`);
  }
  return id;
}

export type ValidationError = AppError<"VALIDATION_ERROR">;

export function validateUuid(id: string): Result<string, ValidationError> {
  if (!UuidSchema.safeParse(id).success) {
    return err(createError("VALIDATION_ERROR", `Invalid UUID format: ${id}`));
  }
  return ok(id);
}
