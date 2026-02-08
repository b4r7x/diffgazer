import { useFocusZone, useKey } from "@stargazer/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";

const PROGRESS_SHORTCUTS = [
  { key: "←/→", label: "Pane" },
  { key: "↑/↓", label: "Navigate" },
  { key: "Enter", label: "View Results" },
];

const PROGRESS_RIGHT_SHORTCUTS = [
  { key: "Esc", label: "Cancel" },
];

interface UseReviewProgressKeyboardOptions {
  onViewResults?: () => void;
  onCancel?: () => void;
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

  useKey("Enter", () => onViewResults?.(), { enabled: !!onViewResults });
  useKey("Escape", () => onCancel?.(), { enabled: !!onCancel });

  usePageFooter({ shortcuts: PROGRESS_SHORTCUTS, rightShortcuts: PROGRESS_RIGHT_SHORTCUTS });

  return { focusPane };
}
