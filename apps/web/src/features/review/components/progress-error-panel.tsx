import { usePageFooter } from "@diffgazer/core/footer";
import { type ReviewStreamErrorGuidance, sanitizePresentationText } from "@diffgazer/core/review";
import { BACK_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { useActionRowNavigation } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Panel } from "@diffgazer/ui/components/panel";
import type { RefObject } from "react";
import { chromeReturnShortcut } from "@/components/layout/header-chrome";
import { useFocusWithin } from "@/hooks/use-focus-within";
import type { ProgressZone } from "../hooks/use-progress-keyboard";

/** One way out of the error layout, in the order the row walks them. */
export interface ErrorAction {
  label: string;
  onAction: () => void;
  variant: "secondary" | "outline";
}

/**
 * The ways forward this panel offers. Every settled failure with a full-frame
 * gate card behind it leaves the live screen, so what is left here is a
 * transport that can be picked up again and a terminated session, whose partial
 * run the server saved before it ended.
 */
export function buildErrorActions({
  guidance,
  onBack,
  onRetry,
  onViewRun,
}: {
  guidance: ReviewStreamErrorGuidance;
  onBack?: () => void;
  onRetry?: () => void;
  onViewRun?: () => void;
}): ErrorAction[] {
  const actions: ErrorAction[] = [];
  if (onBack) {
    actions.push({ label: "Back to Home", onAction: onBack, variant: "secondary" });
  }
  if (guidance.kind === "transport" && onRetry) {
    actions.push({ label: guidance.ctaLabel, onAction: onRetry, variant: "outline" });
  }
  if (onViewRun) {
    actions.push({ label: "View Saved Run", onAction: onViewRun, variant: "outline" });
  }
  return actions;
}

export function ProgressErrorPanel({
  error,
  guidance,
  actions,
  panelRef,
  chromeReturnZone,
  hasBack,
}: {
  error: string;
  guidance: ReviewStreamErrorGuidance;
  actions: ErrorAction[];
  /** The error zone's container, owned by the keyboard hook that focuses into it. */
  panelRef: RefObject<HTMLDivElement | null>;
  /** The zone the header Back button returns to, for the parked legend. */
  chromeReturnZone: ProgressZone | null;
  hasBack: boolean;
}) {
  // Only buttons take focus in here, so focus in the panel means the row has it
  // - the zone alone would keep the mark lit after Tab moved on, and the legend
  // below names the row's keys only while they are the ones bound.
  const focus = useFocusWithin<HTMLDivElement>();
  const row = useActionRowNavigation({
    enabled: true,
    actionCount: actions.length,
    // Mount lands on the first way out: this row is the error layout's focus
    // target, not the log behind it.
    defaultZone: "actions",
    // Scoped to the panel so the row's keys stand down the moment focus leaves
    // it: in the log or parked on the header Back button, ←/→ must not yank
    // focus back into the panel, and ↑ belongs to the chrome hand-off.
    containerRef: panelRef,
    canExitActions: false,
    onAction: (index) => actions[index]?.onAction(),
  });
  const focusedLabel = actions[row.focusedIndex]?.label;

  // The error layout's only footer writer: the pane hook stands its own down
  // there, so this names the keys the row binds while it holds focus, and the
  // way back down while the chrome holds it instead.
  usePageFooter({
    shortcuts: focus.focusWithin
      ? [
          // A lone way out has nowhere to move to.
          ...(actions.length > 1 ? [{ key: "←/→", label: "Move Action" }] : []),
          ...(focusedLabel ? [{ key: "Enter/Space", label: focusedLabel }] : []),
        ]
      : chromeReturnShortcut(chromeReturnZone, { error: "Actions" }),
    rightShortcuts: hasBack ? [BACK_SHORTCUT] : [],
  });

  return (
    <div className="shrink-0 px-4 pb-3">
      {/* No reticle of its own: the enclosing log pane already brackets while
          focus sits in here, and a screen wears one. */}
      <Panel
        ref={panelRef}
        {...focus.props}
        tone="error"
        role="alert"
        aria-live="assertive"
        className="max-w-prose text-left"
      >
        <Panel.Header>
          <Panel.Title>{guidance.title}</Panel.Title>
        </Panel.Header>
        <Panel.Content>
          <div className="font-mono text-muted-foreground">{sanitizePresentationText(error)}</div>
          <div className="text-muted-foreground">{guidance.guidance}</div>
          <div className="flex flex-wrap gap-3">
            {actions.map((action, index) => (
              <Button
                key={action.label}
                {...row.getActionProps(index)}
                variant={action.variant}
                bracket
                highlighted={focus.focusWithin && row.focusedIndex === index}
                onClick={action.onAction}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </Panel.Content>
      </Panel>
    </div>
  );
}
