import { describe, it, expect, beforeEach } from "vitest";
import { TraceRecorder } from "./trace-recorder.js";

describe("TraceRecorder", () => {
  let recorder: TraceRecorder;

  beforeEach(() => {
    recorder = new TraceRecorder();
  });

  it("records a single trace step", async () => {
    const result = await recorder.wrap("readFile", "src/index.ts", async () => "file content");

    expect(result).toBe("file content");

    const trace = recorder.getTrace();
    expect(trace).toHaveLength(1);
    expect(trace[0]).toMatchObject({
      step: 1,
      tool: "readFile",
      inputSummary: "src/index.ts",
      outputSummary: "file content",
    });
    expect(trace[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("records multiple steps with incrementing step numbers", async () => {
    await recorder.wrap("step1", "input1", async () => "result1");
    await recorder.wrap("step2", "input2", async () => "result2");
    await recorder.wrap("step3", "input3", async () => "result3");

    const trace = recorder.getTrace();
    expect(trace).toHaveLength(3);
    expect(trace.map((t) => t.step)).toEqual([1, 2, 3]);
    expect(trace.map((t) => t.tool)).toEqual(["step1", "step2", "step3"]);
  });

  it("summarizes long string outputs", async () => {
    const longString = "x".repeat(200) + "\n".repeat(10);
    await recorder.wrap("readFile", "large.txt", async () => longString);

    const trace = recorder.getTrace();
    expect(trace[0]?.outputSummary).toBe("210 chars, 11 lines");
  });

  it("summarizes array outputs", async () => {
    await recorder.wrap("getFiles", "src/", async () => ["a.ts", "b.ts", "c.ts"]);

    const trace = recorder.getTrace();
    expect(trace[0]?.outputSummary).toBe("Array[3]");
  });

  it("summarizes object outputs", async () => {
    await recorder.wrap("getConfig", "config.json", async () => ({
      name: "test",
      version: "1.0.0",
      dependencies: {},
      devDependencies: {},
    }));

    const trace = recorder.getTrace();
    expect(trace[0]?.outputSummary).toBe("Object{name, version, dependencies, ...}");
  });

  it("handles null and undefined outputs", async () => {
    await recorder.wrap("findFile", "missing.ts", async () => null);
    await recorder.wrap("getOptional", "key", async () => undefined);

    const trace = recorder.getTrace();
    expect(trace[0]?.outputSummary).toBe("null");
    expect(trace[1]?.outputSummary).toBe("undefined");
  });

  it("returns a copy of the trace", () => {
    const trace1 = recorder.getTrace();
    trace1.push({
      step: 99,
      tool: "fake",
      inputSummary: "fake",
      outputSummary: "fake",
      timestamp: "fake",
    });

    const trace2 = recorder.getTrace();
    expect(trace2).toHaveLength(0);
  });

  it("clears all recorded steps", async () => {
    await recorder.wrap("step1", "input1", async () => "result1");
    await recorder.wrap("step2", "input2", async () => "result2");

    recorder.clear();

    expect(recorder.getTrace()).toHaveLength(0);
  });

  it("resets step counter after clear", async () => {
    await recorder.wrap("step1", "input1", async () => "result1");
    recorder.clear();
    await recorder.wrap("newStep", "newInput", async () => "newResult");

    const trace = recorder.getTrace();
    expect(trace[0]?.step).toBe(1);
  });
});
