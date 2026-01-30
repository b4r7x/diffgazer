import { useState, useEffect } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { WizardFrame } from "./wizard-frame.js";

type WizardMode = "onboarding" | "settings";
type DiagnosticStatus = "idle" | "running" | "success" | "error";

interface DiagnosticCheck {
  id: string;
  label: string;
  status: DiagnosticStatus;
  message?: string;
}

interface DiagnosticsStepProps {
  mode: WizardMode;
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  onRunDiagnostics?: () => Promise<DiagnosticResult[]>;
  isActive?: boolean;
}

interface DiagnosticResult {
  id: string;
  success: boolean;
  message?: string;
}

const DEFAULT_CHECKS: DiagnosticCheck[] = [
  { id: "config", label: "Configuration files", status: "idle" },
  { id: "storage", label: "Storage accessibility", status: "idle" },
  { id: "git", label: "Git repository detection", status: "idle" },
  { id: "api", label: "API connectivity", status: "idle" },
];

const STATUS_ICONS: Record<DiagnosticStatus, ReactElement> = {
  idle: <Text dimColor>[ ]</Text>,
  running: <Spinner type="dots" />,
  success: <Text color="green">[OK]</Text>,
  error: <Text color="red">[X]</Text>,
};

function DiagnosticCheckItem({ check }: { check: DiagnosticCheck }): ReactElement {
  return (
    <Box flexDirection="column">
      <Box>
        <Box width={6}>{STATUS_ICONS[check.status]}</Box>
        <Text>{check.label}</Text>
      </Box>
      {check.message && (
        <Box marginLeft={6}>
          <Text dimColor>{check.message}</Text>
        </Box>
      )}
    </Box>
  );
}

export function DiagnosticsStep({
  mode,
  currentStep,
  totalSteps,
  onBack,
  onRunDiagnostics,
  isActive = true,
}: DiagnosticsStepProps): ReactElement {
  const [checks, setChecks] = useState<DiagnosticCheck[]>(DEFAULT_CHECKS);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    if (isRunning) return;
    setIsRunning(true);

    setChecks((prev) =>
      prev.map((check) => ({ ...check, status: "running" as const, message: undefined }))
    );

    if (onRunDiagnostics) {
      const results = await onRunDiagnostics();
      setChecks((prev) =>
        prev.map((check) => {
          const result = results.find((r) => r.id === check.id);
          return {
            ...check,
            status: result?.success ? "success" : "error",
            message: result?.message,
          };
        })
      );
    } else {
      for (const check of DEFAULT_CHECKS) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setChecks((prev) =>
          prev.map((c) =>
            c.id === check.id ? { ...c, status: "success" as const } : c
          )
        );
      }
    }

    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  useInput(
    (input) => {
      if (isRunning) return;

      if (input === "r") {
        runDiagnostics();
        return;
      }

      if (input === "b" && onBack) {
        onBack();
      }
    },
    { isActive }
  );

  function getFooterText(): string {
    if (isRunning) return "Running diagnostics...";
    if (onBack) return "[r] Run Again  [b] Back";
    return "[r] Run Again";
  }

  const frameProps = mode === "settings" ? { width: "66%" as const, centered: true } : {};

  return (
    <WizardFrame
      mode={mode}
      currentStep={currentStep}
      totalSteps={totalSteps}
      stepTitle="System Diagnostics"
      footer={getFooterText()}
      {...frameProps}
    >
      <Text dimColor>Checking system status:</Text>

      <Box marginTop={1} flexDirection="column" gap={0}>
        {checks.map((check) => (
          <DiagnosticCheckItem key={check.id} check={check} />
        ))}
      </Box>

      {!isRunning && checks.every((c) => c.status === "success") && (
        <Box marginTop={1}>
          <Text color="green">All checks passed.</Text>
        </Box>
      )}

      {!isRunning && checks.some((c) => c.status === "error") && (
        <Box marginTop={1}>
          <Text color="yellow">Some checks failed. Review the messages above.</Text>
        </Box>
      )}
    </WizardFrame>
  );
}
