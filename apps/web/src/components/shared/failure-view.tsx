import { usePageFooter } from "@diffgazer/core/footer";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { BACK_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { useActionRowNavigation, useKey, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Panel } from "@diffgazer/ui/components/panel";
import { cn } from "@diffgazer/ui/lib/utils";
import { useRef } from "react";

interface FailureAction {
  label: string;
  onAction: () => void;
  disabled?: boolean;
}

export interface FailureViewProps {
  title: string;
  message: string;
  primary: FailureAction;
  secondary: FailureAction;
  /** Error is the loud tone and announces itself; warning is a gate the user can pass. */
  tone?: "error" | "warning";
  /** Keys scope id: one per gate, shared by the screens that gate mutually excludes. */
  scope: string;
  /** The not-found route owns the page heading; a failure inside a page does not. */
  titleAs?: "h1" | "h2";
  footerRightShortcuts?: Shortcut[];
}

/**
 * The app's one dead-end screen: viewfinder frame, one sentence of cause, and
 * always two ways forward. ←/→ move between the actions, Enter/Space activates,
 * Esc takes the secondary one. The frame stays at rest — a failure view is not
 * a focus target, so it does not borrow the accent focused corners.
 */
export function FailureView({
  title,
  message,
  primary,
  secondary,
  tone = "error",
  scope,
  titleAs: TitleTag = "h2",
  footerRightShortcuts = [BACK_SHORTCUT],
}: FailureViewProps) {
  useScope(scope);
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const actions = [primary, secondary];

  const footer = useActionRowNavigation({
    enabled: true,
    actionCount: actions.length,
    disabledActions: [primary.disabled === true, secondary.disabled === true],
    defaultZone: "actions",
    disabledFocusFallbackRef: focusFallbackRef,
    onAction: (index) => actions[index]?.onAction(),
  });

  useKey("Escape", secondary.onAction);

  const focusedLabel = footer.focusedIndex === 0 ? primary.label : secondary.label;
  const isError = tone === "error";

  usePageFooter({
    shortcuts: [
      { key: "←/→", label: "Move Action" },
      { key: "Enter/Space", label: focusedLabel, disabled: footer.isFocusedActionDisabled },
    ],
    rightShortcuts: footerRightShortcuts,
  });

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Panel
        frame="viewfinder"
        ref={focusFallbackRef}
        tabIndex={-1}
        className="w-full max-w-md p-6 text-center focus:outline-none"
      >
        {/* The alert wrapper, not the heading itself: role="alert" on a heading
            element replaces its heading role, and the failure screen wants both
            the announcement and a real heading in the outline. */}
        <div role={isError ? "alert" : undefined}>
          <TitleTag
            className={cn(
              "mb-4 text-lg font-bold",
              isError ? "text-error-text" : "text-warning-text",
            )}
          >
            {title}
          </TitleTag>
        </div>
        <p className="mx-auto mb-6 max-w-[46ch] break-words font-mono text-sm text-muted-foreground">
          {message}
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button
            {...footer.getActionProps(0)}
            variant="outline"
            bracket
            disabled={primary.disabled}
            highlighted={footer.inActions && footer.focusedIndex === 0}
            onClick={primary.onAction}
          >
            {primary.label}
          </Button>
          <Button
            {...footer.getActionProps(1)}
            variant="secondary"
            bracket
            disabled={secondary.disabled}
            highlighted={footer.inActions && footer.focusedIndex === 1}
            onClick={secondary.onAction}
          >
            {secondary.label}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
