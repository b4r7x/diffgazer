import { Logo } from "@diffgazer/ui/components/logo";
import { StatusIndicator } from "@diffgazer/ui/components/status-indicator";
import { cn } from "@diffgazer/ui/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { CHROME_LABEL_CLASS, CHROME_NAV_TARGET_CLASS } from "@/components/shared/chrome-label";
import { FOCUS_RING_CLASS } from "@/components/shared/focus-ring";
import {
  WORDMARK_ASCII,
  WORDMARK_COLS,
  WORDMARK_ROWS,
  WORDMARK_TEXT,
} from "@/generated/logo-ascii";
import { DOCS_CHROME_VERSION } from "@/lib/docs-chrome";
import { type DocsLibraryId, getDocsLibraryConfig } from "@/lib/library";
import { ThemeToggle } from "./theme-toggle";

/**
 * One cell of the segmented nav row. Below md the four cells are equal columns
 * of a full-bleed grid, so each label centers in its own segment and the cell
 * itself is the hover/press surface; the horizontal padding only returns at md,
 * where the row is a plain inline flex list again. No base padding on purpose:
 * at 375px a segment is 93.75px and the longest label, COMPONENTS, measures 84px
 * at the chrome's mobile step, so padding here is what would push it out of its
 * cell. Shared by the library links and the GitHub link, which must stay
 * pixel-identical to each other.
 */
const NAV_SEGMENT_CLASS =
  "justify-center transition-colors hover:bg-secondary md:flex-none md:justify-start md:px-1";

type NavLinkProps = { label: string; params: { lib: DocsLibraryId } };

function NavLink({ label, params }: NavLinkProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const libraryPath = `/${params.lib}`;
  const isActive = pathname === libraryPath || pathname.startsWith(`${libraryPath}/`);
  const ariaCurrent = isActive ? ("page" as const) : undefined;
  const className = cn(
    CHROME_NAV_TARGET_CLASS,
    NAV_SEGMENT_CLASS,
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
      aria-label="Site"
      className={cn(
        // Mobile stacks the nav row under the brand/actions row. From md the bar
        // is a single flex row: one 1rem rhythm from the brand through the last
        // nav link, with the actions group pushed to the end by its own auto
        // margin (justify-between would instead scatter the three groups).
        "grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-y-1 border-b border-border bg-background px-4 py-1 md:flex md:gap-x-4",
        CHROME_LABEL_CLASS,
      )}
    >
      <div className="flex min-w-0 items-center gap-x-4">
        <Link
          to="/"
          className={cn(
            CHROME_NAV_TARGET_CLASS,
            "px-1 transition-colors hover:bg-secondary",
            FOCUS_RING_CLASS,
          )}
        >
          {/* The same ascii wordmark block the hero renders, only smaller: the
              art is laid out once at a crisp 10px step and the whole block is
              then scaled by one transform. Nothing here may clip it.

              Three things earn their place. `tracking-normal` cancels the bar's
              own `tracking-widest` — that 0.1em resolves against the *nav's*
              font-size and inherits down as an absolute length, which offsets
              every glyph from its column so the box-drawing strokes stop
              meeting. `max-w-none overflow-visible` drops the Logo's own clip
              guard, which assumes a component sizing itself to its container;
              here the art is laid out wider than its wrapper and only the
              transform brings it back, so the guard would shear off the
              trailing columns. `w-max` then sizes the art to its own content
              instead of the wrapper.

              Transforms do not affect layout, so the wrapper has to reserve the
              *scaled* box itself, and it derives that box rather than carrying a
              measurement. The art is a grid of WORDMARK_ROWS x WORDMARK_COLS
              monospace cells and this wrapper sets the font the art is laid out
              in, so the unscaled block is exactly that many `ch` wide and `em`
              tall in the wrapper's own units. Both the reservation and the
              Logo's transform read one `--wm-scale` per breakpoint, so they
              cannot drift, and regenerating the art moves the reservation with
              it.

              The art has no readable text, so `text` is purely the accessible
              name. */}
          <span
            className="block overflow-visible font-mono text-[10px]/[1] tracking-normal [--wm-scale:0.42] md:[--wm-scale:0.3]"
            style={{
              width: `calc(${WORDMARK_COLS}ch * var(--wm-scale))`,
              height: `calc(${WORDMARK_ROWS}em * var(--wm-scale))`,
            }}
          >
            <Logo
              text={WORDMARK_TEXT}
              asciiText={WORDMARK_ASCII}
              className="w-max max-w-none origin-top-left overflow-visible text-[10px]/[1] font-bold text-foreground [transform:scale(var(--wm-scale))]"
            />
          </span>
        </Link>
        <span aria-hidden="true" className="hidden md:inline">
          |
        </span>
      </div>
      {/* Below md this row is a grid of four equal cells rather than a loose flex
          row: flex items refuse to shrink under their min-content, so COMPONENTS
          would claim the width it needs and the other three split what is left.
          Equal columns give the row its rhythm on their own — no dividers. The
          negative margin cancels the nav's own px-4 so the cells run edge to
          edge; from md the row is a plain flex list. */}
      <div className="col-span-2 row-start-2 -mx-4 grid grid-cols-4 md:mx-0 md:flex md:items-center md:gap-x-4">
        <NavLink label="Docs" params={{ lib: "app" }} />
        <NavLink label="Components" params={{ lib: "ui" }} />
        <NavLink label="Keys" params={{ lib: "keys" }} />
        <a
          href={getDocsLibraryConfig("app").githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            CHROME_NAV_TARGET_CLASS,
            NAV_SEGMENT_CLASS,
            "hover:text-foreground",
            FOCUS_RING_CLASS,
          )}
        >
          GitHub
        </a>
      </div>
      <div className="col-start-2 row-start-1 flex items-center gap-4 md:ml-auto">
        <ThemeToggle />
        <span className="hidden items-center md:inline-flex">
          <StatusIndicator className="text-2xs">ONLINE</StatusIndicator>
        </span>
        <span className="hidden md:inline">{DOCS_CHROME_VERSION}</span>
      </div>
    </nav>
  );
}
