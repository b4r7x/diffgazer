import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { AIProvider } from "@repo/schemas/config";
import type { Theme, ControlsMode, TrustCapabilities } from "@repo/schemas/settings";
import { Badge } from "../ui/index.js";
import { WizardFrame } from "./wizard-frame.js";

type WizardMode = "onboarding" | "settings";
type ConnectionStatus = "idle" | "testing" | "success" | "error";

interface SummaryStepProps {
  mode: WizardMode;
  currentStep: number;
  totalSteps: number;
  provider: AIProvider;
  providerName: string;
  model?: string;
  theme: Theme;
  controlsMode: ControlsMode;
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
  controlsMode,
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

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (input === "t" && connectionStatus !== "testing") {
        handleTestConnection();
      }

      if (key.return && connectionStatus !== "testing") {
        onComplete();
      }

      if (input === "b" && onBack && connectionStatus !== "testing") {
        onBack();
      }
    },
    { isActive }
  );

  const footerText =
    mode === "onboarding"
      ? "[t] Test Connection, Enter to finish setup"
      : onBack
        ? "[t] Test Connection, Enter to save, [b] Back"
        : "[t] Test Connection, Enter to save";

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
            <Text>
              <Text dimColor>Controls: </Text>
              {controlsMode === "menu" ? "Menu Mode" : "Key Mode"}
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
