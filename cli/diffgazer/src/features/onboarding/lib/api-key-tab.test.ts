import { describe, expect, it } from "vitest";
import { apiKeyStepOwnsTab } from "./api-key-tab.js";

describe("apiKeyStepOwnsTab", () => {
  it("owns Tab on the api-key step while the step body is focused", () => {
    expect(apiKeyStepOwnsTab("api-key", "step")).toBe(true);
  });

  it("yields Tab to the wizard when the nav row is focused", () => {
    expect(apiKeyStepOwnsTab("api-key", "nav")).toBe(false);
  });

  it("yields Tab on every other step", () => {
    expect(apiKeyStepOwnsTab("provider", "step")).toBe(false);
    expect(apiKeyStepOwnsTab("model", "step")).toBe(false);
  });
});
