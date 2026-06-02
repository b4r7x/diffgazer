import { describe, expect, it } from "vitest";
import { isStepEvent, StepEventSchema } from "./step.js";

describe("isStepEvent", () => {
  it("recognizes every discriminant declared in StepEventSchema", () => {
    const discriminants = StepEventSchema.options.flatMap((option) => [...option.shape.type.values]);

    for (const type of discriminants) {
      expect(isStepEvent({ type })).toBe(true);
    }
  });

  it("rejects events whose type is not a step discriminant", () => {
    expect(isStepEvent({ type: "agent_progress" })).toBe(false);
    expect(isStepEvent({ type: "issue_found" })).toBe(false);
    expect(isStepEvent({})).toBe(false);
    expect(isStepEvent(null)).toBe(false);
  });
});
