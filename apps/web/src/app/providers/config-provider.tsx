import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { AIProvider, ProviderStatus, TrustConfig, SetupStatus } from "@diffgazer/schemas/config";
import { useQueryClient } from "@tanstack/react-query";
import {
  useInit,
  useProviderStatus,
  useActivateProvider,
  useSaveConfig,
  useDeleteProviderCredentials,
  configQueries,
} from "@diffgazer/api/hooks";

// Stable data context — changes only when config data itself changes
interface ConfigDataContextValue {
  provider?: AIProvider;
  model?: string;
  isConfigured: boolean;
  providerStatus: ProviderStatus[];
  projectId: string | null;
  repoRoot: string | null;
  trust: TrustConfig | null;
  setupStatus: SetupStatus | null;
}

// Volatile actions context — changes with loading/saving state
interface ConfigActionsContextValue {
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  refresh: (invalidate?: boolean) => Promise<void>;
  activateProvider: (providerId: string, model?: string) => Promise<void>;
  saveCredentials: (
    provider: AIProvider,
    apiKey: string,
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

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: configQueries.all() });
  };

  const activateProvider = async (providerId: string, selectedModel?: string) => {
    try {
      await activateMutation.mutateAsync({ providerId, model: selectedModel });
    } catch {
      // Error captured in activateMutation.error
    }
  };

  const saveCredentials = async (
    providerName: AIProvider,
    apiKey: string,
    selectedModel?: string,
  ) => {
    try {
      await saveConfigMutation.mutateAsync({
        provider: providerName,
        apiKey,
        model: selectedModel,
      });
    } catch {
      // Error captured in saveConfigMutation.error
    }
  };

  const deleteProviderCredentials = async (providerName: AIProvider) => {
    try {
      await deleteCredentialsMutation.mutateAsync(providerName);
    } catch {
      // Error captured in deleteCredentialsMutation.error
    }
  };

  const dataValue: ConfigDataContextValue = {
    provider,
    model,
    isConfigured,
    providerStatus,
    projectId,
    repoRoot,
    trust,
    setupStatus,
  };

  const actionsValue: ConfigActionsContextValue = {
    isLoading,
    isSaving,
    error,
    refresh,
    activateProvider,
    saveCredentials,
    deleteProviderCredentials,
  };

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

