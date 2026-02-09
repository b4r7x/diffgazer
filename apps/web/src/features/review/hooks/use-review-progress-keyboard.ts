import { useFocusZone, useKey } from "@stargazer/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";

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

  usePageFooter({
    shortcuts: [
      { key: "←/→", label: "Switch Pane" },
      ...(onViewResults ? [{ key: "Enter", label: "View Results" }] : []),
    ],
    rightShortcuts: onCancel ? [{ key: "Esc", label: "Cancel" }] : [],
  });

  return { focusPane };
}
