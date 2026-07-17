import { StatusIndicator } from "@diffgazer/ui/components/status-indicator";
import { cn } from "@diffgazer/ui/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import { FOCUS_RING_CLASS } from "@/components/shared/focus-ring";
import { DOCS_CHROME_VERSION } from "@/lib/docs-chrome";
import { type DocsLibraryId, getDocsLibraryConfig } from "@/lib/library";
import { ThemeToggle } from "./theme-toggle";

type NavLinkProps = { label: string; params: { lib: DocsLibraryId } };

function NavLink({ label, params }: NavLinkProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const libraryPath = `/${params.lib}`;
  const isActive = pathname === libraryPath || pathname.startsWith(`${libraryPath}/`);
  const ariaCurrent = isActive ? ("page" as const) : undefined;
  const className = cn(
    "px-1 transition-colors hover:bg-secondary",
    FOCUS_RING_CLASS,
    isActive ? "font-bold text-foreground" : "text-muted-foreground hover:text-foreground",
  );

  return (
    <Link to="/$lib" params={params} aria-current={ariaCurrent} className={className}>
      {label}
    </Link>
  );
}

export function StatusBar() {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-1",
        CHROME_LABEL_CLASS,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link
          to="/"
          className={cn(
            "px-1 font-bold text-foreground transition-colors hover:bg-secondary",
            FOCUS_RING_CLASS,
          )}
        >
          diffgazer
        </Link>
        <span aria-hidden="true">|</span>
        <NavLink label="Docs" params={{ lib: "app" }} />
        <NavLink label="Components" params={{ lib: "ui" }} />
        <NavLink label="Keys" params={{ lib: "keys" }} />
        <a
          href={getDocsLibraryConfig("app").githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "px-1 transition-colors hover:bg-secondary hover:text-foreground",
            FOCUS_RING_CLASS,
          )}
        >
          GitHub
        </a>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <span className="hidden items-center md:inline-flex">
          <StatusIndicator className="text-2xs">ONLINE</StatusIndicator>
        </span>
        <span className="hidden md:inline">{DOCS_CHROME_VERSION}</span>
      </div>
    </nav>
  );
}
