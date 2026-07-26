"use client";

import { type ComponentProps, type ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "../dialog";
import {
  SidebarChromeContext,
  SidebarContext,
  type SidebarState,
  useOptionalSidebar,
  useSidebar,
} from "./sidebar-context";
import { SidebarProvider } from "./sidebar-provider";
import { type SidebarVariant, sidebarContainerVariants } from "./sidebar-variants";

/** Props for sidebar. */
export interface SidebarProps extends ComponentProps<"nav"> {
  /**
   * Visual variant. "caret" reserves a chevron marker slot shown on the active row;
   * "inverted" full-bleeds the active row with bg-foreground; "bar" draws a 2px left edge with
   * a soft fill on active; "terminal" shows the chevron prompt on the active item and draws a
   * 1px hairline left rail with no background fill; "tree" renders bold section headers with
   * stroke-chevron folds and single-hairline connectors (trunk/tick/corner) with a soft active
   * fill. Propagated to items via context and exposed as data-variant on the nav root.
   */
  variant?: SidebarVariant;
  /**
   * When true, renders a small intent dot before each item label and derives intent from the
   * item value via the built-in dictionary unless overridden by an explicit intent prop on the
   * item. Color is decoration only (WCAG 1.4.1) - pair with a text/glyph cue.
   */
  autoTone?: boolean;
  /**
   * When true, always render inline navigation even on mobile. Use when a parent layout (for
   * example an app shell drawer) already owns the mobile presentation.
   */
  embedded?: boolean;
  /** Sidebar subparts (Header, Content, Footer, Trigger). */
  children: ReactNode;
}

function SidebarNav({
  ref,
  state,
  variant,
  autoTone,
  className,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  inert,
  children,
  ...rest
}: ComponentProps<"nav"> & {
  state: SidebarState;
  variant: SidebarVariant;
  autoTone: boolean;
}) {
  const hidden = state === "hidden";
  return (
    <nav
      ref={ref}
      aria-label={ariaLabel ?? "Primary"}
      data-slot="sidebar"
      data-variant={variant}
      data-state={state}
      data-auto-tone={autoTone || undefined}
      {...rest}
      aria-hidden={hidden ? true : ariaHidden}
      inert={hidden ? true : inert}
      className={cn(sidebarContainerVariants({ state }), className)}
    >
      {children}
    </nav>
  );
}

function SidebarShell({
  ref,
  variant,
  autoTone,
  embedded,
  className,
  children,
  "aria-label": ariaLabel,
  ...rest
}: {
  variant: SidebarVariant;
  autoTone: boolean;
  embedded: boolean;
  className?: string;
  children: ReactNode;
} & ComponentProps<"nav">) {
  const sidebar = useSidebar();
  const { state, isMobile, openMobile, onMobileOpenChange } = sidebar;
  const isSheet = isMobile && !embedded;
  // Inside the sheet the tri-state has no presentation to describe, so the
  // subtree sees "open". Without this a provider sitting at "hidden" would make
  // SidebarContent aria-hidden and inert inside an open sheet. The provider's
  // own value is untouched — this override never propagates upward and never
  // fires onStateChange, so the desktop round trip still restores it exactly.
  const sheetContext = useMemo(() => ({ ...sidebar, state: "open" as const }), [sidebar]);

  if (isSheet) {
    // Mobile sheet: the Dialog's presence is the open/closed signal, so the nav
    // inside it is always the full-width layout — rail and hidden have no
    // meaning here — and the desktop tri-state is left alone for the next
    // desktop layout. Width is fixed by the sheet wrapper (86vw / max 320px)
    // and the inner nav fills it.
    return (
      <Dialog open={openMobile} onOpenChange={onMobileOpenChange}>
        <DialogContent
          aria-label={ariaLabel ?? "Primary navigation"}
          className="!max-w-[min(86vw,320px)] !h-[100dvh] !max-h-[100dvh] !m-0 !border-r border-border !rounded-none p-0 pb-[env(safe-area-inset-bottom)]"
          frame="none"
        >
          <SidebarContext value={sheetContext}>
            <SidebarNav
              ref={ref}
              state="open"
              variant={variant}
              autoTone={autoTone}
              className={cn("h-full w-full", className)}
              data-mobile="true"
              aria-label={ariaLabel}
              {...rest}
            >
              {children}
            </SidebarNav>
          </SidebarContext>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <SidebarNav
      ref={ref}
      state={state}
      variant={variant}
      autoTone={autoTone}
      className={className}
      aria-label={ariaLabel}
      {...rest}
    >
      {children}
    </SidebarNav>
  );
}

/** Root nav element (standalone or within SidebarProvider). Owns variant + autoTone. */
export function Sidebar({
  ref,
  variant,
  autoTone = false,
  embedded = false,
  children,
  className,
  ...rest
}: SidebarProps) {
  const existingContext = useOptionalSidebar();
  const resolvedVariant = variant ?? "caret";
  const chromeValue = useMemo(
    () => ({ variant: resolvedVariant, autoTone }),
    [resolvedVariant, autoTone],
  );

  const chrome = (
    <SidebarChromeContext value={chromeValue}>
      <SidebarShell
        ref={ref}
        variant={resolvedVariant}
        autoTone={autoTone}
        embedded={embedded}
        className={className}
        {...rest}
      >
        {children}
      </SidebarShell>
    </SidebarChromeContext>
  );

  if (existingContext) return chrome;
  // The implicit fallback provider does not bind the global Cmd/Ctrl+B hotkey:
  // global keys are an app-level contract, and casually mounted sidebars
  // (docs demos, embedded shells) must not stack listeners on one page. Mount
  // SidebarProvider explicitly to opt in.
  return <SidebarProvider shortcutKey={null}>{chrome}</SidebarProvider>;
}
