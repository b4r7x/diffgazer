type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const resolveThreshold = (): number => {
  // Stay silent under test so the structured logger does not pollute output or
  // collide with console spies; honor an explicit override otherwise.
  if (process.env.VITEST) return Number.POSITIVE_INFINITY;
  const configured = process.env.DIFFGAZER_LOG_LEVEL as LogLevel | undefined;
  return LEVEL_ORDER[configured ?? "info"] ?? LEVEL_ORDER.info;
};

/**
 * Emits one structured JSON log line. Internal, dependency-free; the embedded
 * server is CLI-internal so this avoids a logging framework on purpose.
 */
export const log = (
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void => {
  if (LEVEL_ORDER[level] < resolveThreshold()) return;
  const line = JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...fields });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
};
