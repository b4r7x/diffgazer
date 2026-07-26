import {
  guardQueryState,
  useActivateProvider,
  useDeleteProviderCredentials,
  useProviderStatus,
} from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { mapProvidersWithStatus } from "@diffgazer/core/providers";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { AVAILABLE_PROVIDERS, OPENROUTER_PROVIDER_ID } from "@diffgazer/core/schemas/config";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { BACK_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { useContentZone } from "../../../components/layout/global";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { paneBorder } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";
import { ApiKeyOverlay } from "./api-key-overlay";
import type { ProviderDetailData } from "./details";
import { COMFORTABLE_DETAILS_ROWS, ProviderDetails } from "./details";
import type { ProviderListItem } from "./list";
import { ProviderList } from "./list";
import { ModelSelectOverlay } from "./model-select-overlay";

const PROVIDER_IDS = AVAILABLE_PROVIDERS.map((provider) => provider.id);

const BROWSE_SHORTCUTS: Shortcut[] = [BACK_SHORTCUT, { key: "Enter", label: "Select" }];

/**
 * Branch-scoped footer publisher: it unmounts when an overlay takes over the
 * screen, so the overlay's own `usePageFooter` owns the bar while it is open
 * instead of being overwritten by a parent effect on the same commit.
 */
function BrowseFooter(): null {
  usePageFooter({ shortcuts: BROWSE_SHORTCUTS });
  return null;
}

function isProviderId(value: string | undefined): value is AIProvider {
  return PROVIDER_IDS.some((providerId) => providerId === value);
}

function toDetailData(provider: ProviderListItem): ProviderDetailData {
  const info = AVAILABLE_PROVIDERS.find((p) => p.id === provider.id);
  return {
    id: provider.id,
    name: provider.name,
    displayStatus: provider.displayStatus,
    model: provider.model,
    defaultModel: info?.defaultModel,
  };
}

/** The list is chosen by name, so it gets the width a provider name needs. */
function getListWidth({
  isNarrow,
  columns,
}: {
  isNarrow: boolean;
  columns: number;
}): number | undefined {
  if (isNarrow) return undefined;
  return Math.min(Math.max(Math.floor(columns * 0.4), 28), 48);
}

export function ProvidersScreen(): ReactElement {
  const { columns, isNarrow } = useResponsive();
  const { contentRows } = useContentZone();
  const { tokens } = useTheme();
  const listWidth = getListWidth({ isNarrow, columns });

  const providerQuery = useProviderStatus();
  const deleteCredentials = useDeleteProviderCredentials();
  const activateProvider = useActivateProvider();

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [zone, setZone] = useState<"list" | "details">("list");

  const providers = providerQuery.data ? mapProvidersWithStatus(providerQuery.data) : [];
  const error =
    activateProvider.error?.message ??
    deleteCredentials.error?.message ??
    providerQuery.error?.message ??
    null;

  // The highlighted row IS the inspected provider: the details pane never
  // contradicts a row that already looks chosen. Derived, not synced.
  const defaultSelectedId =
    providers.find((provider) => provider.displayStatus === "active")?.id ?? providers[0]?.id;
  const activeSelectionId = selectedId ?? defaultSelectedId;
  const selectedProvider = providers.find((p) => p.id === activeSelectionId);
  const selectedDetail = selectedProvider ? toDetailData(selectedProvider) : undefined;
  const selectedProviderId = isProviderId(activeSelectionId) ? activeSelectionId : null;
  const hasSelection = activeSelectionId !== undefined;

  function handleConfigureKey() {
    if (activeSelectionId) setApiKeyOpen(true);
  }

  function handleSelectModel() {
    if (activeSelectionId) setModelSelectOpen(true);
  }

  function handleApiKeySaved() {
    void providerQuery.refetch();
    if (selectedProvider?.id === OPENROUTER_PROVIDER_ID && !selectedProvider.model) {
      setModelSelectOpen(true);
    }
  }

  function handleRemoveProvider() {
    if (!activeSelectionId) return;
    deleteCredentials.mutate(activeSelectionId);
  }

  function handleSetActive() {
    if (!selectedDetail || selectedDetail.displayStatus === "active") return;
    if (selectedDetail.displayStatus === "needs-key") {
      setApiKeyOpen(true);
      return;
    }
    const model = selectedDetail.model ?? selectedDetail.defaultModel;
    if (!model) {
      setModelSelectOpen(true);
      return;
    }
    activateProvider.mutate({ providerId: selectedDetail.id, model });
  }

  // The bordered section header and the gap under it, then the pane's own
  // border rows: what is left is what the details body may spend.
  const detailsRows = contentRows - 3 - 2;

  const isOverlayOpen = apiKeyOpen || modelSelectOpen;
  const activeZone = hasSelection ? zone : "list";
  const isListActive = !isOverlayOpen && activeZone === "list";
  const isDetailsActive = !isOverlayOpen && activeZone === "details";

  useInput(
    (_input, key) => {
      if (key.tab) {
        if (!hasSelection) {
          setZone("list");
          return;
        }
        setZone(activeZone === "list" ? "details" : "list");
      }
    },
    { isActive: !isOverlayOpen },
  );

  useBackHandler({ isActive: !isOverlayOpen });

  const guard = guardQueryState(providerQuery, {
    loading: () => (
      <Box flexDirection="column" gap={1}>
        <BrowseFooter />
        <SectionHeader bordered>Providers</SectionHeader>
        <Spinner label="Loading providers..." />
      </Box>
    ),
    error: (err) => (
      <Box flexDirection="column" gap={1}>
        <BrowseFooter />
        <SectionHeader bordered>Providers</SectionHeader>
        <Text color={tokens.error}>Error: {sanitizeTerminalText(err.message)}</Text>
      </Box>
    ),
  });

  if (guard) return guard;

  if (selectedProviderId && apiKeyOpen) {
    return (
      <ApiKeyOverlay
        open
        onOpenChange={setApiKeyOpen}
        providerId={selectedProviderId}
        onSaved={handleApiKeySaved}
      />
    );
  }

  if (selectedProviderId && modelSelectOpen) {
    return (
      <ModelSelectOverlay
        open
        onOpenChange={setModelSelectOpen}
        providerId={selectedProviderId}
        selectedId={selectedDetail?.model}
      />
    );
  }

  return (
    <Box flexDirection="column" gap={1} flexGrow={1} minHeight={0}>
      <BrowseFooter />
      <SectionHeader bordered>Providers</SectionHeader>
      <Box
        flexDirection={isNarrow ? "column" : "row"}
        gap={isNarrow ? 0 : 2}
        flexGrow={1}
        minHeight={0}
      >
        {/* The list is chosen by name, so it keeps the width the clamp granted
            it instead of shrinking under the details pane's content. */}
        <Box
          flexDirection="column"
          width={listWidth}
          flexShrink={0}
          height="100%"
          {...paneBorder(tokens, isListActive)}
        >
          <ProviderList
            providers={providers}
            selectedId={activeSelectionId}
            highlightedId={activeSelectionId}
            onSelect={setSelectedId}
            onHighlightChange={setSelectedId}
            isActive={isListActive}
            contentWidth={Math.max((listWidth ?? columns) - 4, 1)}
            compact={(listWidth ?? columns) < 34}
          />
        </Box>
        <Box
          flexDirection="column"
          flexGrow={1}
          height="100%"
          overflow="hidden"
          {...paneBorder(tokens, isDetailsActive)}
        >
          <ProviderDetails
            provider={selectedDetail}
            isActive={isDetailsActive}
            onConfigureKey={handleConfigureKey}
            onSelectModel={handleSelectModel}
            onRemove={handleRemoveProvider}
            onSetActive={handleSetActive}
            isPending={activateProvider.isPending || deleteCredentials.isPending}
            compact={detailsRows < COMFORTABLE_DETAILS_ROWS}
          />
        </Box>
      </Box>
      {error && <Text color={tokens.error}>{sanitizeTerminalText(error)}</Text>}
    </Box>
  );
}
