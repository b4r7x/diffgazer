import { cn } from "@diffgazer/ui/lib/utils";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarItem,
  SidebarSection,
  SidebarSectionContent,
  SidebarSectionTitle,
} from "@diffgazer/ui/components/sidebar";
import { Link, useLocation } from "@tanstack/react-router";
import type { HomeLibrary } from "../data";

function sectionItems(library: HomeLibrary) {
  return library.sections.map((section, index, sections) => ({
    ...section,
    isLast: index === sections.length - 1,
  }));
}

export function HomeSidebar({ libraries }: { libraries: HomeLibrary[] }) {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <Sidebar variant="tree" embedded className="h-full w-full">
      <SidebarContent className="overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="px-3 pt-2 pb-4">
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
                  className={cn(
                    libraryHasActive ? "text-foreground" : "font-medium text-muted-foreground",
                  )}
                >
                  {library.displayName}
                </SidebarSectionTitle>
                <SidebarSectionContent>
                  {sectionItems(library).map((section) => {
                    const href = `/${library.id}/${section.splat}`;
                    const isActive = pathname === href || pathname.startsWith(`${href}/`);

                    return (
                      <SidebarItem key={section.splat} active={isActive}>
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
                  {library.sections.length === 0 ? (
                    <SidebarItem active={pathname === `/${library.id}`}>
                      {({ itemPrefix, ref: _ref, ...itemProps }) => (
                        <Link to="/$lib" params={{ lib: library.id }} {...itemProps}>
                          {itemPrefix}
                          Overview
                        </Link>
                      )}
                    </SidebarItem>
                  ) : null}
                </SidebarSectionContent>
              </SidebarSection>
            );
            })}
          </div>
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}
