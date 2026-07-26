import { useFocusTrap, useKey } from "@diffgazer/keys";
import { Panel } from "@diffgazer/ui/components/panel";
import { cn } from "@diffgazer/ui/lib/utils";
import { type FocusEvent, type ReactNode, useEffect, useRef } from "react";
import { useMobileNav } from "@/hooks/mobile-nav-context";

export interface TuiTwoPaneProps {
  sidebar: (closeSidebar: () => void) => ReactNode;
  sidebarHeader?: ReactNode;
  sidebarBusy?: boolean;
  /** Wrap the main column in a hairline panel (docs). Home passes false for stacked panels. */
  contentInPanel?: boolean;
  children: ReactNode;
}

export function TuiTwoPane({
  sidebar,
  sidebarHeader,
  sidebarBusy = false,
  contentInPanel = true,
  children,
}: TuiTwoPaneProps) {
  const { open: sidebarOpen, setOpen: setSidebarOpen, isDesktop } = useMobileNav();
  const sidebarInert = !isDesktop && !sidebarOpen;
  const panelInert = !isDesktop && sidebarOpen;
  const drawerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const lastSidebarFocusRef = useRef<HTMLElement>(null);

  useFocusTrap(drawerRef, {
    enabled: sidebarOpen && !isDesktop,
    initialFocus: sidebarRef,
    restoreFocus: true,
  });

  const closeSidebar = () => setSidebarOpen(false);
  const sidebarNode = sidebar(closeSidebar);

  useKey("escape", closeSidebar, { enabled: sidebarOpen && !isDesktop, preventDefault: true });

  // The drawer exists only while this pane does, so a surface that renders none
  // (the global 404) must not inherit an open one.
  useEffect(() => () => setSidebarOpen(false), [setSidebarOpen]);

  useEffect(() => {
    if (!isDesktop) return;
    const target = lastSidebarFocusRef.current;
    if (target?.isConnected) target.focus();
  }, [isDesktop]);

  const rememberSidebarFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement && sidebarRef.current?.contains(event.target)) {
      lastSidebarFocusRef.current = event.target;
    }
  };

  const contentBody = contentInPanel ? (
    <Panel frame="hairline" className="flex h-full min-h-0 flex-col overflow-hidden">
      {children}
    </Panel>
  ) : (
    children
  );

  return (
    <div
      ref={drawerRef}
      onFocusCapture={rememberSidebarFocus}
      className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-2"
    >
      <button
        type="button"
        aria-label="Close sidebar navigation"
        inert={!sidebarOpen || undefined}
        className={cn(
          "fixed inset-0 z-(--z-overlay) bg-(--scrim) transition-opacity duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none lg:hidden",
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={closeSidebar}
      />

      <aside
        ref={sidebarRef}
        id="sidebar-nav"
        aria-label="Sidebar navigation"
        aria-busy={sidebarBusy}
        // Opening the drawer focuses the drawer itself, not its first control:
        // a control would arm its own :focus ring on a tap that never touched
        // it. Tab from here enters the trap at the first control as usual.
        tabIndex={-1}
        inert={sidebarInert || undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-(--z-overlay) flex w-72 flex-col outline-hidden transition-transform duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
          // The drawer escapes the shell's safe-area padding while it is fixed,
          // so it carries its own insets against the notch and the home bar.
          "pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
          "lg:static lg:z-auto lg:col-start-1 lg:row-start-1 lg:h-full lg:min-h-0 lg:w-auto lg:translate-x-0 lg:pb-0 lg:pl-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <Panel frame="hairline" className="flex h-full min-h-0 flex-col">
          {sidebarHeader ? (
            <div className="shrink-0 border-b border-border bg-background">{sidebarHeader}</div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-hidden">{sidebarNode}</div>
        </Panel>
      </aside>

      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:col-start-2 lg:row-start-1 lg:h-full lg:min-h-0"
        inert={panelInert || undefined}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{contentBody}</div>
      </div>
    </div>
  );
}
