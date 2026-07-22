import {
  getPartialFailureWarning,
  getReviewEventLogSource,
  type ReviewEvent,
  sanitizeTerminalText,
} from "@diffgazer/core/review";
import type { AgentState, LensStat } from "@diffgazer/core/schemas/events";
import { Box, Text, useInput } from "ink";
import { type ReactElement, useState } from "react";
import { Callout } from "../../../../components/ui/callout";
import { SectionHeader } from "../../../../components/ui/section-header";
import { useTheme } from "../../../../theme/provider";
import { ActivityLog } from "../activity-log";

export interface ReviewProgressActivityProps {
  width: string;
  height: number;
  events: readonly ReviewEvent[];
  notices: string[];
  agents: AgentState[];
  error: string | null;
  lensStats?: LensStat[];
}

export function ReviewProgressActivity({
  width,
  height,
  events,
  notices,
  agents,
  error,
  lensStats,
}: ReviewProgressActivityProps): ReactElement {
  const { tokens } = useTheme();
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const sourceOptions = Array.from(
    new Set(
      events.map(getReviewEventLogSource).filter((source): source is string => Boolean(source)),
    ),
  );
  const activeSourceFilter =
    sourceFilter && sourceOptions.includes(sourceFilter) ? sourceFilter : null;

  useInput(
    (input) => {
      if (input !== "f" || sourceOptions.length === 0) return;
      const currentIndex = activeSourceFilter ? sourceOptions.indexOf(activeSourceFilter) + 1 : 0;
      const nextIndex = (currentIndex + 1) % (sourceOptions.length + 1);
      setSourceFilter(nextIndex === 0 ? null : (sourceOptions[nextIndex - 1] ?? null));
    },
    { isActive: sourceOptions.length > 0 },
  );

  const partialFailure = getPartialFailureWarning(agents, error, lensStats);
  const activityLogHeight = Math.max(
    height -
      2 -
      (sourceOptions.length > 0 ? 1 : 0) -
      (notices.length > 0 ? notices.length + 1 : 0) -
      (partialFailure.hasPartialFailure ? 5 : 0),
    1,
  );

  return (
    <Box flexDirection="column" width={width} height={height} overflow="hidden">
      <Box justifyContent="space-between">
        <SectionHeader variant="muted">Live Activity Log</SectionHeader>
        <Text color={tokens.muted}>tail -f agent.log</Text>
      </Box>

      {sourceOptions.length > 0 ? (
        <Text color={tokens.muted} wrap="truncate-end">
          Filter [f]: {activeSourceFilter ?? "All agents"}
        </Text>
      ) : null}

      {partialFailure.hasPartialFailure ? (
        <Box paddingTop={1}>
          <Callout variant="warning">
            <Callout.Title>Partial Analysis</Callout.Title>
            <Callout.Content>{sanitizeTerminalText(partialFailure.message)}</Callout.Content>
          </Callout>
        </Box>
      ) : null}

      {notices.length > 0 ? (
        <Box flexDirection="column" paddingTop={1}>
          {notices.map((notice) => (
            <Text key={notice} color={tokens.warning}>
              {sanitizeTerminalText(notice)}
            </Text>
          ))}
        </Box>
      ) : null}

      <Box paddingTop={1}>
        <ActivityLog
          events={events}
          height={activityLogHeight}
          isActive
          sourceFilter={activeSourceFilter ?? undefined}
        />
      </Box>
    </Box>
  );
}
