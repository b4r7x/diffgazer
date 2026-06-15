import { err, ok } from "@diffgazer/core/result";
import type { TraceRef } from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";
import { recordTrace, summarizeOutput } from "./trace.js";

describe("summarizeOutput", () => {
  it.each([
    { value: "hello", expected: "hello" },
    { value: [1, 2, 3], expected: "Array[3]" },
    { value: { a: 1, b: 2 }, expected: "Object{a, b}" },
    { value: { a: 1, b: 2, c: 3, d: 4 }, expected: "Object{a, b, c, ...}" },
    { value: null, expected: "null" },
    { value: undefined, expected: "undefined" },
    { value: 42, expected: "42" },
  ])("summarizes $value", ({ value, expected }) => {
    expect(summarizeOutput(value)).toBe(expected);
  });

  it("summarizes long strings with character and line counts", () => {
    const result = summarizeOutput(`a\nb\n${"x".repeat(200)}`);

    expect(result).toContain("chars");
    expect(result).toContain("lines");
  });
});

describe("recordTrace", () => {
  it("summarizes the unwrapped value of an ok Result, not the wrapper", async () => {
    const steps: TraceRef[] = [];
    await recordTrace(steps, "generateAnalysis", "input", async () =>
      ok({ detailedAnalysis: "deep", rootCause: "cause" }),
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]?.outputSummary).toBe("Object{detailedAnalysis, rootCause}");
    expect(steps[0]?.outputSummary).not.toContain("ok");
    expect(steps[0]?.outputSummary).not.toContain("value");
  });

  it("summarizes the error of an err Result", async () => {
    const steps: TraceRef[] = [];
    await recordTrace(steps, "generateAnalysis", "input", async () =>
      err({ code: "MODEL_ERROR", message: "failed" }),
    );

    expect(steps[0]?.outputSummary).toBe("Object{code, message}");
  });
});
