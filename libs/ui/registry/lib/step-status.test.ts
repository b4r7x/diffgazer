import { describe, expect, it } from "vitest";
import registry from "../registry.json";
import { STEP_STATUSES } from "./step-status";

describe("step-status registry metadata", () => {
  it("names every canonical status", () => {
    const item = registry.items.find((entry) => entry.name === "step-status");
    const vocabulary = item?.description.match(/\(([^)]+)\)/)?.[1]?.split(", ");

    expect(vocabulary).toEqual(STEP_STATUSES);
  });
});
