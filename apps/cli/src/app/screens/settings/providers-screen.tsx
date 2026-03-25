import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { ProviderStatus } from "@diffgazer/schemas/config";
import { AVAILABLE_PROVIDERS } from "@diffgazer/schemas/config";
import { useProviderStatus, useDeleteProviderCredentials, matchQueryState } from "@diffgazer/api/hooks";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { useTheme } from "../../../theme/theme-context.js";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { ProviderList } from "../../../features/providers/components/provider-list.js";
import type { ProviderListItem } from "../../../features/providers/components/provider-list.js";
import { ProviderDetails } from "../../../features/providers/components/provider-details.js";
import type { ProviderDetailData } from "../../../features/providers/components/provider-details.js";
import { ApiKeyOverlay } from "../../../features/providers/components/api-key-overlay.js";
import { ModelSelectOverlay } from "../../../features/providers/components/model-select-overlay.js";

function buildProviderList(statuses: ProviderStatus[]): ProviderListItem[] {
  return AVAILABLE_PROVIDERS.map((info) => {
    const status = statuses.find((s) => s.provider === info.id);
    const hasApiKey = status?.hasApiKey ?? false;
    const isActive = status?.isActive ?? false;
    const displayStatus: ProviderListItem["displayStatus"] = isActive
      ? "active"
      : hasApiKey
        ? "configured"
        : "needs-key";
    return {
      id: info.id,
      name: info.name,
      displayStatus,
      model: status?.model,
    };
  });
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

export function ProvidersScreen(): ReactElement {
  useScope("providers");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }, { key: "Enter", label: "Select" }] });
  useBackHandler();

  const { columns } = useTerminalDimensions();
  const { tokens } = useTheme();
  const isNarrow = columns < 80;
  const listWidth = isNarrow ? undefined : Math.max(Math.floor(columns * 0.3), 30);

  const providerQuery = useProviderStatus();
  const deleteCredentials = useDeleteProviderCredentials();

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);

  const providers = providerQuery.data ? buildProviderList(providerQuery.data) : [];

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
  }

  function handleModelSelect(_modelId: string) {
    void providerQuery.refetch();
  }

  function handleRemoveProvider() {
    if (!selectedId) return;
    deleteCredentials.mutate(selectedId);
  }

  const isListActive = !apiKeyOpen && !modelSelectOpen;

  const guard = matchQueryState(providerQuery, {
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
    success: () => null,
  });

  if (guard) return guard as ReactElement;

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
              borderColor={tokens.border}
            >
              <ProviderDetails
                provider={selectedDetail}
                onConfigureKey={handleConfigureKey}
                onSelectModel={handleSelectModel}
                onRemove={handleRemoveProvider}
              />
            </Box>
          </Box>
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
