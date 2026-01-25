import { useState, useEffect } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { AIProvider, GLMEndpoint, OpenRouterModel } from "@repo/schemas/config";
import { AVAILABLE_PROVIDERS } from "@repo/schemas/config";
import type { Theme, ControlsMode, TrustCapabilities, TrustConfig, SettingsConfig } from "@repo/schemas/settings";
import { Card, SelectList, type SelectOption } from "../../components/ui/index.js";
import { TrustStep } from "../../components/wizard/trust-step.js";
import { ThemeStep } from "../../components/wizard/theme-step.js";
import { ProviderStep } from "../../components/wizard/provider-step.js";
import { CredentialsStep } from "../../components/wizard/credentials-step.js";
import { ControlsStep } from "../../components/wizard/controls-step.js";
import { DiagnosticsStep } from "../../components/wizard/diagnostics-step.js";
import { ModelStep } from "../../components/wizard/model-step.js";
import { GLMEndpointStep } from "../../components/wizard/glm-endpoint-step.js";

type SettingsSection =
  | "list"
  | "trust"
  | "theme"
  | "provider"
  | "glm-endpoint"
  | "model"
  | "credentials"
  | "controls"
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
  deleteProviderState?: "idle" | "deleting" | "success" | "error";
  error?: { message: string } | null;
  settings?: SettingsConfig | null;
  projectId?: string;
  repoRoot?: string;
  currentCapabilities?: TrustCapabilities;
  configuredProviders?: ProviderConfig[];
  onDelete: () => void;
  onDeleteProvider?: (provider: AIProvider) => void;
  onBack: () => void;
  onSaveTheme?: (theme: Theme) => void;
  onSaveControls?: (controlsMode: ControlsMode) => void;
  onSaveTrust?: (capabilities: TrustCapabilities) => void;
  onSelectProvider?: (provider: AIProvider) => void;
  onSaveCredentials?: (apiKey: string, provider: AIProvider, model?: string, glmEndpoint?: GLMEndpoint) => void;
  onRunDiagnostics?: () => Promise<Array<{ id: string; success: boolean; message?: string }>>;
  fetchOpenRouterModels?: () => Promise<OpenRouterModel[]>;
}

type SectionId = Exclude<SettingsSection, "list">;

const SECTION_OPTIONS: SelectOption<SectionId>[] = [
  {
    id: "trust",
    label: "Trust",
    description: "Manage directory trust and capabilities",
  },
  {
    id: "theme",
    label: "Theme",
    description: "Change color theme preferences",
  },
  {
    id: "provider",
    label: "Provider",
    description: "Select AI provider for code review",
  },
  {
    id: "credentials",
    label: "Credentials",
    description: "Manage API keys and authentication",
  },
  {
    id: "controls",
    label: "Controls",
    description: "Configure navigation and input mode",
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    description: "Run system health checks",
  },
];

const PROVIDER_ENV_VARS: Record<AIProvider, string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  glm: "GLM_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

function getEnvVarForProvider(provider: AIProvider): { name: string; value: string | undefined } {
  const primaryName = PROVIDER_ENV_VARS[provider];
  const primaryValue = process.env[primaryName];

  // GLM supports ZHIPU_API_KEY as fallback
  if (provider === "glm" && !primaryValue) {
    const fallbackValue = process.env["ZHIPU_API_KEY"];
    if (fallbackValue) {
      return { name: "ZHIPU_API_KEY", value: fallbackValue };
    }
  }

  return { name: primaryName, value: primaryValue };
}

const DEFAULT_CAPABILITIES: TrustCapabilities = {
  readFiles: true,
  readGit: true,
  runCommands: false,
};

function SettingsLoading(): ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Settings</Text>
      <Box marginTop={1}>
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
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Settings</Text>
      <Box marginTop={1} flexDirection="column">
        <Text color="red">{message}</Text>
        {errorDetail && <Text dimColor>{errorDetail}</Text>}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>[b] Back</Text>
      </Box>
    </Box>
  );
}

function SettingsDeleting(): ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Settings</Text>
      <Box marginTop={1}>
        <Spinner type="dots" />
        <Text> Deleting configuration...</Text>
      </Box>
    </Box>
  );
}

function SettingsDeleteSuccess(): ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Settings</Text>
      <Box marginTop={1}>
        <Text color="green">Configuration deleted successfully.</Text>
      </Box>
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

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Settings</Text>

      <Box marginTop={1} flexDirection="row" gap={2}>
        <Box flexDirection="column" width={45}>
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

          <Box marginTop={1}>
            <Card title="Sections">
              <SelectList
                options={SECTION_OPTIONS}
                selectedIndex={selectedIndex}
                onSelect={onSelectIndex}
                isActive
              />
            </Card>
          </Box>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Arrow keys to select, Enter to open  [d] Delete Config  [b] Back</Text>
      </Box>
    </Box>
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
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Settings</Text>
      <Box marginTop={1} flexDirection="column">
        <Text color="yellow">Are you sure you want to delete your configuration?</Text>
        <Text dimColor>This will remove your API key and all settings.</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>[y] Yes, delete  [n] No, cancel</Text>
      </Box>
    </Box>
  );
}

export function SettingsScreen({
  provider,
  model,
  settingsState,
  deleteState,
  deleteProviderState,
  error,
  settings,
  projectId,
  repoRoot,
  currentCapabilities,
  configuredProviders = [],
  onDelete,
  onDeleteProvider,
  onBack,
  onSaveTheme,
  onSaveControls,
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

  const handleControlsSubmit = (controlsMode: ControlsMode) => {
    onSaveControls?.(controlsMode);
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
    setSection("credentials");
  };

  const handleCredentialsSubmit = (apiKey: string) => {
    onSaveCredentials?.(
      apiKey,
      selectedProvider,
      selectedModel,
      selectedProvider === "glm" ? selectedEndpoint : undefined
    );
    goToList();
  };

  const handleRemoveCredentials = () => {
    onDeleteProvider?.(selectedProvider);
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
        initialCapabilities={currentCapabilities ?? DEFAULT_CAPABILITIES}
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

  if (section === "credentials") {
    const currentProviderInfo = AVAILABLE_PROVIDERS.find((p) => p.id === selectedProvider);
    const { name: envVarName, value: envVarValue } = getEnvVarForProvider(selectedProvider);
    const providerConfig = configuredProviders.find((p) => p.provider === selectedProvider);
    const hasKeyringKey = providerConfig?.hasApiKey ?? false;

    return (
      <CredentialsStep
        mode="settings"
        currentStep={selectedProvider === "glm" ? 3 : 2}
        totalSteps={selectedProvider === "glm" ? 3 : 2}
        provider={selectedProvider}
        providerName={currentProviderInfo?.name ?? selectedProvider}
        envVarName={envVarName}
        envVarValue={envVarValue}
        hasKeyringKey={hasKeyringKey}
        onSubmit={handleCredentialsSubmit}
        onRemove={onDeleteProvider ? handleRemoveCredentials : undefined}
        onBack={() => setSection("model")}
        isActive
      />
    );
  }

  if (section === "controls") {
    return (
      <ControlsStep
        mode="settings"
        currentStep={1}
        totalSteps={1}
        initialControlsMode={settings?.controlsMode ?? "menu"}
        onSubmit={handleControlsSubmit}
        onBack={goToList}
        isActive
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
