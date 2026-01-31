import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { AgentState } from "@repo/schemas/agent-event";
import { useTheme } from "../../../hooks/use-theme.js";
import { Card } from "../../../components/ui/layout/card.js";

interface AgentActivityPanelProps {
  agents: AgentState[];
  currentAction: string | null;
  height?: number;
}

function getStatusDisplay(status: AgentState["status"], colors: ReturnType<typeof useTheme>["colors"]) {
  if (status === "complete") {
    return { icon: "\u2713", color: colors.status.complete };
  }
  if (status === "running") {
    return { icon: "\u27F3", color: colors.status.running };
  }
  return { icon: "\u25CB", color: colors.status.pending };
}

function AgentRow({ agent }: { agent: AgentState }): ReactElement {
  const { colors } = useTheme();
  const { icon: statusIcon, color: statusColor } = getStatusDisplay(agent.status, colors);

  const issueCountDisplay =
    agent.status === "complete" && agent.issueCount > 0
      ? `${agent.issueCount} issue${agent.issueCount === 1 ? "" : "s"}`
      : "";

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={statusColor} dimColor={agent.status === "queued"}>
          {statusIcon}{" "}
        </Text>
        <Text dimColor={agent.status === "queued"}>
          {agent.meta.emoji} {agent.meta.name}
        </Text>
        {issueCountDisplay && (
          <Text color={colors.ui.warning}>{"  "}{issueCountDisplay}</Text>
        )}
      </Box>
      {agent.status === "running" && agent.currentAction && (
        <Box marginLeft={2}>
          <Text dimColor>
            {"\u2514\u2500 "}
            {agent.currentAction}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function ReviewSummary({ agents }: { agents: AgentState[] }): ReactElement {
  const { colors } = useTheme();
  const totalIssues = agents.reduce((sum, agent) => sum + agent.issueCount, 0);
  const agentCount = agents.length;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>{"─".repeat(19)}</Text>
      <Text color={colors.status.complete}>Review complete</Text>
      <Text dimColor>
        {agentCount} agent{agentCount === 1 ? "" : "s"} • {totalIssues} issue
        {totalIssues === 1 ? "" : "s"}
      </Text>
    </Box>
  );
}

export function AgentActivityPanel({
  agents,
  currentAction,
  height,
}: AgentActivityPanelProps): ReactElement {
  const runningAgent = agents.find((a) => a.status === "running");
  const displayAction = runningAgent?.currentAction ?? currentAction;

  const agentsWithAction = agents.map((agent) =>
    agent.status === "running" && displayAction
      ? { ...agent, currentAction: displayAction }
      : agent
  );

  const allComplete = agents.length > 0 && agents.every((a) => a.status === "complete");

  return (
    <Card title="Agent Activity">
      <Box flexDirection="column" height={height} gap={0}>
        {agentsWithAction.map((agent) => (
          <AgentRow key={agent.id} agent={agent} />
        ))}
        {allComplete && <ReviewSummary agents={agents} />}
      </Box>
    </Card>
  );
}
