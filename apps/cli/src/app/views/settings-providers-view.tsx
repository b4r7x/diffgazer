import type { ReactElement } from "react";
import { useState, useEffect, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import type { AIProvider, ProviderStatus } from "@repo/schemas/config";
import { AVAILABLE_PROVIDERS, PROVIDER_CAPABILITIES } from "@repo/schemas/config";
import { SplitPane } from "../../components/ui/split-pane.js";
import { Panel, PanelHeader, PanelContent, PanelDivider } from "../../components/ui/panel.js";
import { Badge } from "../../components/ui/badge.js";
import { useTerminalDimensions } from "../../hooks/index.js";
import { useSettingsState } from "../../features/settings/hooks/use-settings-state.js";

type FocusZone = "search" | "filters" | "list" | "actions";
type ProviderFilter = "all" | "configured" | "needs-key" | "free" | "paid";

const FILTERS: { id: ProviderFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "configured", label: "Configured" },
  { id: "needs-key", label: "Needs Key" },
  { id: "free", label: "Free" },
  { id: "paid", label: "Paid" },
];

export const SETTINGS_PROVIDERS_FOOTER_SHORTCUTS = [
  { key: "/", label: "search" },
  { key: "Tab", label: "zone" },
  { key: "j/k", label: "navigate" },
  { key: "Enter", label: "select" },
  { key: "Esc", label: "back" },
];

interface SettingsProvidersViewProps {
  projectId: string;
  onBack: () => void;
  onSelectModel: (provider: AIProvider) => void;
  onSetApiKey: (provider: AIProvider) => void;
  isActive?: boolean;
}

