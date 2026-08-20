import { usePageFooter } from "@diffgazer/core/footer";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { BACK_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { useActionRowNavigation, useKey, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Panel } from "@diffgazer/ui/components/panel";
import { cn } from "@diffgazer/ui/lib/utils";
import { useId, useRef } from "react";
import { useFocusWithin } from "@/hooks/use-focus-within";

interface FailureAction {
  label: string;
  onAction: () => void;
  disabled?: boolean;
}

export interface FailureViewProps {
  title: string;
  message: string;
  /** Identity of the thing that failed — e.g. the configuration's provider and model. */
  meta?: string;
  primary: FailureAction;
  /** Forward path that is not a retry — e.g. opening the providers screen. Never the Esc target. */
  recovery?: FailureAction;
  /** Omit when the dead end has no way back; Esc then takes the primary action. */
  secondary?: FailureAction;
  /** Error is the loud tone and announces itself; warning is a gate the user can pass. */
  tone?: "error" | "warning";
  /** Keys scope id: one per gate, shared by the screens that gate mutually excludes. */
  scope: string;
  /** The not-found route owns the page heading; a failure inside a page does not. */
  titleAs?: "h1" | "h2";
  footerRightShortcuts?: Shortcut[];
}

/**
 * The app's one dead-end screen: a resting panel, one sentence of cause, and up
 * to three ways forward. ←/→ move between the actions, Enter/Space activates,
 * Esc takes the secondary one — or the primary when there is no secondary; the
 * recovery action is a forward path and never the Esc target. The panel claims
 * the focused corner brackets from real focus: an action inside normally holds
 * it, and when every action disables mid-mutation, focus parks on the panel
 * itself so the reticle stays visible.
 */
export function FailureView({
  title,
  message,
  meta,
  primary,
  recovery,
  secondary,
  tone = "error",
  scope,
  titleAs: TitleTag = "h2",
  footerRightShortcuts = [BACK_SHORTCUT],
}: FailureViewProps) {
  useScope(scope);
  const titleId = useId();
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const { focusWithin, props: focusProps } = useFocusWithin<HTMLDivElement>();
  const actions = [primary, recovery, secondary].filter(
    (action): action is FailureAction => action !== undefined,
  );
  const escapeAction = secondary ?? primary;

  const footer = useActionRowNavigation({
    enabled: true,
    actionCount: actions.length,
    disabledActions: actions.map((action) => action.disabled === true),
    defaultZone: "actions",
    disabledFocusFallbackRef: focusFallbackRef,
    onAction: (index) => actions[index]?.onAction(),
  });

  useKey("Escape", escapeAction.onAction);

  const focusedLabel = actions[footer.focusedIndex]?.label ?? primary.label;
  const isError = tone === "error";

  usePageFooter({
    // A lone action has nowhere to move to, so the row hint stays off that screen.
    shortcuts: [
      ...(actions.length > 1 ? [{ key: "←/→", label: "Move Action" }] : []),
      { key: "Enter/Space", label: focusedLabel, disabled: footer.isFocusedActionDisabled },
    ],
    rightShortcuts: footerRightShortcuts,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 md:p-6 lg:p-8">
      {/* Spare height splits 1:2 around the panel — the optical band every
          hub/child/home screen shares — and the spacers collapse once the panel
          outgrows the viewport, so a short window scrolls from the top. */}
      <div aria-hidden className="grow" />
      <Panel
        {...focusProps}
        ref={focusFallbackRef}
        tabIndex={-1}
        tone={isError ? "error" : "warning"}
        focused={focusWithin}
        aria-labelledby={titleId}
        className="mx-auto w-full max-w-lg shrink-0 text-center focus:outline-none"
      >
        {/* Wayfinding only: the corner chip is a fixed 11px uppercase strip with
            no wrap, so it names the kind of dead end and the failure's own
            sentence — often a runtime-interpolated one — stays a real heading in
            the content flow below. */}
        <Panel.Label aria-hidden="true">{isError ? "Error" : "Notice"}</Panel.Label>
        <Panel.Content spacing="none">
          {/* The alert wrapper, not the heading itself: role="alert" on a heading
              element replaces its heading role, and the failure screen wants both
              the announcement and a real heading in the outline. */}
          <div role={isError ? "alert" : undefined}>
            <TitleTag
              id={titleId}
              className={cn(
                "mb-4 font-bold",
                // The route-level dead end owns the page heading and reads at page
                // scale; a failure inside a page stays at panel scale.
                TitleTag === "h1" ? "text-2xl" : "text-lg",
                isError ? "text-error-text" : "text-warning-text",
              )}
            >
              {title}
            </TitleTag>
          </div>
          {meta ? (
            // Data, not prose: the identity of the failed configuration keeps its
            // real casing and reads at full foreground strength.
            <p className="mb-3 break-words font-mono text-sm text-foreground">{meta}</p>
          ) : null}
          <p className="mx-auto mb-6 max-w-[46ch] break-words font-mono text-sm text-muted-foreground">
            {message}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {actions.map((action, index) => (
              <Button
                key={action.label}
                {...footer.getActionProps(index)}
                variant={action === primary ? "outline" : "secondary"}
                bracket
                disabled={action.disabled}
                highlighted={footer.inActions && footer.focusedIndex === index}
                onClick={action.onAction}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </Panel.Content>
      </Panel>
      <div aria-hidden className="grow-[2]" />
    </div>
  );
}
