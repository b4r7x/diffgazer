import { useMemo, useCallback } from "react";
import { useScreenState } from "../../../hooks/use-screen-state.js";
import type { FocusZone, TabId, HistoryRun } from "../types.js";
import { toTimelineItems } from "../types.js";

interface UseHistoryStateOptions {
  runs: HistoryRun[];
  initialTab?: TabId;
}

export function useHistoryState({ runs, initialTab = "runs" }: UseHistoryStateOptions) {
  const timelineItems = useMemo(() => toTimelineItems(runs), [runs]);

  const defaultSelectedDateId = timelineItems[0]?.id ?? "today";
  const defaultSelectedRunId = runs.find((r) => r.date === defaultSelectedDateId)?.id ?? runs[0]?.id ?? null;

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
  const [searchQuery, setSearchQuery] = useScreenState<string>("searchQuery", "");

  const filteredRuns = useMemo(() => {
    let result = selectedDateId === "all" ? runs : runs.filter((run) => run.date === selectedDateId);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((run) =>
        run.id.toLowerCase().includes(query) ||
        run.displayId.toLowerCase().includes(query)
      );
    }

    return result;
  }, [runs, selectedDateId, searchQuery]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId]
  );

  const cycleFocus = useCallback(() => {
    setFocusZone((prev) => {
      if (prev === "search") return "timeline";
      if (prev === "timeline") return "runs";
      if (prev === "runs") return "insights";
      return "search";
    });
  }, []);

  const moveFocusLeft = useCallback(() => {
    setFocusZone((prev) => {
      if (prev === "timeline") return "search";
      if (prev === "runs") return "timeline";
      if (prev === "insights") return "runs";
      return prev;
    });
  }, []);

  const moveFocusRight = useCallback(() => {
    setFocusZone((prev) => {
      if (prev === "search") return "timeline";
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
    if (searchQuery) {
      setSearchQuery("");
      return true;
    }
    if (expandedRunId) {
      setExpandedRunId(null);
      return true;
    }
    return false;
  }, [searchQuery, expandedRunId]);

  return {
    // State
    activeTab,
    focusZone,
    selectedDateId,
    selectedRunId,
    expandedRunId,
    searchQuery,
    timelineItems,
    filteredRuns,
    selectedRun,

    // Actions
    setActiveTab,
    setFocusZone,
    setSelectedDateId,
    setSelectedRunId,
    setExpandedRunId,
    setSearchQuery,
    cycleFocus,
    moveFocusLeft,
    moveFocusRight,
    toggleExpand,
    collapseOrBack,
  };
}
