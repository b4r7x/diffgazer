import { describe, expect, test } from "vitest";
import { assertIntegrationModeChangesAllowed } from "./integration-mode.js";

describe("integration mode planning", () => {
  test("requires overwrite before changing an installed mode", () => {
    expect(() =>
      assertIntegrationModeChangesAllowed(["ui/select"], "@diffgazer/keys", false),
    ).toThrow(/--overwrite/);

    expect(() =>
      assertIntegrationModeChangesAllowed(["ui/select"], "@diffgazer/keys", true),
    ).not.toThrow();
  });

  test("allows a plan when no installed item changes mode", () => {
    expect(() => assertIntegrationModeChangesAllowed([], "copy", false)).not.toThrow();
  });
});
