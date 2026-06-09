import { Kbd } from "@diffgazer/ui/components/kbd";
import { useMobileNav } from "@/lib/mobile-nav-context";
import { useSearchOpen } from "@/lib/search-context";

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

  return (
    <div className="flex shrink-0 items-center border-b border-border bg-[var(--tui-chrome-band-bg)] px-4 py-2">
      <MobileNavToggle />
      <span className="mr-3 font-bold text-foreground" aria-hidden="true">
        ❯
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search documentation"
        className="flex min-w-0 flex-1 cursor-text items-center bg-transparent text-left font-mono text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="truncate">search docs, components, hooks (Press </span>
        <Kbd size="sm" className="mx-1 shrink-0 text-muted-foreground">
          ⌘K
        </Kbd>
        <span className="truncate">)…</span>
      </button>
      <span className="ml-4 shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        [MODE: CMD]
      </span>
    </div>
  );
}
