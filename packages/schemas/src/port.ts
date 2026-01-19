import { z } from "zod";

export const MIN_PORT = 1;
export const MAX_PORT = 65535;

export const PortSchema = z.coerce.number().int().min(MIN_PORT).max(MAX_PORT);

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
