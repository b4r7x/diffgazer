import { PortSchema } from "@repo/schemas/port";

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
