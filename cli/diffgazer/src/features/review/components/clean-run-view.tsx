import { buildCleanRunStatement } from "@diffgazer/core/review";
import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Button } from "../../../components/ui/button";
import { useTheme } from "../../../theme/provider";
import { type ReviewRunReceipt, RunReceiptLedger } from "./run-receipt";

export interface CleanRunAction {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

export interface CleanRunViewProps {
  receipt: ReviewRunReceipt;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
  /** The notices the honesty guard keeps: what was hidden, what was collapsed. */
  notices: string[];
  /** Built by the summary, which owns the key handling and the footer legend. */
  actions: CleanRunAction[];
}

/**
 * A run that found nothing has its receipt as the evidence: the pass statement,
 * then what was read, by which lenses, on which model, for how long. There is no
 * results screen behind this one, so the row below the ledger is where the
 * screen leads instead.
 */
export function CleanRunView({
  receipt,
  droppedBelowThreshold,
  minSeverity,
  notices,
  actions,
}: CleanRunViewProps): ReactElement {
  const { tokens } = useTheme();

  return (
    <Box flexDirection="column" gap={1} paddingTop={1}>
      <Text color={tokens.success} bold>
        {`✔ ${buildCleanRunStatement({ droppedBelowThreshold, minSeverity })}`}
      </Text>
      <RunReceiptLedger receipt={receipt} />
      {notices.length > 0 ? (
        <Box flexDirection="column">
          {notices.map((notice) => (
            <Text key={notice} color={tokens.muted}>
              {notice}
            </Text>
          ))}
        </Box>
      ) : null}
      {actions.length > 0 ? (
        <Box justifyContent="center" gap={2}>
          {actions.map((action, index) => (
            <Button
              key={action.label}
              variant={index === 0 ? "primary" : "secondary"}
              isActive={action.isActive}
              onPress={action.onPress}
            >
              {action.label}
            </Button>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
