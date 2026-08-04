import { usePageFooter } from "@diffgazer/core/footer";
import { getProviderRowId } from "@diffgazer/core/providers";
import type { ClientConfigurationSummary } from "@diffgazer/core/schemas/config";
import { BACK_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { Panel } from "@diffgazer/ui/components/panel";
import { CenteredStatus } from "@/components/shared/centered-status";
import { ApiKeyDialog } from "@/features/providers/components/api-key-dialog/dialog";
import { ProviderDetails } from "@/features/providers/components/details";
import { ProviderList } from "@/features/providers/components/list";
import { ModelSelectDialog } from "@/features/providers/components/model-select-dialog/dialog";
import { useProvidersPageState } from "@/features/providers/hooks/use-page-state";
import { useConfigData } from "@/hooks/use-config";
import { useFocusWithin } from "@/hooks/use-focus-within";

function getProvidersFooter(
  focusZone: "input" | "filters" | "list" | "buttons",
  { hasSelectedRow, hasActions }: { hasSelectedRow: boolean; hasActions: boolean },
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
      ...(hasSelectedRow ? [{ key: "Enter", label: "Select Provider" }] : []),
      ...(hasActions ? [{ key: "Space/→", label: "Actions" }] : []),
      { key: "/", label: "Search" },
    ],
    rightShortcuts: [BACK_SHORTCUT],
  };
}

export function ProvidersPage() {
  const {
    isLoading,
    filteredProviders,
    selectedRow,
    search,
    selection,
    dialogs,
    handlers,
    providerActions,
    runProviderAction,
    keyboard,
    isSubmitting,
  } = useProvidersPageState();

  const { secretsStorage } = useConfigData();
  const listPane = useFocusWithin<HTMLDivElement>();
  const detailsPane = useFocusWithin<HTMLDivElement>();

  const footer = dialogs.anyOpen
    ? { shortcuts: [] as Shortcut[], rightShortcuts: [] as Shortcut[] }
    : getProvidersFooter(keyboard.focusZone, {
        hasSelectedRow: Boolean(selectedRow),
        hasActions: providerActions.length > 0,
      });

  usePageFooter({ shortcuts: footer.shortcuts, rightShortcuts: footer.rightShortcuts });

  const handleProviderListActivate = (id: string) => {
    if (selectedRow && getProviderRowId(selectedRow) === id) {
      handlers.dispatchAction(selectedRow);
    }
  };

  if (isLoading) {
    return <CenteredStatus>Loading providers...</CenteredStatus>;
  }

  const setupDialog = dialogs.current?.kind === "setup" ? dialogs.current : null;
  const modelDialog = dialogs.current?.kind === "model" ? dialogs.current : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4 pt-2 pb-2">
      {/*
        Same pane rhythm as history: chip-labelled hairline Panels on a grid,
        1px column gap so the frames read as one shared rule, pt-4 clearing the
        notched Panel.Label overhang. Below md the grid row is the page's single
        scroller and the panes grow intrinsically; from md each pane scrolls
        internally.
      */}
      <div className="grid min-h-0 flex-1 gap-x-px gap-y-6 overflow-y-auto pt-4 [--panel-hairline:var(--border)] max-md:overflow-x-hidden md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:overflow-hidden">
        <Panel
          {...listPane.props}
          focused={listPane.focusWithin}
          as="section"
          aria-label="Providers"
          className="flex min-w-0 flex-col md:min-h-0"
          data-layout-pane="provider-list"
        >
          <Panel.Label variant="border" aria-hidden="true">
            Providers
          </Panel.Label>
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
            onFilterIndexChange={keyboard.handleFilterIndexChange}
            onFilterKeyDown={keyboard.handleFilterKeyDown}
            getFilterButtonProps={keyboard.getFilterButtonProps}
            onListKeyDown={keyboard.handleListKeyDown}
            highlighted={selection.effectiveSelectedId}
            onHighlightChange={(id) => selection.setSelectedId(id)}
            onActivate={handleProviderListActivate}
            onBoundaryReached={keyboard.handleListBoundary}
          />
        </Panel>
        <Panel
          {...detailsPane.props}
          focused={detailsPane.focusWithin}
          as="section"
          aria-label="Provider details"
          className="flex min-w-0 flex-col md:min-h-0"
          data-layout-pane="provider-details"
        >
          <Panel.Label variant="border" aria-hidden="true">
            Provider Details
            {/* The provider name is data, not a label: keep its real casing. */}
            {selectedRow ? (
              <span className="normal-case"> · {selectedRow.product.name}</span>
            ) : null}
          </Panel.Label>
          <ProviderDetails
            row={selectedRow}
            actions={providerActions}
            onAction={runProviderAction}
            isPending={isSubmitting}
            focusedButtonIndex={
              keyboard.focusZone === "buttons" && selectedRow ? keyboard.buttonIndex : undefined
            }
            isFocused={keyboard.focusZone === "buttons" && !!selectedRow}
            getButtonProps={keyboard.getActionButtonProps}
          />
        </Panel>
      </div>

      {setupDialog ? (
        <ApiKeyDialog
          key={`${getProviderRowId(setupDialog.row)}:${String(setupDialog.owner.id)}`}
          open
          onOpenChange={(open) => {
            if (!open) dialogs.close(setupDialog.owner);
          }}
          row={setupDialog.row}
          secretsStorage={secretsStorage}
          onCreate={(input, opts) => handlers.createConfiguration(setupDialog.owner, input, opts)}
          onUpdate={(payload, opts) => {
            const configuration = setupDialog.row.configuration;
            if (!configuration || configuration.status !== "supported") {
              return Promise.resolve({
                status: "failed" as const,
                message: "This configuration can no longer be updated.",
              });
            }
            return handlers.updateConfiguration(
              setupDialog.owner,
              {
                configurationId: configuration.configurationId,
                expectedRevision: configuration.revision,
                ...payload,
              },
              opts,
            );
          }}
        />
      ) : null}

      {modelDialog && modelDialog.row.configuration?.status === "supported" ? (
        <ModelSelectDialog
          key={`${getProviderRowId(modelDialog.row)}:${String(modelDialog.owner.id)}`}
          open
          onOpenChange={(open) => {
            if (!open) dialogs.close(modelDialog.owner);
          }}
          configuration={
            modelDialog.row.configuration as Extract<
              ClientConfigurationSummary,
              { status: "supported" }
            >
          }
          currentModel={modelDialog.row.configuration.selectedModelId ?? undefined}
          isSaving={isSubmitting}
          onSelect={(modelId) => void handlers.selectModel(modelDialog.owner, modelId)}
        />
      ) : null}
    </div>
  );
}
