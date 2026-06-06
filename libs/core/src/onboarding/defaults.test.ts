import { describe, expect, it } from "vitest";
import { AVAILABLE_PROVIDERS } from "../schemas/config/index.js";
import { LENS_IDS } from "../schemas/review/index.js";
import { getInitialWizardData } from "./defaults.js";

describe("getInitialWizardData", () => {
  it("preselects the first available provider", () => {
    const firstProvider = AVAILABLE_PROVIDERS[0];
    const data = getInitialWizardData();
    expect(data.provider).toBe(firstProvider?.id ?? null);
    expect(data.model).toBe(firstProvider?.defaultModel ?? null);
  });

  it("defaults secret storage to file", () => {
    expect(getInitialWizardData().secretsStorage).toBe("file");
  });

  it("defaults input method to paste with empty api key", () => {
    const data = getInitialWizardData();
    expect(data.inputMethod).toBe("paste");
    expect(data.apiKey).toBe("");
  });

  it("includes every lens by default", () => {
    expect(getInitialWizardData().defaultLenses).toEqual([...LENS_IDS]);
  });

  it("defaults agent execution to sequential", () => {
    expect(getInitialWizardData().agentExecution).toBe("sequential");
  });
});
