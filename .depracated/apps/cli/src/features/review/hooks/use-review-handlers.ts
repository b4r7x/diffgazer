import { useCallback } from "react";
import type { TriageIssue } from "@repo/schemas/triage";
import type { FeedbackCommand } from "../../../lib/feedback-schema.js";
import type { SessionEventType } from "@repo/schemas/session";
import type { FocusArea } from "./use-review-keyboard.js";
import type { IssueTab } from "../constants.js";

interface ReviewHandlersConfig {
  selectedIssue: TriageIssue | null;
  selectedIndex: number;
  filteredIssues: TriageIssue[];
  focus: FocusArea;
  reviewId?: string;
  setSelectedId: (id: string | null) => void;
  setActiveTab: (tab: IssueTab) => void;
  setFocus: React.Dispatch<React.SetStateAction<FocusArea>>;
  setFeedbackMode: (mode: boolean) => void;
  setAskResponse: (response: string | null) => void;
  setActiveFilter: (filter: string) => void;
  addIgnoredPattern: (pattern: string) => void;
  handleFilterNavigate: (direction: "left" | "right") => void;
  handleFilterSelect: () => void;
  triggerDrilldownForIssue: (issue: TriageIssue) => Promise<void>;
  onBack: () => void;
  recordEvent: (type: SessionEventType, payload: Record<string, unknown>) => void;
}

export function useReviewHandlers(config: ReviewHandlersConfig) {
  const {
    selectedIssue,
    selectedIndex,
    filteredIssues,
    focus,
    reviewId,
    setSelectedId,
    setActiveTab,
    setFocus,
    setFeedbackMode,
    setAskResponse,
    setActiveFilter,
    addIgnoredPattern,
    handleFilterNavigate,
    handleFilterSelect,
    triggerDrilldownForIssue,
    onBack,
    recordEvent,
  } = config;

  const handleNavigate = useCallback(
    (direction: "up" | "down") => {
      const delta = direction === "down" ? 1 : -1;
      const newIndex = Math.max(0, Math.min(selectedIndex + delta, filteredIssues.length - 1));
      const issue = filteredIssues[newIndex];
      if (issue) setSelectedId(issue.id);
    },
    [selectedIndex, filteredIssues, setSelectedId]
  );

  const handleOpen = useCallback(() => setFocus("details"), [setFocus]);

  const handleIgnore = useCallback(() => {
    if (!selectedIssue) return;
    recordEvent("IGNORE_ISSUE", {
      issueId: selectedIssue.id,
      title: selectedIssue.title,
      severity: selectedIssue.severity,
    });
  }, [selectedIssue, recordEvent]);

  const handleBack = useCallback(() => {
    if (focus === "details") {
      setFocus("list");
    } else {
      onBack();
    }
  }, [focus, setFocus, onBack]);

  const handleApply = useCallback(() => {
    if (!selectedIssue) return;
    recordEvent("APPLY_PATCH", {
      issueId: selectedIssue.id,
      title: selectedIssue.title,
      file: selectedIssue.file,
      hasPatch: Boolean(selectedIssue.suggested_patch),
    });
  }, [selectedIssue, recordEvent]);

  const handleApplyFromDetails = useCallback(
    (issue: TriageIssue) => {
      recordEvent("APPLY_PATCH", {
        issueId: issue.id,
        title: issue.title,
        file: issue.file,
        hasPatch: Boolean(issue.suggested_patch),
      });
    },
    [recordEvent]
  );

  const handleDrilldown = useCallback(async () => {
    if (!selectedIssue) return;
    if (!reviewId) {
      setActiveTab("explain");
      return;
    }
    await triggerDrilldownForIssue(selectedIssue);
    setActiveTab("explain");
  }, [selectedIssue, reviewId, triggerDrilldownForIssue, setActiveTab]);

  const handleExplain = useCallback(() => void handleDrilldown(), [handleDrilldown]);
  const handleTrace = useCallback(() => setActiveTab("trace"), [setActiveTab]);
  const handleNextIssue = useCallback(() => handleNavigate("down"), [handleNavigate]);
  const handlePrevIssue = useCallback(() => handleNavigate("up"), [handleNavigate]);

  const handleToggleFocus = useCallback(() => {
    setFocus((prev) => {
      if (prev === "filters") return "list";
      if (prev === "list") return "details";
      return "filters";
    });
  }, [setFocus]);

  const handleTabChange = useCallback((tab: IssueTab) => setActiveTab(tab), [setActiveTab]);
  const handleFocusFilters = useCallback(() => setFocus("filters"), [setFocus]);

  const handleFeedbackCommand = useCallback(
    (command: FeedbackCommand) => {
      setFeedbackMode(false);

      switch (command.type) {
        case "focus":
          setActiveFilter(command.filter);
          recordEvent("FILTER_CHANGED", { filter: command.filter, type: "focus" });
          break;

        case "ignore":
          addIgnoredPattern(command.pattern);
          recordEvent("FILTER_CHANGED", { pattern: command.pattern, type: "ignore" });
          break;

        case "refine": {
          const targetIssue = filteredIssues.find(
            (issue) =>
              issue.id === command.issueId ||
              issue.id.endsWith(command.issueId) ||
              issue.title.toLowerCase().includes(command.issueId.toLowerCase())
          );
          if (targetIssue) {
            setSelectedId(targetIssue.id);
            void handleDrilldown();
          }
          break;
        }

        case "ask":
          setAskResponse(`Question received: "${command.question}" (response placeholder)`);
          break;

        case "stop":
          break;
      }
    },
    [filteredIssues, handleDrilldown, recordEvent, setActiveFilter, addIgnoredPattern, setFeedbackMode, setSelectedId, setAskResponse]
  );

  const handleFeedbackCancel = useCallback(() => setFeedbackMode(false), [setFeedbackMode]);

  return {
    handleNavigate,
    handleOpen,
    handleIgnore,
    handleBack,
    handleApply,
    handleApplyFromDetails,
    handleDrilldown,
    handleExplain,
    handleTrace,
    handleNextIssue,
    handlePrevIssue,
    handleToggleFocus,
    handleTabChange,
    handleFocusFilters,
    handleFilterNavigate,
    handleFilterSelect,
    handleFeedbackCommand,
    handleFeedbackCancel,
  };
}
