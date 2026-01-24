import React, { useState } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import Spinner from "ink-spinner";
import type { TriageIssue } from "@repo/schemas/triage";
import type { DrilldownResult } from "@repo/schemas/lens";
import { TRIAGE_SEVERITY_COLORS } from "../constants.js";
import { Separator } from "../../../components/ui/separator.js";
import { classifyDiffLine } from "@repo/core/diff";
import type { ApplyFixResult } from "./review-screen.js";

interface ReviewDetailScreenProps {
  issue: TriageIssue;
  drilldown: DrilldownResult | null;
  isLoadingDrilldown: boolean;
  onBack: () => void;
  onApplyPatch?: (issue: TriageIssue, patch: string) => Promise<ApplyFixResult>;
  onDrilldown: () => void;
}

function DiffLine({ line }: { line: string }): React.ReactElement {
  const lineType = classifyDiffLine(line);

  switch (lineType) {
    case "addition":
      return <Text color="green">{line}</Text>;
    case "deletion":
      return <Text color="red">{line}</Text>;
    case "hunk-header":
      return <Text color="cyan">{line}</Text>;
    case "file-header":
      return <Text bold>{line}</Text>;
    case "context":
    default:
      return <Text>{line}</Text>;
  }
}

function PatchDisplay({ patch }: { patch: string }): React.ReactElement {
  const lines = patch.split("\n").slice(0, 30);
  const hasMore = patch.split("\n").length > 30;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color="cyan">
        Suggested Patch:
      </Text>
      <Box flexDirection="column" marginLeft={1} marginTop={1}>
        {lines.map((line, i) => (
          <DiffLine key={i} line={line} />
        ))}
        {hasMore && (
          <Text dimColor>... (patch truncated)</Text>
        )}
      </Box>
    </Box>
  );
}

function Section({
  title,
  content,
  color = "white",
}: {
  title: string;
  content: string;
  color?: string;
}): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color={color}>
        {title}:
      </Text>
      <Box marginLeft={1} marginTop={0}>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
}

export function ReviewDetailScreen({
  issue,
  drilldown,
  isLoadingDrilldown,
  onBack,
  onApplyPatch,
  onDrilldown,
}: ReviewDetailScreenProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [scrollOffset, setScrollOffset] = useState(0);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const terminalHeight = stdout?.rows ?? 24;
  const contentHeight = terminalHeight - 6;

  const handleApply = async () => {
    if (!onApplyPatch || isApplying) return;

    const patch = drilldown?.patch ?? issue.suggested_patch;
    if (!patch) return;

    setIsApplying(true);
    setFeedback(null);

    const result = await onApplyPatch(issue, patch);

    if (result.success) {
      setFeedback({ type: "success", message: result.message ?? `Applied fix to ${issue.file}` });
    } else {
      setFeedback({ type: "error", message: result.message ?? "Failed to apply fix" });
    }

    setIsApplying(false);
  };

  useInput((input, key) => {
    if (isApplying) return;

    if (input === "j" || key.downArrow) {
      setScrollOffset((s) => s + 1);
    }

    if (input === "k" || key.upArrow) {
      setScrollOffset((s) => Math.max(0, s - 1));
    }

    if (input === "d" && !drilldown && !isLoadingDrilldown) {
      onDrilldown();
    }

    if (input === "a" && onApplyPatch) {
      void handleApply();
    }

    if (input === "b" || key.escape) {
      onBack();
    }

    if (input === "q") {
      exit();
    }
  });

  const severityColor = TRIAGE_SEVERITY_COLORS[issue.severity];

  const hasPatch = drilldown?.patch || issue.suggested_patch;

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="row" gap={1}>
        <Text bold color={severityColor}>
          [{issue.severity.toUpperCase()}]
        </Text>
        <Text bold>{issue.title}</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {issue.file}
          {issue.line_start !== null ? `:${issue.line_start}` : ""}
          {issue.line_end !== null && issue.line_end !== issue.line_start
            ? `-${issue.line_end}`
            : ""}
        </Text>
        <Text dimColor> | </Text>
        <Text dimColor>Category: {issue.category}</Text>
        <Text dimColor> | </Text>
        <Text dimColor>Confidence: {Math.round(issue.confidence * 100)}%</Text>
      </Box>

      <Separator />

      <Section title="Rationale" content={issue.rationale} />

      <Section title="Recommendation" content={issue.recommendation} color="green" />

      {issue.suggested_patch && !drilldown && (
        <PatchDisplay patch={issue.suggested_patch} />
      )}

      {isLoadingDrilldown && (
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Loading detailed analysis...</Text>
        </Box>
      )}

      {drilldown && (
        <>
          <Section title="Detailed Analysis" content={drilldown.detailedAnalysis} />
          <Section title="Root Cause" content={drilldown.rootCause} color="yellow" />
          <Section title="Impact" content={drilldown.impact} color="red" />
          <Section title="Suggested Fix" content={drilldown.suggestedFix} color="green" />

          {drilldown.patch && <PatchDisplay patch={drilldown.patch} />}

          {drilldown.relatedIssues.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold>Related Issues:</Text>
              <Box marginLeft={1}>
                <Text dimColor>{drilldown.relatedIssues.join(", ")}</Text>
              </Box>
            </Box>
          )}

          {drilldown.references.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold>References:</Text>
              <Box flexDirection="column" marginLeft={1}>
                {drilldown.references.map((ref, i) => (
                  <Text key={i} dimColor>
                    - {ref}
                  </Text>
                ))}
              </Box>
            </Box>
          )}
        </>
      )}

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
          [j/k] Scroll  {!drilldown && !isLoadingDrilldown && "[d] Drilldown  "}
          {hasPatch && "[a] Apply patch  "}[b] Back  [q] Quit
        </Text>
      </Box>
    </Box>
  );
}
