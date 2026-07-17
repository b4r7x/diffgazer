import { type IssueFixStepPresentation, sanitizeTerminalText } from "@diffgazer/core/review";
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { Badge } from "../../../components/ui/badge";
import type { CliColorTokens } from "../../../theme/palettes";
import { useTheme } from "../../../theme/provider";

export interface FixPlanChecklistProps {
  steps: readonly IssueFixStepPresentation[];
  completedSteps: Set<number>;
  onToggle: (step: number) => void;
  isActive?: boolean;
}

function riskVariant(risk: string | undefined): "error" | "warning" | "info" {
  switch (risk) {
    case "high":
      return "error";
    case "medium":
      return "warning";
    default:
      return "info";
  }
}

function getIndicatorColor(
  isHighlighted: boolean,
  isComplete: boolean,
  tokens: CliColorTokens,
): string | undefined {
  if (isHighlighted) return tokens.accent;
  if (isComplete) return tokens.success;
  return undefined;
}

function getActionColor(
  isHighlighted: boolean,
  isComplete: boolean,
  tokens: CliColorTokens,
): string {
  if (isHighlighted) return tokens.accent;
  if (isComplete) return tokens.muted;
  return tokens.fg;
}

export function FixPlanChecklist({
  steps,
  completedSteps,
  onToggle,
  isActive = false,
}: FixPlanChecklistProps) {
  const { tokens } = useTheme();
  const [highlightIndex, setHighlightIndex] = useState(0);

  useInput(
    (input, key) => {
      if (steps.length === 0) return;
      if (key.upArrow) {
        setHighlightIndex((i) => (i - 1 + steps.length) % steps.length);
        return;
      }
      if (key.downArrow) {
        setHighlightIndex((i) => (i + 1) % steps.length);
        return;
      }
      if (input === " " || key.return) {
        const highlightedStep = steps[highlightIndex];
        if (highlightedStep) onToggle(highlightedStep.completionIndex);
      }
    },
    { isActive },
  );

  return (
    <Box flexDirection="column">
      {steps.map((step) => {
        const isComplete = completedSteps.has(step.completionIndex);
        const isHighlighted = isActive && step.completionIndex === highlightIndex;
        const indicator = isComplete ? "[x]" : "[ ]";

        return (
          <Box key={step.completionIndex} gap={1}>
            <Text color={getIndicatorColor(isHighlighted, isComplete, tokens)} bold={isHighlighted}>
              {indicator}
            </Text>
            <Text color={tokens.muted}>{`${String(step.number)}.`}</Text>
            <Text
              color={getActionColor(isHighlighted, isComplete, tokens)}
              bold={isHighlighted}
              strikethrough={isComplete}
            >
              {sanitizeTerminalText(step.action)}
            </Text>
            {step.risk ? <Badge variant={riskVariant(step.risk)}>{step.risk}</Badge> : null}
            {step.files.length > 0 ? (
              <Text color={tokens.muted}>
                {sanitizeTerminalText(`files: ${step.files.join(", ")}`)}
              </Text>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}
