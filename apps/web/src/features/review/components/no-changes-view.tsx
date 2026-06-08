import { usePageFooter } from "@diffgazer/core/footer";
import { getNoChangesCopy } from "@diffgazer/core/review";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { useActionRowNavigation, useKey, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { useRef } from "react";

export interface NoChangesViewProps {
  mode: ReviewMode;
  onBack: () => void;
  onSwitchMode?: () => void;
}

export function NoChangesView({ mode, onBack, onSwitchMode }: NoChangesViewProps) {
  useScope("no-changes");

  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const { title, message, switchLabel } = getNoChangesCopy(mode);

  const actions = onSwitchMode ? [onSwitchMode, onBack] : [onBack];
  const actionCount = actions.length;

  const footer = useActionRowNavigation({
    enabled: true,
    actionCount,
    defaultZone: "actions",
    disabledFocusFallbackRef: focusFallbackRef,
    onAction: (index) => actions[index]?.(),
  });

  useKey("Escape", onBack);

  const focusedLabel = onSwitchMode
    ? footer.focusedIndex === 0
      ? switchLabel
      : "Back to Home"
    : "Back to Home";

  const footerShortcuts: Shortcut[] =
    actionCount > 1
      ? [
          { key: "←/→", label: "Move Action" },
          { key: "Enter/Space", label: focusedLabel },
        ]
      : [{ key: "Enter/Space", label: focusedLabel }];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  });

  return (
    <div className="flex flex-1 items-center justify-center">
      <div
        ref={focusFallbackRef}
        tabIndex={-1}
        className="text-center max-w-md p-6 focus:outline-none"
      >
        <div className="text-tui-yellow text-lg font-bold mb-4">{title}</div>
        <p className="text-tui-muted font-mono text-sm mb-6">{message}</p>
        <div className="flex gap-4 justify-center">
          {onSwitchMode && (
            <Button
              {...footer.getActionProps(0)}
              variant="outline"
              bracket
              highlighted={footer.inActions && footer.focusedIndex === 0}
              onClick={onSwitchMode}
            >
              {switchLabel}
            </Button>
          )}
          <Button
            {...footer.getActionProps(onSwitchMode ? 1 : 0)}
            variant="secondary"
            bracket
            highlighted={footer.inActions && footer.focusedIndex === (onSwitchMode ? 1 : 0)}
            onClick={onBack}
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
