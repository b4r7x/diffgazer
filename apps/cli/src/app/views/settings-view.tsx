import { useEffect } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { AIProvider } from "@repo/schemas/config";
import type { Theme, TrustCapabilities, TrustConfig } from "@repo/schemas/settings";
import { useSettingsState } from "../../features/settings/index.js";
import { SettingsScreen } from "../screens/settings-screen.js";

interface SettingsViewProps {
  projectId: string;
  repoRoot: string;
  onBack: () => void;
  onDeleteProvider?: (provider: AIProvider) => void;
}

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

export function SettingsView({
  projectId,
  repoRoot,
  onBack,
  onDeleteProvider,
}: SettingsViewProps): ReactElement {
  const state = useSettingsState(projectId);

  useEffect(() => {
    state.loadAll();
  }, []);

  if (state.isLoading) {
    return <SettingsLoading />;
  }

  const handleSaveTheme = async (theme: Theme) => {
    await state.saveTheme(theme);
  };

  const handleSaveTrust = async (capabilities: TrustCapabilities) => {
    const trustConfig: TrustConfig = {
      projectId,
      repoRoot,
      trustedAt: new Date().toISOString(),
      capabilities,
      trustMode: state.trust?.trustMode ?? "persistent",
    };
    await state.saveTrust(trustConfig);
  };

  const handleSaveCredentials = async (apiKey: string, provider: AIProvider) => {
    await state.saveCredentials(provider, apiKey);
  };

  const handleDeleteConfig = async () => {
    await state.deleteConfig();
  };

  const handleDeleteProvider = (provider: AIProvider) => {
    onDeleteProvider?.(provider);
  };

  const configuredProviders = state.providerStatus.map((p) => ({
    provider: p.provider,
    model: p.model,
    hasApiKey: p.hasApiKey,
  }));

  return (
    <Box flexDirection="column" marginTop={1}>
      <SettingsScreen
        provider={state.config?.provider ?? "Not configured"}
        model={state.config?.model}
        settingsState={state.isLoading ? "loading" : "success"}
        deleteState={state.isSaving ? "deleting" : "idle"}
        error={state.error}
        settings={state.settings}
        projectId={projectId}
        repoRoot={repoRoot}
        currentCapabilities={state.trust?.capabilities}
        configuredProviders={configuredProviders}
        onDelete={handleDeleteConfig}
        onDeleteProvider={handleDeleteProvider}
        onBack={onBack}
        onSaveTheme={handleSaveTheme}
        onSaveTrust={handleSaveTrust}
        onSaveCredentials={handleSaveCredentials}
      />
    </Box>
  );
}
