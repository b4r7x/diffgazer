import {
  findProviderById,
  findProviderDialogRow,
  getProviderActionLayout,
  getProviderRowId,
  getUnrecognizedConfigurationActionLayout,
  isConsentGatedProviderAction,
  type ProviderListRow,
  type ProviderRowControl,
} from "@diffgazer/core/providers";
import {
  canSelectConfiguration,
  type UnrecognizedConfiguration,
} from "@diffgazer/core/schemas/config";
import { useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useProvidersKeyboard } from "@/features/providers/hooks/use-keyboard";
import {
  type ModelDialogOwner,
  type SetupDialogOwner,
  useProviderManagement,
} from "@/features/providers/hooks/use-provider-management";
import { useConfigData } from "@/hooks/use-config";
import { useProviderConsent } from "@/hooks/use-provider-consent";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
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
  // The page's own overlay: the More menu, or the confirmation removal waits
  // behind wherever it was asked for. Page state so the keyboard can stand down
  // while one of them owns the keys.
  const [overlay, setOverlay] = useState<"more" | "delete" | null>(null);
  const overflowMenuOpen = overlay === "more";
  const deleteConfirmOpen = overlay === "delete";

  const { loadState, unrecognizedConfigurations, selectedConfiguration } = useConfigData();
  const consent = useProviderConsent();
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
    handleTestConfiguration,
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

  // "Change model" deep-links land in the model dialog itself. An effect
  // because the rows arrive async; the ref makes the intent one-shot so closing
  // the dialog does not reopen it.
  const modelIntent = search.intent === "select-model";
  const modelIntentConsumedRef = useRef(false);
  useEffect(() => {
    if (!modelIntent || modelIntentConsumedRef.current || isLoading) return;
    if (!selectedRow) return;
    modelIntentConsumedRef.current = true;
    if (selectedRow.configuration) {
      openModelDialog(getProviderRowId(selectedRow));
    }
  }, [modelIntent, isLoading, selectedRow, openModelDialog]);

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
    if (canSelectConfiguration(row.readiness.status)) {
      void handleSelectConfiguration(row, row.configuration?.selectedModelId ?? undefined);
      return;
    }
    void handleDispatchReadinessAction(row);
  };

  const deleteSelected = () => {
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
  };

  // The one derivation of the action row: the renderer and the keyboard zone both read this
  // layout, so their controls and indexes cannot drift apart.
  const actionLayout = selectedUnrecognized
    ? getUnrecognizedConfigurationActionLayout()
    : getProviderActionLayout(selectedRow, selectedConfiguration?.configurationId ?? null);

  // The one dispatch path the rendered action row, the More menu and the keyboard zone use.
  const runProviderControl = (control: ProviderRowControl) => {
    if (control.id === "more") {
      setOverlay("more");
      return;
    }
    const run = isConsentGatedProviderAction(control)
      ? consent.require
      : (action: () => void) => action();
    switch (control.id) {
      case "dispatch":
      case "selectConfiguration":
        if (selectedRow) run(() => dispatchSelectedAction(selectedRow));
        break;
      case "setup":
        if (selectedRow) run(() => openSetupDialog(getProviderRowId(selectedRow)));
        break;
      case "verify": {
        const configurationId = selectedRow?.configuration?.configurationId;
        if (configurationId != null) run(() => void handleTestConfiguration(configurationId));
        break;
      }
      case "selectModel":
        if (selectedRow) openModelDialog(getProviderRowId(selectedRow));
        break;
      case "delete":
        setOverlay("delete");
        break;
    }
  };

  const keyboard = useProvidersKeyboard({
    layout: actionLayout,
    hasSelection: selectedRow !== null || selectedUnrecognized !== null,
    listRowIds,
    listReady: !isLoading && listRowIds.length > 0,
    filter,
    setSelectedId: selectProvider,
    dialogOpen: dialogOwner !== null || overlay !== null || consent.isOpen,
    overflowMenuOpen,
    isPending: isSubmitting,
    hasNotice: loadState.status === "error",
    inputRef,
    listContainerRef,
    noticeActionRef,
    runControl: runProviderControl,
    reviewConsent: consent.consent === null ? consent.open : null,
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
      anyOpen: dialogOwner !== null || deleteConfirmOpen || consent.isOpen,
    },

    deleteConfirm: {
      open: deleteConfirmOpen,
      onOpenChange: (open: boolean) => setOverlay(open ? "delete" : null),
      confirm: deleteSelected,
    },

    handlers: {
      createConfiguration: handleCreateConfiguration,
      updateConfiguration: handleUpdateConfiguration,
      selectModel: handleSelectModel,
    },

    actionLayout,
    runProviderControl,
    overflowMenu: {
      open: overflowMenuOpen,
      onOpenChange: (open: boolean) => setOverlay(open ? "more" : null),
    },

    isSubmitting,
    consent: {
      required: consent.consent === null,
      review: consent.open,
    },

    keyboard: { ...keyboard, listContainerRef, noticeActionRef },
  };
}
