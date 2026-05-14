import { useState, useRef } from "react";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { useProviderManagement } from "@/features/providers/hooks/use-provider-management";
import { useProvidersKeyboard } from "@/features/providers/hooks/use-providers-keyboard";
import { filterProviders, type ProviderFilter } from "@diffgazer/core/providers";

export function useProvidersPageState() {
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const [selectedId, setSelectedId] = useScopedRouteState<string | null>("providerId", null);
  const [filter, setFilter] = useState<ProviderFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    providers,
    isLoading,
    apiKeyDialogOpen,
    setApiKeyDialogOpen,
    modelDialogOpen,
    setModelDialogOpen,
    handleSaveApiKey,
    handleRemoveKey,
    handleSelectProvider,
    handleSelectModel,
  } = useProviderManagement();

  const filteredProviders = filterProviders(providers, filter, searchQuery);

  const effectiveSelectedId = filteredProviders.some((provider) => provider.id === selectedId)
    ? selectedId
    : filteredProviders[0]?.id ?? null;

  const selectedProvider = effectiveSelectedId
    ? filteredProviders.find((p) => p.id === effectiveSelectedId) ?? null
    : null;

  const dialogOpen = apiKeyDialogOpen || modelDialogOpen;
  const needsModel = selectedProvider !== null && !selectedProvider.model;

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
    onSetApiKey: () => setApiKeyDialogOpen(true),
    onSelectModel: () => setModelDialogOpen(true),
    onRemoveKey: handleRemoveKey,
    onSelectProvider: handleSelectProvider,
  });

  return {
    isLoading,
    filteredProviders,
    selectedProvider,
    needsModel,

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
      apiKeyOpen: apiKeyDialogOpen,
      setApiKeyOpen: setApiKeyDialogOpen,
      modelOpen: modelDialogOpen,
      setModelOpen: setModelDialogOpen,
      anyOpen: dialogOpen,
    },

    handlers: {
      saveApiKey: handleSaveApiKey,
      removeKey: handleRemoveKey,
      selectModel: handleSelectModel,
      selectProvider: handleSelectProvider,
    },

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
