import { useFocusZone, useKey } from "@diffgazer/keys";
import { usePageFooter } from "@diffgazer/core/footer";

interface UseReviewProgressKeyboardOptions {
  onViewResults?: () => void;
  onCancel?: () => void;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("button,a,input,select,textarea,[role='button'],[tabindex]:not([tabindex='-1'])"));
}

export function useReviewProgressKeyboard({
  onViewResults,
  onCancel,
}: UseReviewProgressKeyboardOptions) {
  const { zone: focusPane } = useFocusZone({
    initial: "progress",
    zones: ["progress", "log"] as const,
    scope: "review-progress",
    transitions: ({ zone, key }) => {
      if (key === "ArrowLeft" && zone === "log") return "progress";
      if (key === "ArrowRight" && zone === "progress") return "log";
      return null;
    },
  });

  useKey("Enter", (event) => {
    if (isInteractiveTarget(event.target)) return;
    onViewResults?.();
  }, { enabled: !!onViewResults });
  useKey("Escape", () => onCancel?.(), { enabled: !!onCancel });

  usePageFooter({
    shortcuts: [
      { key: "←/→", label: "Switch Pane" },
      ...(onViewResults ? [{ key: "Enter", label: "View Results" }] : []),
    ],
    rightShortcuts: onCancel ? [{ key: "Esc", label: "Cancel" }] : [],
  });

  return { focusPane };
}
