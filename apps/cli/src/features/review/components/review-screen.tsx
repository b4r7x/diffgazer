import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useInput, useApp } from "ink";
import Spinner from "ink-spinner";
import type { TriageIssue, TriageResult } from "@repo/schemas/triage";
import type { SavedTriageReview } from "@repo/schemas/triage-storage";
import type { AgentStreamEvent } from "@repo/schemas/agent-event";
import { TRIAGE_SEVERITY_COLORS } from "../constants.js";
import { Separator } from "../../../components/ui/separator.js";
import { AgentActivityPanel } from "./agent-activity-panel.js";
import { useAgentActivity } from "../hooks/use-agent-activity.js";

interface IssueStatus {
  ignored: boolean;
  applied: boolean;
}

export interface ApplyFixResult {
  success: boolean;
  message?: string;
}

export interface ReviewScreenProps {
  review: SavedTriageReview | null;
  result: TriageResult | null;
  isLoading: boolean;
  loadingMessage?: string;
  lensProgress?: {
    currentLens: string | null;
    currentIndex: number;
    totalLenses: number;
  };
  onSelectIssue: (issue: TriageIssue) => void;
  onBack: () => void;
  onApplyFix?: (issue: TriageIssue) => Promise<ApplyFixResult>;
  agentEvents?: AgentStreamEvent[];
  isReviewing?: boolean;
}

function IssueListItem({
  issue,
  isSelected,
  status,
}: {
  issue: TriageIssue;
  isSelected: boolean;
  status: IssueStatus;
}): React.ReactElement {
  const severityColor = TRIAGE_SEVERITY_COLORS[issue.severity];
  const prefix = isSelected ? "> " : "  ";

  let statusIndicator = "";
  if (status.applied) {
    statusIndicator = " [APPLIED]";
  } else if (status.ignored) {
    statusIndicator = " [IGNORED]";
  }

  return (
    <Box flexDirection="row">
      <Text color={isSelected ? "green" : undefined}>{prefix}</Text>
      <Text color={severityColor} bold>
        [{issue.severity.toUpperCase()}]
      </Text>
      <Text> </Text>
      <Text dimColor={status.ignored}>
        {issue.title}
        {issue.file && (
          <Text dimColor>
            {" "}
            ({issue.file}
            {issue.line_start !== null ? `:${issue.line_start}` : ""})
          </Text>
        )}
      </Text>
      {statusIndicator && (
        <Text color={status.applied ? "green" : "gray"}>{statusIndicator}</Text>
      )}
    </Box>
  );
}

function SeveritySummary({ issues }: { issues: TriageIssue[] }): React.ReactElement {
  const counts = {
    blocker: 0,
    high: 0,
    medium: 0,
    low: 0,
    nit: 0,
  };

  for (const issue of issues) {
    counts[issue.severity]++;
  }

  return (
    <Box flexDirection="row" gap={2}>
      {counts.blocker > 0 && (
        <Text color="red">{counts.blocker} blocker</Text>
      )}
      {counts.high > 0 && (
        <Text color="magenta">{counts.high} high</Text>
      )}
      {counts.medium > 0 && (
        <Text color="yellow">{counts.medium} medium</Text>
      )}
      {counts.low > 0 && (
        <Text color="blue">{counts.low} low</Text>
      )}
      {counts.nit > 0 && (
        <Text color="gray">{counts.nit} nit</Text>
      )}
    </Box>
  );
}

