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
}

export function AgentBoard({ agents, maxRows = agents.length }: AgentBoardProps) {
  const { tokens } = useTheme();

  if (agents.length === 0) return null;

  const availableRows = Math.max(maxRows, 1);
  const hasOverflow = agents.length > availableRows;
  const visibleAgentCount = hasOverflow ? Math.max(availableRows - 1, 0) : availableRows;
  const visibleAgents = agents.slice(0, visibleAgentCount);

  return (
    <Box flexDirection="column">
      <SectionHeader variant="muted" bordered>
        Agent Board
      </SectionHeader>
      <Box flexDirection="column" paddingTop={1}>
        {visibleAgents.map((agent) => {
          const status = getAgentStatusMeta(agent.status);
          const detail = getAgentDetail(agent);

          return (
            <Box key={agent.id} gap={1}>
              <Badge variant={agent.meta.badgeVariant ?? "info"} size="sm">
                {agent.meta.badgeLabel}
              </Badge>
              <Text bold>{agent.meta.name}</Text>
              {agent.status === "running" ? <Spinner variant="dots" size="sm" /> : null}
              <Badge variant={status.variant} size="sm">
                {status.label}
              </Badge>
              <Text color={tokens.muted}>{detail}</Text>
            </Box>
          );
        })}
        {hasOverflow ? (
          <Text color={tokens.muted}>… {agents.length - visibleAgentCount} more agents</Text>
        ) : null}
      </Box>
    </Box>
  );
}
