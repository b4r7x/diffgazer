"use client";

import { useMemo, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";
import { sidebarContainerVariants, type SidebarVariant } from "@/lib/sidebar-variants";
import { Dialog, DialogContent } from "../dialog";
import {
  SidebarChromeContext,
  useOptionalSidebar,
  useSidebar,
} from "./sidebar-context";
import { SidebarProvider } from "./sidebar-provider";

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>;
  /**
   * Visual variant. Active-marker treatment changes per variant; row metrics
   * stay identical so glyph slots line up across variants.
   *   - `caret`    — `▸` glyph prefix; active = `font-semibold`, no row bg.
   *   - `inverted` — TUI cursor line; active = full-bleed `bg-foreground`.
   *   - `bar`      — 1px `border-l` on active; zero radius, no fill.
   *   - `bracket`  — `[*]` (active) / `[ ]` (inactive) glyph prefix.
   *   - `block`    — soft `bg-foreground/8` fill on active.
   */
  variant?: SidebarVariant;
  /**
   * Opt-in: render a `data-intent` dot before each item's label and derive
   * intent from the item `value` via the built-in dictionary when not
   * explicitly set. Color is decoration only (WCAG 1.4.1) — pair with text
   * cues such as labels or badges.
   */
  autoTone?: boolean;
  children: ReactNode;
}

function SidebarNav({
  ref,
  variant,
  autoTone,
  className,
  "aria-label": ariaLabel,
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  ref?: Ref<HTMLElement>;
  variant: SidebarVariant;
  autoTone: boolean;
}) {
  const { state } = useSidebar();
  return (
    <nav
      ref={ref}
      aria-label={ariaLabel ?? "Primary"}
      data-slot="sidebar"
      data-variant={variant}
      data-state={state}
      data-auto-tone={autoTone || undefined}
      {...rest}
      className={cn(sidebarContainerVariants({ state }), className)}
    >
      {children}
    </nav>
  );
}

/**
 * Reads context state to decide whether to render the inline nav or the
 * mobile sheet wrapper. Kept separate so the host (Provider) can render
 * `aria-live` announcers + mobile sheet without re-entering the Sidebar
 * branch logic.
 */
function SidebarShell({
  ref,
  variant,
  autoTone,
  className,
  children,
  "aria-label": ariaLabel,
  ...rest
}: {
  ref?: Ref<HTMLElement>;
  variant: SidebarVariant;
  autoTone: boolean;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  const { state, isMobile, onStateChange } = useSidebar();
  const open = state !== "hidden";

  if (isMobile) {
    // Mobile: render the same chrome inside a Dialog sheet. Width is fixed
    // by the sheet wrapper (86vw / max 320px) and the inner nav fills it.
    return (
      <Dialog open={open} onOpenChange={(next) => onStateChange(next ? "open" : "hidden")}>
        <DialogContent
          aria-label={ariaLabel ?? "Primary navigation"}
          className="!max-w-[min(86vw,320px)] !h-[100dvh] !max-h-[100dvh] !m-0 !border-r border-border !rounded-none p-0 pb-[env(safe-area-inset-bottom)]"
          frame="none"
        >
          <SidebarNav
            ref={ref}
            variant={variant}
            autoTone={autoTone}
            className={cn("h-full w-full", className)}
            data-mobile="true"
            aria-label={ariaLabel}
            {...rest}
          >
            {children}
          </SidebarNav>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <SidebarNav
      ref={ref}
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

/**
 * `Sidebar` is a "Sidebar inside provider" convenience: passing it without an
 * outer `<SidebarProvider>` instantiates one automatically. When nested inside
 * an existing provider (e.g. for an app that mounts the same provider once at
 * the root and renders the sidebar in multiple slots), it reuses that context.
 *
 * Mobile breakpoint and hotkey config live on `<SidebarProvider>`; this
 * convenience signature does not surface them — use `<SidebarProvider>`
 * directly when you need them.
 */
export function Sidebar({
  ref,
  variant,
  autoTone = false,
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
        className={className}
        {...rest}
      >
        {children}
      </SidebarShell>
    </SidebarChromeContext>
  );

  if (existingContext) return chrome;
  return <SidebarProvider>{chrome}</SidebarProvider>;
}
