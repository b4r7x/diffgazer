import type { ProviderStatus } from "@diffgazer/core/schemas/config";
import { describe, expect, it } from "vitest";
import {
  ProviderConfigurationConflictError,
  type ProviderConfigurationFile,
  type RemovedProviderConfigurationRecord,
  type SupportedProviderConfigurationRecord,
} from "./provider-config.js";
import {
  activeProvider,
  applyActiveProvider,
  applyCredentialsWithoutModel,
  type ConfigurationBindingState,
  clearProviderCredentials,
  configurationRevisionKey,
  deleteConfigurationBinding,
  deleteConfigurationRecord,
  effectiveStorage,
  ensureProviderEntry,
  fileHasSecret,
  findConfigurationBinding,
  findConfigurationRevision,
  isFileStorage,
  replaceConfigurationBinding,
  replaceConfigurationRevision,
  retainRemovedConfigurationBinding,
  selectConfigurationRevision,
  toSafeConfigurationRevision,
} from "./providers-store.js";
import {
  createEnvironmentSecretBinding,
  createFileSecretBinding,
  createKeyringSecretBinding,
  type SecretBinding,
} from "./secret-bindings.js";
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

const configurationBudget = {
  inputTokens: 32_000,
  outputTokens: 8_000,
  responseBytes: 65_536,
  wallTimeMs: 60_000,
  retries: 2,
  concurrency: 1,
  perReview: 40_000,
};

function supportedConfiguration(
  configurationId: string,
  revision: number,
): SupportedProviderConfigurationRecord {
  return {
    schemaVersion: 2,
    status: "supported",
    configurationId,
    revision,
    productId: "gemini",
    transportFamily: "hosted-api",
    input: {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
    },
    selectedModelId: "gemini-2.5-flash",
    acknowledgement: {
      noticeVersion: 1,
      acceptedAt: "2026-07-31T12:00:00.000Z",
    },
    evidenceReference: `evidence-${configurationId}-${revision}`,
    budget: configurationBudget,
    createdAt: "2026-07-31T11:00:00.000Z",
    updatedAt: "2026-07-31T12:00:00.000Z",
  };
}

const removedConfiguration: RemovedProviderConfigurationRecord = {
  schemaVersion: 2,
  status: "removed",
  configurationId: "legacy-zai-coding",
  revision: 4,
  productId: "zai-coding",
  transportFamily: "hosted-api",
  selectedModelId: null,
  acknowledgement: null,
  evidenceReference: null,
  budget: null,
  createdAt: "2026-07-31T11:00:00.000Z",
  updatedAt: "2026-07-31T12:00:00.000Z",
};

function configurationFile(
  ...records: ProviderConfigurationFile["records"]
): ProviderConfigurationFile {
  return { schemaVersion: 2, selectedConfigurationId: null, records };
}

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
    expect(result.providers).toEqual(state.providers);
    expect(result.entry).toEqual(state.providers.find((p) => p.provider === "gemini"));
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
    const providers: ProviderStatus[] = [
      ...baseState().providers.filter((p) => p.provider !== "openrouter"),
      { provider: "openrouter", hasApiKey: false, isActive: false },
    ];
    const next = applyCredentialsWithoutModel(providers, "gemini");
    expect(next.find((p) => p.provider === "gemini")).toMatchObject({
      hasApiKey: true,
      isActive: true,
    });
    expect(next.find((p) => p.provider === "openrouter")).toEqual(
      providers.find((p) => p.provider === "openrouter"),
    );
  });

  it("deactivates a provider without a model", () => {
    const noModel = [{ provider: "gemini" as const, hasApiKey: false, isActive: true }];
    const next = applyCredentialsWithoutModel(noModel, "gemini");
    expect(next[0]).toMatchObject({ hasApiKey: true, isActive: false });
  });
});

