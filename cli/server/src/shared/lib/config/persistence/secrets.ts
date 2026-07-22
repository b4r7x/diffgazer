import { isDeepStrictEqual } from "node:util";
import {
  AI_PROVIDERS,
  type AIProvider,
  PROVIDER_ENV_VARS,
  type ProviderStatus,
  type SecretsStorage,
} from "@diffgazer/core/schemas/config";
import { z } from "zod";
import { removeFileSync, writeJsonFile, writeJsonFileSync } from "../../fs.js";
import { getGlobalSecretsPath } from "../../paths.js";
import { withFileTransactionLock } from "../transaction/file-lock.js";
import type { SecretsState } from "../types.js";
import { loadOrQuarantine } from "./load-json.js";

const isValidAIProvider = (value: string): value is AIProvider => {
  return AI_PROVIDERS.includes(value as AIProvider);
};

const PersistedEnvCredentialRefSchema = z
  .object({
    kind: z.literal("env"),
    varName: z.string().min(1),
  })
  .strict();

const PersistedLiteralSecretSchema = z
  .string()
  .refine((value) => value.trim().length > 0, { error: "API key must not be empty" });

const SecretEntrySchema = z.union([PersistedLiteralSecretSchema, PersistedEnvCredentialRefSchema]);

const RawSecretsContainerSchema = z.object({
  providers: z.record(z.string(), z.unknown()).catch({}).optional(),
});

let _secretsPath: string | undefined;

const SECRETS_PATH = (): string => {
  _secretsPath ??= getGlobalSecretsPath();
  return _secretsPath;
};

const parseSecretsContainer = (
  stored: z.infer<typeof RawSecretsContainerSchema> | null,
): SecretsState => {
  const storedProviders = stored?.providers ?? {};

  const migrated: SecretsState["providers"] = {};
  const unknown: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(storedProviders)) {
    if (!isValidAIProvider(key)) {
      unknown[key] = value;
      continue;
    }

    if (value === "env") {
      migrated[key] = { kind: "env", varName: PROVIDER_ENV_VARS[key] };
      continue;
    }
    const parsed = SecretEntrySchema.safeParse(value);
    if (!parsed.success) {
      unknown[key] = value;
      continue;
    }
    if (typeof parsed.data !== "string" && parsed.data.varName !== PROVIDER_ENV_VARS[key]) {
      unknown[key] = value;
      continue;
    }
    migrated[key] = parsed.data;
  }

  return {
    providers: migrated,
    ...(Object.keys(unknown).length > 0 ? { unknownSecrets: unknown } : {}),
  };
};

export const parseSecretsData = (data: unknown): SecretsState => {
  const parsed = RawSecretsContainerSchema.safeParse(data);
  return parseSecretsContainer(parsed.success ? parsed.data : null);
};

export const loadSecrets = (): SecretsState => {
  const stored = loadOrQuarantine(SECRETS_PATH(), "secrets", RawSecretsContainerSchema);
  return parseSecretsContainer(stored);
};

const serializeSecrets = (state: SecretsState): { providers: Record<string, unknown> } => ({
  providers: { ...state.unknownSecrets, ...state.providers },
});

const mergeChangedRecords = (
  state: Record<string, unknown>,
  previous: Record<string, unknown>,
  disk: Record<string, unknown>,
): Record<string, unknown> => {
  const merged = { ...disk };
  const keys = new Set([...Object.keys(previous), ...Object.keys(state)]);
  for (const key of keys) {
    const stateHasKey = Object.hasOwn(state, key);
    const previousHasKey = Object.hasOwn(previous, key);
    const changed =
      stateHasKey !== previousHasKey ||
      (stateHasKey && previousHasKey && !isDeepStrictEqual(state[key], previous[key]));
    if (!changed) continue;
    if (stateHasKey) {
      merged[key] = state[key];
    } else {
      delete merged[key];
    }
  }
  return merged;
};

export const persistSecrets = (state: SecretsState): void => {
  writeJsonFileSync(SECRETS_PATH(), serializeSecrets(state), 0o600);
};

export const persistSecretsAsync = (
  state: SecretsState,
  previousState: SecretsState = { providers: {} },
): Promise<void> =>
  withFileTransactionLock(SECRETS_PATH(), async () => {
    const disk = loadSecrets();
    const providers = mergeChangedRecords(
      serializeSecrets(state).providers,
      serializeSecrets(previousState).providers,
      serializeSecrets(disk).providers,
    );
    if (Object.keys(providers).length === 0) {
      removeFileSync(SECRETS_PATH());
      return;
    }
    await writeJsonFile(SECRETS_PATH(), { providers }, 0o600);
  });

export const removeSecretsFile = (): boolean => removeFileSync(SECRETS_PATH());

export const syncProvidersWithSecrets = (
  providers: ProviderStatus[],
  secrets: SecretsState,
  storage: SecretsStorage,
): ProviderStatus[] => {
  if (storage !== "file") {
    return providers.map((p) => ({ ...p }));
  }

  const providerIds = new Set(providers.map((provider) => provider.provider));
  const nextProviders = providers.map((provider) => ({
    ...provider,
    hasApiKey: secrets.providers[provider.provider] !== undefined,
  }));

  for (const providerId of Object.keys(secrets.providers)) {
    if (!isValidAIProvider(providerId)) continue;
    if (providerIds.has(providerId)) continue;

    nextProviders.push({
      provider: providerId,
      hasApiKey: true,
      isActive: false,
    });
  }

  return nextProviders;
};