export function SettingsProvidersView({
  projectId,
  onBack,
  onSelectModel,
  onSetApiKey,
  isActive = true,
}: SettingsProvidersViewProps): ReactElement {
  const { columns, isNarrow } = useTerminalDimensions();

  // Proportional widths: 40% left, 60% right
  const gap = 1;
  const availableWidth = columns - gap;
  const leftWidth = Math.floor(availableWidth * 0.4);
  const rightWidth = Math.floor(availableWidth * 0.6);

  const settingsState = useSettingsState(projectId);

  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ProviderFilter>("all");
  const [filterIndex, setFilterIndex] = useState(0);
  const [selectedProviderIndex, setSelectedProviderIndex] = useState(0);
  const [actionIndex, setActionIndex] = useState(0);

  useEffect(() => {
    void settingsState.loadAll();
  }, []);

  const providerStatusMap = useMemo(() => {
    const map = new Map<AIProvider, ProviderStatus>();
    for (const status of settingsState.providerStatus) {
      map.set(status.provider, status);
    }
    return map;
  }, [settingsState.providerStatus]);

  const filteredProviders = useMemo(() => {
    let providers = AVAILABLE_PROVIDERS;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      providers = providers.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    switch (activeFilter) {
      case "configured":
        providers = providers.filter((p) => providerStatusMap.get(p.id)?.hasApiKey);
        break;
      case "needs-key":
        providers = providers.filter((p) => !providerStatusMap.get(p.id)?.hasApiKey);
        break;
      case "free":
        providers = providers.filter(
          (p) => PROVIDER_CAPABILITIES[p.id].tier === "free" || PROVIDER_CAPABILITIES[p.id].tier === "mixed"
        );
        break;
      case "paid":
        providers = providers.filter((p) => PROVIDER_CAPABILITIES[p.id].tier === "paid");
        break;
    }

    return providers;
  }, [searchQuery, activeFilter, providerStatusMap]);

  const selectedProvider = filteredProviders[selectedProviderIndex];
  const selectedStatus = selectedProvider ? providerStatusMap.get(selectedProvider.id) : undefined;

  const actions = useMemo(() => {
    if (!selectedProvider || !selectedStatus) return [];

    const result: { id: string; label: string; enabled: boolean }[] = [];

    result.push({
      id: "select-active",
      label: "Select as Active",
      enabled: selectedStatus.hasApiKey && !selectedStatus.isActive,
    });

    result.push({
      id: "set-api-key",
      label: selectedStatus.hasApiKey ? "Update API Key" : "Set API Key",
      enabled: true,
    });

    if (selectedStatus.hasApiKey) {
      result.push({
        id: "remove-key",
        label: "Remove Key",
        enabled: true,
      });
    }

    result.push({
      id: "change-model",
      label: "Change Model",
      enabled: selectedStatus.hasApiKey,
    });

    return result;
  }, [selectedProvider, selectedStatus]);

  function cycleFocusForward(): void {
    setFocusZone((current) => {
      switch (current) {
        case "search":
          return "filters";
        case "filters":
          return "list";
        case "list":
          return actions.length > 0 ? "actions" : "search";
        case "actions":
          return "search";
        default:
          return "list";
      }
    });
  }

  async function handleAction(actionId: string): Promise<void> {
    if (!selectedProvider) return;

    switch (actionId) {
      case "select-active":
        if (selectedStatus?.hasApiKey) {
          await settingsState.saveCredentials(
            selectedProvider.id,
            "",
            selectedStatus.model
          );
        }
        break;
      case "set-api-key":
        onSetApiKey(selectedProvider.id);
        break;
      case "remove-key":
        // Would need deleteProviderCredentials API
        break;
      case "change-model":
        onSelectModel(selectedProvider.id);
        break;
    }
  }

  useInput(
    (input, key) => {
      if (!isActive) return;

      // Global shortcuts
      if (input === "/") {
        setFocusZone("search");
        return;
      }

      if (key.escape) {
        if (focusZone === "search" && searchQuery) {
          setSearchQuery("");
          setFocusZone("list");
        } else if (focusZone !== "list") {
          setFocusZone("list");
        } else {
          onBack();
        }
        return;
      }

      if (key.tab) {
        cycleFocusForward();
        return;
      }

      // Zone-specific handling
      switch (focusZone) {
        case "search":
          if (key.return || key.downArrow) {
            setFocusZone("filters");
          } else if (key.backspace || key.delete) {
            setSearchQuery((q) => q.slice(0, -1));
          } else if (input && input.length === 1 && !key.ctrl && !key.meta) {
            setSearchQuery((q) => q + input);
          }
          break;

        case "filters":
          if (key.upArrow) {
            setFocusZone("search");
          } else if (key.downArrow) {
            setFocusZone("list");
            setSelectedProviderIndex(0);
          } else if (key.leftArrow) {
            setFilterIndex((i) => Math.max(0, i - 1));
          } else if (key.rightArrow) {
            setFilterIndex((i) => Math.min(FILTERS.length - 1, i + 1));
          } else if (key.return) {
            const filter = FILTERS[filterIndex];
            if (filter) {
              setActiveFilter(filter.id);
              setSelectedProviderIndex(0);
            }
          }
          break;

        case "list":
          if (key.upArrow || input === "k") {
            if (selectedProviderIndex === 0) {
              setFocusZone("filters");
            } else {
              setSelectedProviderIndex((i) => Math.max(0, i - 1));
            }
          } else if (key.downArrow || input === "j") {
            setSelectedProviderIndex((i) =>
              Math.min(filteredProviders.length - 1, i + 1)
            );
          } else if (key.rightArrow && actions.length > 0) {
            setFocusZone("actions");
            setActionIndex(0);
          } else if (key.return && actions.length > 0) {
            setFocusZone("actions");
            setActionIndex(0);
          }
          break;

        case "actions":
          if (key.leftArrow) {
            if (actionIndex === 0) {
              setFocusZone("list");
            } else {
              setActionIndex((i) => Math.max(0, i - 1));
            }
          } else if (key.rightArrow) {
            setActionIndex((i) => Math.min(actions.length - 1, i + 1));
          } else if (key.upArrow) {
            setActionIndex((i) => Math.max(0, i - 1));
          } else if (key.downArrow) {
            setActionIndex((i) => Math.min(actions.length - 1, i + 1));
          } else if (key.return) {
            const action = actions[actionIndex];
            if (action?.enabled) {
              void handleAction(action.id);
            }
          }
          break;
      }
    },
    { isActive }
  );

  if (settingsState.isLoading) {
    return (
      <Box padding={2} justifyContent="center">
        <Text dimColor>Loading providers...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <SplitPane
        leftWidth={isNarrow ? undefined : leftWidth}
        rightWidth={isNarrow ? undefined : rightWidth}
        gap={gap}
      >
        {/* Left Pane - Provider List */}
        <Panel>
          <PanelHeader>PROVIDERS</PanelHeader>
          <PanelContent>
            {/* Search Input */}
            <Box marginBottom={1}>
              <Text color={focusZone === "search" ? "cyan" : "gray"}>/</Text>
              <Text color={focusZone === "search" ? "white" : "gray"}>
                {searchQuery || (focusZone === "search" ? "█" : "Search...")}
              </Text>
            </Box>

            {/* Filter Buttons */}
            <Box marginBottom={1} gap={1} flexWrap="wrap">
              {FILTERS.map((filter, idx) => {
                const isActive = activeFilter === filter.id;
                const isFocused = focusZone === "filters" && filterIndex === idx;
                return (
                  <Text
                    key={filter.id}
                    color={isActive ? "cyan" : isFocused ? "white" : "gray"}
                    bold={isActive}
                    inverse={isFocused}
                  >
                    [{filter.label}]
                  </Text>
                );
              })}
            </Box>

            <PanelDivider />

            {/* Provider List */}
            <Box flexDirection="column" flexGrow={1}>
              {filteredProviders.map((provider, idx) => {
                const status = providerStatusMap.get(provider.id);
                const isSelected = idx === selectedProviderIndex;
                const isFocused = focusZone === "list" && isSelected;

                const statusIcon = status?.hasApiKey ? (status.isActive ? "*" : "+") : "-";
                const statusColor = status?.hasApiKey
                  ? status.isActive ? "green" : "blue"
                  : "gray";

                return (
                  <Box key={provider.id}>
                    <Text color={isFocused ? "cyan" : undefined}>
                      {isFocused ? "> " : "  "}
                    </Text>
                    <Text color={statusColor}>{statusIcon} </Text>
                    <Text
                      color={isSelected ? "white" : "gray"}
                      bold={isSelected}
                      inverse={isFocused}
                    >
                      {provider.name}
                    </Text>
                    <Text dimColor> ({provider.models.length || "dynamic"})</Text>
                  </Box>
                );
              })}
              {filteredProviders.length === 0 && (
                <Text dimColor>No providers match filter</Text>
              )}
            </Box>
          </PanelContent>
        </Panel>

        {/* Right Pane - Provider Details */}
        <Panel>
          {selectedProvider ? (
            <ProviderDetails
              provider={selectedProvider}
              status={selectedStatus}
              actions={actions}
              focusedActionIndex={focusZone === "actions" ? actionIndex : -1}
            />
          ) : (
            <Box padding={2}>
              <Text dimColor>Select a provider</Text>
            </Box>
          )}
        </Panel>
      </SplitPane>

    </Box>
  );
}

interface ProviderDetailsProps {
  provider: { id: AIProvider; name: string; defaultModel: string; models: readonly string[] };
  status: ProviderStatus | undefined;
  actions: { id: string; label: string; enabled: boolean }[];
  focusedActionIndex: number;
}

function ProviderDetails({
  provider,
  status,
  actions,
  focusedActionIndex,
}: ProviderDetailsProps): ReactElement {
  const capabilities = PROVIDER_CAPABILITIES[provider.id];

  const capabilityChecks = [
    { label: "Tool Calling", value: capabilities.toolCalling.includes("Supported") },
    { label: "JSON Mode", value: capabilities.jsonMode.includes("Supported") },
    { label: "Streaming", value: capabilities.streaming.includes("Supported") || capabilities.streaming.includes("Native") },
    { label: "Multi-Provider", value: capabilities.capabilities.includes("MULTI-PROVIDER") },
  ];

  return (
    <>
      {/* Header */}
      <Box paddingX={1} marginBottom={1} gap={1}>
        <Text bold>{provider.name}</Text>
        {status?.isActive && <Badge text="ACTIVE" variant="success" />}
      </Box>

      <PanelContent>
        {/* Capabilities Grid */}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold dimColor>CAPABILITIES</Text>
          <Box flexDirection="column" marginLeft={1}>
            {capabilityChecks.map((cap) => (
              <Text key={cap.label} color={cap.value ? "green" : "gray"}>
                {cap.value ? "[x]" : "[ ]"} {cap.label}
              </Text>
            ))}
          </Box>
        </Box>

        {/* Cost Tier */}
        <Box marginBottom={1}>
          <Text dimColor>Cost Tier: </Text>
          <Badge
            text={capabilities.tierBadge}
            variant={capabilities.tierBadge === "FREE" ? "success" : "warning"}
          />
        </Box>

        <PanelDivider />

        {/* Status Section */}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold dimColor>STATUS</Text>
          <Box flexDirection="column" marginLeft={1}>
            <Box>
              <Text dimColor>API Key: </Text>
              <Text color={status?.hasApiKey ? "green" : "red"}>
                {status?.hasApiKey ? "Configured" : "Not Set"}
                {status?.hasApiKey ? " [x]" : " [ ]"}
              </Text>
            </Box>
            <Box>
              <Text dimColor>Model: </Text>
              <Text color={status?.model ? "white" : "gray"}>
                {status?.model ?? "Not Selected"}
              </Text>
            </Box>
            <Box>
              <Text dimColor>Context: </Text>
              <Text>{capabilities.contextWindow}</Text>
            </Box>
          </Box>
        </Box>

        <PanelDivider />

        {/* Action Buttons */}
        <Box flexDirection="column">
          <Text bold dimColor>ACTIONS</Text>
          <Box flexDirection="column" marginLeft={1} marginTop={1}>
            {actions.map((action, idx) => {
              const isFocused = focusedActionIndex === idx;
              const color = !action.enabled ? "gray" : isFocused ? "cyan" : "white";
              return (
                <Box key={action.id}>
                  <Text color={color} inverse={isFocused} dimColor={!action.enabled}>
                    {isFocused ? "> " : "  "}[ {action.label} ]
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>
      </PanelContent>
    </>
  );
}
