import type { TraceRef } from "@diffgazer/core/schemas/review";

export function summarizeOutput(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === "string") {
    const lines = value.split("\n").length;
    const chars = value.length;
    if (chars > 100) {
      return `${chars} chars, ${lines} lines`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return `Array[${value.length}]`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    return `Object{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", ..." : ""}}`;
  }

  return String(value);
}

export async function recordTrace<T>(
  steps: TraceRef[],
  toolName: string,
  inputSummary: string,
  fn: () => Promise<T>,
): Promise<T> {
  const step = steps.length + 1;
  const timestamp = new Date().toISOString();
  const result = await fn();
  steps.push({
    step,
    tool: toolName,
    inputSummary,
    outputSummary: summarizeOutput(result),
    timestamp,
  });
  return result;
}
