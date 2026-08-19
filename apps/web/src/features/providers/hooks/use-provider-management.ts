import { mapProviderList } from "@diffgazer/core/providers";
import {
  type ProviderManagementEvent,
  type ProviderManagementFailure,
  type ProviderManagementMutations,
  useProviderManagement as useProviderManagementMachine,
} from "@diffgazer/core/providers/hooks";
import { toast } from "@diffgazer/ui/components/toast";
import { useConfigActions, useConfigData } from "@/hooks/use-config";

export type {
  ModelDialogOwner,
  SetupDialogOwner,
} from "@diffgazer/core/providers/hooks";

function describeSuccess(
  event: ProviderManagementEvent,
): { title: string; message: string } | null {
  switch (event.action) {
    case "create":
      return { title: "Configuration Created", message: "Provider configured" };
    case "update":
      return { title: "Configuration Updated", message: "Provider configured" };
    case "delete":
      return { title: "Configuration Deleted", message: "Provider configuration deleted" };
    // Inspection results are rendered in the provider details pane, so a toast
    // would duplicate what the user is already looking at.
    case "inspect":
      return null;
    case "test":
      return { title: "Verified", message: "The configuration produced structured review output" };
    case "select":
      return {
        title: "Configuration Selected",
        message: `${event.row.product.name} is now active`,
      };
    case "select-model":
      return { title: "Model Selected", message: `Selected ${event.modelId}` };
  }
}

const FAILURE_TITLES: Record<ProviderManagementEvent["action"], string | null> = {
  // The setup dialog stays open and renders create/update failures inline, so a
  // toast would report the same failure twice.
  create: null,
  update: null,
  delete: "Failed to Delete",
  inspect: "Failed to Inspect",
  test: "Verification Failed",
  select: "Failed to Select",
  "select-model": "Failed to Select Model",
};

function reportSucceeded(event: ProviderManagementEvent) {
  const copy = describeSuccess(event);
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

  return { ...management, providers, isLoading };
}
