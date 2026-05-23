import { describe, expect, it, vi } from "vitest";
import {
  buildConfigPayload,
  buildSettingsPayload,
  saveWizard,
} from "./save-wizard.js";
import { getInitialWizardData } from "./defaults.js";
import type { WizardData } from "./types.js";

function withData(overrides: Partial<WizardData>): WizardData {
  return { ...getInitialWizardData(), ...overrides };
}

describe("buildSettingsPayload", () => {
  it("copies storage, lenses and execution mode", () => {
    const data = withData({
      secretsStorage: "keyring",
      defaultLenses: ["security"],
      agentExecution: "parallel",
    });

    expect(buildSettingsPayload(data)).toEqual({
      secretsStorage: "keyring",
      defaultLenses: ["security"],
      agentExecution: "parallel",
    });
  });
});

describe("buildConfigPayload", () => {
  it("forwards model when set", () => {
    const data = withData({
      provider: "gemini",
      model: "gemini-2.5-pro",
      inputMethod: "paste",
      apiKey: "real-key",
    });

    expect(buildConfigPayload(data)).toEqual({
      provider: "gemini",
      apiKey: { kind: "literal", value: "real-key" },
      model: "gemini-2.5-pro",
    });
  });

  it("sends structured env credential ref when env method is selected", () => {
    const data = withData({
      provider: "gemini",
      model: "gemini-2.5-pro",
      inputMethod: "env",
      apiKey: "ignored",
    });

    expect(buildConfigPayload(data).apiKey).toEqual({
      kind: "env",
      varName: "GOOGLE_API_KEY",
    });
  });

  it("sends structured literal credential ref when paste method is selected", () => {
    const data = withData({
      provider: "gemini",
      model: "gemini-2.5-pro",
      inputMethod: "paste",
      apiKey: "real-key",
    });

    expect(buildConfigPayload(data).apiKey).toEqual({
      kind: "literal",
      value: "real-key",
    });
  });

  it("omits the model when none is selected", () => {
    const data = withData({ provider: "gemini", model: null, apiKey: "k" });

    expect(buildConfigPayload(data).model).toBeUndefined();
  });

  it("throws when there is no provider", () => {
    expect(() => buildConfigPayload(withData({ provider: null }))).toThrow();
  });
});

describe("saveWizard", () => {
  it("persists settings before config and forwards the derived payloads", async () => {
    const callOrder: string[] = [];
    const saveSettings = vi.fn(async () => {
      callOrder.push("settings");
    });
    const saveConfig = vi.fn(async () => {
      callOrder.push("config");
    });

    const data = withData({
      secretsStorage: "file",
      provider: "gemini",
      model: "gemini-2.5-pro",
      inputMethod: "paste",
      apiKey: "real-key",
      defaultLenses: ["security"],
      agentExecution: "sequential",
    });

    const result = await saveWizard(data, { saveSettings, saveConfig });

    expect(result).toEqual({ status: "complete" });
    expect(callOrder).toEqual(["settings", "config"]);
    expect(saveSettings).toHaveBeenCalledWith({
      secretsStorage: "file",
      defaultLenses: ["security"],
      agentExecution: "sequential",
    });
    expect(saveConfig).toHaveBeenCalledWith({
      provider: "gemini",
      apiKey: { kind: "literal", value: "real-key" },
      model: "gemini-2.5-pro",
    });
  });

  it("returns partial result on settings save failure without calling saveConfig", async () => {
    const saveSettings = vi.fn(async () => {
      throw new Error("boom");
    });
    const saveConfig = vi.fn();

    const result = await saveWizard(getInitialWizardData(), { saveSettings, saveConfig });

    expect(result.status).toBe("partial");
    if (result.status === "partial") {
      expect(result.completedSteps).toEqual([]);
      expect(result.error).toBeInstanceOf(Error);
    }
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it("returns partial result on config save failure after settings succeeds", async () => {
    const saveSettings = vi.fn(async () => {});
    const saveConfig = vi.fn(async () => {
      throw new Error("config fail");
    });

    const data = withData({
      secretsStorage: "file",
      provider: "gemini",
      model: "gemini-2.5-pro",
      inputMethod: "paste",
      apiKey: "real-key",
    });

    const result = await saveWizard(data, { saveSettings, saveConfig });

    expect(result.status).toBe("partial");
    if (result.status === "partial") {
      expect(result.completedSteps).toEqual(["settings"]);
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});
