import { useInput } from "ink";
import { useKeyboardMode } from "../../../hooks/use-keyboard-mode.js";
import { TAB_ORDER, type IssueTab } from "../components/issue-tabs.js";

export type FocusArea = "list" | "details";

export interface ReviewKeyboardState {
  focus: FocusArea;
  activeTab?: IssueTab;
  hasPatch?: boolean;
  hasTrace?: boolean;
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
    key: { upArrow: boolean; downArrow: boolean; return: boolean; escape: boolean; tab: boolean }
  ): void {
    if (focus === "list") {
      handleListFocusKeys(input, key);
    } else {
      handleDetailsFocusKeys(input, key);
    }
  }

  function handleListFocusKeys(
    input: string,
    key: { upArrow: boolean; downArrow: boolean; return: boolean; escape: boolean; tab: boolean }
  ): void {
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
