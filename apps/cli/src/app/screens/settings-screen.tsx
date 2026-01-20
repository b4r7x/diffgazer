import { useState, useEffect } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";

interface SettingsScreenProps {
  provider: string;
  model?: string;
  settingsState: "idle" | "loading" | "success" | "error";
  deleteState: "idle" | "deleting" | "success" | "error";
  error?: { message: string } | null;
  onDelete: () => void;
  onBack: () => void;
}

export function SettingsScreen({
  provider,
  model,
  settingsState,
  deleteState,
  error,
  onDelete,
  onBack,
}: SettingsScreenProps): ReactElement {
  const [step, setStep] = useState<"view" | "confirm_delete">("view");

  useEffect(() => {
    if (deleteState !== "success") return;
    const timer = setTimeout(onBack, 1500);
    return () => clearTimeout(timer);
  }, [deleteState, onBack]);

  useInput((input) => {
    if (deleteState === "deleting") return;

    if (deleteState === "error") {
      if (input === "r") onDelete();
      if (input === "b") onBack();
      return;
    }

    if (step === "view") {
      if (input === "d") setStep("confirm_delete");
      if (input === "b") onBack();
      return;
    }

    if (step === "confirm_delete") {
      if (input === "y") onDelete();
      if (input === "n") setStep("view");
    }
  });

  if (settingsState === "loading") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Stargazer Settings</Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Loading settings...</Text>
        </Box>
      </Box>
    );
  }

  if (settingsState === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Stargazer Settings</Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="red">Error: Failed to load settings</Text>
          {error?.message && (
            <Text color="red" dimColor>({error.message})</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>[b] Back</Text>
        </Box>
      </Box>
    );
  }

  if (deleteState === "deleting") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Stargazer Settings</Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Deleting configuration...</Text>
        </Box>
      </Box>
    );
  }

  if (deleteState === "success") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Stargazer Settings</Text>
        <Box marginTop={1}>
          <Text color="green">Configuration deleted successfully.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Returning to setup...</Text>
        </Box>
      </Box>
    );
  }

  if (deleteState === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Stargazer Settings</Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="red">Error: Failed to delete configuration</Text>
          {error?.message && (
            <Text color="red" dimColor>({error.message})</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>[r] Retry  [b] Back</Text>
        </Box>
      </Box>
    );
  }

  if (step === "confirm_delete") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Stargazer Settings</Text>
        <Text dimColor>{"─".repeat(20)}</Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow">Are you sure you want to delete your configuration?</Text>
          <Text dimColor>This will remove your API key and provider settings.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>[y] Yes, delete  [n] No, cancel</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Stargazer Settings</Text>
      <Text dimColor>{"─".repeat(20)}</Text>

      <Box flexDirection="column" marginTop={1}>
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
          <Text>{"•".repeat(10)}</Text>
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>[d] Delete Configuration  [b] Back</Text>
      </Box>
    </Box>
  );
}
