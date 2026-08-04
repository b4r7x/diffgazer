import {
  findProviderById,
  getProviderRowId,
  type ProviderDialogOwner,
  type ProviderListRow,
} from "@diffgazer/core/providers";
import { resolveSelectedId } from "@diffgazer/core/review";
import { useRef, useState } from "react";
import { useProvidersKeyboard } from "@/features/providers/hooks/use-keyboard";
import {
  type ModelDialogOwner,
  type SetupDialogOwner,
  useProviderManagement,
} from "@/features/providers/hooks/use-provider-management";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { getProviderActions, type ProviderAction } from "../lib/actions";
import { filterProviders, type ProviderFilter } from "../lib/filter";

type ProviderDialog =
  | { kind: "setup"; owner: SetupDialogOwner; row: ProviderListRow }
  | { kind: "model"; owner: ModelDialogOwner; row: ProviderListRow };

/**
 * A row's id flips from its product id to its configuration id the moment a
 * configuration is created, so a model dialog opened during that transition must
 * be resolved by the configuration it was opened for -- the id it captured is
 * the only identity that survives the refresh.
 */
function findDialogRow(
  providers: ProviderListRow[],
  owner: ProviderDialogOwner | null,
): ProviderListRow | null {
  if (!owner) return null;
  if (owner.kind === "setup") return findProviderById(providers, owner.rowId);
  return (
    findProviderById(providers, owner.configurationId) ?? findProviderById(providers, owner.rowId)
  );
}

export function useProvidersPageState() {
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const [selectedId, setSelectedId] = useScopedRouteState<string | null>("providerId", null);
  const [filter, setFilter] = useState<ProviderFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    providers,
    isLoading,
    isSubmitting,
    dialogOwner,
    openSetupDialog,
    openModelDialog,
    closeDialog,
    handleCreateConfiguration,
    handleUpdateConfiguration,
    handleDeleteConfiguration,
    handleSelectModel,
    handleDispatchReadinessAction,
  } = useProviderManagement();

  const filteredProviders = filterProviders(providers, filter, searchQuery);
  const effectiveSelectedId = resolveSelectedId(
    selectedId,
    filteredProviders.map((row) => ({ id: getProviderRowId(row) })),
  );
  const selectedRow = effectiveSelectedId
    ? findProviderById(filteredProviders, effectiveSelectedId)
    : null;
  const dialogRow = findDialogRow(providers, dialogOwner);

  let dialog: ProviderDialog | null = null;
  if (dialogOwner && dialogRow) {
    dialog =
      dialogOwner.kind === "setup"
        ? { kind: "setup", owner: dialogOwner, row: dialogRow }
        : { kind: "model", owner: dialogOwner, row: dialogRow };
  }

  const dispatchSelectedAction = (row: ProviderListRow) => {
    if (isSubmitting) return;
    void handleDispatchReadinessAction(row);
  };

  const actions = {
    onSetup: () => {
      if (selectedRow) openSetupDialog(getProviderRowId(selectedRow));
    },
    onSelectModel: () => {
      if (selectedRow) openModelDialog(getProviderRowId(selectedRow));
    },
    onDelete: () => {
      const configurationId = selectedRow?.configuration?.configurationId;
      const revision = selectedRow?.configuration?.revision;
      if (configurationId != null && revision != null) {
        void handleDeleteConfiguration(configurationId, revision);
      }
    },
    onDispatchAction: () => {
      if (selectedRow) dispatchSelectedAction(selectedRow);
    },
  };

  // The one derivation of the action row: the renderer and the keyboard zone both read this
  // array, so their indexes and counts cannot drift apart.
  const providerActions = getProviderActions(selectedRow);

  const runProviderAction = (action: ProviderAction) => {
    switch (action.id) {
      case "dispatch":
        actions.onDispatchAction();
        break;
      case "setup":
        actions.onSetup();
        break;
      case "selectModel":
        actions.onSelectModel();
        break;
      case "delete":
        actions.onDelete();
        break;
    }
  };

  const keyboard = useProvidersKeyboard({
    actions: providerActions,
    selectedRow,
    filteredProviders,
    listReady: !isLoading && filteredProviders.length > 0,
    filter,
    setSelectedId,
    dialogOpen: dialogOwner !== null,
    inputRef,
    listContainerRef,
    runAction: runProviderAction,
  });

  return {
    isLoading,
    filteredProviders,
    selectedRow,

    search: {
      inputRef,
      query: searchQuery,
      setQuery: setSearchQuery,
    },

    selection: {
      effectiveSelectedId,
      setSelectedId,
      filter,
      setFilter,
    },

    dialogs: {
      current: dialog,
      close: closeDialog,
      anyOpen: dialogOwner !== null,
    },

    handlers: {
      createConfiguration: handleCreateConfiguration,
      updateConfiguration: handleUpdateConfiguration,
      selectModel: handleSelectModel,
      dispatchAction: dispatchSelectedAction,
    },

    actions,
    providerActions,
    runProviderAction,

    isSubmitting,

    keyboard: { ...keyboard, listContainerRef },
  };
}
