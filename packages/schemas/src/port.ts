import { z } from "zod";

/** Minimum valid TCP/UDP port number */
export const MIN_PORT = 1;

/** Maximum valid TCP/UDP port number */
export const MAX_PORT = 65535;

/**
 * Zod schema for validating port numbers.
 * Coerces string input to number and validates range (1-65535).
 */
export const PortSchema = z.coerce.number().int().min(MIN_PORT).max(MAX_PORT);

/**
 * A valid TCP/UDP port number (1-65535).
 * Inferred from PortSchema for type-safe port handling.
 *
 * Note: While this type is currently inferred as `number`, it provides
 * semantic meaning and schema validation integration.
 */
export type Port = z.infer<typeof PortSchema>;

export function parsePort(value: string): number {
  const result = PortSchema.safeParse(value);
  if (!result.success) {
    throw new Error("Invalid port number");
  }
  return result.data;
}

export function parsePortOrDefault(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const result = PortSchema.safeParse(value);
  return result.success ? result.data : defaultValue;
}
