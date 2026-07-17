import {
  SidebarItem,
  SidebarSection,
  SidebarSectionContent,
  SidebarSectionTitle,
} from "@diffgazer/ui/components/sidebar";
import { cn } from "@diffgazer/ui/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import { chromeSidebarItemClassName, isPrimaryNavigationClick } from "@/components/layout/sidebar";
import { TreeSidebarShell } from "@/components/layout/tree-sidebar-shell";
import type { HomeLibrary } from "../data";

export function HomeSidebar({
  libraries,
  onNavigate,
}: {
  libraries: HomeLibrary[];
  onNavigate?: () => void;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <TreeSidebarShell>
      {libraries.map((library) => {
        const libraryHasActive =
          pathname === `/${library.id}` ||
          pathname.startsWith(`/${library.id}/`) ||
          library.sections.some((section) => {
            const href = `/${library.id}/${section.splat}`;
            return pathname === href || pathname.startsWith(`${href}/`);
          });

        return (
          <SidebarSection key={library.id} collapsible defaultOpen>
            <SidebarSectionTitle
              headingLevel="h2"
              className={cn(
                libraryHasActive ? "text-foreground" : "font-medium text-muted-foreground",
              )}
            >
              {library.displayName}
            </SidebarSectionTitle>
            <SidebarSectionContent>
              {library.sections.map((section) => {
                const href = `/${library.id}/${section.splat}`;
                const isActive = pathname === href || pathname.startsWith(`${href}/`);

                return (
                  <SidebarItem
                    key={section.splat}
                    active={isActive}
                    className={chromeSidebarItemClassName}
                    onClick={(event) => {
                      if (isPrimaryNavigationClick(event)) onNavigate?.();
                    }}
                  >
                    {({ itemPrefix, ref: _ref, ...itemProps }) => (
                      <Link
                        to="/$lib/$"
                        params={{ lib: library.id, _splat: section.splat }}
                        {...itemProps}
                      >
                        {itemPrefix}
                        {section.name}
                        {section.count > 0 ? ` (${section.count})` : ""}
                      </Link>
                    )}
                  </SidebarItem>
                );
              })}
            </SidebarSectionContent>
          </SidebarSection>
        );
      })}
    </TreeSidebarShell>
  );
}