export function ReviewScreen({
  review,
  result,
  isLoading,
  loadingMessage,
  lensProgress,
  onSelectIssue,
  onBack,
  onApplyFix,
  agentEvents = [],
  isReviewing = false,
}: ReviewScreenProps): React.ReactElement {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [issueStatuses, setIssueStatuses] = useState(
    () => new Map<string, IssueStatus>()
  );
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const { agents, currentAction } = useAgentActivity(agentEvents);
  const showAgentPanel = isReviewing && agents.length > 0;

  const issues = result?.issues ?? [];
  const prevIssuesLengthRef = useRef(issues.length);

  useEffect(() => {
    // Only clamp when issues array shrinks
    if (issues.length < prevIssuesLengthRef.current && issues.length > 0) {
      setSelectedIndex((idx) => Math.min(idx, issues.length - 1));
    }
    prevIssuesLengthRef.current = issues.length;
  }, [issues.length]);

  const getIssueStatus = useCallback(
    (id: string): IssueStatus => {
      return issueStatuses.get(id) ?? { ignored: false, applied: false };
    },
    [issueStatuses]
  );

  const toggleIgnore = useCallback((id: string) => {
    setIssueStatuses((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(id) ?? { ignored: false, applied: false };
      newMap.set(id, { ...current, ignored: !current.ignored });
      return newMap;
    });
  }, []);

  const markApplied = useCallback((id: string) => {
    setIssueStatuses((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(id) ?? { ignored: false, applied: false };
      newMap.set(id, { ...current, applied: true, ignored: false });
      return newMap;
    });
  }, []);

  const handleApply = useCallback(async (issue: TriageIssue) => {
    if (!onApplyFix || isApplying) return;

    setIsApplying(true);
    setFeedback(null);

    const result = await onApplyFix(issue);

    if (result.success) {
      markApplied(issue.id);
      setFeedback({ type: "success", message: result.message ?? `Applied fix to ${issue.file}` });
    } else {
      setFeedback({ type: "error", message: result.message ?? "Failed to apply fix" });
    }

    setIsApplying(false);
  }, [onApplyFix, isApplying, markApplied]);

  useInput((input, key) => {
    if (isLoading || isApplying) return;

    if (input === "j" || key.downArrow) {
      setSelectedIndex((i) => Math.min(i + 1, issues.length - 1));
    }

    if (input === "k" || key.upArrow) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }

    if (key.return && issues[selectedIndex]) {
      onSelectIssue(issues[selectedIndex]);
    }

    if (input === "i" && issues[selectedIndex]) {
      toggleIgnore(issues[selectedIndex].id);
    }

    if (input === "a" && issues[selectedIndex] && onApplyFix) {
      void handleApply(issues[selectedIndex]);
    }

    if (input === "b" || key.escape) {
      onBack();
    }

    if (input === "q") {
      exit();
    }
  });

  if (isLoading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          AI Code Review
        </Text>
        <Separator />
        <Box marginTop={1} flexDirection="row" gap={2}>
          <Box flexDirection="column">
            <Box>
              <Spinner type="dots" />
              <Text> {loadingMessage ?? "Analyzing code..."}</Text>
            </Box>
            {lensProgress && lensProgress.totalLenses > 0 && (
              <Box marginTop={1}>
                <Text dimColor>
                  Lens {lensProgress.currentIndex + 1}/{lensProgress.totalLenses}
                  {lensProgress.currentLens && `: ${lensProgress.currentLens}`}
                </Text>
              </Box>
            )}
          </Box>
          {showAgentPanel && (
            <Box flexShrink={0} width={28}>
              <AgentActivityPanel
                agents={agents}
                currentAction={currentAction}
                height={10}
              />
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  if (!result || issues.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          AI Code Review
        </Text>
        <Separator />
        <Box marginTop={1}>
          <Text color="green">No issues found!</Text>
        </Box>
        {result?.summary && (
          <Box marginTop={1}>
            <Text dimColor>{result.summary}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text dimColor>[b] Back  [q] Quit</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        AI Code Review
      </Text>
      <Separator />

      <Box marginTop={1}>
        <SeveritySummary issues={issues} />
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {issues.map((issue, index) => (
          <IssueListItem
            key={issue.id}
            issue={issue}
            isSelected={index === selectedIndex}
            status={getIssueStatus(issue.id)}
          />
        ))}
      </Box>

      {feedback && (
        <Box marginTop={1}>
          <Text color={feedback.type === "success" ? "green" : "red"}>
            {feedback.type === "success" ? "[OK] " : "[ERROR] "}
            {feedback.message}
          </Text>
        </Box>
      )}

      {isApplying && (
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Applying fix...</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          [j/k] Navigate  [Enter] Details  [i] Ignore  [a] Apply  [b] Back  [q] Quit
        </Text>
      </Box>
    </Box>
  );
}
