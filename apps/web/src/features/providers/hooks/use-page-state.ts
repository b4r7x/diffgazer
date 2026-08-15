import {
  findProviderById,
  findProviderDialogRow,
  getProviderRowId,
  type ProviderListRow,
} from "@diffgazer/core/providers";
import type { UnrecognizedConfiguration } from "@diffgazer/core/schemas/config";
import { useSearch } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useProvidersKeyboard } from "@/features/providers/hooks/use-keyboard";
import {
  type ModelDialogOwner,
  type SetupDialogOwner,
  useProviderManagement,
} from "@/features/providers/hooks/use-provider-management";
import { useConfigData } from "@/hooks/use-config";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import {
  getProviderActions,
  type ProviderAction,
  UNRECOGNIZED_CONFIGURATION_ACTIONS,
} from "../lib/actions";
import {
  filterProviders,
  filterUnrecognizedConfigurations,
  type ProviderFilter,
} from "../lib/filter";

type ProviderDialog =
  | { kind: "setup"; owner: SetupDialogOwner; row: ProviderListRow }
  | { kind: "model"; owner: ModelDialogOwner; row: ProviderListRow };

function findProviderRowForSelection(
  selectedId: string,
  rows: ProviderListRow[],
): ProviderListRow | null {
  const byProductId = rows.find((row) => row.product.productId === selectedId);
  if (byProductId) return byProductId;

  return rows.find((row) => getProviderRowId(row) === selectedId) ?? null;
}

/**
 * `rowIds` is the whole list in rendered order, provider rows first and
 * unrecognized records after them, so a selection can land on a record that has
 * no provider row behind it.
 */
function resolveProviderSelectedId(
  selectedId: string | null,
  rows: ProviderListRow[],
  rowIds: string[],
): string | null {
  const fallback = rowIds[0] ?? null;
  if (selectedId === null) return fallback;
  const matched = findProviderRowForSelection(selectedId, rows);
  if (matched) return getProviderRowId(matched);
  return rowIds.includes(selectedId) ? selectedId : fallback;
}

export function useProvidersPageState() {
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const noticeActionRef = useRef<HTMLButtonElement>(null);

  // Reconnect flows deep-link the page to the affected product; the search
  // param seeds the selection until the user picks something else.
  const search = useSearch({ strict: false });
  const linkedProductId = typeof search.product === "string" ? search.product : null;
  const [selectedId, setSelectedId] = useScopedRouteState<string | null>(
    "providerId",
    linkedProductId,
  );
  const [filter, setFilter] = useState<ProviderFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { loadState, unrecognizedConfigurations } = useConfigData();
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
    handleSelectConfiguration,
    handleDispatchReadinessAction,
  } = useProviderManagement();

  const filteredProviders = filterProviders(providers, filter, searchQuery);
  const filteredUnrecognized = filterUnrecognizedConfigurations(
    unrecognizedConfigurations,
    filter,
    searchQuery,
  );
  const listRowIds = [
    ...filteredProviders.map(getProviderRowId),
    ...filteredUnrecognized.map((entry) => entry.configurationId),
  ];
  const effectiveSelectedId = resolveProviderSelectedId(selectedId, filteredProviders, listRowIds);
  const selectedRow = effectiveSelectedId
    ? findProviderById(filteredProviders, effectiveSelectedId)
    : null;
  const selectedUnrecognized: UnrecognizedConfiguration | null =
    filteredUnrecognized.find(({ configurationId }) => configurationId === effectiveSelectedId) ??
    null;

  const selectProvider = (id: string | null) => {
    if (id === null) {
      setSelectedId(null);
      return;
    }
    const matched =
      findProviderById(filteredProviders, id) ??
      filteredProviders.find((row) => row.product.productId === id);
    setSelectedId(matched?.product.productId ?? id);
  };

  const dialogRow = findProviderDialogRow(providers, dialogOwner);

  let dialog: ProviderDialog | null = null;
  if (dialogOwner && dialogRow) {
    dialog =
      dialogOwner.kind === "setup"
        ? { kind: "setup", owner: dialogOwner, row: dialogRow }
        : { kind: "model", owner: dialogOwner, row: dialogRow };
  }

  const dispatchSelectedAction = (row: ProviderListRow) => {
    if (isSubmitting) return;
    if (row.readiness.ready) {
      void handleSelectConfiguration(row, row.configuration?.selectedModelId ?? undefined);
      return;
    }
    void handleDispatchReadinessAction(row);
  };

  // Reached only through runProviderAction, the one dispatch path the rendered
  // action row and the keyboard zone both use.
  const actions = {
    onSetup: () => {
      if (selectedRow) openSetupDialog(getProviderRowId(selectedRow));
    },
    onSelectModel: () => {
      if (selectedRow) openModelDialog(getProviderRowId(selectedRow));
    },
    onDelete: () => {
      // An unrecognized record never showed a revision, so its delete asserts none.
      if (selectedUnrecognized) {
        void handleDeleteConfiguration(selectedUnrecognized.configurationId);
        return;
      }
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
  const providerActions = selectedUnrecognized
    ? UNRECOGNIZED_CONFIGURATION_ACTIONS
    : getProviderActions(selectedRow);

  const runProviderAction = (action: ProviderAction) => {
    switch (action.id) {
      case "dispatch":
      case "selectConfiguration":
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
    hasSelection: selectedRow !== null || selectedUnrecognized !== null,
    listRowIds,
    listReady: !isLoading && listRowIds.length > 0,
    filter,
    setSelectedId: selectProvider,
    dialogOpen: dialogOwner !== null,
    isPending: isSubmitting,
    hasNotice: loadState.status === "error",
    inputRef,
    listContainerRef,
    noticeActionRef,
    runAction: runProviderAction,
  });

  return {
    isLoading,
    filteredProviders,
    unrecognizedConfigurations: filteredUnrecognized,
    selectedRow,
    selectedUnrecognized,

    search: {
      inputRef,
      query: searchQuery,
      setQuery: setSearchQuery,
    },

    selection: {
      effectiveSelectedId,
      setSelectedId: selectProvider,
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

    providerActions,
    runProviderAction,

    isSubmitting,

    keyboard: { ...keyboard, listContainerRef, noticeActionRef },
  };
}
