import { usePageFooter } from "@diffgazer/core/footer";
import type { CredentialRef } from "@diffgazer/core/schemas/config";
import { OPENROUTER_PROVIDER_ID, PROVIDER_ENV_VARS } from "@diffgazer/core/schemas/config";
import { BACK_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { CenteredStatus } from "@/components/shared/centered-status";
import { ApiKeyDialog } from "@/features/providers/components/api-key-dialog/dialog";
import { ProviderDetails } from "@/features/providers/components/details";
import { ProviderList } from "@/features/providers/components/list";
import { ModelSelectDialog } from "@/features/providers/components/model-select-dialog/dialog";
import { useProvidersPageState } from "@/features/providers/hooks/use-page-state";
import { useConfigData } from "@/hooks/use-config";

function getProvidersFooter(
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
      rightShortcuts: [BACK_SHORTCUT],
    };
  }

  if (focusZone === "buttons") {
    return {
      shortcuts: [
        { key: "←/→/↑/↓", label: "Move Action" },
        { key: "Enter/Space", label: "Activate Action" },
        { key: "/", label: "Search" },
      ],
      rightShortcuts: [BACK_SHORTCUT],
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
    rightShortcuts: [BACK_SHORTCUT],
  };
}

export function ProvidersPage() {
  const {
    isLoading,
    filteredProviders,
    selectedProvider,
    search,
    selection,
    dialogs,
    handlers,
    keyboard,
    isSubmitting,
  } = useProvidersPageState();

  const { secretsStorage } = useConfigData();

  const footer = dialogs.anyOpen
    ? { shortcuts: [] as Shortcut[], rightShortcuts: [] as Shortcut[] }
    : getProvidersFooter(keyboard.focusZone, Boolean(selectedProvider));

  usePageFooter({ shortcuts: footer.shortcuts, rightShortcuts: footer.rightShortcuts });

  const actions = {
    onSetApiKey: () => {
      if (isSubmitting) return;
      if (selectedProvider) dialogs.openApiKey(selectedProvider.id);
    },
    onSelectModel: () => {
      if (isSubmitting) return;
      if (selectedProvider) dialogs.openModel(selectedProvider.id);
    },
    onRemoveKey: () => {
      if (isSubmitting) return;
      if (selectedProvider) void handlers.removeKey(selectedProvider.id);
    },
    onSelectProvider: () => {
      if (selectedProvider) handlers.activateProvider(selectedProvider);
    },
  };

  const handleProviderListActivate = (id: string) => {
    const provider = filteredProviders.find((candidate) => candidate.id === id);
    if (!provider) return;
    handlers.activateProvider(provider);
  };

  if (isLoading) {
    return <CenteredStatus>Loading providers...</CenteredStatus>;
  }

  const apiKeyDialog = dialogs.current?.kind === "api-key" ? dialogs.current : null;
  const modelDialog = dialogs.current?.kind === "model" ? dialogs.current : null;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      <div className="flex w-full flex-col border-b border-border md:h-full md:w-2/5 md:border-r md:border-b-0">
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
          onActivate={handleProviderListActivate}
          onBoundaryReached={keyboard.handleListBoundary}
        />
      </div>
      <div className="flex w-full flex-col bg-background md:h-full md:w-3/5">
        <ProviderDetails
          provider={selectedProvider}
          actions={actions}
          isPending={isSubmitting}
          focusedButtonIndex={
            keyboard.focusZone === "buttons" && selectedProvider ? keyboard.buttonIndex : undefined
          }
          isFocused={keyboard.focusZone === "buttons" && !!selectedProvider}
          getButtonProps={keyboard.getActionButtonProps}
        />
      </div>

      {apiKeyDialog && (
        <ApiKeyDialog
          key={`${apiKeyDialog.provider.id}:${String(apiKeyDialog.owner.id)}`}
          open
          onOpenChange={(open) => {
            if (!open) dialogs.close(apiKeyDialog.owner);
          }}
          providerName={apiKeyDialog.provider.name}
          envVarName={PROVIDER_ENV_VARS[apiKeyDialog.provider.id]}
          secretsStorage={secretsStorage}
          onSubmit={(method, value) => {
            const apiKey: string | CredentialRef =
              method === "env" ? { kind: "env", varName: value } : value;
            return handlers.saveApiKey(apiKeyDialog.owner, apiKey, {
              openModelDialog:
                apiKeyDialog.provider.id === OPENROUTER_PROVIDER_ID && !apiKeyDialog.provider.model,
            });
          }}
        />
      )}
      {modelDialog && (
        <ModelSelectDialog
          key={`${modelDialog.provider.id}:${String(modelDialog.owner.id)}`}
          open
          onOpenChange={(open) => {
            if (!open) dialogs.close(modelDialog.owner);
          }}
          provider={modelDialog.provider.id}
          currentModel={modelDialog.provider.model}
          isSaving={isSubmitting}
          onSelect={(modelId) => void handlers.selectModel(modelDialog.owner, modelId)}
        />
      )}
    </div>
  );
}
