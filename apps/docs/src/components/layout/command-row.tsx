import { Kbd } from "@diffgazer/ui/components/kbd";
import { cn } from "@diffgazer/ui/lib/utils";
import { useRouterState } from "@tanstack/react-router";
import { CHROME_ACTION_TARGET_CLASS, CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import { FOCUS_RING_CLASS } from "@/components/shared/focus-ring";
import { useMobileNav } from "@/hooks/mobile-nav-context";
import { useSearchOpen } from "@/hooks/search-context";
import { getDocsLibraryConfig, getDocsLibraryFromPathname } from "@/lib/library";

function MobileNavToggle() {
  const { open, setOpen, menuButtonRef } = useMobileNav();

  return (
    <button
      ref={menuButtonRef}
      type="button"
      aria-label="Open navigation menu"
      aria-expanded={open}
      aria-controls="sidebar-nav"
      className={cn(
        // Both conditions are CSS so the toggle ships in the prerendered markup
        // and paints with the first frame instead of appearing at hydration:
        // `max-lg` mirrors the drawer's own breakpoint in tui-two-pane, and the
        // `has` check keeps surfaces that mount no drawer (the global 404) from
        // offering a control that opens nothing.
        "hidden group-has-[#sidebar-nav]/shell:max-lg:flex",
        "-ml-2 mr-1 h-11 w-11 shrink-0 flex-col items-center justify-center gap-1",
        FOCUS_RING_CLASS,
      )}
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
    <div className="flex shrink-0 items-center border-b border-border bg-background px-4 py-1.5 pointer-coarse:py-1">
      <MobileNavToggle />
      <span className="mr-3 font-bold text-foreground" aria-hidden="true">
        ❯
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-w-0 flex-1 cursor-text items-center bg-transparent text-left font-mono text-sm text-muted-foreground transition-colors hover:text-foreground",
          CHROME_ACTION_TARGET_CLASS,
          FOCUS_RING_CLASS,
        )}
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
