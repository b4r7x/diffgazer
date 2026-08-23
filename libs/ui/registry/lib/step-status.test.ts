import { requireValue } from "@diffgazer/core/testing/assertions";
import { describe, expect, it } from "vitest";
import registry from "../registry.json";
import type { StepStatus } from "./step-status";

const STEP_STATUSES = [
  "pending",
  "active",
  "completed",
  "error",
  "skipped",
  "disabled",
] as const satisfies readonly StepStatus[];

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
});
