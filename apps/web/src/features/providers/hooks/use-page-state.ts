import { resolveSelectedId } from "@diffgazer/core/review";
import { useRef, useState } from "react";
import { useProvidersKeyboard } from "@/features/providers/hooks/use-keyboard";
import { useProviderManagement } from "@/features/providers/hooks/use-provider-management";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { filterProviders, type ProviderFilter } from "../lib/filter";

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

  const effectiveSelectedId = resolveSelectedId(selectedId, filteredProviders);

  const selectedProvider = effectiveSelectedId
    ? (filteredProviders.find((p) => p.id === effectiveSelectedId) ?? null)
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
