import { useInput } from "ink";
import { useKeyboardMode } from "../../../hooks/use-keyboard-mode.js";
import { TAB_ORDER, type IssueTab } from "../constants.js";

export type FocusArea = "list" | "details" | "filters";

export interface ReviewKeyboardState {
  focus: FocusArea;
  activeTab?: IssueTab;
  hasPatch?: boolean;
  hasTrace?: boolean;
  filterFocusedIndex?: number;
  filterCount?: number;
}

export interface ReviewKeyboardActions {
  onNavigate: (direction: "up" | "down") => void;
  onOpen: () => void;
  onApply: () => void;
  onIgnore: () => void;
  onExplain: () => void;
  onTrace: () => void;
  onNextIssue: () => void;
  onPrevIssue: () => void;
  onToggleFocus: () => void;
  onBack: () => void;
  onTabChange?: (tab: IssueTab) => void;
  onFilterNavigate?: (direction: "left" | "right") => void;
  onFilterSelect?: () => void;
  onFocusFilters?: () => void;
}

export interface UseReviewKeyboardOptions {
  focus: FocusArea;
  state?: ReviewKeyboardState;
  actions: ReviewKeyboardActions;
  disabled?: boolean;
}

function getNextTab(
  currentTab: IssueTab,
  hasPatch: boolean,
  hasTrace: boolean
): IssueTab {
  const currentIndex = TAB_ORDER.indexOf(currentTab);
  for (let i = currentIndex + 1; i < TAB_ORDER.length; i++) {
    const tab = TAB_ORDER[i];
    if (tab === "trace" && !hasTrace) continue;
    if (tab === "patch" && !hasPatch) continue;
    return tab as IssueTab;
  }
  return "details";
}

export function useReviewKeyboard(options: UseReviewKeyboardOptions): void {
  const { focus, state, actions, disabled } = options;
  const { isKeyMode, isMenuMode } = useKeyboardMode();

  const {
    onNavigate,
    onOpen,
    onApply,
    onIgnore,
    onExplain,
    onTrace,
    onNextIssue,
    onPrevIssue,
    onToggleFocus,
    onBack,
    onTabChange,
    onFilterNavigate,
    onFilterSelect,
    onFocusFilters,
  } = actions;

  const activeTab = state?.activeTab ?? "details";
  const hasPatch = state?.hasPatch ?? false;
  const hasTrace = state?.hasTrace ?? false;

  useInput((input, key) => {
    if (disabled) return;

    if (isKeyMode) {
      handleKeysMode(input, key);
    } else if (isMenuMode) {
      handleMenuMode(input, key);
    }
  });

  function handleKeysMode(
    input: string,
    key: { upArrow: boolean; downArrow: boolean; leftArrow: boolean; rightArrow: boolean; return: boolean; escape: boolean; tab: boolean }
  ): void {
    if (focus === "filters") {
      handleFiltersFocusKeys(input, key);
    } else if (focus === "list") {
      handleListFocusKeys(input, key);
    } else {
      handleDetailsFocusKeys(input, key);
    }
  }

  function handleListFocusKeys(
    input: string,
    key: { upArrow: boolean; downArrow: boolean; return: boolean; escape: boolean; tab: boolean }
  ): void {
    if (input === "1") {
      onTabChange?.("details");
      return;
    }

    if (input === "2") {
      onTabChange?.("explain");
      return;
    }

    if (input === "3" && hasTrace) {
      onTabChange?.("trace");
      return;
    }

    if (input === "4" && hasPatch) {
      onTabChange?.("patch");
      return;
    }

    if (input === "j" || key.downArrow) {
      onNavigate("down");
      return;
    }

    if (input === "k" || key.upArrow) {
      onNavigate("up");
      return;
    }

    if (input === "o" || key.return) {
      onOpen();
      return;
    }

    if (input === "a") {
      onApply();
      return;
    }

    if (input === "i") {
      onIgnore();
      return;
    }

    if (input === "e") {
      onExplain();
      return;
    }

    if (input === "t") {
      onTrace();
      return;
    }

    if (input === "n") {
      onNextIssue();
      return;
    }

    if (input === "p") {
      onPrevIssue();
      return;
    }

    if (input === "f") {
      onFocusFilters?.();
      return;
    }

    if (key.tab) {
      onToggleFocus();
      return;
    }

    if (key.escape || input === "q") {
      onBack();
      return;
    }
  }

  function handleDetailsFocusKeys(
    input: string,
    key: { upArrow: boolean; downArrow: boolean; return: boolean; escape: boolean; tab: boolean }
  ): void {
    if (input === "1") {
      onTabChange?.("details");
      return;
    }

    if (input === "2") {
      onTabChange?.("explain");
      return;
    }

    if (input === "3" && hasTrace) {
      onTabChange?.("trace");
      return;
    }

    if (input === "4" && hasPatch) {
      onTabChange?.("patch");
      return;
    }

    if (input === "j" || key.downArrow) {
      onNavigate("down");
      return;
    }

    if (input === "k" || key.upArrow) {
      onNavigate("up");
      return;
    }

    if (key.tab) {
      const nextTab = getNextTab(activeTab, hasPatch, hasTrace);
      onTabChange?.(nextTab);
      return;
    }

    if (key.escape) {
      onToggleFocus();
      return;
    }
  }

  function handleFiltersFocusKeys(
    input: string,
    key: { leftArrow: boolean; rightArrow: boolean; downArrow: boolean; return: boolean; escape: boolean; tab: boolean }
  ): void {
    if (input === "h" || key.leftArrow) {
      onFilterNavigate?.("left");
      return;
    }

    if (input === "l" || key.rightArrow) {
      onFilterNavigate?.("right");
      return;
    }

    if (key.return || input === " ") {
      onFilterSelect?.();
      return;
    }

    if (input === "j" || key.downArrow) {
      onToggleFocus();
      return;
    }

    if (key.tab) {
      onToggleFocus();
      return;
    }

    if (key.escape) {
      onBack();
      return;
    }
  }

  function handleMenuMode(
    _input: string,
    key: { upArrow: boolean; downArrow: boolean; return: boolean; escape: boolean; tab: boolean }
  ): void {
    if (key.upArrow) {
      onNavigate("up");
      return;
    }

    if (key.downArrow) {
      onNavigate("down");
      return;
    }

    if (key.return) {
      onOpen();
      return;
    }

    if (key.escape) {
      onBack();
      return;
    }
  }
}
