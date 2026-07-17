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
  const {
    open: sidebarOpen,
    setOpen: setSidebarOpen,
    isDesktop,
    registerSidebar,
    unregisterSidebar,
  } = useMobileNav();
  const sidebarInert = !isDesktop && !sidebarOpen;
  const panelInert = !isDesktop && sidebarOpen;
  const drawerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const initialSidebarFocusRef = useRef<HTMLElement>(null);
  const lastSidebarFocusRef = useRef<HTMLElement>(null);

  useFocusTrap(drawerRef, {
    enabled: sidebarOpen && !isDesktop,
    initialFocus: initialSidebarFocusRef,
    restoreFocus: true,
  });

  const closeSidebar = () => setSidebarOpen(false);
  const sidebarNode = sidebar(closeSidebar);

  useKey("escape", closeSidebar, { enabled: sidebarOpen && !isDesktop, preventDefault: true });

  useEffect(() => {
    registerSidebar();
    return unregisterSidebar;
  }, [registerSidebar, unregisterSidebar]);

  useEffect(() => {
    if (!isDesktop) return;
    const target = lastSidebarFocusRef.current;
    if (target?.isConnected) target.focus();
  }, [isDesktop]);

  const setSidebarRef = (node: HTMLElement | null) => {
    sidebarRef.current = node;
    initialSidebarFocusRef.current = node?.querySelector<HTMLElement>("a[href], button") ?? null;
  };

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
          "fixed inset-0 z-(--z-overlay) bg-(--scrim) transition-opacity duration-300 motion-reduce:transition-none lg:hidden",
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={closeSidebar}
      />

      <aside
        ref={setSidebarRef}
        id="sidebar-nav"
        aria-label="Sidebar navigation"
        aria-busy={sidebarBusy}
        inert={sidebarInert || undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-(--z-overlay) flex w-72 flex-col transition-transform duration-300 ease-out motion-reduce:transition-none",
          "lg:static lg:z-auto lg:col-start-1 lg:row-start-1 lg:h-full lg:min-h-0 lg:w-auto lg:translate-x-0",
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
