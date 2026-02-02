import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { AIProvider } from "@repo/schemas/config";
import type { Theme, TrustCapabilities } from "@repo/schemas/settings";
import { Badge } from "../ui/index.js";
import { WizardFrame } from "./wizard-frame.js";
import type { WizardMode } from "../../types/index.js";
import { useWizardNavigation } from "../../hooks/index.js";
type ConnectionStatus = "idle" | "testing" | "success" | "error";

interface SummaryStepProps {
  mode: WizardMode;
  currentStep: number;
  totalSteps: number;
  provider: AIProvider;
  providerName: string;
  model?: string;
  theme: Theme;
  capabilities?: TrustCapabilities;
  directoryPath?: string;
  onTestConnection: () => Promise<boolean>;
  onComplete: () => void;
  onBack?: () => void;
  isActive?: boolean;
}

function CapabilitiesSummary({
  capabilities,
}: {
  capabilities: TrustCapabilities;
}): ReactElement {
  return (
    <Box flexDirection="column">
      <Text dimColor>Capabilities:</Text>
      <Box marginLeft={2} flexDirection="column">
        <Text>
          Read Files:{" "}
          <Text color={capabilities.readFiles ? "green" : "red"}>
            {capabilities.readFiles ? "Enabled" : "Disabled"}
          </Text>
        </Text>
        <Text>
          Read Git:{" "}
          <Text color={capabilities.readGit ? "green" : "red"}>
            {capabilities.readGit ? "Enabled" : "Disabled"}
          </Text>
        </Text>
        <Text>
          Run Commands:{" "}
          <Text color={capabilities.runCommands ? "green" : "red"}>
            {capabilities.runCommands ? "Enabled" : "Disabled"}
          </Text>
        </Text>
      </Box>
    </Box>
  );
}

function ConnectionStatusDisplay({
  status,
  error,
}: {
  status: ConnectionStatus;
  error?: string;
}): ReactElement {
  switch (status) {
    case "idle":
      return <Text dimColor>Press [t] to test connection</Text>;
    case "testing":
      return (
        <Box>
          <Spinner type="dots" />
          <Text> Testing connection...</Text>
        </Box>
      );
    case "success":
      return <Text color="green">Connection successful</Text>;
    case "error":
      return (
        <Box flexDirection="column">
          <Text color="red">Connection failed</Text>
          {error && <Text dimColor>{error}</Text>}
        </Box>
      );
  }
}

export function SummaryStep({
  mode,
  currentStep,
  totalSteps,
  provider,
  providerName,
  model,
  theme,
  capabilities,
  directoryPath,
  onTestConnection,
  onComplete,
  onBack,
  isActive = true,
}: SummaryStepProps): ReactElement {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionError, setConnectionError] = useState<string>();

  const handleTestConnection = async () => {
    setConnectionStatus("testing");
    setConnectionError(undefined);

    try {
      const success = await onTestConnection();
      setConnectionStatus(success ? "success" : "error");
      if (!success) {
        setConnectionError("Failed to connect to AI provider");
      }
    } catch (err) {
      setConnectionStatus("error");
      setConnectionError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const isTesting = connectionStatus === "testing";

  useWizardNavigation({
    onBack: isTesting ? undefined : onBack,
    isActive,
    onInput: (input, key) => {
      if (isTesting) return;

      if (input === "t") {
        void handleTestConnection();
      }

      if (key.return) {
        onComplete();
      }
    },
  });

  const action = mode === "onboarding" ? "finish setup" : "save";
  const backHint = onBack ? ", [b] Back" : "";
  const footerText = `[t] Test Connection, Enter to ${action}${backHint}`;

  return (
    <WizardFrame
      mode={mode}
      currentStep={currentStep}
      totalSteps={totalSteps}
      stepTitle="Configuration Summary"
      footer={footerText}
    >
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>AI Provider</Text>
          <Box marginLeft={2} flexDirection="column">
            <Text>
              <Text dimColor>Provider: </Text>
              {providerName}
            </Text>
            <Text>
              <Text dimColor>Model: </Text>
              {model ?? "Default"}
            </Text>
            <Text>
              <Text dimColor>API Key: </Text>
              {"*".repeat(10)}
            </Text>
          </Box>
        </Box>

        <Box flexDirection="column">
          <Text bold>Preferences</Text>
          <Box marginLeft={2} flexDirection="column">
            <Text>
              <Text dimColor>Theme: </Text>
              {theme}
            </Text>
          </Box>
        </Box>

        {capabilities && directoryPath && (
          <Box flexDirection="column">
            <Text bold>Directory Trust</Text>
            <Box marginLeft={2} flexDirection="column">
              <Text>
                <Text dimColor>Path: </Text>
                {directoryPath}
              </Text>
              <CapabilitiesSummary capabilities={capabilities} />
            </Box>
          </Box>
        )}

        <Box
          marginTop={1}
          borderStyle="single"
          borderColor="gray"
          paddingX={2}
          paddingY={1}
          flexDirection="column"
        >
          <Text bold>Connection Test</Text>
          <Box marginTop={1}>
            <ConnectionStatusDisplay status={connectionStatus} error={connectionError} />
          </Box>
        </Box>
      </Box>
    </WizardFrame>
  );
}
