import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import type { Shortcut } from "@diffgazer/core/schemas/ui";
import { SEVERITY_ORDER } from "@diffgazer/core/schemas/ui";
import { findNavigationItemByValue, getNavigationItems, useFocusZone, useKey, useScopedNavigation } from "@diffgazer/keys";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useSeverityFilter } from "./use-severity-filter.js";
import { useIssueSelection } from "./use-issue-selection.js";
import { useIssueDetailsTabs } from "./use-issue-details-tabs.js";

type FocusZone = "filters" | "list" | "details";

const ZONES = ["filters", "list", "details"] as const;
const REVIEW_SCOPE = "review";

interface UseReviewResultsKeyboardOptions {
  issues: ReviewIssue[];
}

function getReviewResultsFooter(
  focusZone: FocusZone,
  hasSelectedIssue: boolean,
  canUsePatchTab: boolean,
): { shortcuts: Shortcut[]; rightShortcuts: Shortcut[] } {
  if (focusZone === "filters") {
    return {
      shortcuts: [
        { key: "←/→", label: "Move Filter" },
        { key: "Enter/Space", label: "Toggle Filter" },
        { key: "j", label: "Issue List" },
      ],
      rightShortcuts: [{ key: "Esc", label: "Back" }],
    };
  }

  if (focusZone === "details") {
    if (!hasSelectedIssue) {
      return {
        shortcuts: [{ key: "←", label: "Issue List" }],
        rightShortcuts: [{ key: "Esc", label: "Back" }],
      };
    }

    return {
      shortcuts: [
        { key: canUsePatchTab ? "1-4" : "1-3", label: "Switch Tab" },
        { key: "←", label: "Issue List" },
      ],
      rightShortcuts: [{ key: "Esc", label: "Back" }],
    };
  }

  return {
    shortcuts: [
      { key: "j/k", label: "Select Issue" },
      { key: "→", label: "Issue Details" },
    ],
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  };
}

