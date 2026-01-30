import { PortSchema } from "@repo/schemas/port";
import type { Result } from "./result.js";
import type { AppError } from "./errors.js";
import { ok, err } from "./result.js";
import { createError } from "./errors.js";

export function parsePort(value: string): Result<number, AppError> {
  const result = PortSchema.safeParse(value);
  if (!result.success) {
    return err(createError("INVALID_PORT", "Invalid port number"));
  }
  return ok(result.data);
}

export function parsePortOrDefault(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const result = PortSchema.safeParse(value);
  return result.success ? result.data : defaultValue;
}
