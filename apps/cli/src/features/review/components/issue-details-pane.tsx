import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { Tabs } from "../../../components/ui/tabs.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { EmptyState } from "../../../components/ui/empty-state.js";
import { Badge } from "../../../components/ui/badge.js";
import { CodeSnippet } from "./code-snippet.js";

interface Issue {
  id: string;
  severity: string;
  title: string;
  description: string;
  filePath: string;
  startLine?: number;
  code?: string;
  fixPlan?: string;
  category?: string;
}

export interface IssueDetailsPaneProps {
  issue?: Issue;
  isActive?: boolean;
}

function severityVariant(
  severity: string,
): "error" | "warning" | "info" | "neutral" {
  switch (severity) {
    case "blocker":
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
      return "info";
    default:
      return "neutral";
  }
}

function OverviewTab({ issue }: { issue: Issue }) {
  const { tokens } = useTheme();

  return (
    <Box flexDirection="column" gap={1} paddingTop={1}>
      <Box gap={1}>
        <Badge variant={severityVariant(issue.severity)} dot>
          {issue.severity}
        </Badge>
        {issue.category ? (
          <Badge variant="neutral">{issue.category}</Badge>
        ) : null}
      </Box>
      <SectionHeader variant="muted">Description</SectionHeader>
      <Text color={tokens.fg}>{issue.description}</Text>
      <Box gap={1}>
        <Text color={tokens.muted}>File:</Text>
        <Text color={tokens.accent}>{issue.filePath}</Text>
        {issue.startLine != null ? (
          <>
            <Text color={tokens.muted}>Line:</Text>
            <Text color={tokens.accent}>{issue.startLine}</Text>
          </>
        ) : null}
      </Box>
    </Box>
  );
}

function CodeTab({ issue }: { issue: Issue }) {
  const { tokens } = useTheme();

  if (!issue.code) {
    return (
      <Box paddingTop={1}>
        <Text color={tokens.muted}>No code snippet available</Text>
      </Box>
    );
  }

  return (
    <Box paddingTop={1}>
      <CodeSnippet
        filePath={issue.filePath}
        startLine={issue.startLine}
        code={issue.code}
      />
    </Box>
  );
}

function FixPlanTab({ issue }: { issue: Issue }) {
  const { tokens } = useTheme();

  if (!issue.fixPlan) {
    return (
      <Box paddingTop={1}>
        <Text color={tokens.muted}>No fix plan available</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      <SectionHeader variant="muted">Suggested Fix</SectionHeader>
      <Text color={tokens.fg}>{issue.fixPlan}</Text>
    </Box>
  );
}

export function IssueDetailsPane({ issue, isActive = false }: IssueDetailsPaneProps) {
  if (!issue) {
    return (
      <EmptyState>
        <EmptyState.Message>No issue selected</EmptyState.Message>
        <EmptyState.Description>
          Select an issue from the list to view details
        </EmptyState.Description>
      </EmptyState>
    );
  }

  return (
    <Box flexDirection="column">
      <SectionHeader bordered>{issue.title}</SectionHeader>
      <Tabs defaultValue="overview">
        <Tabs.List isActive={isActive}>
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="code">Code</Tabs.Trigger>
          <Tabs.Trigger value="fix">Fix Plan</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="overview">
          <ScrollArea height={12} isActive={false}>
            <OverviewTab issue={issue} />
          </ScrollArea>
        </Tabs.Content>
        <Tabs.Content value="code">
          <ScrollArea height={12} isActive={false}>
            <CodeTab issue={issue} />
          </ScrollArea>
        </Tabs.Content>
        <Tabs.Content value="fix">
          <ScrollArea height={12} isActive={false}>
            <FixPlanTab issue={issue} />
          </ScrollArea>
        </Tabs.Content>
      </Tabs>
    </Box>
  );
}
