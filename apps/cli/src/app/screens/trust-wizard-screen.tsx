import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { TrustCapabilities, TrustConfig } from "@repo/schemas/settings";
import { ToggleList, type ToggleOption } from "../../components/ui/index.js";

type TrustAction = "persist" | "once" | "exit";

type CapabilityKey = keyof TrustCapabilities;

const CAPABILITY_OPTIONS: {
  id: CapabilityKey;
  label: string;
  description: string;
}[] = [
  {
    id: "readFiles",
    label: "Allow reading repository files",
    description: "Read source code and other files in this directory",
  },
  {
    id: "readGit",
    label: "Allow reading git metadata",
    description: "Read git history, branches, and diff information",
  },
  {
    id: "runCommands",
    label: "Allow running commands",
    description: "Run shell commands for analysis (e.g., linters, tests)",
  },
];

const DEFAULT_CAPABILITIES: TrustCapabilities = {
  readFiles: true,
  readGit: true,
  runCommands: false,
};

interface TrustWizardScreenProps {
  projectId: string;
  repoRoot: string;
  onComplete: (config: TrustConfig) => void;
}

export function TrustWizardScreen({
  projectId,
  repoRoot,
  onComplete,
}: TrustWizardScreenProps): React.ReactElement {
  const { exit } = useApp();
  const [capabilities, setCapabilities] = useState<TrustCapabilities>(DEFAULT_CAPABILITIES);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actionIndex, setActionIndex] = useState(0);
  const [focusArea, setFocusArea] = useState<"capabilities" | "actions">("capabilities");

  const toggleOptions: ToggleOption<CapabilityKey>[] = CAPABILITY_OPTIONS.map((opt) => ({
    id: opt.id,
    label: opt.label,
    description: opt.description,
    enabled: capabilities[opt.id],
  }));

  const actions: { id: TrustAction; label: string }[] = [
    { id: "persist", label: "Trust & Continue" },
    { id: "once", label: "Trust Once" },
    { id: "exit", label: "No, Exit" },
  ];

  const handleToggle = (id: CapabilityKey, enabled: boolean) => {
    setCapabilities((prev) => ({ ...prev, [id]: enabled }));
  };

  const handleAction = (action: TrustAction) => {
    if (action === "exit") {
      exit();
      return;
    }

    const config: TrustConfig = {
      projectId,
      repoRoot,
      trustedAt: new Date().toISOString(),
      capabilities,
      trustMode: action === "persist" ? "persistent" : "session",
    };

    onComplete(config);
  };

  useInput((input, key) => {
    if (focusArea === "capabilities") {
      if (key.downArrow) {
        if (selectedIndex < CAPABILITY_OPTIONS.length - 1) {
          setSelectedIndex(selectedIndex + 1);
        } else {
          setFocusArea("actions");
          setActionIndex(0);
        }
      }
      if (key.upArrow && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      }
      if (input === " " || key.return) {
        const option = CAPABILITY_OPTIONS[selectedIndex];
        if (option) {
          handleToggle(option.id, !capabilities[option.id]);
        }
      }
      if (key.tab) {
        setFocusArea("actions");
      }
    } else {
      if (key.leftArrow && actionIndex > 0) {
        setActionIndex(actionIndex - 1);
      }
      if (key.rightArrow && actionIndex < actions.length - 1) {
        setActionIndex(actionIndex + 1);
      }
      if (key.upArrow) {
        setFocusArea("capabilities");
        setSelectedIndex(CAPABILITY_OPTIONS.length - 1);
      }
      if (key.return) {
        const action = actions[actionIndex];
        if (action) {
          handleAction(action.id);
        }
      }
      if (key.tab) {
        setFocusArea("capabilities");
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Stargazer</Text>
        <Text dimColor> - Trust Directory</Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text>Before Stargazer can analyze this repository, you need to grant permissions.</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Directory: </Text>
        <Text bold>{repoRoot}</Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text bold>Capabilities</Text>
        <Text dimColor>Select which operations Stargazer can perform:</Text>
      </Box>

      <Box marginBottom={1}>
        <ToggleList
          options={toggleOptions}
          selectedIndex={focusArea === "capabilities" ? selectedIndex : -1}
          onSelect={setSelectedIndex}
          onToggle={handleToggle}
          isActive={focusArea === "capabilities"}
        />
      </Box>

      <Box marginTop={1} flexDirection="row" gap={2}>
        {actions.map((action, idx) => {
          const isSelected = focusArea === "actions" && actionIndex === idx;
          const color = action.id === "exit" ? "red" : action.id === "persist" ? "green" : "yellow";

          return (
            <Box key={action.id}>
              <Text
                color={isSelected ? color : undefined}
                bold={isSelected}
                inverse={isSelected}
              >
                {isSelected ? ` ${action.label} ` : action.label}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          Arrow keys to navigate, Space/Enter to toggle, Tab to switch sections
        </Text>
      </Box>
    </Box>
  );
}
