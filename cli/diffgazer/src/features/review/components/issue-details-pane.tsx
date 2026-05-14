import { Box, Text } from "ink";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import type { DetailsEmptyKind } from "@diffgazer/core/review";
import { useTheme } from "../../../theme/theme-context.js";
import { Tabs } from "../../../components/ui/tabs.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { EmptyState } from "../../../components/ui/empty-state.js";
import { Badge } from "../../../components/ui/badge.js";
import { CodeSnippet } from "./code-snippet.js";
import { DiffView } from "./diff-view.js";
import { FixPlanChecklist } from "./fix-plan-checklist.js";
import { severityVariant } from "../../../theme/severity-variant.js";
import { formatIssueLineRange } from "./issue-details-helpers.js";

const EMPTY_COPY: Record<
  DetailsEmptyKind,
  { title: string; description?: string }
> = {
  "no-issues": {
    title: "No issues in this review",
    description: "This analysis passed without findings.",
  },
  "filter-empty": {
    title: "No issues match this filter",
    description: "Choose another severity to continue.",
  },
  "no-selection": { title: "Select an issue to view details" },
};

export interface IssueDetailsPaneProps {
  issue?: ReviewIssue;
  isActive?: boolean;
  scrollHeight?: number;
  emptyKind?: DetailsEmptyKind;
  completedSteps: Set<number>;
  onToggleStep: (step: number) => void;
}

function IssueHeader({ issue }: { issue: ReviewIssue }) {
  const { tokens } = useTheme();
  const lineText = formatIssueLineRange(issue.line_start, issue.line_end);

  return (
    <Box flexDirection="column">
      <Text bold color={tokens.fg}>
        {issue.title}
      </Text>
      <Box gap={1}>
        <Text color={tokens.muted}>Location:</Text>
        <Text color={tokens.accent}>{`${issue.file}:${lineText}`}</Text>
      </Box>
    </Box>
  );
}

function DetailsTab({
  issue,
  completedSteps,
  onToggleStep,
}: {
  issue: ReviewIssue;
  completedSteps: Set<number>;
  onToggleStep: (step: number) => void;
}) {
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

      {codeEvidence.length > 0 ? (
        <Box flexDirection="column" gap={1}>
          <SectionHeader variant="muted">Evidence</SectionHeader>
          {codeEvidence.map((ev) => (
            <Box
              key={`${ev.file ?? issue.file}:${ev.range?.start ?? ""}:${ev.excerpt}`}
              flexDirection="column"
            >
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
          <FixPlanChecklist
            steps={issue.fixPlan}
            completedSteps={completedSteps}
            onToggle={onToggleStep}
          />
        </Box>
      ) : null}

      {issue.betterOptions && issue.betterOptions.length > 0 ? (
        <Box flexDirection="column">
          <SectionHeader variant="muted">Better Options</SectionHeader>
          {issue.betterOptions.map((opt) => (
            <Box key={opt} gap={1}>
              <Text color={tokens.muted}>-</Text>
              <Text color={tokens.fg}>{opt}</Text>
            </Box>
          ))}
        </Box>
      ) : null}

      {issue.testsToAdd && issue.testsToAdd.length > 0 ? (
        <Box flexDirection="column">
          <SectionHeader variant="muted">Tests to Add</SectionHeader>
          {issue.testsToAdd.map((test) => (
            <Box key={test} gap={1}>
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
    </Box>
  );
}

function TraceTab({ issue }: { issue: ReviewIssue }) {
  const { tokens } = useTheme();

  if (!issue.trace || issue.trace.length === 0) {
    return (
      <Box paddingTop={1}>
        <Text color={tokens.muted}>No trace data available for this issue.</Text>
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
            <Text color={tokens.accent} bold>
              {step.tool}
            </Text>
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
      <DiffView patch={issue.suggested_patch} />
    </Box>
  );
}

export function IssueDetailsPane({
  issue,
  isActive = false,
  scrollHeight = 12,
  emptyKind = "no-selection",
  completedSteps,
  onToggleStep,
}: IssueDetailsPaneProps) {
  if (!issue) {
    const empty = EMPTY_COPY[emptyKind];
    return (
      <EmptyState>
        <EmptyState.Message>{empty.title}</EmptyState.Message>
        {empty.description ? (
          <EmptyState.Description>{empty.description}</EmptyState.Description>
        ) : null}
      </EmptyState>
    );
  }

  return (
    <Box flexDirection="column">
      <Box paddingX={1} paddingTop={1}>
        <IssueHeader issue={issue} />
      </Box>
      <Tabs defaultValue="details">
        <Tabs.List isActive={isActive}>
          <Tabs.Trigger value="details">Details</Tabs.Trigger>
          <Tabs.Trigger value="explain">Explain</Tabs.Trigger>
          <Tabs.Trigger value="trace">Trace</Tabs.Trigger>
          {issue.suggested_patch ? (
            <Tabs.Trigger value="patch">Patch</Tabs.Trigger>
          ) : null}
        </Tabs.List>
        <Tabs.Content value="details">
          <ScrollArea height={scrollHeight} isActive={isActive}>
            <DetailsTab
              issue={issue}
              completedSteps={completedSteps}
              onToggleStep={onToggleStep}
            />
          </ScrollArea>
        </Tabs.Content>
        <Tabs.Content value="explain">
          <ScrollArea height={scrollHeight} isActive={isActive}>
            <ExplainTab issue={issue} />
          </ScrollArea>
        </Tabs.Content>
        <Tabs.Content value="trace">
          <ScrollArea height={scrollHeight} isActive={isActive}>
            <TraceTab issue={issue} />
          </ScrollArea>
        </Tabs.Content>
        {issue.suggested_patch ? (
          <Tabs.Content value="patch">
            <ScrollArea height={scrollHeight} isActive={isActive}>
              <PatchTab issue={issue} />
            </ScrollArea>
          </Tabs.Content>
        ) : null}
      </Tabs>
    </Box>
  );
}
