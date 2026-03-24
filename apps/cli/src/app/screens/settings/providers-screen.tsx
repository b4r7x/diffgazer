import { useState } from "react";
import type { ReactElement } from "react";
import { Box } from "ink";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { ProviderList } from "../../../features/providers/components/provider-list.js";
import { ProviderDetails } from "../../../features/providers/components/provider-details.js";
import { ApiKeyOverlay } from "../../../features/providers/components/api-key-overlay.js";
import { ModelSelectOverlay } from "../../../features/providers/components/model-select-overlay.js";

const MOCK_PROVIDERS = [
  { id: "openai", name: "OpenAI", status: "configured" as const, model: "gpt-4" },
  { id: "anthropic", name: "Anthropic", status: "unconfigured" as const },
];

const MOCK_MODELS = [
  { id: "gpt-4", name: "GPT-4", capabilities: ["chat", "code"] },
  { id: "gpt-4o", name: "GPT-4o", capabilities: ["chat", "code", "vision"] },
  { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", capabilities: ["chat", "code"] },
];

export function ProvidersScreen(): ReactElement {
  useScope("providers");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }, { key: "Enter", label: "Select" }] });
  useBackHandler();

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);

  const selectedProvider = MOCK_PROVIDERS.find((p) => p.id === selectedId);

  function handleConfigureKey() {
    if (selectedId) setApiKeyOpen(true);
  }

  function handleSelectModel() {
    if (selectedId) setModelSelectOpen(true);
  }

  function handleSaveKey(_key: string, _method: string) {
    // TODO: persist API key
  }

  function handleModelSelect(_modelId: string) {
    // TODO: persist model selection
  }

  const isListActive = !apiKeyOpen && !modelSelectOpen;

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Providers</SectionHeader>
          <Box gap={2}>
            <Box flexDirection="column" width={30}>
              <ProviderList
                providers={MOCK_PROVIDERS}
                selectedId={selectedId}
                onSelect={setSelectedId}
                isActive={isListActive}
              />
            </Box>
            <Box flexDirection="column" flexGrow={1}>
              <ProviderDetails
                provider={selectedProvider}
                onConfigureKey={handleConfigureKey}
                onSelectModel={handleSelectModel}
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
        models={MOCK_MODELS}
        selectedId={selectedProvider?.model}
        onSelect={handleModelSelect}
      />
    </Panel>
  );
}
