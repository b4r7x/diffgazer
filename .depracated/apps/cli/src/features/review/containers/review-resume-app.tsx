import React, { useEffect, useState, useCallback } from "react";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import type { TriageIssue } from "@repo/schemas/triage";
import type { SavedTriageReview } from "@repo/schemas/triage-storage";
import type { DrilldownResult } from "@repo/schemas/lens";
import { applyPatch } from "../../../lib/diff/index.js";
import { useTriageHistory } from "../hooks/use-triage-history.js";
import { ReviewScreen, ReviewDetailScreen, type ApplyFixResult } from "../components/index.js";
import { triggerDrilldown } from "../api/index.js";
import { Separator } from "../../../components/ui/separator.js";

type Screen = "list" | "detail";

interface ReviewResumeAppProps {
  reviewId: string;
}

export function ReviewResumeApp({
  reviewId,
}: ReviewResumeAppProps): React.ReactElement {
  const { exit } = useApp();
  const { loadOne, current, listState, error } = useTriageHistory();
  const [screen, setScreen] = useState<Screen>("list");
  const [selectedIssue, setSelectedIssue] = useState<TriageIssue | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownResult | null>(null);
  const [isLoadingDrilldown, setIsLoadingDrilldown] = useState(false);

  useEffect(() => {
    void loadOne(reviewId);
  }, [reviewId]);

  const handleSelectIssue = useCallback(
    (issue: TriageIssue) => {
      setSelectedIssue(issue);

      const existingDrilldown = current?.drilldowns.find(
        (d) => d.issueId === issue.id
      );
      setDrilldown(existingDrilldown ?? null);
      setScreen("detail");
    },
    [current]
  );

  const handleBack = useCallback(() => {
    if (screen === "detail") {
      setScreen("list");
      setSelectedIssue(null);
      setDrilldown(null);
    } else {
      exit();
    }
  }, [screen, exit]);

  const handleDrilldown = useCallback(async () => {
    if (!selectedIssue) return;

    setIsLoadingDrilldown(true);
    try {
      const result = await triggerDrilldown({
        reviewId,
        issueId: selectedIssue.id,
      });
      setDrilldown(result.drilldown);
    } catch (err) {
      console.error("Failed to get drilldown:", err);
    } finally {
      setIsLoadingDrilldown(false);
    }
  }, [selectedIssue, reviewId]);

  const handleApplyFix = useCallback(async (issue: TriageIssue): Promise<ApplyFixResult> => {
    const patch = issue.suggested_patch;
    if (!patch) {
      return { success: false, message: "No suggested patch available" };
    }

    const filePath = resolve(process.cwd(), issue.file);

    try {
      const content = await readFile(filePath, "utf-8");
      const patchResult = applyPatch(content, patch);

      if (!patchResult.ok) {
        return {
          success: false,
          message: `${patchResult.error.message}${patchResult.error.details ? `: ${patchResult.error.details}` : ""}`,
        };
      }

      await writeFile(filePath, patchResult.value, "utf-8");

      return { success: true, message: `Applied fix to ${issue.file}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Failed to apply patch: ${message}` };
    }
  }, []);

  const handleApplyPatch = useCallback(async (issue: TriageIssue, patch: string): Promise<ApplyFixResult> => {
    const filePath = resolve(process.cwd(), issue.file);

    try {
      const content = await readFile(filePath, "utf-8");
      const patchResult = applyPatch(content, patch);

      if (!patchResult.ok) {
        return {
          success: false,
          message: `${patchResult.error.message}${patchResult.error.details ? `: ${patchResult.error.details}` : ""}`,
        };
      }

      await writeFile(filePath, patchResult.value, "utf-8");

      return { success: true, message: `Applied fix to ${issue.file}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Failed to apply patch: ${message}` };
    }
  }, []);

  if (listState === "loading" || !current) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          Resume Review
        </Text>
        <Separator />
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Loading review...</Text>
        </Box>
      </Box>
    );
  }

  if (listState === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          Resume Review
        </Text>
        <Separator />
        <Text color="red">Error: {error?.message ?? "Failed to load review"}</Text>
        <Box marginTop={1}>
          <Text dimColor>[q] Quit</Text>
        </Box>
      </Box>
    );
  }

  if (screen === "detail" && selectedIssue) {
    return (
      <ReviewDetailScreen
        issue={selectedIssue}
        drilldown={drilldown}
        isLoadingDrilldown={isLoadingDrilldown}
        onBack={handleBack}
        onDrilldown={handleDrilldown}
        onApplyPatch={handleApplyPatch}
      />
    );
  }

  return (
    <ReviewScreen
      review={current}
      result={current.result}
      isLoading={false}
      onSelectIssue={handleSelectIssue}
      onBack={handleBack}
      onApplyFix={handleApplyFix}
    />
  );
}
