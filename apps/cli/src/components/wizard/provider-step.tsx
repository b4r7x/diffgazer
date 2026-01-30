import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import type { AIProvider } from "@repo/schemas/config";
import { AVAILABLE_PROVIDERS } from "@repo/schemas/config";
import { Badge, SelectList, type SelectOption } from "../ui/index.js";
import { WizardFrame } from "./wizard-frame.js";

type WizardMode = "onboarding" | "settings";

interface ProviderConfig {
  provider: AIProvider;
  model?: string;
  hasApiKey: boolean;
}

interface ProviderStepProps {
  mode: WizardMode;
  currentStep: number;
  totalSteps: number;
  configuredProviders: ProviderConfig[];
  onSelect: (provider: AIProvider) => void;
  onBack?: () => void;
  isActive?: boolean;
}

function ProviderBadge({
  isConfigured,
  isCurrentProvider,
}: {
  isConfigured: boolean;
  isCurrentProvider: boolean;
}): ReactElement | null {
  if (isCurrentProvider) {
    return <Badge text="Current" variant="info" />;
  }
  if (isConfigured) {
    return <Badge text="Configured" variant="success" />;
  }
  return <Badge text="Not Configured" variant="default" />;
}

function getProviderDescription(
  providerId: AIProvider,
  defaultModel: string,
  currentModel?: string
): string {
  if (currentModel) {
    return `Model: ${currentModel}`;
  }

  switch (providerId) {
    case "glm":
      return "Coding endpoint optimized for code review";
    case "openrouter":
      return "Access 400+ models from multiple providers";
    default:
      return `Default model: ${defaultModel}`;
  }
}

export function ProviderStep({
  mode,
  currentStep,
  totalSteps,
  configuredProviders,
  onSelect,
  onBack,
  isActive = true,
}: ProviderStepProps): ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const getProviderStatus = (providerId: AIProvider) => {
    const config = configuredProviders.find((c) => c.provider === providerId);
    return {
      isConfigured: config?.hasApiKey ?? false,
      isCurrentProvider: configuredProviders[0]?.provider === providerId,
      model: config?.model,
    };
  };

  const options: SelectOption<AIProvider>[] = AVAILABLE_PROVIDERS.map((provider) => {
    const status = getProviderStatus(provider.id);
    return {
      id: provider.id,
      label: provider.name,
      description: getProviderDescription(provider.id, provider.defaultModel, status.model),
      badge: (
        <ProviderBadge
          isConfigured={status.isConfigured}
          isCurrentProvider={status.isCurrentProvider}
        />
      ),
    };
  });

  useInput(
    (input) => {
      if (!isActive) return;

      if (input === "b" && onBack) {
        onBack();
      }
    },
    { isActive }
  );

  const footerText =
    mode === "onboarding"
      ? "Arrow keys to select, Enter to continue"
      : onBack
        ? "Arrow keys to select, Enter to configure, [b] Back"
        : "Arrow keys to select, Enter to configure";

  return (
    <WizardFrame
      mode={mode}
      currentStep={currentStep}
      totalSteps={totalSteps}
      stepTitle="Select AI Provider"
      footer={footerText}
      width="66%"
      centered
    >
      <Text dimColor>Choose an AI provider for code review:</Text>

      <Box marginTop={1}>
        <SelectList
          options={options}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onSubmit={(option) => onSelect(option.id)}
          isActive={isActive}
        />
      </Box>
    </WizardFrame>
  );
}