export function useReviewResultsKeyboard({ issues }: UseReviewResultsKeyboardOptions) {
  const router = useRouter();
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const filterRef = useRef<HTMLDivElement>(null);

  const { severityFilter, setSeverityFilter, filteredIssues, focusedFilterIndex, setFocusedFilterIndex, toggleSeverityFilter, moveFocusedFilter } =
    useSeverityFilter({ issues });

  const { selectedIssue, selectedIssueId, setSelectedIssueId, highlightedIssueId, listRef } =
    useIssueSelection({ filteredIssues, sourceKey: severityFilter ?? "all" });

  const { activeTab, setActiveTab, completedSteps, handleToggleStep, detailsScrollRef, moveTab, scrollDetails } =
    useIssueDetailsTabs({ selectedIssue });

  const setReviewFocusZone = useCallback((zone: FocusZone) => {
    setFocusZone(zone);
  }, []);

  useFocusZone({
    initial: "list" as FocusZone,
    zones: ZONES,
    zone: focusZone,
    onZoneChange: setReviewFocusZone,
    scope: REVIEW_SCOPE,
    tabCycle: ["filters", "list", "details"],
    focus: {
      targets: {
        filters: {
          container: filterRef,
          target: () =>
            findNavigationItemByValue(filterRef.current, {
              type: "button",
              value: SEVERITY_ORDER[focusedFilterIndex] ?? SEVERITY_ORDER[0],
              ownerSelector: null,
            }) ?? getNavigationItems(filterRef.current, {
              type: "button",
              ownerSelector: null,
            })[0] ?? filterRef.current,
        },
        list: listRef,
        details: detailsScrollRef,
      },
    },
    transitions: ({ zone, key }) => {
      if (zone === "list" && key === "ArrowRight") return "details";
      if (zone === "filters" && key === "ArrowDown") return "list";
      return null;
    },
  });

  const selectIssue = (id: string) => {
    setReviewFocusZone("list");
    setSelectedIssueId(id);
  };

  const highlightIssue = (id: string | null) => {
    if (id === null) return;
    setSelectedIssueId(id);
  };

  const handleListBoundary = (direction: "previous" | "next") => {
    if (direction === "previous") setReviewFocusZone("filters");
  };

  useScopedNavigation({
    containerRef: listRef,
    role: "option",
    highlighted: highlightedIssueId,
    onHighlightChange: highlightIssue,
    onNavigationBoundaryReached: handleListBoundary,
    wrap: false,
    scope: REVIEW_SCOPE,
    enabled: focusZone === "list" && filteredIssues.length > 0,
    upKeys: ["ArrowUp", "k"],
    downKeys: ["ArrowDown", "j"],
  });

  const handleListFocus = () => {
    setReviewFocusZone("list");
  };

  const handleFilterKeyDown = useCallback((event: KeyboardEvent) => {
    if (focusZone !== "filters") {
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setReviewFocusZone("list");
      return;
    }

    // ArrowUp in filters is a no-op: the badge row is the top of this pane,
    // so there is nothing to navigate up to.
    if (event.key === "ArrowUp") {
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowRight" && focusedFilterIndex >= SEVERITY_ORDER.length - 1) {
      event.preventDefault();
      setReviewFocusZone("details");
    }
  }, [focusZone, focusedFilterIndex, setReviewFocusZone]);

  useKey(["ArrowUp", "k"], () => setReviewFocusZone("filters"), {
    scope: REVIEW_SCOPE,
    enabled: focusZone === "list" && filteredIssues.length === 0,
  });

  useKey("Escape", () => router.history.back(), { scope: REVIEW_SCOPE });

  useKey("ArrowLeft", () => moveFocusedFilter(-1), { scope: REVIEW_SCOPE, enabled: focusZone === "filters" });
  useKey("ArrowRight", () => {
    if (focusedFilterIndex >= SEVERITY_ORDER.length - 1) {
      setReviewFocusZone("details");
      return;
    }
    moveFocusedFilter(1);
  }, { scope: REVIEW_SCOPE, enabled: focusZone === "filters" });

  useKey("j", () => setReviewFocusZone("list"), { scope: REVIEW_SCOPE, enabled: focusZone === "filters" });

  useKey("ArrowLeft", () => {
    if (!selectedIssue) {
      setReviewFocusZone("list");
      return;
    }

    const result = moveTab(-1);
    if (result === "boundary-left") setReviewFocusZone("list");
  }, { scope: REVIEW_SCOPE, enabled: focusZone === "details" });
  useKey("ArrowRight", () => moveTab(1), { scope: REVIEW_SCOPE, enabled: focusZone === "details" && !!selectedIssue });

  useKey("ArrowUp", () => scrollDetails(-80), { scope: REVIEW_SCOPE, enabled: focusZone === "details" });
  useKey("ArrowDown", () => scrollDetails(80), { scope: REVIEW_SCOPE, enabled: focusZone === "details" });

  useKey("Enter", toggleSeverityFilter, { scope: REVIEW_SCOPE, enabled: focusZone === "filters" });
  useKey(" ", toggleSeverityFilter, { scope: REVIEW_SCOPE, enabled: focusZone === "filters" });

  useKey("1", () => setActiveTab("details"), { scope: REVIEW_SCOPE, enabled: focusZone === "details" && !!selectedIssue });
  useKey("2", () => setActiveTab("explain"), { scope: REVIEW_SCOPE, enabled: focusZone === "details" && !!selectedIssue });
  useKey("3", () => setActiveTab("trace"), { scope: REVIEW_SCOPE, enabled: focusZone === "details" && !!selectedIssue });
  useKey("4", () => setActiveTab("patch"), { scope: REVIEW_SCOPE, enabled: focusZone === "details" && !!selectedIssue?.suggested_patch });

  const footer = getReviewResultsFooter(
    focusZone,
    selectedIssue !== null,
    Boolean(selectedIssue?.suggested_patch),
  );

  usePageFooter({ shortcuts: footer.shortcuts, rightShortcuts: footer.rightShortcuts });

  return {
    filteredIssues,
    selectedIssue,
    selectedIssueId,
    setSelectedIssueId: selectIssue,
    highlightIssue,
    handleListBoundary,
    activeTab,
    setActiveTab,
    severityFilter,
    setSeverityFilter,
    focusZone,
    focusedFilterIndex,
    setFocusedFilterIndex,
    filterRef,
    handleFilterKeyDown,
    highlightedIssueId,
    handleListFocus,
    listRef,
    detailsScrollRef,
    completedSteps,
    handleToggleStep,
  };
}
