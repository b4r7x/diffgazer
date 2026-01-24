import React, { useEffect, useState, useCallback } from "react";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { useApp } from "ink";
import type { TriageIssue } from "@repo/schemas/triage";
import type { DrilldownResult, LensId, ProfileId } from "@repo/schemas/lens";
import { applyPatch } from "@repo/core/diff";
import { useTriage } from "../hooks/use-triage.js";
import { ReviewScreen, type ApplyFixResult } from "../components/review-screen.js";
import { ReviewDetailScreen } from "../components/review-detail-screen.js";
import { triggerDrilldown } from "../api/index.js";

type Screen = "list" | "detail";

interface InteractiveReviewAppProps {
  staged: boolean;
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
}

export function InteractiveReviewApp({
  staged,
  files,
  lenses,
  profile,
}: InteractiveReviewAppProps): React.ReactElement {
  const { exit } = useApp();
  const { state, startTriage } = useTriage({ files, lenses, profile });
  const [screen, setScreen] = useState<Screen>("list");
  const [selectedIssue, setSelectedIssue] = useState<TriageIssue | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownResult | null>(null);
  const [isLoadingDrilldown, setIsLoadingDrilldown] = useState(false);

  useEffect(() => {
    void startTriage(staged);
  }, [staged]);

  const reviewId = state.status === "success" ? state.reviewId : null;

  const handleSelectIssue = useCallback((issue: TriageIssue) => {
    setSelectedIssue(issue);
    setDrilldown(null);
    setScreen("detail");
  }, []);

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
    if (!selectedIssue || !reviewId) return;

    setIsLoadingDrilldown(true);
    try {
      const result = await triggerDrilldown({
        reviewId,
        issueId: selectedIssue.id,
      });
      setDrilldown(result.drilldown);
    } catch (error) {
      console.error("Failed to get drilldown:", error);
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

  const isLoading = state.status === "loading";
  const result = state.status === "success" ? state.data : null;
  const lensProgress = state.status === "loading" || state.status === "success"
    ? state.lensProgress
    : undefined;

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
      review={null}
      result={result}
      isLoading={isLoading}
      loadingMessage={
        lensProgress?.currentLens
          ? `Analyzing with ${lensProgress.currentLens} lens...`
          : "Starting analysis..."
      }
      lensProgress={lensProgress}
      onSelectIssue={handleSelectIssue}
      onBack={handleBack}
      onApplyFix={handleApplyFix}
    />
  );
}
