import { useState, useEffect } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { AIProvider, GLMEndpoint, OpenRouterModel } from "@repo/schemas/config";
import { AVAILABLE_PROVIDERS } from "@repo/schemas/config";
import type { Theme, TrustCapabilities, TrustConfig, SettingsConfig } from "@repo/schemas/settings";
import type { Shortcut } from "@repo/schemas/ui";
import { SETTINGS_MENU_ITEMS, type SettingsAction } from "@repo/core";
import { DEFAULT_TRUST_CAPABILITIES } from "@repo/core";
import { Card, SelectList, type SelectOption } from "../../components/ui/index.js";
import { SplitPane } from "../../components/ui/layout/index.js";
import { useTerminalDimensions } from "../../hooks/index.js";
import { TrustStep } from "../../components/wizard/trust-step.js";
import { ThemeStep } from "../../components/wizard/theme-step.js";
import { ProviderStep } from "../../components/wizard/provider-step.js";
import { DiagnosticsStep } from "../../components/wizard/diagnostics-step.js";
import { ModelStep } from "../../components/wizard/model-step.js";
import { GLMEndpointStep } from "../../components/wizard/glm-endpoint-step.js";

export const SETTINGS_FOOTER_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "select" },
  { key: "Enter", label: "open" },
  { key: "d", label: "delete" },
  { key: "b", label: "back" },
];

type SettingsSection =
  | "list"
  | "trust"
  | "theme"
  | "provider"
  | "glm-endpoint"
  | "model"
  | "diagnostics";

interface ProviderConfig {
  provider: AIProvider;
  model?: string;
  hasApiKey: boolean;
}

interface SettingsScreenProps {
  provider: string;
  model?: string;
  settingsState: "idle" | "loading" | "success" | "error";
  deleteState: "idle" | "deleting" | "success" | "error";
  error?: { message: string } | null;
  settings?: SettingsConfig | null;
  projectId?: string;
  repoRoot?: string;
  currentCapabilities?: TrustCapabilities;
  configuredProviders?: ProviderConfig[];
  onDelete: () => void;
  onBack: () => void;
  onSaveTheme?: (theme: Theme) => void;
  onSaveTrust?: (capabilities: TrustCapabilities) => void;
  onSelectProvider?: (provider: AIProvider) => void;
  onSaveCredentials?: (apiKey: string, provider: AIProvider, model?: string, glmEndpoint?: GLMEndpoint) => void;
  onRunDiagnostics?: () => Promise<Array<{ id: string; success: boolean; message?: string }>>;
  fetchOpenRouterModels?: () => Promise<OpenRouterModel[]>;
}

type SectionId = Exclude<SettingsSection, "list">;

const SECTION_OPTIONS: SelectOption<SectionId>[] = SETTINGS_MENU_ITEMS.map((item) => ({
  id: item.id as SectionId,
  label: item.label,
  description: item.description,
}));

function SettingsLoading(): ReactElement {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center">
      <Box>
        <Spinner type="dots" />
        <Text> Loading settings...</Text>
      </Box>
    </Box>
  );
}

function SettingsError({
  message,
  errorDetail,
  onBack,
}: {
  message: string;
  errorDetail?: string;
  onBack: () => void;
}): ReactElement {
  useInput((input) => {
    if (input === "b") onBack();
  });

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center">
      <Box flexDirection="column">
        <Text color="red">{message}</Text>
        {errorDetail && <Text dimColor>{errorDetail}</Text>}
      </Box>
    </Box>
  );
}

function SettingsDeleting(): ReactElement {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center">
      <Box>
        <Spinner type="dots" />
        <Text> Deleting configuration...</Text>
      </Box>
    </Box>
  );
}

function SettingsDeleteSuccess(): ReactElement {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center">
      <Text color="green">Configuration deleted successfully.</Text>
    </Box>
  );
}

