import { usePageFooter } from "@diffgazer/core/footer";
import { getNoChangesCopy } from "@diffgazer/core/review";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { BACK_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { useActionRowNavigation, useKey, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Panel } from "@diffgazer/ui/components/panel";
import { useId, useRef } from "react";
import { useFocusWithin } from "@/hooks/use-focus-within";

export interface NoChangesViewProps {
  mode: ReviewMode;
  onBack: () => void;
  onSwitchMode?: () => void;
  switchDisabled?: boolean;
}

export function NoChangesView({
  mode,
  onBack,
  onSwitchMode,
  switchDisabled = false,
}: NoChangesViewProps) {
  useScope("no-changes");

  const titleId = useId();
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const { focusWithin, props: focusProps } = useFocusWithin<HTMLDivElement>();
  const { title, message, switchLabel } = getNoChangesCopy(mode);

  const actions = onSwitchMode ? [onSwitchMode, onBack] : [onBack];
  const actionCount = actions.length;

  const footer = useActionRowNavigation({
    enabled: true,
    actionCount,
    disabledActions: onSwitchMode ? [switchDisabled, false] : [false],
    defaultZone: "actions",
    disabledFocusFallbackRef: focusFallbackRef,
    onAction: (index) => actions[index]?.(),
  });

  useKey("Escape", onBack);

  const focusedLabel = onSwitchMode && footer.focusedIndex === 0 ? switchLabel : "Back to Home";

  const footerShortcuts: Shortcut[] =
    actionCount > 1
      ? [
          { key: "←/→", label: "Move Action" },
          { key: "Enter/Space", label: focusedLabel, disabled: footer.isFocusedActionDisabled },
        ]
      : [{ key: "Enter/Space", label: focusedLabel }];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [BACK_SHORTCUT],
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 md:p-6 lg:p-8">
      {/* Boxed dead-end panels sit in the app-wide centered −38px band, like
          failure-view.tsx, sparse page cards, and loading (card.tsx,
          centered-status.tsx). The spacers collapse once the panel
          outgrows the viewport, so a short window scrolls from the top. */}
      <div aria-hidden className="grow" />
      <Panel
        {...focusProps}
        ref={focusFallbackRef}
        // A gate the user can pass, not a fault — the warning tint its sibling
        // review gates wear.
        tone="warning"
        tabIndex={-1}
        focused={focusWithin}
        aria-labelledby={titleId}
        className="mx-auto w-full max-w-md shrink-0 text-center focus:outline-none"
      >
        {/* Wayfinding only: the corner chip is a fixed 11px uppercase strip with
            no wrap, so it names the kind of dead end and the mode-dependent
            headline stays a real heading in the content flow below. */}
        <Panel.Label aria-hidden="true">Notice</Panel.Label>
        <Panel.Content spacing="none">
          <h2 id={titleId} className="mb-4 text-lg font-bold text-warning-text">
            {title}
          </h2>
          <p className="text-muted-foreground font-mono text-sm mb-6">{message}</p>
          <div className="flex gap-4 justify-center">
            {onSwitchMode && (
              <Button
                {...footer.getActionProps(0)}
                variant="outline"
                bracket
                disabled={switchDisabled}
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
        </Panel.Content>
      </Panel>
      <div aria-hidden className="mt-[76px] grow" />
    </div>
  );
}
