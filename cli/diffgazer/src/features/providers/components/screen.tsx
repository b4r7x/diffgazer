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
import { BACK_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { ApiKeyOverlay } from "./api-key-overlay";
import type { ProviderDetailData } from "./details";
import { ProviderDetails } from "./details";
import type { ProviderListItem } from "./list";
import { ProviderList } from "./list";
import { ModelSelectOverlay } from "./model-select-overlay";

const PROVIDER_IDS = AVAILABLE_PROVIDERS.map((provider) => provider.id);

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

function getListWidth({
  isNarrow,
  isMedium,
  columns,
}: {
  isNarrow: boolean;
  isMedium: boolean;
  columns: number;
}): number | undefined {
  if (isNarrow) return undefined;
  if (isMedium) return Math.max(Math.floor(columns * 0.25), 24);
  return Math.max(Math.floor(columns * 0.3), 30);
}

export function ProvidersScreen(): ReactElement {
  usePageFooter({
    shortcuts: [BACK_SHORTCUT, { key: "Enter", label: "Select" }],
  });
  const { columns, isNarrow, isMedium } = useResponsive();
  const { tokens } = useTheme();
  const listWidth = getListWidth({ isNarrow, isMedium, columns });

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

  const selectedProvider = providers.find((p) => p.id === selectedId);
  const selectedDetail = selectedProvider ? toDetailData(selectedProvider) : undefined;
  const selectedProviderId = isProviderId(selectedId) ? selectedId : null;
  const hasSelection = selectedId !== undefined;

  function handleConfigureKey() {
    if (selectedId) setApiKeyOpen(true);
  }

  function handleSelectModel() {
    if (selectedId) setModelSelectOpen(true);
  }

  function handleApiKeySaved() {
    void providerQuery.refetch();
    if (selectedProvider?.id === OPENROUTER_PROVIDER_ID && !selectedProvider.model) {
      setModelSelectOpen(true);
    }
  }

  function handleRemoveProvider() {
    if (!selectedId) return;
    deleteCredentials.mutate(selectedId);
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
      <Panel>
        <Panel.Content>
          <Box flexDirection="column" gap={1}>
            <SectionHeader>Providers</SectionHeader>
            <Spinner label="Loading providers..." />
          </Box>
        </Panel.Content>
      </Panel>
    ),
    error: (err) => (
      <Panel>
        <Panel.Content>
          <Box flexDirection="column" gap={1}>
            <SectionHeader>Providers</SectionHeader>
            <Text color={tokens.error}>Error: {sanitizeTerminalText(err.message)}</Text>
          </Box>
        </Panel.Content>
      </Panel>
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
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Providers</SectionHeader>
          <Box flexDirection={isNarrow ? "column" : "row"} gap={isNarrow ? 0 : 2}>
            <Box
              flexDirection="column"
              width={listWidth}
              borderStyle="single"
              borderColor={isListActive ? tokens.accent : tokens.border}
            >
              <ProviderList
                providers={providers}
                selectedId={selectedId}
                onSelect={setSelectedId}
                isActive={isListActive}
                contentWidth={Math.max((listWidth ?? columns) - 4, 1)}
                compact={isMedium}
              />
            </Box>
            <Box
              flexDirection="column"
              flexGrow={1}
              borderStyle="single"
              borderColor={isDetailsActive ? tokens.accent : tokens.border}
            >
              <ProviderDetails
                provider={selectedDetail}
                isActive={isDetailsActive}
                onConfigureKey={handleConfigureKey}
                onSelectModel={handleSelectModel}
                onRemove={handleRemoveProvider}
                onSetActive={handleSetActive}
                isPending={activateProvider.isPending || deleteCredentials.isPending}
                stackActions={isMedium}
              />
            </Box>
          </Box>
          {error && <Text color={tokens.error}>{sanitizeTerminalText(error)}</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
