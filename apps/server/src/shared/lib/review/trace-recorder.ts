import type { TraceRef } from "@repo/schemas";

function summarizeOutput(value: unknown): string {
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

export class TraceRecorder {
  private steps: TraceRef[] = [];

  async wrap<T>(toolName: string, inputSummary: string, fn: () => Promise<T>): Promise<T> {
    const step = this.steps.length + 1;
    const timestamp = new Date().toISOString();

    const result = await fn();

    const trace: TraceRef = {
      step,
      tool: toolName,
      inputSummary,
      outputSummary: summarizeOutput(result),
      timestamp,
    };

    this.steps.push(trace);

    return result;
  }

  getTrace(): TraceRef[] {
    return [...this.steps];
  }

  clear(): void {
    this.steps = [];
  }
}
