import { usePageFooter } from "@diffgazer/core/footer";
import type { CredentialRef } from "@diffgazer/core/schemas/config";
import { PROVIDER_ENV_VARS } from "@diffgazer/core/schemas/config";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { useConfigData } from "@/app/providers/config";
import { ApiKeyDialog } from "@/features/providers/components/api-key-dialog/dialog";
import { ProviderDetails } from "@/features/providers/components/details";
import { ProviderList } from "@/features/providers/components/list";
import { ModelSelectDialog } from "@/features/providers/components/model-select-dialog/dialog";
import { useProvidersPageState } from "@/features/providers/hooks/use-page-state";

export function getProvidersFooter(
  focusZone: "input" | "filters" | "list" | "buttons",
  hasSelectedProvider: boolean,
): { shortcuts: Shortcut[]; rightShortcuts: Shortcut[] } {
  if (focusZone === "input") {
    return {
      shortcuts: [
        { key: "↓", label: "Filters" },
        { key: "Esc", label: "Exit Search" },
      ],
      rightShortcuts: [],
    };
  }

  if (focusZone === "filters") {
    return {
      shortcuts: [
        { key: "←/→", label: "Change Filter" },
        { key: "↑/↓", label: "Switch Zone" },
        { key: "/", label: "Search" },
      ],
      rightShortcuts: [{ key: "Esc", label: "Back" }],
    };
  }

  if (focusZone === "buttons") {
    return {
      shortcuts: [
        { key: "←/→/↑/↓", label: "Move Action" },
        { key: "Enter/Space", label: "Activate Action" },
        { key: "/", label: "Search" },
      ],
      rightShortcuts: [{ key: "Esc", label: "Back" }],
    };
  }

  return {
    shortcuts: [
      { key: "↑/↓", label: "Navigate Providers" },
      ...(hasSelectedProvider
        ? [
            { key: "Enter", label: "Select Provider" },
            { key: "Space/→", label: "Actions" },
          ]
        : []),
      { key: "/", label: "Search" },
    ],
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  };
}

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

  const { secretsStorage } = useConfigData();

  const footer = dialogs.anyOpen
    ? { shortcuts: [] as Shortcut[], rightShortcuts: [] as Shortcut[] }
    : getProvidersFooter(keyboard.focusZone, Boolean(selectedProvider));

  usePageFooter({ shortcuts: footer.shortcuts, rightShortcuts: footer.rightShortcuts });

  const actions = {
    onSetApiKey: () => dialogs.setApiKeyOpen(true),
    onSelectModel: () => dialogs.setModelOpen(true),
    onRemoveKey: () => {
      if (selectedProvider) void handlers.removeKey(selectedProvider.id);
    },
    onSelectProvider: () => {
      if (selectedProvider)
        void handlers.selectProvider(
          selectedProvider.id,
          selectedProvider.name,
          selectedProvider.model,
        );
    },
  };

  const handleProviderActivate = (id: string) => {
    const provider = filteredProviders.find((candidate) => candidate.id === id);
    if (!provider) return;
    void handlers.selectProvider(provider.id, provider.name, provider.model);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <output className="text-tui-muted" aria-live="polite">
          Loading providers...
        </output>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-2/5 flex flex-col border-r border-tui-border">
        <ProviderList
          ref={keyboard.listContainerRef}
          providers={filteredProviders}
          selectedId={selection.effectiveSelectedId}
          onSelect={(id) => {
            keyboard.handleListFocus();
            selection.setSelectedId(id);
          }}
          filter={selection.filter}
          onFilterChange={selection.setFilter}
          searchQuery={search.query}
          onSearchChange={search.setQuery}
          isFocused={keyboard.focusZone === "list"}
          inputRef={search.inputRef}
          onSearchFocus={keyboard.handleSearchFocus}
          onSearchEscape={keyboard.handleSearchEscape}
          onListFocus={keyboard.handleListFocus}
          focusedFilterIndex={keyboard.focusZone === "filters" ? keyboard.filterIndex : undefined}
          onFilterHighlightChange={keyboard.setFilterIndex}
          onFilterFocus={keyboard.handleFilterFocus}
          onFilterKeyDown={keyboard.handleFilterKeyDown}
          getFilterButtonProps={keyboard.getFilterButtonProps}
          onListKeyDown={keyboard.handleListKeyDown}
          highlighted={selection.effectiveSelectedId}
          onHighlightChange={(id) => selection.setSelectedId(id)}
          onActivate={handleProviderActivate}
          onBoundaryReached={keyboard.handleListBoundary}
        />
      </div>
      <div className="w-3/5 flex flex-col bg-tui-bg">
        <ProviderDetails
          provider={selectedProvider}
          actions={actions}
          disableSelectProvider={needsModel}
          focusedButtonIndex={
            keyboard.focusZone === "buttons" && selectedProvider ? keyboard.buttonIndex : undefined
          }
          isFocused={keyboard.focusZone === "buttons" && !!selectedProvider}
          getButtonProps={keyboard.getActionButtonProps}
        />
      </div>

      {selectedProvider && (
        <>
          <ApiKeyDialog
            key={selectedProvider.id}
            open={dialogs.apiKeyOpen}
            onOpenChange={dialogs.setApiKeyOpen}
            providerName={selectedProvider.name}
            envVarName={PROVIDER_ENV_VARS[selectedProvider.id]}
            secretsStorage={secretsStorage}
            onSubmit={(method, value) => {
              const apiKey: string | CredentialRef =
                method === "env" ? { kind: "env", varName: value } : value;
              return handlers.saveApiKey(selectedProvider.id, apiKey, {
                openModelDialog: selectedProvider.id === "openrouter" && !selectedProvider.model,
              });
            }}
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
