export function parsePortEnv(
  value: string | undefined,
  fallback: number,
  variableName = "PORT",
): number {
  if (value === undefined) return fallback;

  const trimmed = value.trim();
  const port = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${variableName} "${value}": expected an integer from 1 to 65535.`);
  }

  return port;
}
