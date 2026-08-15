import { useKey } from "@diffgazer/keys";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { cn } from "@diffgazer/ui/lib/utils";
import type { AnyRouteMatch } from "@tanstack/react-router";
import { Link, useRouterState } from "@tanstack/react-router";
import { Fragment } from "react";
import { CHROME_ACTION_TARGET_CLASS, CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import { FOCUS_RING_CLASS } from "@/components/shared/focus-ring";
import { nextThemePreference, useTheme } from "@/hooks/theme-context";

// Structural so tests can hand-build matches, but `status` is pinned to the
// router's own union: a renamed literal must fail to compile, not silently
// stop matching below.
type FooterRouteMatch = {
  routeId: string;
  status: AnyRouteMatch["status"];
  globalNotFound?: boolean;
};

function getFooterMode(matches: readonly FooterRouteMatch[]): "home" | "docs" | "global" {
  if (
    matches.some(
      (match) => match.status === "error" || match.status === "notFound" || match.globalNotFound,
    )
  ) {
    return "global";
  }

  const leafRouteId = matches.at(-1)?.routeId;
  if (leafRouteId === "/") return "home";
  if (leafRouteId === "/$lib/$") return "docs";
  return "global";
}

function KeyHint({ keys, label }: { keys: readonly string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1">
        {keys.map((key, index) => (
          <Fragment key={key}>
            {index > 0 && <span aria-hidden="true">/</span>}
            <Kbd size="sm">{key}</Kbd>
          </Fragment>
        ))}
      </span>
      <span>{label}</span>
    </span>
  );
}

export function FooterBar() {
  const mode = useRouterState({ select: (state) => getFooterMode(state.matches) });
  const { theme, setTheme } = useTheme();
  // The hint sits in a row of direct-manipulation keys, so F2 does what its
  // label says: flip the theme in place, the same cycle the status-bar control
  // runs. The theme docs page keeps its route, reachable from sidebar and search.
  const toggleTheme = () => setTheme(nextThemePreference(theme));

  useKey("f2", toggleTheme);

  return (
    <footer
      className={cn(
        "flex shrink-0 items-center justify-between border-t border-border bg-background px-4 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]",
        CHROME_LABEL_CLASS,
      )}
    >
      <div className="hidden items-center gap-6 sm:flex">
        {mode === "home" && (
          <>
            <KeyHint keys={["j", "k"]} label="move" />
            <KeyHint keys={["↵"]} label="open" />
          </>
        )}
        {mode === "docs" && <KeyHint keys={["p", "n"]} label="prev/next" />}
        <KeyHint keys={["/"]} label="search" />
        <button
          type="button"
          onClick={toggleTheme}
          className={cn(
            CHROME_ACTION_TARGET_CLASS,
            "gap-1.5 transition-colors hover:text-foreground",
            FOCUS_RING_CLASS,
          )}
        >
          <Kbd size="sm">F2</Kbd>
          <span>Theme</span>
        </button>
      </div>
      <div className="flex items-center gap-6">
        <Link
          to="/privacy"
          className={cn(
            CHROME_ACTION_TARGET_CLASS,
            "transition-colors hover:text-foreground",
            FOCUS_RING_CLASS,
          )}
        >
          Privacy
        </Link>
        <Link
          to="/terms"
          className={cn(
            CHROME_ACTION_TARGET_CLASS,
            "transition-colors hover:text-foreground",
            FOCUS_RING_CLASS,
          )}
        >
          Terms
        </Link>
        <span>© 2026 diffgazer</span>
      </div>
    </footer>
  );
}