function SectionList({
  provider,
  model,
  selectedIndex,
  onSelectIndex,
  onSelectSection,
  onDelete,
  onBack,
}: {
  provider: string;
  model?: string;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onSelectSection: (section: SectionId) => void;
  onDelete: () => void;
  onBack: () => void;
}): ReactElement {
  const { isNarrow, columns } = useTerminalDimensions();

  useInput((input, key) => {
    if (key.return) {
      const section = SECTION_OPTIONS[selectedIndex];
      if (section) {
        onSelectSection(section.id);
      }
    }

    if (input === "d") {
      onDelete();
    }

    if (input === "b") {
      onBack();
    }
  });

  const leftPanelWidth = isNarrow ? undefined : Math.min(40, Math.floor(columns * 0.4));
  const rightPanelWidth = isNarrow ? undefined : Math.min(45, Math.floor(columns * 0.45));

  const configCard = (
    <Card title="Current Configuration">
      <Text>
        <Text dimColor>Provider: </Text>
        <Text>{provider}</Text>
      </Text>
      <Text>
        <Text dimColor>Model: </Text>
        <Text>{model ?? "Default"}</Text>
      </Text>
      <Text>
        <Text dimColor>API Key: </Text>
        <Text>{"*".repeat(10)}</Text>
      </Text>
    </Card>
  );

  const sectionsCard = (
    <Card title="Sections">
      <SelectList
        options={SECTION_OPTIONS}
        selectedIndex={selectedIndex}
        onSelect={onSelectIndex}
        isActive
      />
    </Card>
  );

  return (
    <SplitPane
      center={!isNarrow}
      leftWidth={leftPanelWidth}
      rightWidth={rightPanelWidth}
    >
      <Box flexDirection="column">
        {configCard}
      </Box>
      <Box flexDirection="column">
        {sectionsCard}
      </Box>
    </SplitPane>
  );
}

function DeleteConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}): ReactElement {
  useInput((input) => {
    if (input === "y") onConfirm();
    if (input === "n") onCancel();
  });

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center">
      <Box flexDirection="column" alignItems="center">
        <Text color="yellow">Are you sure you want to delete your configuration?</Text>
        <Text dimColor>This will remove your API key and all settings.</Text>
        <Box marginTop={1}>
          <Text dimColor>[y] Yes, delete  [n] No, cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}

