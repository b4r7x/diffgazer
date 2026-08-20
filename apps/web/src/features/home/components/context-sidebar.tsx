import { buildHomeContextRows, type HomeContextInfo } from "@diffgazer/core/schemas/presentation";
import { Panel } from "@diffgazer/ui/components/panel";
import { cn } from "@diffgazer/ui/lib/utils";
import type { useNavigate } from "@tanstack/react-router";
import type { Ref } from "react";
import { PathValue } from "@/components/shared/path-value";
import { InfoField } from "./info-field";

interface ContextSidebarProps {
  /** The panel element, for the page to test whether focus rests here before it goes inert. */
  ref?: Ref<HTMLElement>;
  context: HomeContextInfo;
  /** Injected like the menu's, so the panel's two settings routes are observable. */
  navigate: ReturnType<typeof useNavigate>;
  isTrusted: boolean;
  projectPath?: string;
  pending?: boolean;
  /** Provided only when there is a run to open; the row stays inert without it. */
  onOpenLastRun?: () => void;
}

const CONTEXT_TITLE_ID = "home-context-title";

export function ContextSidebar({
  ref,
  context,
  navigate,
  isTrusted,
  projectPath,
  pending = false,
  onOpenLastRun,
}: ContextSidebarProps) {
  const rows = buildHomeContextRows({ context, isTrusted, projectPath });

  const navigateUnlessPending = (to: "/settings/providers" | "/settings/trust-permissions") => {
    if (pending) return;
    navigate({ to });
  };

  return (
    // Brackets mark the pane the keys drive, and this readout is in no focus
    // cycle, so it identifies itself with the hairline box and its corner label
    // instead of a second reticle beside the menu.
    // lg:order-first is a deliberate visual/Tab-order divergence at desktop:
    // the DOM keeps the menu first so Tab and reading order lead with the
    // actionable pane, while the readout sits on the left like the TUI's; the
    // rows' jump keys (t/p/o) reach the sidebar without Tab-walking to it.
    <Panel
      // Explicit for the ref's sake: the ARIA name already resolves the tag to
      // <section>, and `as` keys the ref type to the element actually rendered.
      as="section"
      ref={ref}
      aria-labelledby={CONTEXT_TITLE_ID}
      className="w-full lg:order-first lg:w-80 lg:shrink-0"
    >
      <Panel.Label>
        <h2 id={CONTEXT_TITLE_ID}>Context</h2>
      </Panel.Label>
      <Panel.Content inert={pending || undefined}>
        {isTrusted ? (
          <InfoField label={rows.trust.label} tone="info">
            <PathValue value={rows.trust.value} />
          </InfoField>
        ) : (
          <InfoField
            label={rows.trust.label}
            tone="warning"
            onClick={() => navigateUnlessPending("/settings/trust-permissions")}
            ariaLabel="Grant trust permissions"
          >
            <PathValue value={rows.trust.value} />
            {/* Like the [o] chip below: the binding shows where a keyboard has
                it, and stays decorative — the row's aria-label names the action. */}
            <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Click to grant trust →</span>
              <span aria-hidden="true" className="hidden shrink-0 sm:inline">
                [t]
              </span>
            </span>
          </InfoField>
        )}
        <InfoField
          label={rows.provider.label}
          tone="accent"
          onClick={() => navigateUnlessPending("/settings/providers")}
          ariaLabel="Configure provider settings"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{rows.provider.value}</span>
            <span
              aria-hidden="true"
              className="hidden shrink-0 text-xs text-muted-foreground sm:inline"
            >
              [p]
            </span>
          </div>
        </InfoField>
        <InfoField
          label={rows.lastRun.label}
          tone={rows.lastRun.status === "unavailable" ? "warning" : "success"}
          onClick={pending ? undefined : onOpenLastRun}
          ariaLabel={
            rows.lastRun.meta === undefined
              ? `Open last review ${rows.lastRun.value}`
              : `Open last review ${rows.lastRun.value} — ${rows.lastRun.meta}`
          }
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{rows.lastRun.value}</span>
            {onOpenLastRun ? (
              <>
                {/* The chip advertises the binding on a keyboard; a touch device
                    has none, so it shows the same trailing arrow the untrusted
                    row already uses. */}
                <span
                  aria-hidden="true"
                  className="hidden shrink-0 text-xs text-muted-foreground sm:inline"
                >
                  [o]
                </span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-xs text-muted-foreground sm:hidden"
                >
                  →
                </span>
              </>
            ) : null}
          </div>
          {rows.lastRun.meta !== undefined && (
            <span
              className={cn(
                "mt-0.5 block truncate text-xs",
                // Amber issue count is the pre-mobile signal: findings warrant a
                // warmer hue than the structural gray, a clean run stays green.
                rows.lastRun.hasIssues ? "text-warning-text" : "text-success-text",
              )}
            >
              {rows.lastRun.meta}
            </span>
          )}
        </InfoField>
      </Panel.Content>
    </Panel>
  );
}
