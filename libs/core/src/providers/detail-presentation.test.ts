import { describe, expect, it } from "vitest";
import {
  getProviderDetailModelLabel,
  PROVIDER_DETAIL_ACTION_LABELS,
  PROVIDER_DETAIL_EMPTY_LABEL,
} from "./detail-presentation.js";

describe("provider detail presentation", () => {
  it("defines shared action and empty-state labels", () => {
    expect(PROVIDER_DETAIL_ACTION_LABELS).toEqual({
      selectProvider: "Select Provider",
      configureApiKey: "Configure API Key",
      removeKey: "Remove Key",
      selectModel: "Select Model",
    });
    expect(PROVIDER_DETAIL_EMPTY_LABEL).toBe("Select a provider to view details");
  });

  it.each([
    ["selected model", "gemini", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-pro"],
    ["default model", "gemini", undefined, "gemini-2.5-flash", "gemini-2.5-flash (default)"],
    ["required model", "openrouter", undefined, undefined, "Model required"],
    ["missing default", "groq", undefined, undefined, "No default model"],
  ])("formats the %s state", (_label, providerId, model, defaultModel, expected) => {
    expect(getProviderDetailModelLabel(providerId, model, defaultModel)).toBe(expected);
  });
});
