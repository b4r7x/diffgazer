import type { Result } from "@diffgazer/core/result";
import type { TraceRef } from "@diffgazer/core/schemas/review";

function isResult(value: unknown): value is Result<unknown, unknown> {
  return typeof value === "object" && value !== null && "ok" in value;
}

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
  // Summarize the real value/error, not the `{ ok, value }` Result wrapper —
  // otherwise every trace step reads "Object{ok, value}".
  let summarized: unknown = result;
  if (isResult(result)) {
    summarized = result.ok ? result.value : result.error;
  }
  steps.push({
    step,
    tool: toolName,
    inputSummary,
    outputSummary: summarizeOutput(summarized),
    timestamp,
  });
  return result;
}
