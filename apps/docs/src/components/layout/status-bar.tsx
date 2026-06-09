import { StatusIndicator } from "@diffgazer/ui/components/status-indicator";
import { cn } from "@diffgazer/ui/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { DOCS_CHROME_VERSION, DOCS_GITHUB_URL } from "@/lib/docs-chrome";

function NavLink({
  label,
  to,
  params,
}: {
  label: string;
  to: "/" | "/$lib";
  params?: { lib: "ui" | "keys" };
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isActive =
    to === "/"
      ? pathname === "/"
      : params?.lib !== undefined && pathname.startsWith(`/${params.lib}`);
  const className = cn(
    "px-1 transition-colors hover:bg-secondary",
    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
  );

  if (to === "/") {
    return (
      <Link to="/" className={className}>
        {label}
      </Link>
    );
  }

  return (
    <Link to="/$lib" params={params ?? { lib: "ui" }} className={className}>
      {label}
    </Link>
  );
}

export function StatusBar() {
  return (
    <nav
      aria-label="Site status"
      className="flex shrink-0 items-center justify-between border-b border-border bg-[var(--tui-chrome-status-bg)] px-4 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
    >
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="px-1 font-bold text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          diffgazer
        </Link>
        <span aria-hidden="true">|</span>
        <NavLink label="Docs" to="/" />
        <NavLink label="Components" to="/$lib" params={{ lib: "ui" }} />
        <NavLink label="Keys" to="/$lib" params={{ lib: "keys" }} />
        <a
          href={DOCS_GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-1 transition-colors hover:bg-secondary hover:text-foreground"
        >
          GitHub
        </a>
      </div>
      <div className="flex items-center gap-4">
        <StatusIndicator className="text-muted-foreground">ONLINE</StatusIndicator>
        <span>USER: GUEST</span>
        <span>{DOCS_CHROME_VERSION}</span>
      </div>
    </nav>
  );
}
