import {
  type DetailsEmptyKind,
  getDetailsEmptyCopy,
  type IssueDetailsPresentation,
  sanitizeTerminalText,
  toIssueDetailsPresentation,
} from "@diffgazer/core/review";
import { type IssueTab, isIssueTab } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { Box, Text } from "ink";
import { EmptyState } from "../../../../components/ui/empty-state";
import { ScrollArea } from "../../../../components/ui/scroll-area";
import { SectionHeader } from "../../../../components/ui/section-header";
import { Tabs } from "../../../../components/ui/tabs";
import { useTheme } from "../../../../theme/provider";
import { DiffView } from "../diff-view";
import { DetailsTab } from "./details";
import { TraceTab } from "./trace";

export interface IssueDetailsPaneProps {
  issue?: ReviewIssue;
  isActive?: boolean;
  scrollHeight?: number;
  emptyKind?: DetailsEmptyKind;
  activeTab: IssueTab;
  onTabChange: (tab: IssueTab) => void;
  completedSteps: Set<number>;
  onToggleStep: (step: number) => void;
  subZone?: IssueDetailsSubZone;
  truncateHeader?: boolean;
  showTabs?: boolean;
}

export type IssueDetailsSubZone = "body" | "fix-plan";

function IssueHeader({
  issue,
  presentation,
  truncate,
}: {
  issue: ReviewIssue;
  presentation: IssueDetailsPresentation;
  truncate: boolean;
}) {
  const { tokens } = useTheme();
  const wrap = truncate ? "truncate-end" : "wrap";

  return (
    <Box flexDirection="column" flexShrink={0}>
      <Text bold color={tokens.fg} wrap={wrap}>
        {sanitizeTerminalText(issue.title)}
      </Text>
      <Text color={tokens.accent} wrap={wrap}>
        <Text color={tokens.muted}>Location: </Text>
        {sanitizeTerminalText(presentation.location)}
      </Text>
    </Box>
  );
}

function ExplainTab({
  issue,
  scrollHeight,
  isActive,
}: {
  issue: ReviewIssue;
  scrollHeight: number;
  isActive: boolean;
}) {
  const { tokens } = useTheme();

  return (
    <ScrollArea height={scrollHeight} isActive={isActive} contentIdentity={issue.id}>
      <Box flexDirection="column" gap={1} paddingTop={1}>
        <SectionHeader variant="muted">Rationale</SectionHeader>
        <Text color={tokens.fg}>{sanitizeTerminalText(issue.rationale)}</Text>

        <SectionHeader variant="muted">Recommendation</SectionHeader>
        <Text color={tokens.fg}>{sanitizeTerminalText(issue.recommendation)}</Text>
      </Box>
    </ScrollArea>
  );
}

function PatchTab({
  issueId,
  patch,
  scrollHeight,
  isActive,
}: {
  issueId: string;
  patch: string;
  scrollHeight: number;
  isActive: boolean;
}) {
  return (
    <ScrollArea height={scrollHeight} isActive={isActive} contentIdentity={issueId}>
      <Box flexDirection="column" gap={1} paddingTop={1}>
        <SectionHeader variant="muted">Suggested Patch</SectionHeader>
        <DiffView patch={patch} />
      </Box>
    </ScrollArea>
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
  subZone = "body",
  truncateHeader = false,
  showTabs = true,
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

  const presentation = toIssueDetailsPresentation(issue);

  return (
    <Box flexDirection="column">
      <Box paddingX={1} paddingTop={1}>
        <IssueHeader issue={issue} presentation={presentation} truncate={truncateHeader} />
      </Box>
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isIssueTab(value)) onTabChange(value);
        }}
      >
        {showTabs ? (
          <Tabs.List isActive={isActive}>
            <Tabs.Trigger value="details">Details</Tabs.Trigger>
            <Tabs.Trigger value="explain">Explain</Tabs.Trigger>
            {issue.trace?.length ? <Tabs.Trigger value="trace">Trace</Tabs.Trigger> : null}
            {issue.suggested_patch ? <Tabs.Trigger value="patch">Patch</Tabs.Trigger> : null}
          </Tabs.List>
        ) : null}
        <Tabs.Content value="details">
          <DetailsTab
            issue={issue}
            completedSteps={completedSteps}
            onToggleStep={onToggleStep}
            subZone={subZone}
            scrollHeight={scrollHeight}
            isActive={isActive && subZone === "body"}
            presentation={presentation}
          />
        </Tabs.Content>
        <Tabs.Content value="explain">
          <ExplainTab issue={issue} scrollHeight={scrollHeight} isActive={isActive} />
        </Tabs.Content>
        {issue.trace?.length ? (
          <Tabs.Content value="trace">
            <TraceTab
              issueId={issue.id}
              trace={presentation.trace}
              scrollHeight={scrollHeight}
              isActive={isActive}
            />
          </Tabs.Content>
        ) : null}
        {issue.suggested_patch ? (
          <Tabs.Content value="patch">
            <PatchTab
              issueId={issue.id}
              patch={issue.suggested_patch}
              scrollHeight={scrollHeight}
              isActive={isActive}
            />
          </Tabs.Content>
        ) : null}
      </Tabs>
    </Box>
  );
}
