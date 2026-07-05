import { usePageFooter } from "@diffgazer/core/footer";
import type { IssueTab, Shortcut } from "@diffgazer/core/schemas/presentation";
import {
  BACK_SHORTCUT,
  SEVERITY_ORDER,
  SWITCH_PANE_SHORTCUT,
} from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import {
  findNavigationItemByValue,
  getNavigationItems,
  useFocusZone,
  useKey,
  useScopedNavigation,
} from "@diffgazer/keys";
import { useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import { type KeyboardEvent, useRef, useState } from "react";
import { RESET_FILTER_VALUE } from "@/features/review/components/severity-filter-group";
import { resolveBackAction } from "@/lib/back-navigation";
import { getMainContent } from "@/lib/main-content";
import { useReviewDetailsTabKeyboard } from "./use-details-tab-keyboard";
import { useIssueDetailsTabs } from "./use-issue-details-tabs";
import { useIssueSelection } from "./use-issue-selection";
import { useSeverityFilter } from "./use-severity-filter";
import { useReviewSeverityFilterKeyboard } from "./use-severity-filter-keyboard";

type FocusZone = "filters" | "list" | "details";

const ZONES = ["filters", "list", "details"] as const;
const REVIEW_SCOPE = "review";
const TAB_KEY_BY_ID: Record<IssueTab, string> = {
  details: "1",
  explain: "2",
  trace: "3",
  patch: "4",
};

interface UseReviewResultsKeyboardOptions {
  issues: ReviewIssue[];
  initialIssueId?: string | null;
}

function getReviewResultsFooter(
  focusZone: FocusZone,
  hasSelectedIssue: boolean,
  availableTabs: readonly IssueTab[],
  isFilterActive: boolean,
  hasFixPlanSteps: boolean,
): { shortcuts: Shortcut[]; rightShortcuts: Shortcut[] } {
  if (focusZone === "filters") {
    const shortcuts: Shortcut[] = [
      SWITCH_PANE_SHORTCUT,
      { key: "←/→", label: "Move Filter" },
      { key: "Enter/Space", label: "Toggle Filter" },
    ];
    if (isFilterActive) shortcuts.push({ key: "r", label: "Reset" });
    shortcuts.push({ key: "j", label: "Issue List" });
    return {
      shortcuts,
      rightShortcuts: [BACK_SHORTCUT],
    };
  }

  if (focusZone === "details") {
    if (!hasSelectedIssue) {
      return {
        shortcuts: [SWITCH_PANE_SHORTCUT, { key: "←", label: "Issue List" }],
        rightShortcuts: [{ key: "Esc", label: "Issue List" }],
      };
    }

    const shortcuts: Shortcut[] = [
      SWITCH_PANE_SHORTCUT,
      { key: getTabKeyHint(availableTabs), label: "Switch Tab" },
    ];
    if (hasFixPlanSteps) {
      shortcuts.push(
        { key: "j/k", label: "Move Step" },
        { key: "Enter/Space", label: "Toggle Step" },
      );
    }
    shortcuts.push({ key: "←", label: "Issue List" });
    return {
      shortcuts,
      rightShortcuts: [{ key: "Esc", label: "Issue List" }],
    };
  }

  return {
    shortcuts: [
      SWITCH_PANE_SHORTCUT,
      { key: "j/k", label: "Select Issue" },
      { key: "→", label: "Issue Details" },
    ],
    rightShortcuts: [BACK_SHORTCUT],
  };
}

function getTabKeyHint(availableTabs: readonly IssueTab[]): string {
  const keys = availableTabs.map((tab) => TAB_KEY_BY_ID[tab]);
  const isContiguous = keys.every((key, index) => Number(key) === index + 1);
  if (isContiguous && keys.length > 1) return `${keys[0]}-${keys.at(-1)}`;
  return keys.join("/");
}

function severityFilterToKey(filter: ReadonlySet<ReviewIssue["severity"]>): string {
  if (filter.size === 0) return "all";
  return Array.from(filter).sort().join(",");
}

export function useReviewResultsKeyboard({
  issues,
  initialIssueId,
}: UseReviewResultsKeyboardOptions) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { pathname } = useLocation();
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const filterRef = useRef<HTMLDivElement>(null);
  const listBodyRef = useRef<HTMLDivElement>(null);
  const detailsPaneRef = useRef<HTMLElement>(null);

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
    useIssueSelection({
      filteredIssues,
      sourceKey: severityFilterToKey(severityFilter),
      initialIssueId,
    });

  const {
    activeTab,
    availableTabs,
    setActiveTab,
    completedSteps,
    handleToggleStep,
    detailsScrollRef,
    moveTab,
    scrollDetails,
  } = useIssueDetailsTabs({ selectedIssue });

  const lastFilterIndex = SEVERITY_ORDER.length - 1;
  const resetIndex = SEVERITY_ORDER.length;

  const focusTargetValueForIndex = (index: number): string =>
    index === resetIndex ? RESET_FILTER_VALUE : (SEVERITY_ORDER[index] ?? SEVERITY_ORDER[0]);

  const findFilterChip = (index: number): HTMLElement | null =>
    findNavigationItemByValue(filterRef.current, {
      type: "button",
      value: focusTargetValueForIndex(index),
      ownerSelector: null,
    });

  useFocusZone<FocusZone>({
    initial: "list",
    zones: ZONES,
    zone: focusZone,
    onZoneChange: setFocusZone,
    scope: REVIEW_SCOPE,
    tabCycle: ["filters", "list", "details"],
    tabCycleScope: "document",
    tabCycleBoundary: getMainContent,
    focus: {
      autoFocus: true,
      targets: {
        filters: {
          container: filterRef,
          target: () =>
            findNavigationItemByValue(filterRef.current, {
              type: "button",
              value: focusTargetValueForIndex(focusedFilterIndex),
              ownerSelector: null,
            }) ??
            getNavigationItems(filterRef.current, {
              type: "button",
              ownerSelector: null,
            })[0] ??
            filterRef.current,
        },
        // Container refs cover the whole pane region (list body, details pane
        // root) so focus landing anywhere inside — tab triggers, tabpanel, code
        // blocks — syncs the zone. The list container deliberately excludes the
        // filter row: it belongs to the filters zone, and zone containers must
        // stay disjoint or moving filters -> list would leave DOM focus on a
        // filter chip (focus repair skips containers that already hold focus).
        list: { container: listBodyRef, target: listRef },
        details: { container: detailsPaneRef, target: detailsScrollRef },
      },
    },
    transitions: ({ zone, key }) => {
      if (zone === "list" && key === "ArrowRight") return "details";
      if (zone === "filters" && key === "ArrowDown") return "list";
      return null;
    },
  });

  const selectIssueAndFocusList = (id: string) => {
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

  // The severity ToggleGroup claims vertical arrows as extra horizontal moves,
  // so they must be intercepted before its navigation handler: ArrowDown stays
  // a zone move into the list and ArrowUp stays inert instead of moving chips.
  const handleFilterKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusZone("list");
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
    }
  };

  // Escape layering: from the details zone Escape steps back to the issue
  // list; from the list/filters zones it leaves the screen.
  useKey(
    "Escape",
    () => {
      if (focusZone === "details") {
        setFocusZone("list");
        return;
      }
      const action = resolveBackAction(pathname, canGoBack);
      if (action.type === "navigate") {
        void router.navigate({ to: action.to });
      } else if (action.type === "history") {
        router.history.back();
      }
    },
    { scope: REVIEW_SCOPE },
  );

  const handleDetailsTabsBoundary = (direction: "previous" | "next") => {
    if (direction === "previous") setFocusZone("list");
  };

  const handleSeverityFilterBoundary = (direction: "previous" | "next") => {
    if (direction !== "next") return;
    if (isFilterActive) {
      setFocusedFilterIndex(resetIndex);
      findNavigationItemByValue(filterRef.current, {
        type: "button",
        value: RESET_FILTER_VALUE,
        ownerSelector: null,
      })?.focus();
      return;
    }
    setFocusZone("details");
  };

  useReviewSeverityFilterKeyboard({
    scope: REVIEW_SCOPE,
    enabled: focusZone === "filters",
    isFilterActive,
    focusedFilterIndex,
    lastFilterIndex,
    resetIndex,
    setFocusedFilterIndex,
    focusChip: findFilterChip,
    toggleSeverityFilter,
    resetSeverityFilter,
    enterList: () => setFocusZone("list"),
    enterDetails: () => setFocusZone("details"),
  });

  const selectedIssueForKeyboard =
    selectedIssue?.fixPlan === undefined
      ? selectedIssue
      : {
          ...selectedIssue,
          fixPlan: selectedIssue.fixPlan.map((step, index) => ({ ...step, step: index })),
        };

  const { focusedStepIndex } = useReviewDetailsTabKeyboard({
    scope: REVIEW_SCOPE,
    enabled: focusZone === "details",
    selectedIssue: selectedIssueForKeyboard,
    activeTab,
    moveTab,
    scrollDetails,
    setActiveTab,
    enterList: () => setFocusZone("list"),
    onToggleStep: handleToggleStep,
  });

  const hasFixPlanSteps =
    focusZone === "details" && activeTab === "details" && (selectedIssue?.fixPlan?.length ?? 0) > 0;

  const footer = getReviewResultsFooter(
    focusZone,
    selectedIssue !== null,
    availableTabs,
    isFilterActive,
    hasFixPlanSteps,
  );

  usePageFooter({ shortcuts: footer.shortcuts, rightShortcuts: footer.rightShortcuts });

  return {
    filteredIssues,
    selectedIssue,
    selectedIssueId,
    selectIssueAndFocusList,
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
    handleDetailsTabsBoundary,
    highlightedIssueId,
    handleListFocus,
    listRef,
    listBodyRef,
    detailsPaneRef,
    detailsScrollRef,
    completedSteps,
    handleToggleStep,
    focusedStepIndex,
  };
}
