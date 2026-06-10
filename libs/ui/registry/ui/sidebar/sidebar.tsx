"use client";

import { type HTMLAttributes, type ReactNode, type Ref, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "../dialog";
import { SidebarChromeContext, useOptionalSidebar, useSidebar } from "./sidebar-context";
import { SidebarProvider } from "./sidebar-provider";
import { type SidebarVariant, sidebarContainerVariants } from "./sidebar-variants";

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>;
  variant?: SidebarVariant;
  autoTone?: boolean;
  /**
   * When true, always render inline navigation even on mobile. Use when a parent
   * layout (for example an app shell drawer) already owns the mobile presentation.
   */
  embedded?: boolean;
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
  ref?: Ref<HTMLElement>;
  variant: SidebarVariant;
  autoTone: boolean;
  embedded: boolean;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  const { state, isMobile, onStateChange } = useSidebar();
  const open = state !== "hidden";

  if (isMobile && !embedded) {
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
  return <SidebarProvider>{chrome}</SidebarProvider>;
}
