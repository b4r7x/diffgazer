import { Box, Text } from "ink";
import type { ReviewIssue } from "@diffgazer/schemas/review";
import { useTheme } from "../../../theme/theme-context.js";
import { Tabs } from "../../../components/ui/tabs.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { EmptyState } from "../../../components/ui/empty-state.js";
import { Badge } from "../../../components/ui/badge.js";
import { CodeSnippet } from "./code-snippet.js";

export interface IssueDetailsPaneProps {
  issue?: ReviewIssue;
  isActive?: boolean;
  scrollHeight?: number;
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

function riskVariant(
  risk: string | undefined,
): "error" | "warning" | "info" {
  switch (risk) {
    case "high":
      return "error";
    case "medium":
      return "warning";
    default:
      return "info";
  }
}

function OverviewTab({ issue }: { issue: ReviewIssue }) {
  const { tokens } = useTheme();

  const codeEvidence = issue.evidence.filter((e) => e.type === "code");

  return (
    <Box flexDirection="column" gap={1} paddingTop={1}>
      <Box gap={1}>
        <Badge variant={severityVariant(issue.severity)} dot>
          {issue.severity}
        </Badge>
        <Badge variant="neutral">{issue.category}</Badge>
        <Text color={tokens.muted}>
          confidence: {Math.round(issue.confidence * 100)}%
        </Text>
      </Box>

      <SectionHeader variant="muted">Symptom</SectionHeader>
      <Text color={tokens.fg}>{issue.symptom}</Text>

      <SectionHeader variant="muted">Recommendation</SectionHeader>
      <Text color={tokens.fg}>{issue.recommendation}</Text>

      <Box gap={1}>
        <Text color={tokens.muted}>File:</Text>
        <Text color={tokens.accent}>{issue.file}</Text>
        {issue.line_start != null ? (
          <>
            <Text color={tokens.muted}>Lines:</Text>
            <Text color={tokens.accent}>
              {issue.line_end != null
                ? `${issue.line_start}-${issue.line_end}`
                : String(issue.line_start)}
            </Text>
          </>
        ) : null}
      </Box>

      {codeEvidence.length > 0 ? (
        <Box flexDirection="column" gap={1}>
          <SectionHeader variant="muted">Code Evidence</SectionHeader>
          {codeEvidence.map((ev, i) => (
            <Box key={i} flexDirection="column">
              <CodeSnippet
                filePath={ev.file ?? issue.file}
                startLine={ev.range?.start}
                code={ev.excerpt}
              />
            </Box>
          ))}
        </Box>
      ) : null}

      <SectionHeader variant="muted">Why It Matters</SectionHeader>
      <Text color={tokens.fg}>{issue.whyItMatters}</Text>

      {issue.fixPlan && issue.fixPlan.length > 0 ? (
        <Box flexDirection="column">
          <SectionHeader variant="muted">Fix Plan</SectionHeader>
          {issue.fixPlan.map((step) => (
            <Box key={step.step} gap={1}>
              <Text color={tokens.muted}>{`${String(step.step)}.`}</Text>
              <Text color={tokens.fg}>{step.action}</Text>
              {step.risk ? (
                <Badge variant={riskVariant(step.risk)}>{step.risk}</Badge>
              ) : null}
            </Box>
          ))}
        </Box>
      ) : null}

      {issue.betterOptions && issue.betterOptions.length > 0 ? (
        <Box flexDirection="column">
          <SectionHeader variant="muted">Better Options</SectionHeader>
          {issue.betterOptions.map((opt, i) => (
            <Box key={i} gap={1}>
              <Text color={tokens.muted}>-</Text>
              <Text color={tokens.fg}>{opt}</Text>
            </Box>
          ))}
        </Box>
      ) : null}

      {issue.testsToAdd && issue.testsToAdd.length > 0 ? (
        <Box flexDirection="column">
          <SectionHeader variant="muted">Tests to Add</SectionHeader>
          {issue.testsToAdd.map((test, i) => (
            <Box key={i} gap={1}>
              <Text color={tokens.muted}>-</Text>
              <Text color={tokens.fg}>{test}</Text>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function ExplainTab({ issue }: { issue: ReviewIssue }) {
  const { tokens } = useTheme();

  return (
    <Box flexDirection="column" gap={1} paddingTop={1}>
      <SectionHeader variant="muted">Rationale</SectionHeader>
      <Text color={tokens.fg}>{issue.rationale}</Text>

      <SectionHeader variant="muted">Recommendation</SectionHeader>
      <Text color={tokens.fg}>{issue.recommendation}</Text>

      {issue.evidence.length > 0 ? (
        <Box flexDirection="column" gap={1}>
          <SectionHeader variant="muted">Evidence</SectionHeader>
          {issue.evidence.map((ev, i) => (
            <Box key={i} flexDirection="column">
              <Box gap={1}>
                <Badge variant="neutral">{ev.type}</Badge>
                <Text color={tokens.accent}>{ev.title}</Text>
              </Box>
              <Text color={tokens.muted}>{ev.excerpt}</Text>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function TraceTab({ issue }: { issue: ReviewIssue }) {
  const { tokens } = useTheme();

  if (!issue.trace || issue.trace.length === 0) {
    return (
      <Box paddingTop={1}>
        <Text color={tokens.muted}>No trace data available</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1} paddingTop={1}>
      <SectionHeader variant="muted">Agent Trace</SectionHeader>
      {issue.trace.map((step) => (
        <Box key={step.step} flexDirection="column">
          <Box gap={1}>
            <Text color={tokens.muted}>{`#${String(step.step)}`}</Text>
            <Text color={tokens.accent} bold>{step.tool}</Text>
            <Text color={tokens.muted}>{step.timestamp}</Text>
          </Box>
          <Box paddingLeft={2} flexDirection="column">
            <Text color={tokens.fg}>
              <Text color={tokens.muted}>in: </Text>
              {step.inputSummary}
            </Text>
            <Text color={tokens.fg}>
              <Text color={tokens.muted}>out: </Text>
              {step.outputSummary}
            </Text>
            {step.artifacts && step.artifacts.length > 0 ? (
              <Text color={tokens.muted}>
                artifacts: {step.artifacts.join(", ")}
              </Text>
            ) : null}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function PatchTab({ issue }: { issue: ReviewIssue }) {
  const { tokens } = useTheme();

  if (!issue.suggested_patch) {
    return (
      <Box paddingTop={1}>
        <Text color={tokens.muted}>No patch suggested</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1} paddingTop={1}>
      <SectionHeader variant="muted">Suggested Patch</SectionHeader>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={tokens.border}
      >
        {issue.suggested_patch.split("\n").map((line, i) => {
          let color = tokens.fg;
          if (line.startsWith("+")) color = tokens.success;
          else if (line.startsWith("-")) color = tokens.error;
          else if (line.startsWith("@@")) color = tokens.accent;

          return (
            <Text key={i} color={color}>
              {line}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}

export function IssueDetailsPane({ issue, isActive = false, scrollHeight = 12 }: IssueDetailsPaneProps) {
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
          <Tabs.Trigger value="explain">Explain</Tabs.Trigger>
          <Tabs.Trigger value="trace">Trace</Tabs.Trigger>
          <Tabs.Trigger value="patch">Patch</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="overview">
          <ScrollArea height={scrollHeight} isActive={false}>
            <OverviewTab issue={issue} />
          </ScrollArea>
        </Tabs.Content>
        <Tabs.Content value="explain">
          <ScrollArea height={scrollHeight} isActive={false}>
            <ExplainTab issue={issue} />
          </ScrollArea>
        </Tabs.Content>
        <Tabs.Content value="trace">
          <ScrollArea height={scrollHeight} isActive={false}>
            <TraceTab issue={issue} />
          </ScrollArea>
        </Tabs.Content>
        <Tabs.Content value="patch">
          <ScrollArea height={scrollHeight} isActive={false}>
            <PatchTab issue={issue} />
          </ScrollArea>
        </Tabs.Content>
      </Tabs>
    </Box>
  );
}
