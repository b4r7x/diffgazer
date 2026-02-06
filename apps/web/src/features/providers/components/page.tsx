import { usePageFooter } from "@/hooks/use-page-footer";
import { ProviderList } from "@/features/providers/components/provider-list";
import { ProviderDetails } from "@/features/providers/components/provider-details";
import { ApiKeyDialog } from "@/features/providers/components/api-key-dialog/api-key-dialog";
import { ModelSelectDialog } from "@/features/providers/components/model-select-dialog/model-select-dialog";
import { useProvidersPageState } from "@/features/providers/hooks/use-providers-page-state";
import { PROVIDER_ENV_VARS } from "@stargazer/schemas/config";

const FOOTER_SHORTCUTS = [
  { key: "↑/↓", label: "Navigate" },
  { key: "←/→", label: "Switch Panel" },
  { key: "/", label: "Search" },
  { key: "Enter", label: "Activate" },
  { key: "Esc", label: "Back" },
];

export function ProvidersPage() {
  const {
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
  } = useProvidersPageState();

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
          actions={{
            onSetApiKey: () => setApiKeyDialogOpen(true),
            onSelectModel: () => setModelDialogOpen(true),
            onRemoveKey: () => { if (selectedProvider) void handleRemoveKey(selectedProvider.id); },
            onSelectProvider: () => { if (selectedProvider) void handleSelectProvider(selectedProvider.id, selectedProvider.name, selectedProvider.model); },
          }}
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
