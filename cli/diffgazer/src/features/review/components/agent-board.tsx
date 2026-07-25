import { getAgentDetail, getAgentStatusMeta } from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
import { Box, Text } from "ink";
import { Badge } from "../../../components/ui/badge";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useTheme } from "../../../theme/provider";

export interface AgentBoardProps {
  agents: AgentState[];
  maxRows?: number;
  /** Drops the pad under the heading rule when the pane cannot spare the row. */
  compact?: boolean;
}

/**
 * A single row is spent on a named agent, not on the overflow count: "… 5 more
 * agents" alone says nothing about what the review is doing. That row goes to
 * whichever agent is actually working, falling back to the first.
 */
function getVisibleAgents(agents: AgentState[], availableRows: number): AgentState[] {
  if (agents.length <= availableRows) return agents;
  if (availableRows > 1) return agents.slice(0, availableRows - 1);
  const running = agents.find((agent) => agent.status === "running");
  return running ? [running] : agents.slice(0, 1);
}

export function AgentBoard({ agents, maxRows = agents.length, compact = false }: AgentBoardProps) {
  const { tokens } = useTheme();

  if (agents.length === 0) return null;

  const availableRows = Math.max(maxRows, 1);
  const visibleAgents = getVisibleAgents(agents, availableRows);
  const hiddenCount = agents.length - visibleAgents.length;
  // The count only earns a row when one is left over for it.
  const showHiddenCount = hiddenCount > 0 && visibleAgents.length < availableRows;

  return (
    <Box flexDirection="column">
      <SectionHeader variant="muted" bordered>
        Agent Board
      </SectionHeader>
      <Box flexDirection="column" paddingTop={compact ? 0 : 1} overflow="hidden">
        {visibleAgents.map((agent) => {
          const status = getAgentStatusMeta(agent.status);
          const detail = getAgentDetail(agent);

          return (
            <Box key={agent.id} gap={1} height={1} overflow="hidden" flexWrap="nowrap">
              <Box flexShrink={0}>
                <Badge variant={agent.meta.badgeVariant ?? "info"} size="sm">
                  {agent.meta.badgeLabel}
                </Badge>
              </Box>
              <Box flexShrink={0}>
                <Text bold>{agent.meta.name}</Text>
              </Box>
              {agent.status === "running" ? <Spinner variant="dots" size="sm" /> : null}
              <Box flexShrink={0}>
                <Badge variant={status.variant} size="sm">
                  {status.label}
                </Badge>
              </Box>
              <Box flexShrink={1} minWidth={0} overflow="hidden">
                <Text color={tokens.muted} wrap="truncate-end">
                  {detail}
                </Text>
              </Box>
            </Box>
          );
        })}
        {showHiddenCount ? <Text color={tokens.muted}>… {hiddenCount} more agents</Text> : null}
      </Box>
    </Box>
  );
}
