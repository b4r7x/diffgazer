import { useState, useRef } from "react";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import type { ProviderFilter } from "@/features/providers/constants";
import { useProviderManagement } from "@/features/providers/hooks/use-provider-management";
import { useProvidersKeyboard } from "@/features/providers/hooks/use-providers-keyboard";
import { PROVIDER_CAPABILITIES } from "@/config/constants";

export function useProvidersPageState() {
  const inputRef = useRef<HTMLInputElement>(null);

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

  let filteredProviders = providers;

  if (filter === "configured") {
    filteredProviders = filteredProviders.filter((p) => p.hasApiKey);
  } else if (filter === "needs-key") {
    filteredProviders = filteredProviders.filter((p) => !p.hasApiKey);
  } else if (filter === "free") {
    filteredProviders = filteredProviders.filter((p) => PROVIDER_CAPABILITIES[p.id]?.tier === "free" || PROVIDER_CAPABILITIES[p.id]?.tier === "mixed");
  } else if (filter === "paid") {
    filteredProviders = filteredProviders.filter((p) => PROVIDER_CAPABILITIES[p.id]?.tier === "paid");
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredProviders = filteredProviders.filter((p) => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query));
  }

  const effectiveSelectedId = selectedId ?? filteredProviders[0]?.id ?? null;

  const selectedProvider = effectiveSelectedId
    ? filteredProviders.find((p) => p.id === effectiveSelectedId) ?? null
    : null;

  const dialogOpen = apiKeyDialogOpen || modelDialogOpen;
  const needsModel = selectedProvider !== null && !selectedProvider.model;

  const { focusZone, filterIndex, buttonIndex, handleListBoundary } = useProvidersKeyboard({
    selectedId: effectiveSelectedId,
    selectedProvider,
    filteredProviders,
    filter,
    setFilter,
    setSelectedId,
    dialogOpen,
    inputRef,
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
      buttonIndex,
      handleListBoundary,
    },
  };
}
