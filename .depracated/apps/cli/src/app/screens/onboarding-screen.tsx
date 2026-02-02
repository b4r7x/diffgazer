import React, { useState } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { AIProvider, GLMEndpoint, OpenRouterModel } from "@repo/schemas/config";
import { AVAILABLE_PROVIDERS } from "@repo/schemas/config";
import type { Theme, TrustConfig } from "@repo/schemas/settings";
import type { SaveConfigState } from "../../hooks/use-config.js";
import { TrustStep } from "../../components/wizard/trust-step.js";
import { ThemeStep } from "../../components/wizard/theme-step.js";
import { ProviderStep } from "../../components/wizard/provider-step.js";
import { GLMEndpointStep } from "../../components/wizard/glm-endpoint-step.js";
import { ModelStep } from "../../components/wizard/model-step.js";
import { SummaryStep } from "../../components/wizard/summary-step.js";

type WizardState =
  | { step: "trust" }
  | { step: "theme" }
  | { step: "provider" }
  | { step: "glm-endpoint"; provider: AIProvider }
  | { step: "model"; provider: AIProvider }
  | { step: "summary" }
  | { step: "complete" };

const TOTAL_STEPS = 5;

const DEFAULT_THEME: Theme = "auto";

interface OnboardingData {
  trustConfig: TrustConfig | null;
  theme: Theme;
  provider: AIProvider;
  model: string;
  glmEndpoint: GLMEndpoint;
}

interface ProviderConfig {
  provider: AIProvider;
  model?: string;
  hasApiKey: boolean;
}

interface OnboardingScreenProps {
  saveState: SaveConfigState;
  error?: { message: string } | null;
  configuredProviders?: ProviderConfig[];
  repoRoot?: string;
  projectId?: string;
  onSave: (provider: AIProvider, apiKey: string, model: string, glmEndpoint?: GLMEndpoint) => void;
  onSaveSettings?: (settings: {
    theme: Theme;
  }) => void;
  onSaveTrust?: (trust: TrustConfig) => void;
  onTestConnection?: () => Promise<boolean>;
  fetchOpenRouterModels?: () => Promise<OpenRouterModel[]>;
}

function getStepNumber(state: WizardState): number {
  switch (state.step) {
    case "trust":
      return 1;
    case "theme":
      return 2;
    case "provider":
      return 3;
    case "glm-endpoint":
      return 4;
    case "model":
      return 4;
    case "summary":
      return 5;
    case "complete":
      return 5;
  }
}

function getProviderInfo(providerId: AIProvider) {
  return AVAILABLE_PROVIDERS.find((p) => p.id === providerId) ?? AVAILABLE_PROVIDERS[0]!;
}

