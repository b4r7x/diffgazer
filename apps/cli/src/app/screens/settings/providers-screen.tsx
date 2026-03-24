import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { ProviderStatus } from "@diffgazer/schemas/config";
import { AVAILABLE_PROVIDERS } from "@diffgazer/schemas/config";
import { api } from "../../../lib/api.js";
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

  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    api
      .getProviderStatus()
      .then((statuses) => {
        setProviders(buildProviderList(statuses));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load providers");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const selectedProvider = providers.find((p) => p.id === selectedId);
  const selectedDetail = selectedProvider ? toDetailData(selectedProvider) : undefined;

  function handleConfigureKey() {
    if (selectedId) setApiKeyOpen(true);
  }

  function handleSelectModel() {
    if (selectedId) setModelSelectOpen(true);
  }

  function refreshProviders() {
    api
      .getProviderStatus()
      .then((statuses) => {
        setProviders(buildProviderList(statuses));
      })
      .catch(() => {
        // Non-critical — list will keep current state
      });
  }

  function handleSaveKey(_key: string, _method: string) {
    // Key already persisted by ApiKeyOverlay via api.saveConfig().
    refreshProviders();
  }

  function handleModelSelect(_modelId: string) {
    // Model already persisted by ModelSelectOverlay via api.activateProvider().
    refreshProviders();
  }

  function handleRemoveProvider() {
    if (!selectedId) return;
    api
      .deleteProviderCredentials(selectedId)
      .then(() => {
        refreshProviders();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to remove provider");
      });
  }

  const isListActive = !apiKeyOpen && !modelSelectOpen;

  if (isLoading) {
    return (
      <Panel>
        <Panel.Content>
          <Box flexDirection="column" gap={1}>
            <SectionHeader>Providers</SectionHeader>
            <Spinner label="Loading providers..." />
          </Box>
        </Panel.Content>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel>
        <Panel.Content>
          <Box flexDirection="column" gap={1}>
            <SectionHeader>Providers</SectionHeader>
            <Text color="red">Error: {error}</Text>
          </Box>
        </Panel.Content>
      </Panel>
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
