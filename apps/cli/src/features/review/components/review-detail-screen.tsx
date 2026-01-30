import React, { useState, useCallback, useRef } from "react";
import { Box, Text, useInput, useApp } from "ink";
import Spinner from "ink-spinner";
import type { TriageIssue } from "@repo/schemas/triage";
import type { DrilldownResult } from "@repo/schemas/lens";
import { TRIAGE_SEVERITY_COLORS, MAX_PATCH_LINES } from "../constants.js";
import { Separator } from "../../../components/ui/separator.js";
import { DiffLine } from "../../../components/ui/diff-line.js";
import type { ApplyFixResult } from "./review-screen.js";

interface ReviewDetailScreenProps {
  issue: TriageIssue;
  drilldown: DrilldownResult | null;
  isLoadingDrilldown: boolean;
  onBack: () => void;
  onApplyPatch?: (issue: TriageIssue, patch: string) => Promise<ApplyFixResult>;
  onDrilldown: () => void;
}

function PatchDisplay({ patch }: { patch: string }): React.ReactElement {
  const allLines = patch.split("\n");
  const lines = allLines.slice(0, MAX_PATCH_LINES);
  const hasMore = allLines.length > MAX_PATCH_LINES;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color="cyan">
        Suggested Patch:
      </Text>
      <Box flexDirection="column" marginLeft={1} marginTop={1}>
        {lines.map((line, i) => (
          <DiffLine key={`patch-${i}`} line={line} />
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
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const isApplyingRef = useRef(false);

  const handleApply = useCallback(async () => {
    if (!onApplyPatch || isApplyingRef.current) return;

    const patch = drilldown?.patch ?? issue.suggested_patch;
    if (!patch) return;

    isApplyingRef.current = true;
    setIsApplying(true);
    setFeedback(null);

    const result = await onApplyPatch(issue, patch);

    if (result.success) {
      setFeedback({ type: "success", message: result.message ?? `Applied fix to ${issue.file}` });
    } else {
      setFeedback({ type: "error", message: result.message ?? "Failed to apply fix" });
    }

    isApplyingRef.current = false;
    setIsApplying(false);
  }, [onApplyPatch, drilldown?.patch, issue]);

  useInput((input, key) => {
    if (isApplyingRef.current) return;

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
                {drilldown.references.map((ref) => (
                  <Text key={ref} dimColor>
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
          {!drilldown && !isLoadingDrilldown && "[d] Drilldown  "}
          {hasPatch && "[a] Apply patch  "}[b] Back  [q] Quit
        </Text>
      </Box>
    </Box>
  );
}
