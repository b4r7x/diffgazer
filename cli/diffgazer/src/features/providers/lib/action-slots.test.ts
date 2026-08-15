import { requireValue } from "@diffgazer/core/testing/assertions";
import {
  buildProviderRows,
  configurationStatus,
  GEMINI_CONFIGURATION,
  unconfiguredRow,
} from "@diffgazer/core/testing/provider-fixtures";
import { describe, expect, test } from "vitest";
import { getProviderActionSlots } from "./action-slots";

function enabledLabels(row: Parameters<typeof getProviderActionSlots>[0]): string[] {
  return getProviderActionSlots(row)
    .filter((slot) => slot.enabled)
    .map((slot) => slot.label);
}

describe("getProviderActionSlots", () => {
  test("never offers the same action from two live buttons", () => {
    const labels = enabledLabels(unconfiguredRow("gemini"));

    expect(labels).toEqual(["Create configuration"]);
  });

  test("keeps the setup button when readiness asks for something else", () => {
    const row = requireValue(
      buildProviderRows([configurationStatus(GEMINI_CONFIGURATION, "conformance-pending")])[0],
      "conformance-pending row",
    );

    expect(enabledLabels(row)).toContain("Test readiness");
    expect(enabledLabels(row)).toContain("Update configuration");
  });

  test("keeps the four fixed positions whatever the row offers", () => {
    expect(getProviderActionSlots(unconfiguredRow("gemini"))).toHaveLength(4);
    expect(getProviderActionSlots(null)).toHaveLength(4);
  });
});
