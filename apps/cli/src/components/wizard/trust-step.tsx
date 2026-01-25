import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import type { TrustCapabilities, TrustConfig, TrustMode } from "@repo/schemas/settings";
import { ToggleList, type ToggleOption } from "../ui/index.js";
import { WizardFrame } from "./wizard-frame.js";

type WizardMode = "onboarding" | "settings";

interface TrustStepProps {
  mode: WizardMode;
  currentStep: number;
  totalSteps: number;
  repoRoot: string;
  projectId: string;
  initialCapabilities?: TrustCapabilities;
  onComplete: (trust: TrustConfig) => void;
  onSkip: () => void;
  onBack?: () => void;
  isActive?: boolean;
}

type CapabilityKey = keyof TrustCapabilities;

const DEFAULT_CAPABILITIES: TrustCapabilities = {
  readFiles: true,
  readGit: true,
  runCommands: false,
};

const CAPABILITY_OPTIONS: {
  id: CapabilityKey;
  label: string;
  description: string;
}[] = [
  {
    id: "readFiles",
    label: "Read Files",
    description: "Allow reading source code and other files in this directory",
  },
  {
    id: "readGit",
    label: "Read Git",
    description: "Allow reading git history, branches, and diff information",
  },
  {
    id: "runCommands",
    label: "Run Commands",
    description: "Allow running shell commands for analysis (e.g., linters, tests)",
  },
];

function AccessExplanation(): ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>Stargazer will:</Text>
      <Box marginLeft={2} flexDirection="column">
        <Text dimColor>- Analyze code changes in this repository</Text>
        <Text dimColor>- Read git diffs to provide review feedback</Text>
        <Text dimColor>- Access files to understand context</Text>
      </Box>
    </Box>
  );
}

export function TrustStep({
  mode,
  currentStep,
  totalSteps,
  repoRoot,
  projectId,
  initialCapabilities = DEFAULT_CAPABILITIES,
  onComplete,
  onSkip,
  onBack,
  isActive = true,
}: TrustStepProps): ReactElement {
  const [capabilities, setCapabilities] = useState<TrustCapabilities>(initialCapabilities);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const toggleOptions: ToggleOption<CapabilityKey>[] = CAPABILITY_OPTIONS.map((opt) => ({
    id: opt.id,
    label: opt.label,
    description: opt.description,
    enabled: capabilities[opt.id],
  }));

  const handleToggle = (id: CapabilityKey, enabled: boolean) => {
    setCapabilities((prev) => ({ ...prev, [id]: enabled }));
  };

  const handleComplete = (trustMode: TrustMode) => {
    const trustConfig: TrustConfig = {
      projectId,
      repoRoot,
      trustedAt: new Date().toISOString(),
      capabilities,
      trustMode,
    };
    onComplete(trustConfig);
  };

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (input === "t") {
        handleComplete("persistent");
        return;
      }

      if (input === "o") {
        handleComplete("session");
        return;
      }

      if (key.escape || input === "s") {
        onSkip();
        return;
      }

      if (input === "b" && onBack) {
        onBack();
      }
    },
    { isActive }
  );

  const footerText =
    mode === "onboarding"
      ? "Space to toggle, [t] Trust & Continue, [o] Trust Once, [s] Skip"
      : onBack
        ? "Space to toggle, [t] Trust, [o] Once, [s] Skip, [b] Back"
        : "Space to toggle, [t] Trust, [o] Once, [s] Skip";

  return (
    <WizardFrame
      mode={mode}
      currentStep={currentStep}
      totalSteps={totalSteps}
      stepTitle="Do you trust this directory?"
      footer={footerText}
    >
      <Box flexDirection="column">
        <Text color="cyan">{repoRoot}</Text>

        <AccessExplanation />

        <Box marginTop={1}>
          <Text dimColor>Select which capabilities to grant:</Text>
        </Box>

        <Box marginTop={1}>
          <ToggleList
            options={toggleOptions}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onToggle={handleToggle}
            isActive={isActive}
          />
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Actions:</Text>
          <Box marginLeft={2} flexDirection="column">
            <Text>
              <Text color="green">[t]</Text> Trust & Continue - Remember this choice
            </Text>
            <Text>
              <Text color="yellow">[o]</Text> Trust Once - Only for this session
            </Text>
            <Text>
              <Text color="gray">[s]</Text> Skip - Continue without trusting
            </Text>
          </Box>
        </Box>
      </Box>
    </WizardFrame>
  );
}
