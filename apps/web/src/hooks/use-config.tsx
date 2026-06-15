import {
  configQueries,
  useActivateProvider,
  useDeleteProviderCredentials,
  useInit,
  useProviderStatus,
  useSaveConfig,
} from "@diffgazer/core/api/hooks";
import type {
  AIProvider,
  CredentialRef,
  ProviderStatus,
  SecretsStorage,
  SetupStatus,
  TrustConfig,
} from "@diffgazer/core/schemas/config";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";

interface ConfigDataContextValue {
  isLoading: boolean;
  provider?: AIProvider;
  model?: string;
  isConfigured: boolean;
  providerStatus: ProviderStatus[];
  projectId: string | null;
  repoRoot: string | null;
  trust: TrustConfig | null;
  setupStatus: SetupStatus | null;
  secretsStorage: SecretsStorage | null;
}

interface ConfigActionsContextValue {
  refresh: () => Promise<void>;
  activateProvider: (providerId: string, model?: string) => Promise<void>;
  saveCredentials: (
    provider: AIProvider,
    apiKey: string | CredentialRef,
    model?: string,
  ) => Promise<void>;
  deleteProviderCredentials: (provider: AIProvider) => Promise<void>;
}

const EMPTY_PROVIDERS: ProviderStatus[] = [];

const ConfigDataContext = createContext<ConfigDataContextValue | undefined>(undefined);
const ConfigActionsContext = createContext<ConfigActionsContextValue | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const initQuery = useInit();
  const providersQuery = useProviderStatus();
  const { mutateAsync: activateMutateAsync } = useActivateProvider();
  const { mutateAsync: saveConfigMutateAsync } = useSaveConfig();
  const { mutateAsync: deleteCredentialsMutateAsync } = useDeleteProviderCredentials();

  const initData = initQuery.data;
  const isLoading = initQuery.isLoading || providersQuery.isLoading;

  const provider = initData?.config?.provider;
  const model = initData?.config?.model;
  const isConfigured = initData?.setup?.isConfigured ?? false;
  const providerStatus = providersQuery.data ?? initData?.providers ?? EMPTY_PROVIDERS;
  const projectId = initData?.project?.projectId ?? null;
  const repoRoot = initData?.project?.path ?? null;
  const trust = initData?.project?.trust ?? null;
  const setupStatus = initData?.setup ?? null;
  const secretsStorage = initData?.settings?.secretsStorage ?? null;

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: configQueries.all() });
  }, [queryClient]);

  const activateProvider = useCallback(
    async (providerId: string, selectedModel?: string) => {
      await activateMutateAsync({ providerId, model: selectedModel });
    },
    [activateMutateAsync],
  );

  const saveCredentials = useCallback(
    async (providerName: AIProvider, apiKey: string | CredentialRef, selectedModel?: string) => {
      await saveConfigMutateAsync({
        provider: providerName,
        apiKey,
        model: selectedModel,
      });
    },
    [saveConfigMutateAsync],
  );

  const deleteProviderCredentials = useCallback(
    async (providerName: AIProvider) => {
      await deleteCredentialsMutateAsync(providerName);
    },
    [deleteCredentialsMutateAsync],
  );

  const dataValue = useMemo<ConfigDataContextValue>(
    () => ({
      isLoading,
      provider,
      model,
      isConfigured,
      providerStatus,
      projectId,
      repoRoot,
      trust,
      setupStatus,
      secretsStorage,
    }),
    [
      isLoading,
      provider,
      model,
      isConfigured,
      providerStatus,
      projectId,
      repoRoot,
      trust,
      setupStatus,
      secretsStorage,
    ],
  );

  const actionsValue = useMemo<ConfigActionsContextValue>(
    () => ({
      refresh,
      activateProvider,
      saveCredentials,
      deleteProviderCredentials,
    }),
    [refresh, activateProvider, saveCredentials, deleteProviderCredentials],
  );

  return (
    <ConfigDataContext.Provider value={dataValue}>
      <ConfigActionsContext.Provider value={actionsValue}>{children}</ConfigActionsContext.Provider>
    </ConfigDataContext.Provider>
  );
}

export function useConfigData(): ConfigDataContextValue {
  const context = useContext(ConfigDataContext);
  if (context === undefined) {
    throw new Error("useConfigData must be used within a ConfigProvider");
  }
  return context;
}

export function useConfigActions(): ConfigActionsContextValue {
  const context = useContext(ConfigActionsContext);
  if (context === undefined) {
    throw new Error("useConfigActions must be used within a ConfigProvider");
  }
  return context;
}
