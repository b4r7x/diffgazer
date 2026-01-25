import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import type { TriageIssue } from "@repo/schemas/triage";
import { Card } from "../../../components/ui/card.js";
import { useTheme } from "../../../hooks/use-theme.js";

export interface DrilldownPromptProps {
  issue: TriageIssue;
  reason: string;
  onAccept: () => void;
  onSkip: () => void;
  onAcceptAll: () => void;
  isActive?: boolean;
}

export function DrilldownPrompt({
  issue,
  reason,
  onAccept,
  onSkip,
  onAcceptAll,
  isActive = true,
}: DrilldownPromptProps): ReactElement {
  const { colors } = useTheme();

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (input === "y" || key.return) {
        onAccept();
        return;
      }

      if (input === "n" || key.escape) {
        onSkip();
        return;
      }

      if (input === "a") {
        onAcceptAll();
        return;
      }
    },
    { isActive }
  );

  const severityColor = colors.severity[issue.severity];

  return (
    <Card title="Agent Notice" titleColor={colors.ui.info}>
      <Box flexDirection="column" gap={1}>
        <Text>{reason}</Text>

        <Box>
          <Text bold color={severityColor}>
            "{issue.title}"
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text dimColor>
            [y] Analyze deeper  [n] Skip  [a] Analyze all{" "}
            <Text color={severityColor}>{issue.severity.toUpperCase()}</Text>
          </Text>
        </Box>
      </Box>
    </Card>
  );
}
