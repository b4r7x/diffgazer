import { useState, type ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { useResponsive } from "../../../hooks/use-terminal-dimensions.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { Callout } from "../../../components/ui/callout.js";
import { usePageFooter } from "@diffgazer/core/footer";
import { ProgressList } from "./progress-list.js";
import { ActivityLog } from "./activity-log.js";
import { AgentBoard } from "./agent-board.js";
import { AgentFilterBar } from "./agent-filter-bar.js";
import { ContextSnapshotPreview } from "./context-snapshot-preview.js";
import { ReviewMetricsFooter } from "./review-metrics-footer.js";
import type { AgentState } from "@diffgazer/core/schemas/events";
import type {
  LogEntryData,
  ProgressStepData,
  Shortcut,
} from "@diffgazer/core/schemas/ui";
import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import type { FileProgress } from "@diffgazer/core/review";

export interface ReviewProgressViewProps {
  progressSteps: ProgressStepData[];
  agents: AgentState[];
  logEntries: LogEntryData[];
  fileProgress: FileProgress;
  isStreaming: boolean;
  error: string | null;
  onCancel?: () => void;
  onViewResults?: () => void;
  issuesFound: number;
  startedAt: Date | null;
  contextSnapshot?: ReviewContextResponse | null;
}

const STREAMING_SHORTCUTS: Shortcut[] = [];
const COMPLETING_SHORTCUTS: Shortcut[] = [
  { key: "Enter", label: "View Results" },
];

function getResponsiveWidth(
  isWide: boolean,
  isMedium: boolean,
  widths: { wide: string; medium: string; narrow: string },
): string {
  if (isWide) return widths.wide;
  if (isMedium) return widths.medium;
  return widths.narrow;
}

export function ReviewProgressView({
  progressSteps,
  agents,
  logEntries,
  fileProgress,
  isStreaming,
  error,
  onCancel,
  onViewResults,
  issuesFound,
  startedAt,
  contextSnapshot,
}: ReviewProgressViewProps): ReactElement {
  const { tokens } = useTheme();
  const { isMedium, isWide } = useResponsive();
  const [agentFilter, setAgentFilter] = useState<string | null>(null);

  usePageFooter({
    shortcuts: isStreaming ? STREAMING_SHORTCUTS : COMPLETING_SHORTCUTS,
  });

  const elapsed = startedAt ? Date.now() - startedAt.getTime() : 0;

  const sideBySide = isWide || isMedium;
  const progressWidth = getResponsiveWidth(isWide, isMedium, {
    wide: "33%",
    medium: "40%",
    narrow: "100%",
  });
  const logWidth = getResponsiveWidth(isWide, isMedium, {
    wide: "67%",
    medium: "60%",
    narrow: "100%",
  });

  const agentOptions = agents.map((agent) => ({
    id: agent.id,
    name: agent.meta.name,
    badgeLabel: agent.meta.badgeLabel,
    badgeVariant: agent.meta.badgeVariant,
  }));

  const failedAgents = agents.filter((agent) => agent.status === "error");
  const failedAgentNames = failedAgents.map((a) => a.meta.name).join(", ");
  const hasPartialFailure = failedAgents.length > 0 && !error;

  const filteredEntries = agentFilter
    ? logEntries.filter((entry) => entry.source === agentFilter)
    : logEntries;

  const progressPane = (
    <Box flexDirection="column" width={progressWidth}>
      <SectionHeader variant="muted" bordered>
        Progress Overview
      </SectionHeader>
      <Box flexDirection="column" paddingTop={1}>
        <ProgressList steps={progressSteps} />
      </Box>

      {agents.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <AgentBoard agents={agents} />
        </Box>
      ) : null}

      {contextSnapshot && !isStreaming ? (
        <Box marginTop={1}>
          <ContextSnapshotPreview snapshot={contextSnapshot} />
        </Box>
      ) : null}

      <Box marginTop={1}>
        <ReviewMetricsFooter
          filesProcessed={fileProgress.completed.length}
          issuesFound={issuesFound}
          elapsed={elapsed}
          isStreaming={isStreaming}
        />
      </Box>
    </Box>
  );

  const logPane = (
    <Box flexDirection="column" width={logWidth}>
      <Box justifyContent="space-between">
        <SectionHeader variant="muted">Live Activity Log</SectionHeader>
        <Text color={tokens.muted}>tail -f agent.log</Text>
      </Box>

      {agents.length > 0 ? (
        <Box paddingTop={1}>
          <AgentFilterBar
            agents={agentOptions}
            active={agentFilter}
            onChange={setAgentFilter}
          />
        </Box>
      ) : null}

      {hasPartialFailure ? (
        <Box paddingTop={1}>
          <Callout variant="warning">
            <Callout.Title>Partial Analysis</Callout.Title>
            <Callout.Content>
              {`${failedAgents.length} agent${failedAgents.length === 1 ? "" : "s"} failed (likely rate limited): ${failedAgentNames}. Results may be incomplete.`}
            </Callout.Content>
          </Callout>
        </Box>
      ) : null}

      <Box paddingTop={1}>
        <ActivityLog
          entries={filteredEntries}
          height={progressSteps.length + 8}
        />
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column">
      <Box
        flexDirection={sideBySide ? "row" : "column"}
        gap={sideBySide ? 2 : 1}
      >
        {progressPane}
        {logPane}
      </Box>
      {error ? (
        <Box marginTop={1} marginLeft={2}>
          <Text color={tokens.error}>{error}</Text>
        </Box>
      ) : null}
      {isStreaming && onCancel ? (
        <Box marginTop={1}>
          <Button variant="destructive" isActive onPress={onCancel}>
            Cancel
          </Button>
        </Box>
      ) : null}
      {!isStreaming && onViewResults ? (
        <Box marginTop={1}>
          <Button variant="primary" isActive onPress={onViewResults}>
            View Results
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
