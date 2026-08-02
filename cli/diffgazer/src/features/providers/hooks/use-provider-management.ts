import {
  useCreateConfiguration,
  useDeleteConfiguration,
  useInspectConfiguration,
  useSelectConfiguration,
  useTestConfiguration,
  useUpdateConfiguration,
} from "@diffgazer/core/api/hooks";
import {
  type ModelDialogOwner,
  type ProviderListRow,
  type ProviderManagementMutations,
  type ProviderManagementOutcome,
  type SetupDialogOwner,
  type UpdateConfigurationRequest,
  useProviderManagement as useProviderManagementMachine,
} from "@diffgazer/core/providers";
import type { ClientConfigurationInput, ExactModelId } from "@diffgazer/core/schemas/config";

type ContinueOptions = { openModelDialog?: boolean };

/**
 * The overlays own the pending state and render the failure in place, so a
 * failed outcome is re-raised for the overlay that is awaiting the save.
 */
function raiseFailure(outcome: ProviderManagementOutcome): void {
  if (outcome.status === "failed") throw new Error(outcome.message);
}

export function useProviderManagement(providers: ProviderListRow[]) {
  const createConfiguration = useCreateConfiguration();
  const inspectConfiguration = useInspectConfiguration();
  const selectConfiguration = useSelectConfiguration();
  const testConfiguration = useTestConfiguration();
  const updateConfiguration = useUpdateConfiguration();
  const deleteConfiguration = useDeleteConfiguration();

  const mutationError =
    createConfiguration.error?.message ??
    inspectConfiguration.error?.message ??
    selectConfiguration.error?.message ??
    testConfiguration.error?.message ??
    updateConfiguration.error?.message ??
    deleteConfiguration.error?.message ??
    null;

  const mutations: ProviderManagementMutations = {
    createConfiguration: (input) => createConfiguration.mutateAsync(input),
    updateConfiguration: (request) => updateConfiguration.mutateAsync(request),
    deleteConfiguration: (request) => deleteConfiguration.mutateAsync(request),
    inspectConfiguration: (configurationId) => inspectConfiguration.mutateAsync(configurationId),
    testConfiguration: (configurationId) => testConfiguration.mutateAsync(configurationId),
    selectConfiguration: (configurationId, modelId) =>
      selectConfiguration.mutateAsync({ configurationId, modelId }),
  };

  const management = useProviderManagementMachine({ providers, mutations });

  const handleCreateConfiguration = async (
    owner: SetupDialogOwner,
    input: ClientConfigurationInput,
    options?: ContinueOptions,
  ) => {
    raiseFailure(
      await management.handleCreateConfiguration(owner, input, {
        continueToModelSelection: options?.openModelDialog,
      }),
    );
  };

  const handleUpdateConfiguration = async (
    owner: SetupDialogOwner,
    request: UpdateConfigurationRequest,
    options?: ContinueOptions,
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
    mutationError,
    handleCreateConfiguration,
    handleUpdateConfiguration,
    handleSelectModel,
  };
}
