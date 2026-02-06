import { useState, useMemo, useRef } from "react";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { ProviderList } from "@/features/providers/components/provider-list";
import { ProviderDetails } from "@/features/providers/components/provider-details";
import type { ProviderFilter } from "@/features/providers/constants";
import { ApiKeyDialog } from "@/features/providers/components/api-key-dialog/api-key-dialog";
import { ModelSelectDialog } from "@/features/providers/components/model-select-dialog/model-select-dialog";
import { useProviderManagement } from "@/features/providers/hooks/use-provider-management";
import { useProvidersKeyboard } from "@/features/providers/hooks/use-providers-keyboard";
import { PROVIDER_ENV_VARS } from "@stargazer/schemas/config";
import { PROVIDER_CAPABILITIES } from "@/config/constants";

const FOOTER_SHORTCUTS = [
  { key: "↑/↓", label: "Navigate" },
  { key: "←/→", label: "Switch Panel" },
  { key: "/", label: "Search" },
  { key: "Enter", label: "Activate" },
  { key: "Esc", label: "Back" },
];

export function ProvidersPage() {
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

  usePageFooter({ shortcuts: FOOTER_SHORTCUTS });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-gray-500" role="status" aria-live="polite">Loading providers...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-2/5 flex flex-col border-r border-tui-border">
        <ProviderList
          providers={filteredProviders}
          selectedId={effectiveSelectedId}
          onSelect={setSelectedId}
          filter={filter}
          onFilterChange={setFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          keyboardEnabled={focusZone === "list" && !dialogOpen}
          onBoundaryReached={handleListBoundary}
          inputRef={inputRef}
          focusedFilterIndex={focusZone === "filters" ? filterIndex : undefined}
        />
      </div>
      <div className="w-3/5 flex flex-col bg-[#0b0e14]">
        <ProviderDetails
          provider={selectedProvider}
          onSetApiKey={() => setApiKeyDialogOpen(true)}
          onSelectModel={() => setModelDialogOpen(true)}
          onRemoveKey={() => { if (selectedProvider) void handleRemoveKey(selectedProvider.id); }}
          onSelectProvider={() => { if (selectedProvider) void handleSelectProvider(selectedProvider.id, selectedProvider.name, selectedProvider.model); }}
          disableSelectProvider={needsOpenRouterModel}
          focusedButtonIndex={focusZone === "buttons" && selectedProvider ? buttonIndex : undefined}
          isFocused={focusZone === "buttons" && !!selectedProvider}
        />
      </div>

      {selectedProvider && (
        <>
          <ApiKeyDialog
            open={apiKeyDialogOpen}
            onOpenChange={setApiKeyDialogOpen}
            providerName={selectedProvider.name}
            envVarName={PROVIDER_ENV_VARS[selectedProvider.id]}
            hasExistingKey={selectedProvider.hasApiKey}
            onSubmit={(_method, value) => handleSaveApiKey(
              selectedProvider.id,
              value,
              { openModelDialog: selectedProvider.id === "openrouter" && !selectedProvider.model },
            )}
            onRemoveKey={() => handleRemoveKey(selectedProvider.id)}
          />
          <ModelSelectDialog
            open={modelDialogOpen}
            onOpenChange={setModelDialogOpen}
            provider={selectedProvider.id}
            currentModel={selectedProvider.model}
            onSelect={(modelId) => void handleSelectModel(selectedProvider.id, modelId)}
          />
        </>
      )}
    </div>
  );
}
