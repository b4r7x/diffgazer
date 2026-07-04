import { isPackaged } from "./paths.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const resolveThreshold = (): number => {
  // Stay silent under test so the structured logger does not pollute output or
  // collide with console spies; honor an explicit override otherwise.
  if (process.env.VITEST) return Number.POSITIVE_INFINITY;
  const configured = process.env.DIFFGAZER_LOG_LEVEL as LogLevel | undefined;
  if (configured && LEVEL_ORDER[configured] !== undefined) {
    return LEVEL_ORDER[configured];
  }
  // The packaged CLI runs this server in the user-facing `diffgazer` process, so
  // default it to `warn` to keep per-request info logs out of the terminal.
  // Diagnostics stay available via an explicit DIFFGAZER_LOG_LEVEL=info. The
  // standalone/dev server keeps the verbose `info` default.
  return isPackaged() ? LEVEL_ORDER.warn : LEVEL_ORDER.info;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === "[object Object]";

const normalizeLogValue = (value: unknown, seen: WeakSet<object> = new WeakSet()): unknown => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const result = value.map((item) => normalizeLogValue(item, seen));
    seen.delete(value);
    return result;
  }
  if (isPlainRecord(value)) {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const result = Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeLogValue(nested, seen)]),
    );
    seen.delete(value);
    return result;
  }
  return value;
};

const normalizeLogFields = (fields: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, normalizeLogValue(value)]));

/**
 * Emits one structured JSON log line. Internal, dependency-free; the embedded
 * server is CLI-internal so this avoids a logging framework on purpose.
 */
export const log = (level: LogLevel, event: string, fields: Record<string, unknown> = {}): void => {
  if (LEVEL_ORDER[level] < resolveThreshold()) return;
  const line = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...normalizeLogFields(fields),
  });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
};
