import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import type { SaveConfigState } from "../../hooks/use-config.js";
import { GEMINI_MODEL_INFO } from "@repo/schemas/config";

type Step = "provider" | "model" | "apiKey";

interface OnboardingScreenProps {
  saveState: SaveConfigState;
  error?: { message: string } | null;
  onSave: (provider: string, apiKey: string, model: string) => void;
}

const PROVIDERS = [
  { id: "gemini", name: "Google Gemini" },
] as const;

const getProvider = (index: number) => PROVIDERS[index] ?? PROVIDERS[0];
const DEFAULT_MODEL_ID = "gemini-2.5-flash";

const MODELS = Object.values(GEMINI_MODEL_INFO);

export function OnboardingScreen({
  saveState,
  error,
  onSave,
}: OnboardingScreenProps): React.ReactElement {
  const [step, setStep] = useState<Step>("provider");
  const [selectedProvider, setSelectedProvider] = useState(0);
  const [selectedModel, setSelectedModel] = useState(
    Math.max(0, MODELS.findIndex((m) => m.recommended))
  );
  const [apiKey, setApiKey] = useState("");

  useInput((input, key) => {
    if (saveState === "saving") return;

    if (step === "provider") {
      if (key.upArrow && selectedProvider > 0) {
        setSelectedProvider(selectedProvider - 1);
      }
      if (key.downArrow && selectedProvider < PROVIDERS.length - 1) {
        setSelectedProvider(selectedProvider + 1);
      }
      if (key.return) {
        setStep("model");
      }
    }

    if (step === "model") {
      if (key.upArrow && selectedModel > 0) {
        setSelectedModel(selectedModel - 1);
      }
      if (key.downArrow && selectedModel < MODELS.length - 1) {
        setSelectedModel(selectedModel + 1);
      }
      if (key.return) {
        setStep("apiKey");
      }
      if (input === "b") {
        setStep("provider");
      }
    }

    if (step === "apiKey" && saveState === "error") {
      if (input === "r") {
        const model = MODELS[selectedModel];
        onSave(getProvider(selectedProvider).id, apiKey, model?.id ?? DEFAULT_MODEL_ID);
      }
      if (input === "b") {
        setStep("model");
      }
    }
  });

  const handleApiKeySubmit = (value: string) => {
    if (value.trim()) {
      const model = MODELS[selectedModel];
      onSave(getProvider(selectedProvider).id, value.trim(), model?.id ?? DEFAULT_MODEL_ID);
    }
  };

  if (saveState === "saving") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Stargazer Setup</Text>
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
        <Text bold color="cyan">Stargazer Setup</Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="red">Error: {error?.message ?? "Failed to save configuration"}</Text>
          <Box marginTop={1}>
            <Text dimColor>[r] Retry  [b] Back</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Stargazer Setup</Text>
      <Text dimColor>Configure your AI provider to get started.</Text>

      {step === "provider" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Step 1: Select AI Provider</Text>
          <Box flexDirection="column" marginTop={1}>
            {PROVIDERS.map((provider, index) => (
              <Text key={provider.id}>
                {selectedProvider === index ? (
                  <Text color="green">{"> "}</Text>
                ) : (
                  "  "
                )}
                {provider.name}
              </Text>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Use arrow keys to select, Enter to continue</Text>
          </Box>
        </Box>
      )}

      {step === "model" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Step 2: Select Model</Text>
          <Text dimColor>Provider: {getProvider(selectedProvider).name}</Text>
          <Box flexDirection="column" marginTop={1}>
            {MODELS.map((model, index) => (
              <Box key={model.id} flexDirection="column">
                <Text>
                  {selectedModel === index ? (
                    <Text color="green">{"> "}</Text>
                  ) : (
                    "  "
                  )}
                  <Text bold={model.recommended}>{model.name}</Text>
                  {model.recommended && <Text color="yellow"> (Recommended)</Text>}
                  {model.tier === "paid" && <Text color="red"> [Paid]</Text>}
                  {model.tier === "free" && <Text color="green"> [Free]</Text>}
                </Text>
                {selectedModel === index && (
                  <Text dimColor>    {model.description}</Text>
                )}
              </Box>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Use arrow keys to select, Enter to continue, [b] Back</Text>
          </Box>
        </Box>
      )}

      {step === "apiKey" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Step 3: Enter API Key</Text>
          <Text dimColor>Provider: {getProvider(selectedProvider).name}</Text>
          <Text dimColor>Model: {MODELS[selectedModel]?.name ?? "Unknown"}</Text>
          <Box marginTop={1}>
            <Text>API Key: </Text>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={handleApiKeySubmit}
              mask="*"
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to save, [b] Back</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
