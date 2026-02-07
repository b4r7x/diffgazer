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
    isLoading,
    filteredProviders,
    selectedProvider,
    needsModel,
    search,
    selection,
    dialogs,
    handlers,
    keyboard,
  } = useProvidersPageState();

  usePageFooter({ shortcuts: FOOTER_SHORTCUTS });

  const actions = {
    onSetApiKey: () => dialogs.setApiKeyOpen(true),
    onSelectModel: () => dialogs.setModelOpen(true),
    onRemoveKey: () => { if (selectedProvider) void handlers.removeKey(selectedProvider.id); },
    onSelectProvider: () => { if (selectedProvider) void handlers.selectProvider(selectedProvider.id, selectedProvider.name, selectedProvider.model); },
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-tui-muted" role="status" aria-live="polite">Loading providers...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-2/5 flex flex-col border-r border-tui-border">
        <ProviderList
          providers={filteredProviders}
          selectedId={selection.effectiveSelectedId}
          onSelect={selection.setSelectedId}
          filter={selection.filter}
          onFilterChange={selection.setFilter}
          searchQuery={search.query}
          onSearchChange={search.setQuery}
          keyboardEnabled={keyboard.focusZone === "list" && !dialogs.anyOpen}
          onBoundaryReached={keyboard.handleListBoundary}
          inputRef={search.inputRef}
          focusedFilterIndex={keyboard.focusZone === "filters" ? keyboard.filterIndex : undefined}
        />
      </div>
      <div className="w-3/5 flex flex-col bg-tui-bg">
        <ProviderDetails
          provider={selectedProvider}
          actions={actions}
          disableSelectProvider={needsModel}
          focusedButtonIndex={keyboard.focusZone === "buttons" && selectedProvider ? keyboard.buttonIndex : undefined}
          isFocused={keyboard.focusZone === "buttons" && !!selectedProvider}
        />
      </div>

      {selectedProvider && (
        <>
          <ApiKeyDialog
            open={dialogs.apiKeyOpen}
            onOpenChange={dialogs.setApiKeyOpen}
            providerName={selectedProvider.name}
            envVarName={PROVIDER_ENV_VARS[selectedProvider.id]}
            hasExistingKey={selectedProvider.hasApiKey}
            onSubmit={(_method, value) => handlers.saveApiKey(
              selectedProvider.id,
              value,
              { openModelDialog: selectedProvider.id === "openrouter" && !selectedProvider.model },
            )}
            onRemoveKey={() => handlers.removeKey(selectedProvider.id)}
          />
          <ModelSelectDialog
            open={dialogs.modelOpen}
            onOpenChange={dialogs.setModelOpen}
            provider={selectedProvider.id}
            currentModel={selectedProvider.model}
            onSelect={(modelId) => void handlers.selectModel(selectedProvider.id, modelId)}
          />
        </>
      )}
    </div>
  );
}
