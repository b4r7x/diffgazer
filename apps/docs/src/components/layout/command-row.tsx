import { Kbd } from "@diffgazer/ui/components/kbd";
import { useRouterState } from "@tanstack/react-router";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import { FOCUS_RING_CLASS } from "@/components/shared/focus-ring";
import { useMobileNav } from "@/hooks/mobile-nav-context";
import { useSearchOpen } from "@/hooks/search-context";
import { getDocsLibraryConfig, getDocsLibraryFromPathname } from "@/lib/library";

function MobileNavToggle() {
  const { open, setOpen, isDesktop, sidebarEnabled, menuButtonRef } = useMobileNav();

  if (isDesktop || !sidebarEnabled) {
    return null;
  }

  return (
    <button
      ref={menuButtonRef}
      type="button"
      aria-label="Open navigation menu"
      aria-expanded={open}
      aria-controls="sidebar-nav"
      className="mr-3 flex h-6 w-6 shrink-0 flex-col justify-center gap-1"
      onClick={() => setOpen(true)}
    >
      <span className="block h-px w-4 bg-foreground" />
      <span className="block h-px w-4 bg-foreground" />
      <span className="block h-px w-4 bg-foreground" />
    </button>
  );
}

export function CommandRow() {
  const { setOpen } = useSearchOpen();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const library = getDocsLibraryFromPathname(pathname);
  const scope = library ? getDocsLibraryConfig(library).displayName : "root";

  return (
    <div className="flex shrink-0 items-center border-b border-border bg-background px-4 py-2">
      <MobileNavToggle />
      <span className="mr-3 font-bold text-foreground" aria-hidden="true">
        ❯
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex min-w-0 flex-1 cursor-text items-center bg-transparent text-left font-mono text-sm text-muted-foreground transition-colors hover:text-foreground ${FOCUS_RING_CLASS}`}
      >
        <span className="truncate">search docs, components, hooks…</span>
        <Kbd size="sm" className="ml-auto shrink-0 text-muted-foreground">
          /
        </Kbd>
      </button>
      <span aria-hidden="true" className={`ml-4 hidden shrink-0 md:inline ${CHROME_LABEL_CLASS}`}>
        [SCOPE: {scope}]
      </span>
    </div>
  );
}
