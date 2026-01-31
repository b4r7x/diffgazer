import { useMemo, useCallback } from "react";
import { useScreenState } from "../../../hooks/use-screen-state.js";
import type { HistoryState, FocusZone, TabId, HistoryRun, TimelineItem } from "../types.js";
import { toTimelineItems } from "../types.js";

interface UseHistoryStateOptions {
  runs: HistoryRun[];
  initialTab?: TabId;
}

export function useHistoryState({ runs, initialTab = "runs" }: UseHistoryStateOptions) {
  const timelineItems = useMemo(() => toTimelineItems(runs), [runs]);

  // Compute default selected date from available runs
  const defaultSelectedDateId = useMemo(() => {
    const items = toTimelineItems(runs);
    return items[0]?.id ?? "today";
  }, [runs]);

  // Compute default selected run from available runs
  const defaultSelectedRunId = useMemo(() => {
    const items = toTimelineItems(runs);
    const firstDate = items[0]?.id ?? "today";
    const firstRunForDate = runs.find((r) => r.date === firstDate);
    return firstRunForDate?.id ?? runs[0]?.id ?? null;
  }, [runs]);

  const [activeTab, setActiveTab] = useScreenState<TabId>("activeTab", initialTab);
  const [focusZone, setFocusZone] = useScreenState<FocusZone>("focusZone", "runs");
  const [expandedRunId, setExpandedRunId] = useScreenState<string | null>("expandedRunId", null);
  const [selectedDateId, setSelectedDateId] = useScreenState<string>(
    "selectedDateId",
    defaultSelectedDateId
  );
  const [selectedRunId, setSelectedRunId] = useScreenState<string | null>(
    "selectedRunId",
    defaultSelectedRunId
  );

  const filteredRuns = useMemo(
    () => selectedDateId === "all" ? runs : runs.filter((run) => run.date === selectedDateId),
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
