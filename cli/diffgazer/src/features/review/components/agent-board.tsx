import { getAgentDetail, getAgentStatusMeta } from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
import { Box, Text } from "ink";
import { Badge, type BadgeProps } from "../../../components/ui/badge";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useTheme } from "../../../theme/provider";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export interface AgentBoardProps {
  agents: AgentState[];
}

export function AgentBoard({ agents }: AgentBoardProps) {
  const { tokens } = useTheme();

  if (agents.length === 0) return null;

  return (
    <Box flexDirection="column">
      <SectionHeader variant="muted" bordered>
        Agent Board
      </SectionHeader>
      <Box flexDirection="column" paddingTop={1}>
        {agents.map((agent) => {
          const status = getAgentStatusMeta(agent.status) as {
            label: string;
            variant: BadgeVariant;
          };
          const detail = getAgentDetail(agent);

          return (
            <Box key={agent.id} gap={1}>
              <Badge variant={(agent.meta.badgeVariant ?? "info") as BadgeVariant} size="sm">
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
      </Box>
    </Box>
  );
}
