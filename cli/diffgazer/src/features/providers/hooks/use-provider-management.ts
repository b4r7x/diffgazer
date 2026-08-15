import {
  useCreateConfiguration,
  useDeleteConfiguration,
  useInspectConfiguration,
  useSelectConfiguration,
  useTestConfiguration,
  useUpdateConfiguration,
} from "@diffgazer/core/api/hooks";
import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  type ModelDialogOwner,
  type ProviderManagementAction,
  type ProviderManagementMutations,
  type ProviderManagementOutcome,
  type SetupDialogOwner,
  type UpdateConfigurationRequest,
  useProviderManagement as useProviderManagementMachine,
} from "@diffgazer/core/providers/hooks";
import type {
  ClientConfigurationInput,
  ExactModelId,
  ReadinessAcknowledgement,
} from "@diffgazer/core/schemas/config";
import { useState } from "react";

type AcceptedAcknowledgement = Extract<ReadinessAcknowledgement, { status: "accepted" }>;

type CreateContinueOptions = {
  openModelDialog?: boolean;
  acknowledgement: AcceptedAcknowledgement;
};

type UpdateContinueOptions = { openModelDialog?: boolean };

/**
 * The overlays own the pending state and render the failure in place, so a
 * failed outcome is re-raised for the overlay that is awaiting the save.
 */
function raiseFailure(outcome: ProviderManagementOutcome): void {
  if (outcome.status === "failed") throw new Error(outcome.message);
}

/**
 * The actions the screen dispatches, and therefore the ones whose failure it
 * reports. Create, update and model selection run inside an overlay that stays
 * open and renders the failure in place, so reporting them here too would show
 * the same failure twice.
 */
const SCREEN_REPORTED_ACTIONS = new Set<ProviderManagementAction>([
  "delete",
  "inspect",
  "test",
  "select",
]);

export function useProviderManagement(providers: ProviderListRow[]) {
  const createConfiguration = useCreateConfiguration();
  const inspectConfiguration = useInspectConfiguration();
  const selectConfiguration = useSelectConfiguration();
  const testConfiguration = useTestConfiguration();
  const updateConfiguration = useUpdateConfiguration();
  const deleteConfiguration = useDeleteConfiguration();

  // A test that fails its readiness probe answers HTTP 200, so React Query
  // reports no error for it; the machine's notifier is the only channel that
  // carries every failure, and it replaces the previous one instead of ranking
  // stale mutation errors by a fixed priority.
  const [actionError, setActionError] = useState<string | null>(null);

  const mutations: ProviderManagementMutations = {
    createConfiguration: (input) => createConfiguration.mutateAsync(input),
    updateConfiguration: (request) => updateConfiguration.mutateAsync(request),
    deleteConfiguration: (request) => deleteConfiguration.mutateAsync(request),
    inspectConfiguration: (configurationId) => inspectConfiguration.mutateAsync(configurationId),
    testConfiguration: (configurationId) => testConfiguration.mutateAsync(configurationId),
    selectConfiguration: (configurationId, modelId) =>
      selectConfiguration.mutateAsync({ configurationId, modelId }),
  };

  const management = useProviderManagementMachine({
    providers,
    mutations,
    notifier: {
      onSucceeded: () => setActionError(null),
      onFailed: ({ action, message }) =>
        setActionError(SCREEN_REPORTED_ACTIONS.has(action) ? message : null),
    },
  });

  const handleCreateConfiguration = async (
    owner: SetupDialogOwner,
    input: ClientConfigurationInput,
    options: CreateContinueOptions,
  ) => {
    raiseFailure(
      await management.handleCreateConfiguration(owner, input, {
        continueToModelSelection: options.openModelDialog,
        acknowledgement: options.acknowledgement,
      }),
    );
  };

  const handleUpdateConfiguration = async (
    owner: SetupDialogOwner,
    request: UpdateConfigurationRequest,
    options?: UpdateContinueOptions,
  ) => {
    raiseFailure(
      await management.handleUpdateConfiguration(owner, request, {
        continueToModelSelection: options?.openModelDialog,
      }),
    );
  };

  const handleSelectModel = async (owner: ModelDialogOwner, modelId: ExactModelId) => {
    raiseFailure(await management.handleSelectModel(owner, modelId));
  };

  return {
    ...management,
    actionError,
    handleCreateConfiguration,
    handleUpdateConfiguration,
    handleSelectModel,
  };
}
