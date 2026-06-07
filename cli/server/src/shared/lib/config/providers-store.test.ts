import { describe, expect, it } from "vitest";
import {
  activeProvider,
  applyActiveProvider,
  applyCredentialsWithoutModel,
  clearProviderCredentials,
  effectiveStorage,
  ensureProviderEntry,
  fileHasSecret,
  isFileStorage,
} from "./providers-store.js";
import type { ConfigState, SecretsState } from "./types.js";

const baseState = (): ConfigState => ({
  settings: {
    theme: "auto",
    secretsStorage: "file",
    defaultLenses: ["correctness"],
    defaultProfile: null,
    severityThreshold: "low",
    agentExecution: "sequential",
  },
  providers: [
    { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
    { provider: "openrouter", hasApiKey: true, isActive: false, model: "x-ai/grok" },
  ],
});

describe("applyActiveProvider", () => {
  it("activates the requested provider and deactivates all others", () => {
    const state = baseState();
    const next = applyActiveProvider(state.providers, {
      providerId: "openrouter",
      model: "x-ai/grok",
      hasApiKey: true,
    });

    expect(next.find((p) => p.provider === "openrouter")).toMatchObject({
      isActive: true,
      model: "x-ai/grok",
      hasApiKey: true,
    });
    expect(next.find((p) => p.provider === "gemini")?.isActive).toBe(false);
  });

  it("preserves the existing model when preserveModel is set and no model is provided", () => {
    const state = baseState();
    const next = applyActiveProvider(state.providers, {
      providerId: "gemini",
      preserveModel: true,
    });

    expect(next.find((p) => p.provider === "gemini")?.model).toBe("gemini-2.5-flash");
  });
});

describe("ensureProviderEntry", () => {
  it("returns the existing entry without modifying providers", () => {
    const state = baseState();
    const result = ensureProviderEntry(state.providers, "gemini", true);
    expect(result.providers).toBe(state.providers);
    expect(result.entry.provider).toBe("gemini");
  });

  it("appends a new provider when none exists", () => {
    const state = baseState();
    const trimmed = state.providers.filter((p) => p.provider !== "openrouter");
    const result = ensureProviderEntry(trimmed, "openrouter", false);
    expect(result.providers).toHaveLength(trimmed.length + 1);
    expect(result.entry).toMatchObject({
      provider: "openrouter",
      hasApiKey: false,
      isActive: false,
    });
  });
});

describe("applyCredentialsWithoutModel", () => {
  it("keeps a provider active when it already has a model", () => {
    const next = applyCredentialsWithoutModel(baseState().providers, "gemini");
    expect(next.find((p) => p.provider === "gemini")).toMatchObject({
      hasApiKey: true,
      isActive: true,
    });
  });

  it("deactivates a provider without a model", () => {
    const noModel = [{ provider: "gemini" as const, hasApiKey: false, isActive: true }];
    const next = applyCredentialsWithoutModel(noModel, "gemini");
    expect(next[0]).toMatchObject({ hasApiKey: true, isActive: false });
  });
});

describe("clearProviderCredentials", () => {
  it("strips api key, active flag, and model for the target provider", () => {
    const next = clearProviderCredentials(baseState().providers, "gemini");
    expect(next.find((p) => p.provider === "gemini")).toMatchObject({
      hasApiKey: false,
      isActive: false,
      model: undefined,
    });
  });
});

describe("activeProvider", () => {
  it("returns a copy of the active provider", () => {
    const state = baseState();
    const active = activeProvider(state);
    expect(active).toMatchObject({ provider: "gemini", isActive: true });
    expect(active).not.toBe(state.providers[0]);
  });

  it("returns null when no provider is active", () => {
    const state = baseState();
    state.providers = state.providers.map((p) => ({ ...p, isActive: false }));
    expect(activeProvider(state)).toBeNull();
  });
});

describe("storage helpers", () => {
  it("effectiveStorage defaults to file when secretsStorage is null", () => {
    const state = baseState();
    state.settings.secretsStorage = null;
    expect(effectiveStorage(state)).toBe("file");
  });

  it("isFileStorage reflects the effective storage", () => {
    const state = baseState();
    expect(isFileStorage(state)).toBe(true);
    state.settings.secretsStorage = "keyring";
    expect(isFileStorage(state)).toBe(false);
  });

  it("fileHasSecret reports presence in the file secrets map", () => {
    const secrets: SecretsState = { providers: { gemini: "key" } };
    expect(fileHasSecret(secrets, "gemini")).toBe(true);
    expect(fileHasSecret(secrets, "openrouter")).toBe(false);
  });
});