export function SettingsScreen({
  provider,
  model,
  settingsState,
  deleteState,
  error,
  settings,
  projectId,
  repoRoot,
  currentCapabilities,
  configuredProviders = [],
  onDelete,
  onBack,
  onSaveTheme,
  onSaveTrust,
  onSelectProvider,
  onSaveCredentials,
  onRunDiagnostics,
  fetchOpenRouterModels,
}: SettingsScreenProps): ReactElement {
  const [section, setSection] = useState<SettingsSection>("list");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>("gemini");
  const [selectedEndpoint, setSelectedEndpoint] = useState<GLMEndpoint>("coding");
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (deleteState !== "success") return;
    const timer = setTimeout(onBack, 1500);
    return () => clearTimeout(timer);
  }, [deleteState, onBack]);

  const goToSection = (sectionId: SectionId) => {
    setSection(sectionId);
  };

  const goToList = () => {
    setSection("list");
  };

  const handleDeleteRequest = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    onDelete();
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const handleThemeSubmit = (theme: Theme) => {
    onSaveTheme?.(theme);
    goToList();
  };

  const handleTrustComplete = (trust: TrustConfig) => {
    onSaveTrust?.(trust.capabilities);
    goToList();
  };

  const handleTrustSkip = () => {
    goToList();
  };

  const handleProviderSelect = (providerSelection: AIProvider) => {
    setSelectedProvider(providerSelection);
    onSelectProvider?.(providerSelection);

    if (providerSelection === "glm") {
      setSection("glm-endpoint");
    } else {
      setSection("model");
    }
  };

  const handleGLMEndpointSelect = (endpoint: GLMEndpoint) => {
    setSelectedEndpoint(endpoint);
    setSection("model");
  };

  const handleModelSelect = (selectedModelValue: string) => {
    setSelectedModel(selectedModelValue);
    // Save provider and model selection directly (credentials handled via env vars)
    onSaveCredentials?.(
      "", // No API key needed - use env var
      selectedProvider,
      selectedModelValue,
      selectedProvider === "glm" ? selectedEndpoint : undefined
    );
    goToList();
  };

  if (settingsState === "loading") {
    return <SettingsLoading />;
  }

  if (settingsState === "error") {
    return (
      <SettingsError
        message="Failed to load settings"
        errorDetail={error?.message}
        onBack={onBack}
      />
    );
  }

  if (deleteState === "deleting") {
    return <SettingsDeleting />;
  }

  if (deleteState === "success") {
    return <SettingsDeleteSuccess />;
  }

  if (deleteState === "error") {
    return (
      <SettingsError
        message="Failed to delete configuration"
        errorDetail={error?.message}
        onBack={onBack}
      />
    );
  }

  if (showDeleteConfirm) {
    return <DeleteConfirm onConfirm={handleDeleteConfirm} onCancel={handleDeleteCancel} />;
  }

  if (section === "trust") {
    return (
      <TrustStep
        mode="settings"
        currentStep={1}
        totalSteps={1}
        repoRoot={repoRoot ?? process.cwd()}
        projectId={projectId ?? "default"}
        initialCapabilities={currentCapabilities ?? DEFAULT_TRUST_CAPABILITIES}
        onComplete={handleTrustComplete}
        onSkip={handleTrustSkip}
        onBack={goToList}
        isActive
      />
    );
  }

  if (section === "theme") {
    return (
      <ThemeStep
        mode="settings"
        currentStep={1}
        totalSteps={1}
        initialTheme={settings?.theme ?? "auto"}
        onSubmit={handleThemeSubmit}
        onBack={goToList}
        isActive
      />
    );
  }

  if (section === "provider") {
    return (
      <ProviderStep
        mode="settings"
        currentStep={1}
        totalSteps={1}
        configuredProviders={configuredProviders}
        onSelect={handleProviderSelect}
        onBack={goToList}
        isActive
      />
    );
  }

  if (section === "glm-endpoint") {
    return (
      <GLMEndpointStep
        mode="settings"
        currentStep={1}
        totalSteps={3}
        initialEndpoint={selectedEndpoint}
        onSelect={handleGLMEndpointSelect}
        onBack={() => setSection("provider")}
        isActive
      />
    );
  }

  if (section === "model") {
    const currentProviderInfo = AVAILABLE_PROVIDERS.find((p) => p.id === selectedProvider);

    return (
      <ModelStep
        mode="settings"
        currentStep={selectedProvider === "glm" ? 2 : 1}
        totalSteps={selectedProvider === "glm" ? 3 : 2}
        provider={selectedProvider}
        providerName={currentProviderInfo?.name ?? selectedProvider}
        initialModel={selectedModel}
        onSelect={handleModelSelect}
        onBack={() => selectedProvider === "glm" ? setSection("glm-endpoint") : setSection("provider")}
        isActive
        fetchOpenRouterModels={selectedProvider === "openrouter" ? fetchOpenRouterModels : undefined}
      />
    );
  }

  if (section === "diagnostics") {
    return (
      <DiagnosticsStep
        mode="settings"
        currentStep={1}
        totalSteps={1}
        onBack={goToList}
        onRunDiagnostics={onRunDiagnostics}
        isActive
      />
    );
  }

  return (
    <SectionList
      provider={provider}
      model={model}
      selectedIndex={selectedIndex}
      onSelectIndex={setSelectedIndex}
      onSelectSection={goToSection}
      onDelete={handleDeleteRequest}
      onBack={onBack}
    />
  );
}
