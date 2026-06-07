import { describe, expect, it } from "vitest";
import { canProceed } from "./can-proceed.js";
import { getInitialWizardData } from "./defaults.js";
import type { WizardData } from "./types.js";

function withData(overrides: Partial<WizardData>): WizardData {
  return { ...getInitialWizardData(), ...overrides };
}

describe("canProceed", () => {
  it("blocks storage step when no storage method is selected", () => {
    expect(canProceed("storage", withData({ secretsStorage: null }))).toBe(false);
  });

  it("allows storage step when a storage method is selected", () => {
    expect(canProceed("storage", withData({ secretsStorage: "file" }))).toBe(true);
    expect(canProceed("storage", withData({ secretsStorage: "keyring" }))).toBe(true);
  });

  it("blocks provider step when no provider is selected", () => {
    expect(canProceed("provider", withData({ provider: null }))).toBe(false);
  });

  it("allows provider step when a provider is selected", () => {
    expect(canProceed("provider", withData({ provider: "gemini" }))).toBe(true);
  });

  it("allows api-key step when env method is selected even without a key", () => {
    expect(canProceed("api-key", withData({ inputMethod: "env", apiKey: "" }))).toBe(true);
  });

  it("blocks api-key step when paste method has empty key", () => {
    expect(canProceed("api-key", withData({ inputMethod: "paste", apiKey: "" }))).toBe(false);
  });

  it("allows api-key step when paste method has a key", () => {
    expect(canProceed("api-key", withData({ inputMethod: "paste", apiKey: "secret" }))).toBe(true);
  });

  it("blocks model step when model is null", () => {
    expect(canProceed("model", withData({ model: null }))).toBe(false);
  });

  it("allows model step when model is selected", () => {
    expect(canProceed("model", withData({ model: "gemini-2.5-pro" }))).toBe(true);
  });

  it("blocks analysis step when no lenses are selected", () => {
    expect(canProceed("analysis", withData({ defaultLenses: [] }))).toBe(false);
  });

  it("allows analysis step when at least one lens is selected", () => {
    expect(canProceed("analysis", withData({ defaultLenses: ["security"] }))).toBe(true);
  });

  it("allows execution step regardless of mode", () => {
    expect(canProceed("execution", withData({ agentExecution: "parallel" }))).toBe(true);
    expect(canProceed("execution", withData({ agentExecution: "sequential" }))).toBe(true);
  });
});
