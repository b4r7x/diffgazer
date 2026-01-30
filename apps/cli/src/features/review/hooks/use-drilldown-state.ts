import { useState, useCallback, useRef, useEffect } from "react";
import type { TriageIssue } from "@repo/schemas/triage";
import type { DrilldownResult } from "@repo/schemas/lens";
import { shouldSuggestDrilldown } from "@repo/core/review";
import { getErrorMessage } from "@repo/core";
import { triggerDrilldown } from "../api/index.js";

export interface DrilldownState {
  status: "idle" | "loading" | "success" | "error";
  data: DrilldownResult | null;
  error: string | null;
}

interface UseDrilldownStateOptions {
  issues: TriageIssue[];
  reviewId?: string;
}

interface UseDrilldownStateReturn {
  drilldownState: DrilldownState;
  pendingDrilldowns: string[];
  showingDrilldownPrompt: boolean;
  currentDrilldownIssue: TriageIssue | null;
  getCachedDrilldown: (issueId: string) => DrilldownResult | undefined;
  triggerDrilldownForIssue: (issue: TriageIssue) => Promise<void>;
  handleDrilldownAccept: () => void;
  handleDrilldownSkip: () => void;
  handleDrilldownAcceptAll: () => Promise<void>;
}

export function useDrilldownState({
  issues,
  reviewId,
}: UseDrilldownStateOptions): UseDrilldownStateReturn {
  const [drilldownState, setDrilldownState] = useState<DrilldownState>({
    status: "idle",
    data: null,
    error: null,
  });
  const drilldownCacheRef = useRef<Map<string, DrilldownResult>>(new Map());
  const drilldownSuggestionsCheckedRef = useRef(false);

  const [pendingDrilldowns, setPendingDrilldowns] = useState<string[]>([]);
  const [showingDrilldownPrompt, setShowingDrilldownPrompt] = useState(false);
  const [currentDrilldownIssue, setCurrentDrilldownIssue] = useState<TriageIssue | null>(null);

  // Check for drilldown suggestions on mount
  useEffect(() => {
    if (drilldownSuggestionsCheckedRef.current) return;
    if (issues.length === 0 || !reviewId) return;

    drilldownSuggestionsCheckedRef.current = true;

    const suggestions = issues
      .filter(shouldSuggestDrilldown)
      .map((issue) => issue.id);

    if (suggestions.length > 0) {
      setPendingDrilldowns(suggestions);
      const firstIssue = issues.find((i) => i.id === suggestions[0]);
      if (firstIssue) {
        setCurrentDrilldownIssue(firstIssue);
        setShowingDrilldownPrompt(true);
      }
    }
  }, [issues, reviewId]);

  const getCachedDrilldown = useCallback((issueId: string) => {
    return drilldownCacheRef.current.get(issueId);
  }, []);

  const executeDrilldownForIssue = useCallback(
    async (issueId: string) => {
      if (!reviewId) return;

      const cached = drilldownCacheRef.current.get(issueId);
      if (cached) return;

      try {
        const response = await triggerDrilldown({
          reviewId,
          issueId,
        });
        drilldownCacheRef.current.set(issueId, response.drilldown);
      } catch (error) {
        console.error("Background drilldown failed:", getErrorMessage(error));
      }
    },
    [reviewId]
  );

  const triggerDrilldownForIssue = useCallback(
    async (issue: TriageIssue) => {
      if (!reviewId) {
        return;
      }

      const cached = drilldownCacheRef.current.get(issue.id);
      if (cached) {
        setDrilldownState({ status: "success", data: cached, error: null });
        return;
      }

      setDrilldownState({ status: "loading", data: null, error: null });

      try {
        const response = await triggerDrilldown({
          reviewId,
          issueId: issue.id,
        });
        drilldownCacheRef.current.set(issue.id, response.drilldown);
        setDrilldownState({ status: "success", data: response.drilldown, error: null });
      } catch (error) {
        setDrilldownState({
          status: "error",
          data: null,
          error: getErrorMessage(error),
        });
      }
    },
    [reviewId]
  );

  const advanceToNextDrilldownSuggestion = useCallback(() => {
    setPendingDrilldowns((prev) => {
      const remaining = prev.slice(1);

      if (remaining.length > 0) {
        const nextIssue = issues.find((i) => i.id === remaining[0]);
        if (nextIssue) {
          setCurrentDrilldownIssue(nextIssue);
        } else {
          setShowingDrilldownPrompt(false);
          setCurrentDrilldownIssue(null);
        }
      } else {
        setShowingDrilldownPrompt(false);
        setCurrentDrilldownIssue(null);
      }

      return remaining;
    });
  }, [issues]);

  const handleDrilldownAccept = useCallback(() => {
    if (!currentDrilldownIssue) return;

    void executeDrilldownForIssue(currentDrilldownIssue.id);
    advanceToNextDrilldownSuggestion();
  }, [currentDrilldownIssue, executeDrilldownForIssue, advanceToNextDrilldownSuggestion]);

  const handleDrilldownSkip = useCallback(() => {
    advanceToNextDrilldownSuggestion();
  }, [advanceToNextDrilldownSuggestion]);

  const handleDrilldownAcceptAll = useCallback(async () => {
    setShowingDrilldownPrompt(false);
    setCurrentDrilldownIssue(null);

    for (const issueId of pendingDrilldowns) {
      await executeDrilldownForIssue(issueId);
    }

    setPendingDrilldowns([]);
  }, [pendingDrilldowns, executeDrilldownForIssue]);

  return {
    drilldownState,
    pendingDrilldowns,
    showingDrilldownPrompt,
    currentDrilldownIssue,
    getCachedDrilldown,
    triggerDrilldownForIssue,
    handleDrilldownAccept,
    handleDrilldownSkip,
    handleDrilldownAcceptAll,
  };
}