describe("clearProviderCredentials", () => {
  it("strips api key, active flag, and model for the target provider", () => {
    const state = baseState();
    const next = clearProviderCredentials(state.providers, "gemini");
    expect(next.find((p) => p.provider === "gemini")).toMatchObject({
      hasApiKey: false,
      isActive: false,
      model: undefined,
    });
    expect(next.find((p) => p.provider === "openrouter")).toEqual(
      state.providers.find((p) => p.provider === "openrouter"),
    );
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

describe("V2 configuration storage helpers", () => {
  it("keys storage by the exact configuration id and revision identity", () => {
    expect(configurationRevisionKey("gemini-primary", 3)).toBe("gemini-primary\u00003");
    expect(configurationRevisionKey("gemini-primary", 31)).not.toBe(
      configurationRevisionKey("gemini-primary3", 1),
    );
  });

  it("finds, replaces, and selects only conflict-free configuration revisions", () => {
    const primary = supportedConfiguration("gemini-primary", 3);
    const file = configurationFile(
      { status: "supported", record: primary },
      { status: "removed", record: removedConfiguration },
    );

    expect(
      findConfigurationRevision(file, { configurationId: "gemini-primary", revision: 3 }),
    ).toEqual({ status: "supported", record: primary });
    expect(
      findConfigurationRevision(file, { configurationId: "gemini-primary", revision: 2 }),
    ).toBeUndefined();
    expect(selectConfigurationRevision(file, "gemini-primary").selectedConfigurationId).toBe(
      "gemini-primary",
    );
    expect(() => selectConfigurationRevision(file, "legacy-zai-coding")).toThrow(
      ProviderConfigurationConflictError,
    );

    const replacement = { ...primary, updatedAt: "2026-07-31T13:00:00.000Z" };
    const replaced = replaceConfigurationRevision(
      file,
      { configurationId: "gemini-primary", revision: 3 },
      replacement,
    );
    expect(findConfigurationRevision(replaced, primary)).toEqual({
      status: "supported",
      record: replacement,
    });
    expect(() =>
      replaceConfigurationRevision(
        file,
        { configurationId: "gemini-primary", revision: 2 },
        replacement,
      ),
    ).toThrow(ProviderConfigurationConflictError);
  });

  it("retains a removed binding until exact-revision deletion", () => {
    const activeBinding = createEnvironmentSecretBinding("gemini-primary", 3, "GEMINI_API_KEY");
    const removedBinding = createFileSecretBinding(
      "legacy-zai-coding",
      4,
      "/run/secrets/legacy-zai",
    );
    const retained = retainRemovedConfigurationBinding(
      [activeBinding, removedBinding],
      removedConfiguration,
    );

    expect(findConfigurationBinding(retained, removedConfiguration)?.status).toBe("removed");
    expect(findConfigurationBinding(retained, activeBinding)?.status).toBe("active");
    expect(deleteConfigurationBinding(retained, removedConfiguration)).toEqual([activeBinding]);

    const state: ConfigurationBindingState = {
      file: configurationFile(
        { status: "supported", record: supportedConfiguration("gemini-primary", 3) },
        { status: "removed", record: removedConfiguration },
      ),
      bindings: retained,
    };
    const deleted = deleteConfigurationRecord(state, removedConfiguration);
    expect(deleted.file.records).toEqual([state.file.records[0]]);
    expect(deleted.bindings).toEqual([activeBinding]);
  });

  it("projects configuration bindings without secret references or values", () => {
    const record = supportedConfiguration("gemini-primary", 3);
    const environmentBindingWithValue = {
      ...createEnvironmentSecretBinding("gemini-primary", 3, "GEMINI_API_KEY"),
      value: "literal-secret",
    };
    const bindings: SecretBinding[] = [
      environmentBindingWithValue,
      createFileSecretBinding("gemini-primary", 3, "/run/secrets/gemini"),
      createKeyringSecretBinding("gemini-primary", 3, "diffgazer/gemini-primary"),
    ];
    const projections = bindings.map((binding) =>
      toSafeConfigurationRevision({ status: "supported", record }, binding),
    );

    for (const projection of projections) {
      expect(projection).toMatchObject({
        configurationId: "gemini-primary",
        revision: 3,
        status: "supported",
      });
      expect(Object.keys(projection?.binding ?? {}).sort()).toEqual([
        "configurationId",
        "kind",
        "revision",
        "status",
      ]);
    }
    expect(JSON.stringify(projections)).not.toContain("GEMINI_API_KEY");
    expect(JSON.stringify(projections)).not.toContain("/run/secrets/gemini");
    expect(JSON.stringify(projections)).not.toContain("diffgazer/gemini-primary");
    expect(JSON.stringify(projections)).not.toContain("literal-secret");
  });

  it("isolates same-provider configurations and rejects provider-wide replacement", () => {
    const primary = supportedConfiguration("gemini-primary", 3);
    const backup = supportedConfiguration("gemini-backup", 7);
    const file = configurationFile(
      { status: "supported", record: primary },
      { status: "supported", record: backup },
    );
    const replacement = { ...primary, selectedModelId: "gemini-2.5-pro" };

    const replaced = replaceConfigurationRevision(
      file,
      { configurationId: "gemini-primary", revision: 3 },
      replacement,
    );
    expect(findConfigurationRevision(replaced, backup)).toEqual({
      status: "supported",
      record: backup,
    });
    expect(() =>
      replaceConfigurationRevision(file, { configurationId: "gemini", revision: 3 }, replacement),
    ).toThrow(ProviderConfigurationConflictError);

    const revisionThree = createEnvironmentSecretBinding("gemini-primary", 3, "GEMINI_API_KEY");
    const revisionFour = createKeyringSecretBinding("gemini-primary", 4, "gemini-primary-4");
    const replacementBinding = createFileSecretBinding(
      "gemini-primary",
      3,
      "/run/secrets/gemini-primary-3",
    );
    const replacedBindings = replaceConfigurationBinding(
      [revisionThree, revisionFour],
      replacementBinding,
      revisionThree,
    );
    expect(findConfigurationBinding(replacedBindings, revisionThree)).toEqual(replacementBinding);
    expect(findConfigurationBinding(replacedBindings, revisionFour)).toBe(revisionFour);
    expect(() =>
      replaceConfigurationBinding([revisionThree, revisionFour], replacementBinding, revisionFour),
    ).toThrow(ProviderConfigurationConflictError);
  });
});
