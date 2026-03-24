import { Box } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { ProgressList } from "./progress-list.js";
import { ActivityLog } from "./activity-log.js";

export interface ReviewProgressViewProps {
  steps: Array<{
    name: string;
    status: string;
    substeps?: string[];
    duration?: number;
  }>;
  logEntries: Array<{
    timestamp: string;
    message: string;
    variant?: "success" | "warning" | "error" | "info" | "neutral";
  }>;
  onCancel?: () => void;
}

const WIDE_THRESHOLD = 100;

export function ReviewProgressView({
  steps,
  logEntries,
  onCancel,
}: ReviewProgressViewProps) {
  const { tokens } = useTheme();
  const { columns } = useTerminalDimensions();
  const isWide = columns >= WIDE_THRESHOLD;

  const progressPane = (
    <Box flexDirection="column" flexGrow={1} width={isWide ? "50%" : "100%"}>
      <SectionHeader bordered>Progress</SectionHeader>
      <Box flexDirection="column" paddingTop={1}>
        <ProgressList steps={steps as any} />
      </Box>
    </Box>
  );

  const logPane = (
    <Box flexDirection="column" flexGrow={1} width={isWide ? "50%" : "100%"}>
      <SectionHeader bordered>Activity Log</SectionHeader>
      <Box paddingTop={1}>
        <ActivityLog entries={logEntries} height={steps.length + 5} />
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" borderColor={tokens.border}>
      <Box
        flexDirection={isWide ? "row" : "column"}
        gap={isWide ? 2 : 1}
      >
        {progressPane}
        {logPane}
      </Box>
      {onCancel ? (
        <Box marginTop={1}>
          <Button
            variant="destructive"
            isActive
            onPress={onCancel}
          >
            Cancel
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
