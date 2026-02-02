import type { ZodSchema } from "zod";
import type { Result } from "@repo/core";
import { ok, err } from "@repo/core";

export function validateSchema<T, E>(
  value: unknown,
  schema: ZodSchema<T>,
  errorFactory: (message: string) => E
): Result<T, E> {
  const result = schema.safeParse(value);
  if (!result.success) {
    return err(errorFactory(result.error.message));
  }
  return ok(result.data);
}