export function OnboardingScreen({
  saveState,
  error,
  configuredProviders = [],
  repoRoot = process.cwd(),
  projectId = "default",
  onSave,
  onSaveSettings,
  onSaveTrust,
  onTestConnection,
  fetchOpenRouterModels,
}: OnboardingScreenProps): React.ReactElement {
  const [state, setState] = useState<WizardState>({ step: "trust" });
  const [data, setData] = useState<OnboardingData>({
    trustConfig: null,
    theme: DEFAULT_THEME,
    provider: "gemini",
    model: "",
    glmEndpoint: "coding",
  });

  const currentProvider = getProviderInfo(data.provider);

  const goBack = () => {
    switch (state.step) {
      case "theme":
        setState({ step: "trust" });
        break;
      case "provider":
        setState({ step: "theme" });
        break;
      case "glm-endpoint":
        setState({ step: "provider" });
        break;
      case "model":
        if (data.provider === "glm") {
          setState({ step: "glm-endpoint", provider: data.provider });
        } else {
          setState({ step: "provider" });
        }
        break;
      case "summary":
        setState({ step: "model", provider: data.provider });
        break;
    }
  };

  const handleTrustComplete = (trust: TrustConfig) => {
    setData((prev) => ({ ...prev, trustConfig: trust }));
    if (onSaveTrust) {
      onSaveTrust(trust);
    }
    setState({ step: "theme" });
  };

  const handleTrustSkip = () => {
    setState({ step: "theme" });
  };

  const handleThemeSubmit = (theme: Theme) => {
    setData((prev) => ({ ...prev, theme }));
    setState({ step: "provider" });
  };

  const handleProviderSelect = (provider: AIProvider) => {
    const providerInfo = getProviderInfo(provider);
    setData((prev) => ({ ...prev, provider, model: providerInfo.defaultModel }));

    if (provider === "glm") {
      setState({ step: "glm-endpoint", provider });
    } else {
      setState({ step: "model", provider });
    }
  };

  const handleGLMEndpointSelect = (endpoint: GLMEndpoint) => {
    setData((prev) => ({ ...prev, glmEndpoint: endpoint }));
    setState({ step: "model", provider: data.provider });
  };

  const handleModelSelect = (model: string) => {
    setData((prev) => ({ ...prev, model }));
    setState({ step: "summary" });
  };

  const handleTestConnection = async (): Promise<boolean> => {
    if (onTestConnection) {
      return onTestConnection();
    }
    return true;
  };

  const handleComplete = () => {
    setState({ step: "complete" });
    if (onSaveSettings) {
      onSaveSettings({
        theme: data.theme,
      });
    }
    onSave(
      data.provider,
      "", // API key handled via env vars
      data.model,
      data.provider === "glm" ? data.glmEndpoint : undefined
    );
  };

  if (saveState === "saving") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Setup</Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Saving configuration...</Text>
        </Box>
      </Box>
    );
  }

  if (saveState === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Setup</Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="red">Error: {error?.message ?? "Failed to save configuration"}</Text>
          <Box marginTop={1}>
            <Text dimColor>Press any key to go back and try again.</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  if (state.step === "trust") {
    return (
      <TrustStep
        mode="onboarding"
        currentStep={getStepNumber(state)}
        totalSteps={TOTAL_STEPS}
        repoRoot={repoRoot}
        projectId={projectId}
        initialCapabilities={data.trustConfig?.capabilities}
        onComplete={handleTrustComplete}
        onSkip={handleTrustSkip}
        isActive
      />
    );
  }

  if (state.step === "theme") {
    return (
      <ThemeStep
        mode="onboarding"
        currentStep={getStepNumber(state)}
        totalSteps={TOTAL_STEPS}
        initialTheme={data.theme}
        onSubmit={handleThemeSubmit}
        onBack={goBack}
        isActive
      />
    );
  }

  if (state.step === "provider") {
    return (
      <ProviderStep
        mode="onboarding"
        currentStep={getStepNumber(state)}
        totalSteps={TOTAL_STEPS}
        configuredProviders={configuredProviders}
        onSelect={handleProviderSelect}
        onBack={goBack}
        isActive
      />
    );
  }

  if (state.step === "glm-endpoint") {
    return (
      <GLMEndpointStep
        mode="onboarding"
        currentStep={getStepNumber(state)}
        totalSteps={TOTAL_STEPS}
        initialEndpoint={data.glmEndpoint}
        onSelect={handleGLMEndpointSelect}
        onBack={goBack}
        isActive
      />
    );
  }

  if (state.step === "model") {
    return (
      <ModelStep
        mode="onboarding"
        currentStep={getStepNumber(state)}
        totalSteps={TOTAL_STEPS}
        provider={data.provider}
        providerName={currentProvider.name}
        initialModel={data.model}
        onSelect={handleModelSelect}
        onBack={goBack}
        isActive
        fetchOpenRouterModels={fetchOpenRouterModels}
      />
    );
  }

  return (
    <SummaryStep
      mode="onboarding"
      currentStep={getStepNumber(state)}
      totalSteps={TOTAL_STEPS}
      provider={data.provider}
      providerName={currentProvider.name}
      model={data.model}
      theme={data.theme}
      capabilities={data.trustConfig?.capabilities}
      directoryPath={repoRoot}
      onTestConnection={handleTestConnection}
      onComplete={handleComplete}
      onBack={goBack}
      isActive
    />
  );
}
