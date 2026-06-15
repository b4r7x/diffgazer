import { StatusIndicator } from "@diffgazer/ui/components/status-indicator";
import { cn } from "@diffgazer/ui/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import { DOCS_CHROME_VERSION } from "@/lib/docs-chrome";
import { type DocsLibraryId, getDocsLibraryConfig } from "@/lib/library";
import { ThemeToggle } from "./theme-toggle";

const focusRingClassName =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type NavLinkProps = { label: string } & (
  | { to: "/" }
  | { to: "/$lib"; params: { lib: DocsLibraryId } }
);

function NavLink(props: NavLinkProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isActive =
    props.to === "/" ? pathname === "/" : pathname.startsWith(`/${props.params.lib}`);
  const ariaCurrent = isActive ? ("page" as const) : undefined;
  const className = cn(
    "px-1 transition-colors hover:bg-secondary",
    focusRingClassName,
    isActive ? "font-bold text-foreground" : "text-muted-foreground hover:text-foreground",
  );

  if (props.to === "/") {
    return (
      <Link to="/" aria-current={ariaCurrent} className={className}>
        {props.label}
      </Link>
    );
  }

  return (
    <Link to="/$lib" params={props.params} aria-current={ariaCurrent} className={className}>
      {props.label}
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
            focusRingClassName,
          )}
        >
          diffgazer
        </Link>
        <span aria-hidden="true">|</span>
        <NavLink label="Docs" to="/" />
        <NavLink label="Components" to="/$lib" params={{ lib: "ui" }} />
        <NavLink label="Keys" to="/$lib" params={{ lib: "keys" }} />
        <a
          href={getDocsLibraryConfig("app").githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "px-1 transition-colors hover:bg-secondary hover:text-foreground",
            focusRingClassName,
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
        <span className="hidden md:inline">USER: GUEST</span>
        <span className="hidden md:inline">{DOCS_CHROME_VERSION}</span>
      </div>
    </nav>
  );
}
