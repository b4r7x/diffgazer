import {
  mapProviderList,
  type ProviderManagementEvent,
  type ProviderManagementFailure,
  type ProviderManagementMutations,
  useProviderManagement as useProviderManagementMachine,
} from "@diffgazer/core/providers";
import { toast } from "@diffgazer/ui/components/toast";
import { useConfigActions, useConfigData } from "@/hooks/use-config";

export type {
  ModelDialogOwner,
  ProviderManagementOutcome,
  SetupDialogOwner,
} from "@diffgazer/core/providers";

const SUCCESS_COPY: Record<
  ProviderManagementEvent["action"],
  ((event: ProviderManagementEvent) => { title: string; message: string }) | null
> = {
  create: () => ({ title: "Configuration Created", message: "Provider configured" }),
  update: () => ({ title: "Configuration Updated", message: "Provider configured" }),
  delete: () => ({
    title: "Configuration Deleted",
    message: "Provider configuration deleted",
  }),
  // Inspection results are rendered in the provider details pane, so a toast
  // would duplicate what the user is already looking at.
  inspect: null,
  test: () => ({ title: "Readiness Tested", message: "Configuration readiness updated" }),
  select: (event) => ({
    title: "Configuration Selected",
    message: `${event.row?.product.name ?? "Provider"} is now active`,
  }),
  "select-model": (event) => ({
    title: "Model Selected",
    message: `Selected ${event.modelId ?? "model"}`,
  }),
};

const FAILURE_TITLES: Record<ProviderManagementEvent["action"], string | null> = {
  // The setup dialog stays open and renders create/update failures inline, so a
  // toast would report the same failure twice.
  create: null,
  update: null,
  delete: "Failed to Delete",
  inspect: "Failed to Inspect",
  test: "Failed to Test",
  select: "Failed to Select",
  "select-model": "Failed to Select Model",
};

function reportSucceeded(event: ProviderManagementEvent) {
  const copy = SUCCESS_COPY[event.action]?.(event);
  if (copy) toast.success(copy.title, { message: copy.message });
}

function reportFailed(failure: ProviderManagementFailure) {
  const title = FAILURE_TITLES[failure.action];
  if (title) toast.error(title, { message: failure.message });
}

export function useProviderManagement() {
  const { isLoading, configurations } = useConfigData();
  const {
    createConfiguration,
    inspectConfiguration,
    selectConfiguration,
    testConfiguration,
    updateConfiguration,
    deleteConfiguration,
    dispatchConfigurationAction,
  } = useConfigActions();

  const providers = mapProviderList(configurations);
  const mutations: ProviderManagementMutations = {
    createConfiguration,
    updateConfiguration,
    deleteConfiguration,
    inspectConfiguration,
    testConfiguration,
    selectConfiguration,
  };

  const management = useProviderManagementMachine({
    providers,
    mutations,
    notifier: { onSucceeded: reportSucceeded, onFailed: reportFailed },
  });

  return { ...management, providers, isLoading, dispatchConfigurationAction };
}
