import { describe, expect, it } from "vitest";
import registry from "../registry.json";
import { requireValue } from "../testing/assertions";
import { STEP_STATUSES, type StepStatus } from "./step-status";

describe("step-status registry metadata", () => {
  it("names every canonical status", () => {
    const item = requireValue(
      registry.items.find((entry) => entry.name === "step-status"),
      "step-status registry item",
    );

    for (const status of STEP_STATUSES) {
      expect(item.description).toMatch(new RegExp(`\\b${status}\\b`));
    }
  });

  it("STEP_STATUSES exports the canonical six-state ordering", () => {
    expect(STEP_STATUSES).toEqual([
      "pending",
      "active",
      "completed",
      "error",
      "skipped",
      "disabled",
    ] satisfies StepStatus[]);
  });
});
