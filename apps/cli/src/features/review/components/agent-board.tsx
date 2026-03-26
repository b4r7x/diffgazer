import { Box, Text } from "ink";
import { Badge, type BadgeProps } from "../../../components/ui/badge.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { useTheme } from "../../../theme/theme-context.js";
import { getAgentDetail } from "@diffgazer/core/review";
import type { AgentState, AgentStatus } from "@diffgazer/schemas/events";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const STATUS_META: Record<AgentStatus, { label: string; variant: BadgeVariant }> = {
  queued: { label: "WAIT", variant: "neutral" },
  running: { label: "RUN", variant: "info" },
  complete: { label: "DONE", variant: "success" },
  error: { label: "FAIL", variant: "error" },
};

export interface AgentBoardProps {
  agents: AgentState[];
}

export function AgentBoard({ agents }: AgentBoardProps) {
  const { tokens } = useTheme();

  if (agents.length === 0) return null;

  return (
    <Box flexDirection="column">
      {agents.map((agent) => {
        const status = STATUS_META[agent.status];
        const detail = getAgentDetail(agent);

        return (
          <Box key={agent.id} gap={1}>
            <Badge variant={(agent.meta.badgeVariant ?? "info") as BadgeVariant} size="sm">
              {agent.meta.badgeLabel}
            </Badge>
            <Text bold>{agent.meta.name}</Text>
            {agent.status === "running" ? (
              <Spinner variant="dots" size="sm" />
            ) : null}
            <Badge variant={status.variant} size="sm">
              {status.label}
            </Badge>
            <Text color={tokens.muted}>{detail}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
