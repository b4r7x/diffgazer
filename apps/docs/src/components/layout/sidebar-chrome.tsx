import { Select, SelectContent, SelectItem, SelectTrigger } from "@diffgazer/ui/components/select";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { toast } from "@diffgazer/ui/components/toast";
import { cn } from "@diffgazer/ui/lib/utils";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useLayoutEffect, useRef, useState } from "react";
import { DocsPathBreadcrumbs } from "@/components/docs-path-breadcrumbs";
import { useMobileNav } from "@/hooks/mobile-nav-context";
import { usePendingDocsRoute } from "@/hooks/use-pending-docs-route";
import {
  DOCS_LIBRARY_IDS,
  type DocsLibraryId,
  getDocsLibraryConfig,
  getRouteSlugsFromPathname,
  isDocsLibraryId,
  routeSlugsFromSourcePath,
  sourceSlugsForLibrary,
} from "@/lib/library";
import type { PageTree } from "@/lib/page-tree";
import { parseLibrarySwitchInput } from "@/lib/server-inputs";
import {
  SidebarPanelHeader,
  SidebarPanelHeaderDivider,
  SidebarPanelHeaderLabel,
  SidebarPanelHeaderRow,
} from "./sidebar-panel-header";

const resolveLibrarySwitchPath = createServerFn({ method: "GET" })
  .inputValidator(parseLibrarySwitchInput)
  .handler(async ({ data }) => {
    const { source } = await import("@/lib/source");
    const sourceSlugs = sourceSlugsForLibrary(data.targetLibrary, data.currentSlugs);
    const targetPage = source.getPage(sourceSlugs);

    if (!targetPage) {
      return { library: data.targetLibrary, slugs: [] as string[] };
    }

    const targetSlugs = routeSlugsFromSourcePath(data.targetLibrary, targetPage.path);

    return { library: data.targetLibrary, slugs: targetSlugs ?? [] };
  });

const selectTriggerClassName = cn(
  "h-auto min-h-6 w-auto min-w-0 flex-1 justify-start gap-2 rounded-none border-0 bg-transparent px-0 py-1 text-left shadow-none pointer-coarse:min-h-11",
  "text-xs font-mono font-bold text-foreground",
  "hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
);

interface RouteContext {
  library: DocsLibraryId;
  pathname: string;
  pendingPathname: string | null;
}

export function SidebarChrome({ library, tree }: { library: DocsLibraryId; tree: PageTree }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const pendingDocsPathname = usePendingDocsRoute();
  const navigate = useNavigate();
  const { setOpen: setMobileNavOpen, isDesktop } = useMobileNav();
  const [selectHost, setSelectHost] = useState<HTMLDivElement | null>(null);
  // The awaited switch resolves long after the render that started it, so the
  // route it began on is read from a ref; null means the sidebar unmounted.
  const activeRouteRef = useRef<RouteContext | null>({
    library,
    pathname,
    pendingPathname: pendingDocsPathname,
  });
  const [pendingSwitch, setPendingSwitch] = useState<RouteContext | null>(null);
  const activeLibrary = getDocsLibraryConfig(library);
  const switching =
    pendingSwitch !== null &&
    pendingSwitch.library === library &&
    pendingSwitch.pathname === pathname &&
    pendingSwitch.pendingPathname === pendingDocsPathname;
  const isHeaderBusy = switching || pendingDocsPathname !== null;

  // Layout, not passive: a resolved switch can run before a passive effect would
  // have refreshed the route it compares itself against.
  useLayoutEffect(() => {
    activeRouteRef.current = { library, pathname, pendingPathname: pendingDocsPathname };
    return () => {
      activeRouteRef.current = null;
    };
  }, [library, pathname, pendingDocsPathname]);

  const pathParts = pathname.split("/").filter(Boolean);
  const showBreadcrumbs = isDocsLibraryId(pathParts[0] ?? "") && pathParts.length > 1;

  const handleLibraryChange = async (nextValue: string) => {
    if (switching) return;
    if (!isDocsLibraryId(nextValue)) return;

    const targetLibrary = getDocsLibraryConfig(nextValue);
    if (!targetLibrary.enabled || nextValue === library) return;

    const ownsTransition = () => {
      const activeRoute = activeRouteRef.current;
      return (
        activeRoute !== null &&
        activeRoute.library === library &&
        activeRoute.pathname === pathname &&
        activeRoute.pendingPathname === pendingDocsPathname
      );
    };
    setPendingSwitch({ library, pathname, pendingPathname: pendingDocsPathname });
    try {
      const currentSlugs = getRouteSlugsFromPathname(pathname, library);
      const { library: targetLib, slugs } = await resolveLibrarySwitchPath({
        data: {
          targetLibrary: nextValue,
          currentSlugs,
        },
      });
      if (!ownsTransition()) return;

      await navigate({
        to: "/$lib/$",
        params: { lib: targetLib, _splat: slugs.join("/") },
      });
    } catch {
      if (!ownsTransition()) return;
      toast.error("Couldn't switch library");
    } finally {
      setPendingSwitch(null);
    }
  };

  return (
    <SidebarPanelHeader>
      <SidebarPanelHeaderRow aria-busy={isHeaderBusy}>
        <SidebarPanelHeaderLabel>Scope</SidebarPanelHeaderLabel>
        <div ref={setSelectHost} className="contents">
          <Select value={library} onChange={(v) => void handleLibraryChange(v)}>
            <SelectTrigger
              className={cn(selectTriggerClassName, switching && "pointer-events-none opacity-50")}
              aria-disabled={switching || undefined}
              aria-label="Select documentation library"
            >
              <span className="truncate">
                <span className="text-muted-foreground">[ </span>
                {activeLibrary.displayName}
                <span className="text-muted-foreground"> ]</span>
              </span>
              {isHeaderBusy ? (
                <Spinner size="sm" className="shrink-0 text-muted-foreground" />
              ) : null}
            </SelectTrigger>
            <SelectContent
              className="min-w-[12rem] rounded-none border border-border bg-background p-0 shadow-none"
              sideOffset={0}
              align="start"
              portalContainer={isDesktop ? undefined : selectHost}
            >
              {DOCS_LIBRARY_IDS.map((id) => {
                const config = getDocsLibraryConfig(id);
                return (
                  <SelectItem
                    key={id}
                    value={id}
                    disabled={!config.enabled}
                    indicator="radio"
                    className="rounded-none bg-background px-3 py-1.5 text-xs text-foreground/55 aria-selected:bg-foreground/[0.08] aria-selected:font-semibold aria-selected:text-foreground data-[highlighted]:bg-foreground/[0.06] data-[highlighted]:text-foreground"
                  >
                    {config.enabled ? config.displayName : `${config.displayName} (coming soon)`}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </SidebarPanelHeaderRow>

      {showBreadcrumbs ? (
        <>
          <SidebarPanelHeaderDivider />
          <SidebarPanelHeaderRow className="min-h-0 gap-2 py-1.5">
            <SidebarPanelHeaderLabel>Path</SidebarPanelHeaderLabel>
            <DocsPathBreadcrumbs
              tree={tree}
              className="min-w-0 flex-1"
              onNavigate={() => setMobileNavOpen(false)}
            />
          </SidebarPanelHeaderRow>
        </>
      ) : null}
    </SidebarPanelHeader>
  );
}
