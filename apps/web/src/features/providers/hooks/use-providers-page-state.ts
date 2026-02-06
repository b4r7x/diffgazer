import { useState, useMemo, useRef } from "react";
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

  const filteredProviders = useMemo(() => {
    let result = providers;

    if (filter === "configured") {
      result = result.filter((p) => p.hasApiKey);
    } else if (filter === "needs-key") {
      result = result.filter((p) => !p.hasApiKey);
    } else if (filter === "free") {
      result = result.filter((p) => PROVIDER_CAPABILITIES[p.id]?.tier === "free" || PROVIDER_CAPABILITIES[p.id]?.tier === "mixed");
    } else if (filter === "paid") {
      result = result.filter((p) => PROVIDER_CAPABILITIES[p.id]?.tier === "paid");
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query));
    }

    return result;
  }, [providers, filter, searchQuery]);

  const effectiveSelectedId = selectedId ?? filteredProviders[0]?.id ?? null;

  const selectedProvider = effectiveSelectedId
    ? filteredProviders.find((p) => p.id === effectiveSelectedId) ?? null
    : null;

  const dialogOpen = apiKeyDialogOpen || modelDialogOpen;
  const needsOpenRouterModel = selectedProvider?.id === "openrouter" && !selectedProvider?.model;

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
    inputRef,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    filteredProviders,
    effectiveSelectedId,
    setSelectedId,
    selectedProvider,
    isLoading,
    apiKeyDialogOpen,
    setApiKeyDialogOpen,
    modelDialogOpen,
    setModelDialogOpen,
    handleSaveApiKey,
    handleRemoveKey,
    handleSelectModel,
    handleSelectProvider,
    dialogOpen,
    needsOpenRouterModel,
    focusZone,
    filterIndex,
    buttonIndex,
    handleListBoundary,
  };
}
