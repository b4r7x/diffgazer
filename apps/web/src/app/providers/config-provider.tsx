import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { AIProvider, CredentialRef, ProviderStatus, TrustConfig, SetupStatus, SecretsStorage } from "@diffgazer/core/schemas/config";
import { useQueryClient } from "@tanstack/react-query";
import {
  useInit,
  useProviderStatus,
  useActivateProvider,
  useSaveConfig,
  useDeleteProviderCredentials,
  configQueries,
} from "@diffgazer/core/api/hooks";

// Stable data context — changes only when config data itself changes
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

// Volatile actions context — changes with loading/saving state
interface ConfigActionsContextValue {
  isSaving: boolean;
  error: string | null;
  refresh: (invalidate?: boolean) => Promise<void>;
  activateProvider: (providerId: string, model?: string) => Promise<void>;
  saveCredentials: (
    provider: AIProvider,
    apiKey: string | CredentialRef,
    model?: string,
  ) => Promise<void>;
  deleteProviderCredentials: (provider: AIProvider) => Promise<void>;
}

const ConfigDataContext = createContext<ConfigDataContextValue | undefined>(undefined);
const ConfigActionsContext = createContext<ConfigActionsContextValue | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const initQuery = useInit();
  const providersQuery = useProviderStatus();
  const activateMutation = useActivateProvider();
  const saveConfigMutation = useSaveConfig();
  const deleteCredentialsMutation = useDeleteProviderCredentials();

  const initData = initQuery.data;
  const isLoading = initQuery.isLoading || providersQuery.isLoading;
  const isSaving =
    activateMutation.isPending ||
    saveConfigMutation.isPending ||
    deleteCredentialsMutation.isPending;

  const queryError = initQuery.error ?? providersQuery.error;
  const mutationError =
    activateMutation.error ??
    saveConfigMutation.error ??
    deleteCredentialsMutation.error;
  const error = mutationError?.message ?? queryError?.message ?? null;

  const provider = initData?.config?.provider;
  const model = initData?.config?.model;
  const isConfigured = initData?.setup?.isConfigured ?? false;
  const providerStatus = providersQuery.data ?? initData?.providers ?? [];
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
      try {
        await activateMutation.mutateAsync({ providerId, model: selectedModel });
      } catch {
        // Error is surfaced via activateMutation.error
      }
    },
    [activateMutation.mutateAsync],
  );

  const saveCredentials = useCallback(
    async (providerName: AIProvider, apiKey: string | CredentialRef, selectedModel?: string) => {
      await saveConfigMutation.mutateAsync({
        provider: providerName,
        apiKey,
        model: selectedModel,
      });
    },
    [saveConfigMutation.mutateAsync],
  );

  const deleteProviderCredentials = useCallback(
    async (providerName: AIProvider) => {
      await deleteCredentialsMutation.mutateAsync(providerName);
    },
    [deleteCredentialsMutation.mutateAsync],
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
    [isLoading, provider, model, isConfigured, providerStatus, projectId, repoRoot, trust, setupStatus, secretsStorage],
  );

  const actionsValue = useMemo<ConfigActionsContextValue>(
    () => ({
      isSaving,
      error,
      refresh,
      activateProvider,
      saveCredentials,
      deleteProviderCredentials,
    }),
    [isSaving, error, refresh, activateProvider, saveCredentials, deleteProviderCredentials],
  );

  return (
    <ConfigDataContext.Provider value={dataValue}>
      <ConfigActionsContext.Provider value={actionsValue}>
        {children}
      </ConfigActionsContext.Provider>
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

