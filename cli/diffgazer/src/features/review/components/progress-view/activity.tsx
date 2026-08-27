import { getPartialFailureWarning, type ReviewEvent } from "@diffgazer/core/review";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import type { AgentState, LensStat } from "@diffgazer/core/schemas/events";
import { clampIndex } from "@diffgazer/keys";
import { Box, Text, useInput } from "ink";
import { type ReactElement, useState } from "react";
import { Callout } from "../../../../components/ui/callout";
import { SectionHeader } from "../../../../components/ui/section-header";
import { useTheme } from "../../../../theme/provider";
import { ActivityLog } from "../activity-log";

// [ and ] step the log's agent filter, mirroring the web progress pane; f steps
// forward too, except while the view has claimed f for Filter Files.
const SOURCE_FILTER_STEPS: Record<string, 1 | -1> = { f: 1, "]": 1, "[": -1 };
const BRACKET_FILTER_STEPS: Record<string, 1 | -1> = { "]": 1, "[": -1 };

export interface ReviewProgressActivityProps {
  width: string;
  height: number;
  events: readonly ReviewEvent[];
  notices: string[];
  agents: AgentState[];
  error: string | null;
  lensStats?: LensStat[];
  filterFilesKeyActive?: boolean;
}

export function ReviewProgressActivity({
  width,
  height,
  events,
  notices,
  agents,
  error,
  lensStats,
  filterFilesKeyActive = false,
}: ReviewProgressActivityProps): ReactElement {
  const { tokens } = useTheme();
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [zone, setZone] = useState<"log" | "filters">("log");

  // A log source is always an agent name, and every agent that can emit one is
  // already on the board, so the agent list is the option set — no rescan of the
  // retained event history on each streaming render.
  const sourceOptions = agents.map((agent) => agent.meta.name);
  const activeSourceFilter =
    sourceFilter && sourceOptions.includes(sourceFilter) ? sourceFilter : null;
  const hasFilters = sourceOptions.length > 0;
  const activeZone = hasFilters ? zone : "log";

  const stepSourceFilter = (step: 1 | -1) => {
    const positions = sourceOptions.length + 1; // "All agents" at 0, then one slot per agent
    const currentIndex = activeSourceFilter ? sourceOptions.indexOf(activeSourceFilter) + 1 : 0;
    const nextIndex = clampIndex(currentIndex, step, positions, true);
    setSourceFilter(nextIndex === 0 ? null : (sourceOptions[nextIndex - 1] ?? null));
  };

  const filterSteps = filterFilesKeyActive ? BRACKET_FILTER_STEPS : SOURCE_FILTER_STEPS;

  useInput(
    (input) => {
      const step = filterSteps[input];
      if (step !== 1 && step !== -1) return;
      stepSourceFilter(step);
    },
    { isActive: hasFilters },
  );

  useInput(
    (_input, key) => {
      if (key.downArrow) {
        setZone("log");
      } else if (key.leftArrow) {
        stepSourceFilter(-1);
      } else if (key.rightArrow) {
        stepSourceFilter(1);
      }
    },
    { isActive: activeZone === "filters" },
  );

  const partialFailure = getPartialFailureWarning(agents, error, lensStats);
  const activityLogHeight = Math.max(
    height -
      2 -
      (hasFilters ? 1 : 0) -
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

      {hasFilters ? (
        <Text color={activeZone === "filters" ? tokens.accent : tokens.muted} wrap="truncate-end">
          Filter ({filterFilesKeyActive ? "[, ]" : "f, [, ]"}): {activeSourceFilter ?? "All agents"}
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
          {notices.map((notice, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: notice text can repeat; stream order is the rendered identity.
            <Text key={index} color={tokens.warning}>
              {sanitizeTerminalText(notice)}
            </Text>
          ))}
        </Box>
      ) : null}

      <Box paddingTop={1}>
        <ActivityLog
          events={events}
          height={activityLogHeight}
          isActive={activeZone === "log"}
          onTopBoundary={hasFilters ? () => setZone("filters") : undefined}
          sourceFilter={activeSourceFilter ?? undefined}
        />
      </Box>
    </Box>
  );
}
