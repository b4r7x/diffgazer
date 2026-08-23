import {
  invalidateConfigurationCaches,
  useApi,
  useConfigurationAction,
  useConfigurationInit,
  useCreateConfiguration,
  useDeleteConfiguration,
  useInspectConfiguration,
  useSelectConfiguration,
  useTestConfiguration,
  useUpdateConfiguration,
} from "@diffgazer/core/api/hooks";
import { getCatalogModelName, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import {
  type ClientConfigurationAction,
  type ClientConfigurationActionResponse,
  type ClientConfigurationInput,
  type ClientConfigurationSummary,
  type ConfigurationId,
  type ConfigurationInitResponse,
  type ConfigurationRevision,
  type ConfigurationStatus,
  type ExactModelId,
  type Readiness,
  type ReadinessAcknowledgement,
  type RunnableProductId,
  resolveSelectedConfiguration,
  type SecretsStorage,
  type SettingsConfig,
  type UnrecognizedConfiguration,
} from "@diffgazer/core/schemas/config";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";

type AcceptedAcknowledgement = Extract<ReadinessAcknowledgement, { status: "accepted" }>;

type ConfigLoadState =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; init: ConfigurationInitResponse };

interface ConfigDataContextValue {
  loadState: ConfigLoadState;
  isLoading: boolean;
  configurations: ConfigurationStatus[];
  /** Stored records this build could not decode; removal is all they support. */
  unrecognizedConfigurations: UnrecognizedConfiguration[];
  selectedConfiguration: ClientConfigurationSummary | null;
  selectedReadiness: Readiness | null;
  isReady: boolean;
  isConfigured: boolean;
  provider: string | undefined;
  model: string | undefined;
  selectedProductId: RunnableProductId | undefined;
  projectId: string | null;
  repoRoot: string | null;
  trust: ConfigurationInitResponse["project"]["trust"];
  settings: SettingsConfig | null;
  secretsStorage: SecretsStorage | null;
}

interface ConfigActionsContextValue {
  refresh: () => Promise<void>;
  createConfiguration: (request: {
    input: ClientConfigurationInput;
    acknowledgement?: AcceptedAcknowledgement;
  }) => Promise<ClientConfigurationActionResponse>;
  inspectConfiguration: (configurationId: ConfigurationId) => Promise<void>;
  selectConfiguration: (configurationId: ConfigurationId, modelId: ExactModelId) => Promise<void>;
  testConfiguration: (
    configurationId: ConfigurationId,
  ) => Promise<Extract<ClientConfigurationActionResponse, { action: "test" }>>;
  updateConfiguration: (input: {
    configurationId: ConfigurationId;
    expectedRevision: ConfigurationRevision;
    input: ClientConfigurationInput;
    acknowledgement: AcceptedAcknowledgement;
  }) => Promise<void>;
  deleteConfiguration: (input: {
    configurationId: ConfigurationId;
    expectedRevision?: ConfigurationRevision;
  }) => Promise<void>;
  dispatchConfigurationAction: (action: ClientConfigurationAction) => Promise<void>;
}

const ConfigDataContext = createContext<ConfigDataContextValue | undefined>(undefined);
const ConfigActionsContext = createContext<ConfigActionsContextValue | undefined>(undefined);

function toLoadState(
  init: ConfigurationInitResponse | undefined,
  isLoading: boolean,
  error: Error | null,
): ConfigLoadState {
  if (init) return { status: "ready", init };
  if (isLoading) return { status: "loading" };
  if (error) return { status: "error", error };
  return { status: "error", error: new Error("Configuration did not load") };
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const initQuery = useConfigurationInit();
  const { mutateAsync: createConfigurationMutate } = useCreateConfiguration();
  const { mutateAsync: inspectConfigurationMutate } = useInspectConfiguration();
  const { mutateAsync: selectConfigurationMutate } = useSelectConfiguration();
  const { mutateAsync: testConfigurationMutate } = useTestConfiguration();
  const { mutateAsync: updateConfigurationMutate } = useUpdateConfiguration();
  const { mutateAsync: deleteConfigurationMutate } = useDeleteConfiguration();
  const { mutateAsync: dispatchConfigurationActionMutate } = useConfigurationAction();

  const initData = initQuery.data;
  const isLoading = initQuery.isLoading;
  const initError = initQuery.error;

  // Both contexts are consumed app-wide, so their identity is a real referential
  // contract: without these, every mutation transition re-renders every consumer.
  const dataValue = useMemo<ConfigDataContextValue>(() => {
    const selected = resolveSelectedConfiguration(initData);
    const selectedConfiguration = selected?.configuration ?? null;
    const selectedReadiness = selected?.readiness ?? null;
    const selectedProductId = selectedConfiguration?.productId;

    return {
      loadState: toLoadState(initData, isLoading, initError),
      isLoading,
      configurations: initData?.configurations ?? [],
      unrecognizedConfigurations: initData?.unrecognizedConfigurations ?? [],
      selectedConfiguration,
      selectedReadiness,
      isReady: selectedReadiness?.ready ?? false,
      isConfigured: selectedConfiguration != null,
      provider:
        selectedProductId === undefined
          ? undefined
          : PRODUCT_REGISTRY[selectedProductId].presentation.name,
      model: selectedConfiguration?.selectedModelId
        ? getCatalogModelName(
            selectedConfiguration.productId,
            selectedConfiguration.selectedModelId,
          )
        : undefined,
      selectedProductId,
      projectId: initData?.project.projectId ?? null,
      repoRoot: initData?.project.path ?? null,
      trust: initData?.project.trust ?? null,
      settings: initData?.settings ?? null,
      secretsStorage: initData?.settings.secretsStorage ?? null,
    };
  }, [initData, isLoading, initError]);

  const refresh = useCallback(
    () => invalidateConfigurationCaches(queryClient, api),
    [queryClient, api],
  );

  const actionsValue = useMemo<ConfigActionsContextValue>(
    () => ({
      refresh,
      createConfiguration: createConfigurationMutate,
      inspectConfiguration: async (configurationId) => {
        await inspectConfigurationMutate(configurationId);
      },
      selectConfiguration: async (configurationId, modelId) => {
        await selectConfigurationMutate({ configurationId, modelId });
      },
      testConfiguration: testConfigurationMutate,
      updateConfiguration: async (input) => {
        await updateConfigurationMutate(input);
      },
      deleteConfiguration: async (input) => {
        await deleteConfigurationMutate(input);
      },
      dispatchConfigurationAction: async (action) => {
        await dispatchConfigurationActionMutate(action);
      },
    }),
    [
      refresh,
      createConfigurationMutate,
      inspectConfigurationMutate,
      selectConfigurationMutate,
      testConfigurationMutate,
      updateConfigurationMutate,
      deleteConfigurationMutate,
      dispatchConfigurationActionMutate,
    ],
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
