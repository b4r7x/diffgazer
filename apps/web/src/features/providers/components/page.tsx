import { useRef } from "react";
import { useNavigation } from "keyscope";
import type { Shortcut } from "@diffgazer/schemas/ui";
import { usePageFooter } from "@/hooks/use-page-footer";
import { ProviderList } from "@/features/providers/components/provider-list";
import { ProviderDetails } from "@/features/providers/components/provider-details";
import { ApiKeyDialog } from "@/features/providers/components/api-key-dialog/api-key-dialog";
import { ModelSelectDialog } from "@/features/providers/components/model-select-dialog/model-select-dialog";
import { useProvidersPageState } from "@/features/providers/hooks/use-providers-page-state";
import { PROVIDER_ENV_VARS } from "@diffgazer/schemas/config";

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
        { key: "←/→", label: "Move Filter" },
        { key: "Enter/Space", label: "Apply Filter" },
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
      ...(hasSelectedProvider ? [{ key: "→", label: "Actions" }] : []),
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

  const footer = dialogs.anyOpen
    ? { shortcuts: [] as Shortcut[], rightShortcuts: [] as Shortcut[] }
    : getProvidersFooter(keyboard.focusZone, Boolean(selectedProvider));

  usePageFooter({ shortcuts: footer.shortcuts, rightShortcuts: footer.rightShortcuts });

  const listRef = useRef<HTMLDivElement>(null);
  const listBridgeActive = keyboard.focusZone === "list" && !dialogs.anyOpen;
  const { focusedValue: listFocusedValue } = useNavigation({
    containerRef: listRef,
    role: "option",
    enabled: listBridgeActive,
    value: selection.effectiveSelectedId,
    onValueChange: selection.setSelectedId,
    wrap: false,
    onBoundaryReached: keyboard.handleListBoundary,
  });

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
          isFocused={keyboard.focusZone === "list"}
          inputRef={search.inputRef}
          focusedFilterIndex={keyboard.focusZone === "filters" ? keyboard.filterIndex : undefined}
          listRef={listRef}
          focusedValue={listFocusedValue}
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
            onSubmit={(_method, value) => handlers.saveApiKey(
              selectedProvider.id,
              value,
              { openModelDialog: selectedProvider.id === "openrouter" && !selectedProvider.model },
            )}
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
