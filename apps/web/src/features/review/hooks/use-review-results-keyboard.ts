import { useRef, useState, type KeyboardEvent } from "react";
import { useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { SEVERITY_ORDER } from "@diffgazer/core/schemas/presentation";
import { findNavigationItemByValue, getNavigationItems, useFocusZone, useKey, useScopedNavigation } from "@diffgazer/keys";
import { usePageFooter } from "@diffgazer/core/footer";
import { resolveBackAction } from "@/lib/back-navigation";
import { useSeverityFilter } from "./use-severity-filter";
import { useIssueSelection } from "./use-issue-selection";
import { useIssueDetailsTabs } from "./use-issue-details-tabs";
import { RESET_FILTER_VALUE } from "@/features/review/components/severity-filter-group";

type FocusZone = "filters" | "list" | "details";

const ZONES = ["filters", "list", "details"] as const;
const REVIEW_SCOPE = "review";

interface UseReviewResultsKeyboardOptions {
  issues: ReviewIssue[];
  initialIssueId?: string | null;
}

function getReviewResultsFooter(
  focusZone: FocusZone,
  hasSelectedIssue: boolean,
  canUsePatchTab: boolean,
  isFilterActive: boolean,
): { shortcuts: Shortcut[]; rightShortcuts: Shortcut[] } {
  if (focusZone === "filters") {
    const shortcuts: Shortcut[] = [
      { key: "←/→", label: "Move Filter" },
      { key: "Enter/Space", label: "Toggle Filter" },
    ];
    if (isFilterActive) shortcuts.push({ key: "r", label: "Reset" });
    shortcuts.push({ key: "j", label: "Issue List" });
    return {
      shortcuts,
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

function severityFilterToKey(filter: ReadonlySet<ReviewIssue["severity"]>): string {
  if (filter.size === 0) return "all";
  return Array.from(filter).sort().join(",");
}

export function useReviewResultsKeyboard({ issues, initialIssueId }: UseReviewResultsKeyboardOptions) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { pathname } = useLocation();
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const filterRef = useRef<HTMLDivElement>(null);

  const {
    severityFilter,
    setSeverityFilter,
    filteredIssues,
    focusedFilterIndex,
    setFocusedFilterIndex,
    toggleSeverityFilter,
    resetSeverityFilter,
    isFilterActive,
  } = useSeverityFilter({ issues });

  const { selectedIssue, selectedIssueId, setSelectedIssueId, highlightedIssueId, listRef } =
    useIssueSelection({ filteredIssues, sourceKey: severityFilterToKey(severityFilter), initialIssueId });

  const { activeTab, setActiveTab, completedSteps, handleToggleStep, detailsScrollRef, moveTab, scrollDetails } =
    useIssueDetailsTabs({ selectedIssue });

  const lastFilterIndex = SEVERITY_ORDER.length - 1;
  const resetIndex = SEVERITY_ORDER.length;

  const focusTargetValueForIndex = (index: number): string =>
    index === resetIndex ? RESET_FILTER_VALUE : SEVERITY_ORDER[index] ?? SEVERITY_ORDER[0];

  useFocusZone({
    initial: "list" as FocusZone,
    zones: ZONES,
    zone: focusZone,
    onZoneChange: setFocusZone,
    scope: REVIEW_SCOPE,
    tabCycle: ["filters", "list", "details"],
    focus: {
      targets: {
        filters: {
          container: filterRef,
          target: () =>
            findNavigationItemByValue(filterRef.current, {
              type: "button",
              value: focusTargetValueForIndex(focusedFilterIndex),
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

  const focusAndSelectIssue = (id: string) => {
    setFocusZone("list");
    setSelectedIssueId(id);
  };

  const selectIssue = (id: string | null) => {
    if (id === null) return;
    setSelectedIssueId(id);
  };

  const handleListBoundary = (direction: "previous" | "next") => {
    if (direction === "previous") setFocusZone("filters");
  };

  useScopedNavigation({
    containerRef: listRef,
    role: "option",
    highlighted: highlightedIssueId,
    onHighlightChange: selectIssue,
    onNavigationBoundaryReached: handleListBoundary,
    wrap: false,
    scope: REVIEW_SCOPE,
    enabled: focusZone === "list" && filteredIssues.length > 0,
    upKeys: ["ArrowUp", "k"],
    downKeys: ["ArrowDown", "j"],
  });

  const handleListFocus = () => {
    setFocusZone("list");
  };

  const handleFilterKeyDown = (event: KeyboardEvent) => {
    if (focusZone !== "filters") {
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusZone("list");
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
    }
  };

  useKey(["ArrowUp", "k"], () => setFocusZone("filters"), {
    scope: REVIEW_SCOPE,
    enabled: focusZone === "list" && filteredIssues.length === 0,
  });

  useKey("Escape", () => {
    const action = resolveBackAction(pathname, canGoBack);
    if (action.type === "navigate") {
      void router.navigate({ to: action.to });
    } else if (action.type === "history") {
      router.history.back();
    }
  }, { scope: REVIEW_SCOPE });

  useKey("ArrowLeft", () => setFocusedFilterIndex(lastFilterIndex), {
    scope: REVIEW_SCOPE,
    enabled: focusZone === "filters" && focusedFilterIndex === resetIndex,
  });
  useKey("ArrowRight", () => {
    if (focusedFilterIndex === resetIndex) {
      setFocusZone("details");
    }
  }, { scope: REVIEW_SCOPE, enabled: focusZone === "filters" && focusedFilterIndex === resetIndex });

  const handleSeverityFilterBoundary = (direction: "previous" | "next") => {
    if (direction !== "next") return;
    if (isFilterActive) {
      setFocusedFilterIndex(resetIndex);
      return;
    }
    setFocusZone("details");
  };

  useKey("j", () => setFocusZone("list"), { scope: REVIEW_SCOPE, enabled: focusZone === "filters" });

  useKey("ArrowLeft", () => {
    if (!selectedIssue) {
      setFocusZone("list");
      return;
    }

    const result = moveTab(-1);
    if (result === "boundary-left") setFocusZone("list");
  }, { scope: REVIEW_SCOPE, enabled: focusZone === "details" });
  useKey("ArrowRight", () => moveTab(1), { scope: REVIEW_SCOPE, enabled: focusZone === "details" && !!selectedIssue });

  useKey("ArrowUp", () => scrollDetails(-80), { scope: REVIEW_SCOPE, enabled: focusZone === "details" });
  useKey("ArrowDown", () => scrollDetails(80), { scope: REVIEW_SCOPE, enabled: focusZone === "details" });

  const handleEnterOrSpace = () => {
    if (focusedFilterIndex === resetIndex) {
      resetSeverityFilter();
      setFocusedFilterIndex(lastFilterIndex);
      return;
    }
    toggleSeverityFilter();
  };

  useKey("Enter", handleEnterOrSpace, { scope: REVIEW_SCOPE, enabled: focusZone === "filters" });
  useKey(" ", handleEnterOrSpace, { scope: REVIEW_SCOPE, enabled: focusZone === "filters" });

  useKey("r", () => {
    resetSeverityFilter();
    setFocusedFilterIndex(lastFilterIndex);
  }, { scope: REVIEW_SCOPE, enabled: focusZone === "filters" && isFilterActive });

  useKey("1", () => setActiveTab("details"), { scope: REVIEW_SCOPE, enabled: focusZone === "details" && !!selectedIssue });
  useKey("2", () => setActiveTab("explain"), { scope: REVIEW_SCOPE, enabled: focusZone === "details" && !!selectedIssue });
  useKey("3", () => setActiveTab("trace"), { scope: REVIEW_SCOPE, enabled: focusZone === "details" && !!selectedIssue });
  useKey("4", () => setActiveTab("patch"), { scope: REVIEW_SCOPE, enabled: focusZone === "details" && !!selectedIssue?.suggested_patch });

  const footer = getReviewResultsFooter(
    focusZone,
    selectedIssue !== null,
    Boolean(selectedIssue?.suggested_patch),
    isFilterActive,
  );

  usePageFooter({ shortcuts: footer.shortcuts, rightShortcuts: footer.rightShortcuts });

  return {
    filteredIssues,
    selectedIssue,
    selectedIssueId,
    setSelectedIssueId: focusAndSelectIssue,
    selectIssue,
    handleListBoundary,
    activeTab,
    setActiveTab,
    severityFilter,
    setSeverityFilter,
    resetSeverityFilter,
    focusZone,
    focusedFilterIndex,
    setFocusedFilterIndex,
    filterRef,
    handleFilterKeyDown,
    handleSeverityFilterBoundary,
    highlightedIssueId,
    handleListFocus,
    listRef,
    detailsScrollRef,
    completedSteps,
    handleToggleStep,
  };
}
