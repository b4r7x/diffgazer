import { resolveSelectedId } from "@diffgazer/core/review";
import type { ProviderWithStatus } from "@diffgazer/core/schemas/config";
import { useRef, useState } from "react";
import { useProvidersKeyboard } from "@/features/providers/hooks/use-keyboard";
import {
  type ApiKeyDialogOwner,
  type ModelDialogOwner,
  useProviderManagement,
} from "@/features/providers/hooks/use-provider-management";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { filterProviders, findProviderById, type ProviderFilter } from "../lib/filter";

type ProviderDialog =
  | { kind: "api-key"; owner: ApiKeyDialogOwner; provider: ProviderWithStatus }
  | { kind: "model"; owner: ModelDialogOwner; provider: ProviderWithStatus };

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
    openApiKeyDialog,
    openModelDialog,
    closeDialog,
    handleSaveApiKey,
    handleRemoveKey,
    handleSelectProvider,
    handleSelectModel,
  } = useProviderManagement();

  const filteredProviders = filterProviders(providers, filter, searchQuery);

  const effectiveSelectedId = resolveSelectedId(selectedId, filteredProviders);

  const selectedProvider = effectiveSelectedId
    ? findProviderById(filteredProviders, effectiveSelectedId)
    : null;
  const dialogProvider = findProviderById(providers, dialogOwner?.providerId ?? null);
  let dialog: ProviderDialog | null = null;
  if (dialogOwner && dialogProvider) {
    dialog =
      dialogOwner.kind === "api-key"
        ? { kind: "api-key", owner: dialogOwner, provider: dialogProvider }
        : { kind: "model", owner: dialogOwner, provider: dialogProvider };
  }

  const dialogOpen = dialogOwner !== null;

  const activateProvider = (provider: ProviderWithStatus) => {
    if (isSubmitting) return;
    if (!provider.hasApiKey) {
      openApiKeyDialog(provider.id);
      return;
    }

    const model = provider.model || provider.defaultModel;
    if (!model) {
      openModelDialog(provider.id);
      return;
    }

    void handleSelectProvider(provider.id, provider.name, model);
  };

  const {
    focusZone,
    filterIndex,
    setFilterIndex,
    buttonIndex,
    getActionButtonProps,
    getFilterButtonProps,
    handleFilterKeyDown,
    handleListKeyDown,
    handleSearchFocus,
    handleSearchEscape,
    handleFilterFocus,
    handleListFocus,
    handleListBoundary,
  } = useProvidersKeyboard({
    selectedProvider,
    filteredProviders,
    listReady: !isLoading && filteredProviders.length > 0,
    filter,
    setSelectedId,
    dialogOpen,
    inputRef,
    listContainerRef,
    onSetApiKey: () => {
      if (selectedProvider) openApiKeyDialog(selectedProvider.id);
    },
    onSelectModel: () => {
      if (selectedProvider) openModelDialog(selectedProvider.id);
    },
    onRemoveKey: async (providerId) => {
      void (await handleRemoveKey(providerId));
    },
    onActivateProvider: activateProvider,
  });

  return {
    isLoading,
    filteredProviders,
    selectedProvider,

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
      openApiKey: openApiKeyDialog,
      openModel: openModelDialog,
      close: closeDialog,
      anyOpen: dialogOpen,
    },

    handlers: {
      saveApiKey: handleSaveApiKey,
      removeKey: handleRemoveKey,
      selectModel: handleSelectModel,
      activateProvider,
    },

    isSubmitting,

    keyboard: {
      focusZone,
      filterIndex,
      setFilterIndex,
      buttonIndex,
      getActionButtonProps,
      getFilterButtonProps,
      handleFilterKeyDown,
      handleListKeyDown,
      handleSearchFocus,
      handleSearchEscape,
      handleFilterFocus,
      handleListFocus,
      handleListBoundary,
      listContainerRef,
    },
  };
}
