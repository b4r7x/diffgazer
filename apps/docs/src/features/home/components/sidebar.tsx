import {
  SidebarItem,
  SidebarSection,
  SidebarSectionContent,
  SidebarSectionTitle,
} from "@diffgazer/ui/components/sidebar";
import { Link, useLocation } from "@tanstack/react-router";
import { TreeSidebarShell } from "@/components/layout/tree-sidebar-shell";
import { isPrimaryNavigationClick } from "@/components/shared/navigation-click";
import { CHROME_SIDEBAR_ITEM_CLASS } from "@/components/shared/sidebar-item";
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
          pathname === `/${library.id}` || pathname.startsWith(`/${library.id}/`);

        return (
          <SidebarSection key={library.id} collapsible defaultOpen>
            <SidebarSectionTitle
              headingLevel="h2"
              className={libraryHasActive ? "text-foreground" : "font-medium text-muted-foreground"}
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
                    className={CHROME_SIDEBAR_ITEM_CLASS}
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
