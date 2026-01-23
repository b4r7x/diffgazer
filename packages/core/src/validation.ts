import { UuidSchema } from "@repo/schemas/errors";

export { UuidSchema };

export function isValidUuid(id: string): boolean {
  return UuidSchema.safeParse(id).success;
}

export function assertValidUuid(id: string): string {
  if (!UuidSchema.safeParse(id).success) {
    throw new Error(`Invalid UUID format: ${id}`);
  }
  return id;
}
