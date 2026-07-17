import { usePageFooter } from "@diffgazer/core/footer";
import { BACK_SHORTCUT, SWITCH_PANE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { useFocusZone, useKey } from "@diffgazer/keys";
import { useRef } from "react";
import { getMainContent } from "@/lib/main-content";

interface UseReviewProgressKeyboardOptions {
  onViewResults?: () => void;
  onBack?: () => void;
  onCancel?: () => void;
  cancelDisabled?: boolean;
  hasError: boolean;
}

export const REVIEW_PROGRESS_CONTROLS = {
  cancel: { key: "c", label: "Cancel" },
  leave: { key: "Escape", label: "Back" },
} as const;

// App-specific activatable-target check. Unlike `isEditableElement` from
// @diffgazer/keys (which only matches text-editable inputs/textareas/contenteditable),
// this also matches buttons and links, so Enter activates them natively instead
// of opening results. Focusable pane scroll containers are intentionally not
// matched: Enter has no native meaning there and the footer advertises
// "Enter View Results" for the whole screen.
function isActivatableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("button,a,input,select,textarea,[role='button']"));
}

export function useReviewProgressKeyboard({
  onViewResults,
  onBack,
  onCancel,
  cancelDisabled = false,
  hasError,
}: UseReviewProgressKeyboardOptions) {
  const progressPaneRef = useRef<HTMLElement>(null);
  const progressScrollRef = useRef<HTMLDivElement>(null);
  const logPaneRef = useRef<HTMLElement>(null);
  const agentFilterRef = useRef<HTMLDivElement>(null);
  const logContentRef = useRef<HTMLDivElement>(null);

  const { zone: focusPane, setZone } = useFocusZone({
    initial: "progress",
    zones: ["progress", "log", "filters"] as const,
    scope: "review-progress",
    tabCycle: hasError ? undefined : ["progress", "log"],
    tabCycleScope: "document",
    tabCycleBoundary: getMainContent,
    focus: {
      autoFocus: true,
      targets: {
        progress: { container: progressPaneRef, target: progressScrollRef },
        filters: agentFilterRef,
        log: {
          container: logContentRef,
          target: () => logContentRef.current?.querySelector<HTMLElement>("[role='log']") ?? null,
        },
      },
    },
    transitions: ({ zone, key }) => {
      if (key === "ArrowLeft" && zone === "log") return "progress";
      if (key === "ArrowRight" && zone === "progress") return "log";
      return null;
    },
  });

  useKey(
    "Enter",
    (event) => {
      if (isActivatableTarget(event.target)) return;
      onViewResults?.();
    },
    { enabled: !!onViewResults && !hasError },
  );
  // Esc leaves the screen without cancelling the run: the review keeps
  // streaming server-side and home's Resume Last Review picks it back up.
  // Cancel stays keyboard-reachable via "c" because document-scope Tab no
  // longer visits the [Cancel] button.
  useKey(REVIEW_PROGRESS_CONTROLS.leave.key, () => onBack?.(), { enabled: !!onBack });
  useKey(
    REVIEW_PROGRESS_CONTROLS.cancel.key,
    (event) => {
      if (isActivatableTarget(event.target)) return;
      onCancel?.();
    },
    { enabled: !!onCancel && !hasError && !cancelDisabled },
  );
  useKey(
    "f",
    (event) => {
      if (isActivatableTarget(event.target)) return;
      setZone("filters");
    },
    { enabled: !hasError },
  );

  usePageFooter({
    shortcuts: hasError
      ? []
      : [
          SWITCH_PANE_SHORTCUT,
          { key: "←/→", label: "Switch Pane" },
          { key: "f", label: "Filter" },
          ...(onViewResults ? [{ key: "Enter", label: "View Results" }] : []),
          ...(onCancel ? [{ ...REVIEW_PROGRESS_CONTROLS.cancel, disabled: cancelDisabled }] : []),
        ],
    rightShortcuts: onBack ? [BACK_SHORTCUT] : [],
  });

  return {
    focusPane,
    progressPaneRef,
    progressScrollRef,
    logPaneRef,
    agentFilterRef,
    logContentRef,
  };
}
