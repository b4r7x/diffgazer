import { useState, useMemo, useCallback } from "react";
import type { HistoryState, FocusZone, TabId, HistoryRun, TimelineItem } from "../types.js";
import { toTimelineItems } from "../types.js";

interface UseHistoryStateOptions {
  runs: HistoryRun[];
  initialTab?: TabId;
}

export function useHistoryState({ runs, initialTab = "runs" }: UseHistoryStateOptions) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [focusZone, setFocusZone] = useState<FocusZone>("runs");
  const [selectedDateId, setSelectedDateId] = useState<string>("today");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(runs[0]?.id ?? null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const timelineItems = useMemo(() => toTimelineItems(runs), [runs]);

  const filteredRuns = useMemo(
    () => runs.filter((run) => run.date === selectedDateId),
    [runs, selectedDateId]
  );

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId]
  );

  const cycleFocus = useCallback(() => {
    setFocusZone((prev) => {
      if (prev === "timeline") return "runs";
      if (prev === "runs") return "insights";
      return "timeline";
    });
  }, []);

  const moveFocusLeft = useCallback(() => {
    setFocusZone((prev) => {
      if (prev === "runs") return "timeline";
      if (prev === "insights") return "runs";
      return prev;
    });
  }, []);

  const moveFocusRight = useCallback(() => {
    setFocusZone((prev) => {
      if (prev === "timeline") return "runs";
      if (prev === "runs") return "insights";
      return prev;
    });
  }, []);

  const toggleExpand = useCallback(() => {
    if (selectedRunId) {
      setExpandedRunId((prev) => (prev === selectedRunId ? null : selectedRunId));
    }
  }, [selectedRunId]);

  const collapseOrBack = useCallback(() => {
    if (expandedRunId) {
      setExpandedRunId(null);
      return true;
    }
    return false;
  }, [expandedRunId]);

  return {
    // State
    activeTab,
    focusZone,
    selectedDateId,
    selectedRunId,
    expandedRunId,
    timelineItems,
    filteredRuns,
    selectedRun,

    // Actions
    setActiveTab,
    setFocusZone,
    setSelectedDateId,
    setSelectedRunId,
    setExpandedRunId,
    cycleFocus,
    moveFocusLeft,
    moveFocusRight,
    toggleExpand,
    collapseOrBack,
  };
}
