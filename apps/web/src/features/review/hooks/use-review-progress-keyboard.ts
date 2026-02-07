import { useState } from "react";
import { useScope, useKey } from "@stargazer/keyboard";
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
  const [focusPane, setFocusPane] = useState<"progress" | "log">("progress");

  useScope("review-progress");

  useKey("ArrowLeft", () => setFocusPane("progress"), { enabled: focusPane === "log" });
  useKey("ArrowRight", () => setFocusPane("log"), { enabled: focusPane === "progress" });

  useKey("Enter", () => onViewResults?.(), { enabled: !!onViewResults });
  useKey("Escape", () => onCancel?.(), { enabled: !!onCancel });

  usePageFooter({ shortcuts: PROGRESS_SHORTCUTS, rightShortcuts: PROGRESS_RIGHT_SHORTCUTS });

  return { focusPane };
}
