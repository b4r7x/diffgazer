import { describe, expect, it } from "vitest";
import { stepComplete, stepError, stepStart } from "./step-events.js";

describe("step-events factories", () => {
  it("stepStart returns a step_start event with timestamp", () => {
    const event = stepStart("diff");
    expect(event.type).toBe("step_start");
    expect(event.step).toBe("diff");
    expect(typeof event.timestamp).toBe("string");
    expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false);
  });

  it("stepComplete returns a step_complete event with timestamp", () => {
    const event = stepComplete("review");
    expect(event.type).toBe("step_complete");
    expect(event.step).toBe("review");
    expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false);
  });

  it("stepError returns a step_error event with message and timestamp", () => {
    const event = stepError("context", "context unavailable");
    expect(event).toMatchObject({
      type: "step_error",
      step: "context",
      error: "context unavailable",
    });
    expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false);
  });
});
