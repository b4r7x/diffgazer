import {
  Breadcrumbs as BreadcrumbsBase,
  type BreadcrumbsProps,
} from "@diffgazer/ui/components/breadcrumbs";
import { cn } from "@diffgazer/ui/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import { SECTIONS_WITH_INDEX } from "@/generated/sections-with-index";
import { isDocsLibraryId } from "@/lib/library";

type DocsBreadcrumbsProps = Pick<BreadcrumbsProps, "className" | "separator">;

function hasIndexPage(library: string, pathParts: string[], segmentIndex: number): boolean {
  const sectionPath = [library, ...pathParts.slice(0, segmentIndex + 1)].join("/");
  return SECTIONS_WITH_INDEX.has(sectionPath);
}

export function Breadcrumbs({ className, separator = "/" }: DocsBreadcrumbsProps = {}) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const parts = pathname.split("/").filter(Boolean);
  const library = parts[0];

  if (!library || !isDocsLibraryId(library)) return null;

  const pathParts = parts.slice(1);

  if (pathParts.length === 0) return null;

  return (
    <BreadcrumbsBase separator={separator} className={cn("capitalize", className)}>
      {pathParts.map((part, i) => {
        const href = `/${[library, ...pathParts.slice(0, i + 1)].join("/")}`;
        const isLast = i === pathParts.length - 1;
        const isLinkable = !isLast && hasIndexPage(library, pathParts, i);

        const label = part.replace(/-/g, " ");
        const splat = pathParts.slice(0, i + 1).join("/");

        return (
          <BreadcrumbsBase.Item key={href} current={isLast}>
            {isLinkable ? (
              <BreadcrumbsBase.Link>
                {(linkProps) => (
                  <Link to="/$lib/$" params={{ lib: library, _splat: splat }} {...linkProps}>
                    {label}
                  </Link>
                )}
              </BreadcrumbsBase.Link>
            ) : (
              <span>{label}</span>
            )}
          </BreadcrumbsBase.Item>
        );
      })}
    </BreadcrumbsBase>
  );
}
