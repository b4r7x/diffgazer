import { Panel } from "@diffgazer/ui/components/panel";
import { cn } from "@diffgazer/ui/lib/utils";
import { type ReactNode, useEffect, useRef } from "react";
import { useMobileNav } from "@/lib/mobile-nav-context";

export interface TuiTwoPaneProps {
  sidebar: ReactNode | ((closeSidebar: () => void) => ReactNode);
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
    menuButtonRef,
  } = useMobileNav();
  const sidebarInert = !isDesktop && !sidebarOpen;
  const panelInert = !isDesktop && sidebarOpen;
  const sidebarRef = useRef<HTMLElement>(null);
  const hadOpenSidebarRef = useRef(false);

  const closeSidebar = () => setSidebarOpen(false);
  const sidebarNode = typeof sidebar === "function" ? sidebar(closeSidebar) : sidebar;

  useEffect(() => {
    registerSidebar();
    return unregisterSidebar;
  }, [registerSidebar, unregisterSidebar]);

  useEffect(() => {
    if (isDesktop) return;

    if (sidebarOpen) {
      hadOpenSidebarRef.current = true;
      const firstLink = sidebarRef.current?.querySelector<HTMLElement>("a[href], button");
      (firstLink ?? sidebarRef.current)?.focus();
      return;
    }

    if (hadOpenSidebarRef.current) {
      hadOpenSidebarRef.current = false;
      menuButtonRef.current?.focus();
    }
  }, [sidebarOpen, isDesktop, menuButtonRef]);

  useEffect(() => {
    if (!sidebarOpen || isDesktop) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setSidebarOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen, isDesktop, setSidebarOpen]);

  const contentBody = contentInPanel ? (
    <Panel frame="hairline" className="flex h-full min-h-0 flex-col overflow-hidden">
      {children}
    </Panel>
  ) : (
    children
  );

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-2">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar navigation"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        ref={sidebarRef}
        id="sidebar-nav"
        aria-label="Sidebar navigation"
        aria-busy={sidebarBusy}
        inert={sidebarInert || undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col transition-transform duration-150 ease-in-out",
          "lg:static lg:z-auto lg:col-start-1 lg:row-start-1 lg:h-full lg:min-h-0 lg:w-auto lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        data-pagefind-ignore
      >
        <Panel frame="hairline" className="flex h-full min-h-0 flex-col">
          {sidebarHeader ? (
            <div className="shrink-0 border-b border-border bg-[var(--tui-chrome-band-bg)]">
              {sidebarHeader}
            </div>
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
