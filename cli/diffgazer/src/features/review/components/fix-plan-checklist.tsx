import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { FixPlanStep } from "@diffgazer/core/schemas/review";
import { useTheme } from "../../../theme/theme-context";
import type { CliColorTokens } from "../../../theme/palettes";
import { Badge } from "../../../components/ui/badge";

export interface FixPlanChecklistProps {
  steps: FixPlanStep[];
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
        setHighlightIndex(
          (i) => (i - 1 + steps.length) % steps.length,
        );
        return;
      }
      if (key.downArrow) {
        setHighlightIndex((i) => (i + 1) % steps.length);
        return;
      }
      if (input === " " || key.return) {
        const step = steps[highlightIndex];
        if (step) onToggle(step.step);
      }
    },
    { isActive },
  );

  return (
    <Box flexDirection="column">
      {steps.map((step, i) => {
        const isComplete = completedSteps.has(step.step);
        const isHighlighted = isActive && i === highlightIndex;
        const indicator = isComplete ? "[x]" : "[ ]";

        return (
          <Box key={step.step} gap={1}>
            <Text color={getIndicatorColor(isHighlighted, isComplete, tokens)} bold={isHighlighted}>
              {indicator}
            </Text>
            <Text color={tokens.muted}>{`${String(step.step)}.`}</Text>
            <Text
              color={getActionColor(isHighlighted, isComplete, tokens)}
              bold={isHighlighted}
              strikethrough={isComplete}
            >
              {step.action}
            </Text>
            {step.risk ? (
              <Badge variant={riskVariant(step.risk)}>{step.risk}</Badge>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}
