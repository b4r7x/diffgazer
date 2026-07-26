import { Breadcrumbs } from "@diffgazer/ui/components/breadcrumbs";
import { cn } from "@diffgazer/ui/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import { isPrimaryNavigationClick } from "@/components/shared/navigation-click";
import { SECTIONS_WITH_INDEX } from "@/generated/sections-with-index";
import { isDocsLibraryId } from "@/lib/library";
import { findTreeSectionPath, type PageTree } from "@/lib/page-tree";

type DocsPathBreadcrumbsProps = {
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

export function DocsPathBreadcrumbs({ tree, className, onNavigate }: DocsPathBreadcrumbsProps) {
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
    <Breadcrumbs
      title={fullPath}
      // The list lays out inline instead of as a gapped flex row: this is one
      // mono line that truncates on an ellipsis, and text-overflow has nothing
      // to clip unless the segments are inline content of a block container.
      className={cn(
        "truncate font-mono text-2xs text-muted-foreground [&>ol]:block [&_li]:inline",
        className,
      )}
    >
      <Breadcrumbs.Item>{library}</Breadcrumbs.Item>
      {collapseMiddle ? (
        <Breadcrumbs.Item>
          <Breadcrumbs.Ellipsis className="size-auto" label={middleSlugs.join("/")}>
            …
          </Breadcrumbs.Ellipsis>
        </Breadcrumbs.Item>
      ) : (
        middleSlugs.map((slug, i) => {
          const sectionSlugs = middleSlugs.slice(0, i + 1);
          const sectionPath = [library, ...sectionSlugs].join("/");
          return (
            <Breadcrumbs.Item key={sectionPath}>
              {SECTIONS_WITH_INDEX.has(sectionPath) ? (
                <Breadcrumbs.Link>
                  {(linkProps) => (
                    <Link
                      {...linkProps}
                      to="/$lib/$"
                      params={{ lib: library, _splat: sectionSlugs.join("/") }}
                      onClick={(event) => {
                        if (isPrimaryNavigationClick(event)) onNavigate?.();
                      }}
                    >
                      {slug}
                    </Link>
                  )}
                </Breadcrumbs.Link>
              ) : (
                slug
              )}
            </Breadcrumbs.Item>
          );
        })
      )}
      {/* The chrome row marks the current page by color alone; the primitive's
          bold would be a second emphasis in a 2xs mono line. */}
      <Breadcrumbs.Item current className="font-normal">
        {page}
      </Breadcrumbs.Item>
    </Breadcrumbs>
  );
}
