import { cn } from "@diffgazer/ui/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import { Fragment } from "react";
import { isPrimaryNavigationClick } from "@/components/layout/sidebar";
import { SECTIONS_WITH_INDEX } from "@/generated/sections-with-index";
import { isDocsLibraryId } from "@/lib/library";
import { findTreeSectionPath, type PageTree } from "@/lib/page-tree";

type DocsBreadcrumbsProps = {
  tree: PageTree;
  className?: string;
  onNavigate?: () => void;
};

/*
 * The sidebar PATH row is a fixed-width mono line (~37ch at text-2xs), so
 * overflow is decided by character count, not measurement: when
 * lib/section/page exceeds the budget, the middle segments collapse to a
 * single "…" (shell-style). The library root and the current page always
 * stay whole.
 */
const PATH_CHAR_BUDGET = 36;

/*
 * Middle segments come from the sidebar taxonomy (separator/folder names in
 * the page tree), not from the URL: /ui/changelog belongs to "Project" in the
 * sidebar, so PATH shows ui/project/changelog. A segment links only when its
 * slug chain is also a real indexed URL section (e.g. ui/components).
 */
function sectionSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export function Breadcrumbs({ tree, className, onNavigate }: DocsBreadcrumbsProps) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const parts = pathname.split("/").filter(Boolean);
  const library = parts[0];

  if (!library || !isDocsLibraryId(library)) return null;

  const pathParts = parts.slice(1);

  if (pathParts.length === 0) return null;

  const page = pathParts[pathParts.length - 1];
  const middleSlugs = findTreeSectionPath(tree, pathname).map(sectionSlug);
  const fullPath = [library, ...middleSlugs, page].join("/");
  const collapseMiddle = middleSlugs.length > 0 && fullPath.length > PATH_CHAR_BUDGET;

  return (
    <nav
      aria-label="Breadcrumb"
      title={fullPath}
      className={cn("truncate font-mono text-2xs text-muted-foreground", className)}
    >
      <span>{library}</span>
      <span aria-hidden="true">/</span>
      {collapseMiddle ? (
        <>
          <span aria-hidden="true">…</span>
          <span className="sr-only">{middleSlugs.join("/")}</span>
          <span aria-hidden="true">/</span>
        </>
      ) : (
        middleSlugs.map((slug, i) => {
          const sectionPath = [library, ...middleSlugs.slice(0, i + 1)].join("/");
          return (
            <Fragment key={sectionPath}>
              {SECTIONS_WITH_INDEX.has(sectionPath) ? (
                <Link
                  to="/$lib/$"
                  params={{ lib: library, _splat: middleSlugs.slice(0, i + 1).join("/") }}
                  className="transition-colors hover:text-foreground hover:underline hover:underline-offset-2"
                  onClick={(event) => {
                    if (isPrimaryNavigationClick(event)) onNavigate?.();
                  }}
                >
                  {slug}
                </Link>
              ) : (
                <span>{slug}</span>
              )}
              <span aria-hidden="true">/</span>
            </Fragment>
          );
        })
      )}
      <span aria-current="page" className="text-foreground">
        {page}
      </span>
    </nav>
  );
}
