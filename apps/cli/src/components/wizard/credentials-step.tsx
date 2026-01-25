import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { AIProvider } from "@repo/schemas/config";
import { Badge, SelectList, type SelectOption } from "../ui/index.js";
import { WizardFrame } from "./wizard-frame.js";

type WizardMode = "onboarding" | "settings";
type InputMethod = "existing" | "env" | "manual";
type CredentialAction = InputMethod | "remove";

interface CredentialsStepProps {
  mode: WizardMode;
  currentStep: number;
  totalSteps: number;
  provider: AIProvider;
  providerName: string;
  envVarName: string;
  envVarValue?: string;
  hasKeyringKey?: boolean;
  onSubmit: (apiKey: string, method: InputMethod) => void;
  onRemove?: () => void;
  onBack?: () => void;
  isActive?: boolean;
}

function buildMethodOptions(
  hasKeyringKey: boolean,
  hasEnvVar: boolean,
  envVarName: string,
  showRemoveOption: boolean
): SelectOption<CredentialAction>[] {
  const options: SelectOption<CredentialAction>[] = [];

  if (hasKeyringKey) {
    options.push({
      id: "existing",
      label: "Use Existing Key",
      description: "API key found in secure storage",
      badge: <Badge text="Configured" variant="success" />,
    });
  }

  options.push({
    id: "env",
    label: "Use Environment Variable",
    description: hasEnvVar
      ? `Found: ${envVarName} is set`
      : `${envVarName} not set`,
    badge: hasEnvVar ? <Badge text="Found" variant="success" /> : undefined,
  });

  options.push({
    id: "manual",
    label: "Enter Manually",
    description: "Enter API key directly",
  });

  if (showRemoveOption && hasKeyringKey) {
    options.push({
      id: "remove",
      label: "Remove Credentials",
      description: "Delete saved API key from secure storage",
      badge: <Badge text="Danger" variant="error" />,
    });
  }

  return options;
}

export function CredentialsStep({
  mode,
  currentStep,
  totalSteps,
  provider,
  providerName,
  envVarName,
  envVarValue,
  hasKeyringKey = false,
  onSubmit,
  onRemove,
  onBack,
  isActive = true,
}: CredentialsStepProps): ReactElement {
  const [selectedMethod, setSelectedMethod] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [apiKey, setApiKey] = useState("");

  const hasEnvVar = Boolean(envVarValue);
  const showRemoveOption = mode === "settings" && Boolean(onRemove);
  const methodOptions = buildMethodOptions(hasKeyringKey, hasEnvVar, envVarName, showRemoveOption);
  const currentMethod = methodOptions[selectedMethod]?.id ?? "env";

  const handleMethodSelect = (option: SelectOption<CredentialAction>) => {
    if (option.id === "existing") {
      onSubmit("", "existing");
    } else if (option.id === "env") {
      if (hasEnvVar) {
        onSubmit(envVarValue!, "env");
      } else {
        setShowInput(true);
      }
    } else if (option.id === "remove") {
      setShowRemoveConfirm(true);
    } else {
      setShowInput(true);
    }
  };

  const handleApiKeySubmit = (value: string) => {
    if (value.trim() && currentMethod !== "remove") {
      onSubmit(value.trim(), currentMethod);
    }
  };

  const handleRemoveConfirm = () => {
    if (onRemove) {
      onRemove();
    }
    setShowRemoveConfirm(false);
  };

  const handleRemoveCancel = () => {
    setShowRemoveConfirm(false);
  };

  useInput(
    (input) => {
      if (!isActive) return;

      if (showRemoveConfirm) {
        if (input === "y") {
          handleRemoveConfirm();
        } else if (input === "n") {
          handleRemoveCancel();
        }
        return;
      }

      if (input === "b") {
        if (showInput) {
          setShowInput(false);
          setApiKey("");
        } else if (onBack) {
          onBack();
        }
      }
    },
    { isActive }
  );

  const footerText = showRemoveConfirm
    ? "[y] Yes, remove  [n] No, cancel"
    : showInput
      ? "Enter API key and press Enter, [b] Back"
      : onBack
        ? "Arrow keys to select, Enter to continue, [b] Back"
        : "Arrow keys to select, Enter to continue";

  return (
    <WizardFrame
      mode={mode}
      currentStep={currentStep}
      totalSteps={totalSteps}
      stepTitle="API Credentials"
      footer={footerText}
    >
      <Box marginBottom={1}>
        <Text dimColor>Provider: </Text>
        <Text bold>{providerName}</Text>
      </Box>

      {showRemoveConfirm ? (
        <Box flexDirection="column">
          <Text color="yellow">Are you sure you want to remove credentials for {providerName}?</Text>
          <Text dimColor>This will delete the API key from secure storage.</Text>
        </Box>
      ) : !showInput ? (
        <Box flexDirection="column">
          <Text dimColor>How would you like to provide your API key?</Text>
          <Box marginTop={1}>
            <SelectList
              options={methodOptions}
              selectedIndex={selectedMethod}
              onSelect={setSelectedMethod}
              onSubmit={handleMethodSelect}
              isActive={isActive && !showRemoveConfirm}
            />
          </Box>

          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Environment variable: {envVarName}</Text>
            {hasEnvVar ? (
              <Text color="green">Status: Found</Text>
            ) : (
              <Text color="yellow">Status: Not set</Text>
            )}
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text dimColor>
            {currentMethod === "env" && !hasEnvVar
              ? `Set ${envVarName} in your shell profile, or enter key below:`
              : "Enter your API key:"}
          </Text>
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
            <Text dimColor>
              Your API key will be stored securely in the local configuration.
            </Text>
          </Box>
        </Box>
      )}
    </WizardFrame>
  );
}
