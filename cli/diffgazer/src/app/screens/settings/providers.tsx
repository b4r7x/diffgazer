import {
  guardQueryState,
  useDeleteProviderCredentials,
  useProviderStatus,
} from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { mapProvidersWithStatus } from "@diffgazer/core/providers";
import { AVAILABLE_PROVIDERS, OPENROUTER_PROVIDER_ID } from "@diffgazer/core/schemas/config";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { ApiKeyOverlay } from "../../../features/providers/components/api-key-overlay";
import type { ProviderDetailData } from "../../../features/providers/components/details";
import { ProviderDetails } from "../../../features/providers/components/details";
import type { ProviderListItem } from "../../../features/providers/components/list";
import { ProviderList } from "../../../features/providers/components/list";
import { ModelSelectOverlay } from "../../../features/providers/components/model-select-overlay";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useScope } from "../../../hooks/use-scope";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../providers/theme";

function toListItem(provider: ProviderListItem): ProviderListItem {
  return {
    id: provider.id,
    name: provider.name,
    displayStatus: provider.displayStatus,
    model: provider.model,
  };
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
  useScope("providers");
  usePageFooter({
    shortcuts: [
      { key: "Esc", label: "Back" },
      { key: "Enter", label: "Select" },
    ],
  });
  const { columns, isNarrow, isMedium } = useResponsive();
  const { tokens } = useTheme();
  const listWidth = getListWidth({ isNarrow, isMedium, columns });

  const providerQuery = useProviderStatus();
  const deleteCredentials = useDeleteProviderCredentials();

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [zone, setZone] = useState<"list" | "details">("list");

  const providers = providerQuery.data
    ? mapProvidersWithStatus(providerQuery.data).map(toListItem)
    : [];
  const error = deleteCredentials.error?.message ?? providerQuery.error?.message ?? null;

  const selectedProvider = providers.find((p) => p.id === selectedId);
  const selectedDetail = selectedProvider ? toDetailData(selectedProvider) : undefined;

  function handleConfigureKey() {
    if (selectedId) setApiKeyOpen(true);
  }

  function handleSelectModel() {
    if (selectedId) setModelSelectOpen(true);
  }

  function handleSaveKey(_key: string, _method: string) {
    void providerQuery.refetch();
    if (selectedProvider?.id === OPENROUTER_PROVIDER_ID && !selectedProvider.model) {
      setModelSelectOpen(true);
    }
  }

  function handleModelSelect(_modelId: string) {
    void providerQuery.refetch();
  }

  function handleRemoveProvider() {
    if (!selectedId) return;
    deleteCredentials.mutate(selectedId);
  }

  const isOverlayOpen = apiKeyOpen || modelSelectOpen;
  const isListActive = !isOverlayOpen && zone === "list";
  const isDetailsActive = !isOverlayOpen && zone === "details";

  useInput(
    (_input, key) => {
      if (key.tab) {
        setZone((z) => (z === "list" ? "details" : "list"));
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
            <Text color="red">Error: {err.message}</Text>
          </Box>
        </Panel.Content>
      </Panel>
    ),
  });

  if (guard) return guard;

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Providers</SectionHeader>
          {deleteCredentials.error && (
            <Text color="red">Error: {deleteCredentials.error.message}</Text>
          )}
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
              />
            </Box>
          </Box>
          {error && <Text color={tokens.error}>{error}</Text>}
        </Box>
      </Panel.Content>

      <ApiKeyOverlay
        open={apiKeyOpen}
        onOpenChange={setApiKeyOpen}
        providerId={selectedId ?? ""}
        onSave={handleSaveKey}
      />
      <ModelSelectOverlay
        open={modelSelectOpen}
        onOpenChange={setModelSelectOpen}
        providerId={selectedId ?? ""}
        selectedId={selectedDetail?.model}
        onSelect={handleModelSelect}
      />
    </Panel>
  );
}
