import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { TriageIssue } from "@repo/schemas/triage";
import type { DrilldownResult } from "@repo/schemas/lens";
import { IssueTabs } from "./issue-tabs.js";
import type { IssueTab } from "../constants.js";
import { IssueBodyDetails } from "./issue-body-details.js";
import { IssueBodyExplain } from "./issue-body-explain.js";
import { IssueBodyTrace } from "./issue-body-trace.js";
import { IssueBodyPatch } from "./issue-body-patch.js";
import { Badge } from "../../../components/ui/badge.js";
import { TRIAGE_SEVERITY_COLORS } from "../constants.js";

export interface IssueDetailsPaneProps {
  issue: TriageIssue | null;
  drilldown?: DrilldownResult | null;
  activeTab: IssueTab;
  onTabChange?: (tab: IssueTab) => void;
  onApplyPatch?: (issue: TriageIssue) => void;
  isApplying?: boolean;
  focus?: boolean;
  height?: number;
}

function IssueHeader({ issue }: { issue: TriageIssue }): ReactElement {
  const severityColor = TRIAGE_SEVERITY_COLORS[issue.severity];

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" gap={1}>
        <Badge
          text={issue.severity.toUpperCase()}
          color={severityColor}
        />
        <Badge text={issue.category.toUpperCase()} variant="info" />
        <Text bold>{issue.title}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {issue.file}
          {issue.line_start !== null && `:${issue.line_start}`}
          {issue.line_end !== null && issue.line_end !== issue.line_start
            ? `-${issue.line_end}`
            : ""}
        </Text>
        <Text dimColor> | </Text>
        <Text dimColor>{Math.round(issue.confidence * 100)}% confidence</Text>
      </Box>
    </Box>
  );
}

function DrilldownPanel({ drilldown }: { drilldown: DrilldownResult }): ReactElement {
  return (
    <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="cyan" padding={1}>
      <Text bold color="cyan">Drilldown Analysis</Text>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="yellow">Root Cause</Text>
        <Box marginLeft={2}>
          <Text wrap="wrap">{drilldown.rootCause}</Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="red">Impact</Text>
        <Box marginLeft={2}>
          <Text wrap="wrap">{drilldown.impact}</Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="green">Suggested Fix</Text>
        <Box marginLeft={2}>
          <Text wrap="wrap">{drilldown.suggestedFix}</Text>
        </Box>
      </Box>

      {drilldown.relatedIssues.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="magenta">Related Issues</Text>
          <Box marginLeft={2} flexDirection="column">
            {drilldown.relatedIssues.map((issueId) => (
              <Text key={issueId} dimColor>- {issueId}</Text>
            ))}
          </Box>
        </Box>
      )}

      {drilldown.references.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>References</Text>
          <Box marginLeft={2} flexDirection="column">
            {drilldown.references.map((ref) => (
              <Text key={ref} dimColor>- {ref}</Text>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

export function IssueDetailsPane({
  issue,
  drilldown,
  activeTab,
  onTabChange,
  onApplyPatch,
  isApplying = false,
  focus = false,
  height,
}: IssueDetailsPaneProps): ReactElement {
  const borderColor = focus ? "cyan" : "gray";

  if (!issue) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={borderColor}
        padding={1}
        justifyContent="center"
        alignItems="center"
        height={height}
      >
        <Text dimColor>Select an issue from the list</Text>
      </Box>
    );
  }

  const hasPatch = Boolean(issue.suggested_patch);
  const hasTrace = Boolean(issue.trace && issue.trace.length > 0);
  const showDrilldown = drilldown && drilldown.issueId === issue.id;

  const headerHeight = 4;
  const tabsHeight = 2;
  const drilldownHeight = showDrilldown ? 12 : 0;
  const borderPadding = 4;
  const contentHeight = height
    ? Math.max(1, height - headerHeight - tabsHeight - drilldownHeight - borderPadding)
    : undefined;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={borderColor}
      padding={1}
      height={height}
    >
      <IssueHeader issue={issue} />

      <IssueTabs activeTab={activeTab} hasPatch={hasPatch} hasTrace={hasTrace} />

      <Box
        flexDirection="column"
        flexGrow={1}
        height={contentHeight}
        overflowY="hidden"
      >
        {activeTab === "details" && <IssueBodyDetails issue={issue} />}
        {activeTab === "explain" && <IssueBodyExplain evidence={issue.evidence} />}
        {activeTab === "trace" && <IssueBodyTrace trace={issue.trace} height={contentHeight} />}
        {activeTab === "patch" && (
          <IssueBodyPatch
            patch={issue.suggested_patch}
            onApply={onApplyPatch ? () => onApplyPatch(issue) : undefined}
            isApplying={isApplying}
          />
        )}
      </Box>

      {showDrilldown && <DrilldownPanel drilldown={drilldown} />}
    </Box>
  );
}
