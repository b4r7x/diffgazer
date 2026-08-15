import { describe, expect, it } from "vitest";
import type { ModelInfo } from "../schemas/config/models.js";
import { getRetainedModelNotice } from "./model-discovery-messages.js";

const MODELS: ModelInfo[] = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "", tier: "paid" },
];

describe("getRetainedModelNotice", () => {
  it("says nothing while the selection is one of the offered models", () => {
    expect(getRetainedModelNotice("gemini-2.5-flash", MODELS)).toBeNull();
  });

  it("says nothing when no model is selected", () => {
    expect(getRetainedModelNotice(null, MODELS)).toBeNull();
  });

  // An empty list means discovery failed or was skipped; that is not evidence
  // about the saved model, so it must not produce a capability claim.
  it("says nothing when discovery returned no models to compare against", () => {
    expect(getRetainedModelNotice("gemini-2.5-flash", [])).toBeNull();
  });

  it("names a saved model the capable list no longer offers and keeps it configured", () => {
    const notice = getRetainedModelNotice("glm-4.7", MODELS);

    expect(notice).toContain("glm-4.7");
    expect(notice).toContain("stays configured");
  });
});
