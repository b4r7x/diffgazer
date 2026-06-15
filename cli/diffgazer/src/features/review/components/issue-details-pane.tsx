import {
  type DetailsEmptyKind,
  getDetailsEmptyCopy,
  sanitizeTerminalText,
} from "@diffgazer/core/review";
import type { IssueTab } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { Box, Text } from "ink";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/ui/empty-state";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { SectionHeader } from "../../../components/ui/section-header";
import { Tabs } from "../../../components/ui/tabs";
import { useTheme } from "../../../theme/provider";
import { severityVariant } from "../../../theme/severity-variant";
import { formatIssueLineRange } from "../lib/issue-line-range";
import { CodeSnippet } from "./code-snippet";
import { DiffView } from "./diff-view";
import { FixPlanChecklist } from "./fix-plan-checklist";

export interface IssueDetailsPaneProps {
  issue?: ReviewIssue;
  isActive?: boolean;
  scrollHeight?: number;
  emptyKind?: DetailsEmptyKind;
  activeTab: IssueTab;
  onTabChange: (tab: IssueTab) => void;
  completedSteps: Set<number>;
  onToggleStep: (step: number) => void;
}

function IssueHeader({ issue }: { issue: ReviewIssue }) {
  const { tokens } = useTheme();
  const lineText = formatIssueLineRange(issue.line_start, issue.line_end);

  return (
    <Box flexDirection="column">
      <Text bold color={tokens.fg}>
        {sanitizeTerminalText(issue.title)}
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
  isActive,
}: {
  issue: ReviewIssue;
  completedSteps: Set<number>;
  onToggleStep: (step: number) => void;
  isActive: boolean;
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
        <Text color={tokens.muted}>confidence: {Math.round(issue.confidence * 100)}%</Text>
      </Box>

      <SectionHeader variant="muted">Symptom</SectionHeader>
      <Text color={tokens.fg}>{sanitizeTerminalText(issue.symptom)}</Text>

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
                code={sanitizeTerminalText(ev.excerpt)}
              />
            </Box>
          ))}
        </Box>
      ) : null}

      <SectionHeader variant="muted">Why It Matters</SectionHeader>
      <Text color={tokens.fg}>{sanitizeTerminalText(issue.whyItMatters)}</Text>

      {issue.fixPlan && issue.fixPlan.length > 0 ? (
        <Box flexDirection="column">
          <SectionHeader variant="muted">Fix Plan</SectionHeader>
          <FixPlanChecklist
            steps={issue.fixPlan}
            completedSteps={completedSteps}
            onToggle={onToggleStep}
            isActive={isActive}
          />
        </Box>
      ) : null}

      {issue.betterOptions && issue.betterOptions.length > 0 ? (
        <Box flexDirection="column">
          <SectionHeader variant="muted">Better Options</SectionHeader>
          {issue.betterOptions.map((opt) => (
            <Box key={opt} gap={1}>
              <Text color={tokens.muted}>-</Text>
              <Text color={tokens.fg}>{sanitizeTerminalText(opt)}</Text>
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
      <Text color={tokens.fg}>{sanitizeTerminalText(issue.rationale)}</Text>

      <SectionHeader variant="muted">Recommendation</SectionHeader>
      <Text color={tokens.fg}>{sanitizeTerminalText(issue.recommendation)}</Text>
    </Box>
  );
}

function TraceTab({ issue }: { issue: ReviewIssue }) {
  const { tokens } = useTheme();

  // The trace tab is only rendered when issue.trace is non-empty (the tab is
  // gated in IssueDetailsPane), so trace steps are always present here.
  return (
    <Box flexDirection="column" gap={1} paddingTop={1}>
      <SectionHeader variant="muted">Agent Trace</SectionHeader>
      {issue.trace?.map((step) => (
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
  activeTab,
  onTabChange,
  completedSteps,
  onToggleStep,
}: IssueDetailsPaneProps) {
  if (!issue) {
    const empty = getDetailsEmptyCopy(emptyKind);
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
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as IssueTab)}>
        <Tabs.List isActive={isActive}>
          <Tabs.Trigger value="details">Details</Tabs.Trigger>
          <Tabs.Trigger value="explain">Explain</Tabs.Trigger>
          {issue.trace?.length ? <Tabs.Trigger value="trace">Trace</Tabs.Trigger> : null}
          {issue.suggested_patch ? <Tabs.Trigger value="patch">Patch</Tabs.Trigger> : null}
        </Tabs.List>
        <Tabs.Content value="details">
          <ScrollArea height={scrollHeight} isActive={isActive}>
            <DetailsTab
              issue={issue}
              completedSteps={completedSteps}
              onToggleStep={onToggleStep}
              isActive={isActive}
            />
          </ScrollArea>
        </Tabs.Content>
        <Tabs.Content value="explain">
          <ScrollArea height={scrollHeight} isActive={isActive}>
            <ExplainTab issue={issue} />
          </ScrollArea>
        </Tabs.Content>
        {issue.trace?.length ? (
          <Tabs.Content value="trace">
            <ScrollArea height={scrollHeight} isActive={isActive}>
              <TraceTab issue={issue} />
            </ScrollArea>
          </Tabs.Content>
        ) : null}
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
