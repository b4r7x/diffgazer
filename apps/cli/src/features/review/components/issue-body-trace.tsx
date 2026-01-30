import { useMemo, type ReactElement } from "react";
import { Box, Text } from "ink";
import type { TraceRef } from "@repo/schemas/triage";
import { calculateVisibleWindow } from "../../../lib/scroll-window.js";

function parseTimestamp(timestamp: string): number {
  const date = new Date(timestamp);
  if (!isNaN(date.getTime())) {
    return date.getTime();
  }
  const match = timestamp.match(/(\d+):(\d+):(\d+)(?:\.(\d+))?/);
  if (match) {
    const hours = parseInt(match[1] ?? "0", 10);
    const minutes = parseInt(match[2] ?? "0", 10);
    const seconds = parseInt(match[3] ?? "0", 10);
    const ms = match[4] ? parseInt(match[4].padEnd(3, "0").slice(0, 3), 10) : 0;
    return hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
  }
  return 0;
}

function formatRelativeTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function getToolDescription(tool: string, inputSummary: string): string {
  const toolLower = tool.toLowerCase();
  if (toolLower.includes("read") || toolLower.includes("file")) {
    return inputSummary;
  }
  if (toolLower.includes("search")) {
    return `"${inputSummary}"`;
  }
  return inputSummary;
}

function getOutputDescription(outputSummary: string): string {
  return `> ${outputSummary}`;
}

interface TraceStepProps {
  trace: TraceRef;
  relativeTime: number;
  isLast: boolean;
}

function TraceStep({ trace, relativeTime, isLast }: TraceStepProps): ReactElement {
  const timeStr = formatRelativeTime(relativeTime);
  const toolDesc = getToolDescription(trace.tool, trace.inputSummary);
  const outputDesc = getOutputDescription(trace.outputSummary);

  return (
    <Box flexDirection="column" marginBottom={isLast ? 0 : 1}>
      <Box flexDirection="row">
        <Box width={3}>
          <Text color="cyan" bold>
            {trace.step}.
          </Text>
        </Box>
        <Box flexGrow={1} flexShrink={1}>
          <Text bold color="yellow" wrap="truncate">
            {trace.tool}
          </Text>
        </Box>
        <Box>
          <Text dimColor>{timeStr}</Text>
        </Box>
      </Box>

      <Box marginLeft={3} flexDirection="column">
        <Text dimColor wrap="truncate">
          {toolDesc}
        </Text>
        <Text color="gray" wrap="truncate">
          {outputDesc}
        </Text>
      </Box>
    </Box>
  );
}

interface IssueBodyTraceProps {
  trace: TraceRef[] | undefined;
  height?: number;
}

export function IssueBodyTrace({ trace, height }: IssueBodyTraceProps): ReactElement {
  const traceItems = trace ?? [];

  const relativeTimes = useMemo(() => {
    const firstItem = traceItems[0];
    const baseTime = firstItem ? parseTimestamp(firstItem.timestamp) : 0;
    return traceItems.map((t) => parseTimestamp(t.timestamp) - baseTime);
  }, [traceItems]);

  const headerHeight = 2;
  const itemHeight = 4;
  const availableHeight = height ? Math.max(itemHeight, height - headerHeight) : undefined;
  const visibleCount = availableHeight ? Math.floor(availableHeight / itemHeight) : traceItems.length;

  const window = calculateVisibleWindow({
    totalItems: traceItems.length,
    visibleCount,
  });

  if (traceItems.length === 0) {
    return (
      <Box padding={1}>
        <Text dimColor>No trace available. Trigger drilldown to see AI steps.</Text>
      </Box>
    );
  }

  const visibleItems = traceItems.slice(window.scrollOffset, window.endIndex);
  const visibleRelativeTimes = relativeTimes.slice(window.scrollOffset, window.endIndex);

  const hasScrollUp = window.scrollOffset > 0;
  const hasScrollDown = window.endIndex < traceItems.length;

  return (
    <Box flexDirection="column" height={height}>
      <Box marginBottom={1}>
        <Text bold>
          ## Trace ({traceItems.length} step{traceItems.length !== 1 ? "s" : ""})
        </Text>
      </Box>

      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {hasScrollUp && (
          <Box justifyContent="center">
            <Text dimColor>--- {window.scrollOffset} more above ---</Text>
          </Box>
        )}

        {visibleItems.map((item, index) => (
          <TraceStep
            key={item.step}
            trace={item}
            relativeTime={visibleRelativeTimes[index] ?? 0}
            isLast={window.scrollOffset + index === traceItems.length - 1}
          />
        ))}

        {hasScrollDown && (
          <Box justifyContent="center">
            <Text dimColor>--- {traceItems.length - window.endIndex} more below ---</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
