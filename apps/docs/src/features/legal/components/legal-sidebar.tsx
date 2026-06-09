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

const LEGAL_LINKS = [
  { slug: "privacy", label: "Privacy", to: "/privacy" as const },
  { slug: "terms", label: "Terms", to: "/terms" as const },
] as const;

export function LegalSidebar() {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <Sidebar variant="tree" embedded className="h-full w-full">
      <SidebarContent className="overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="px-3 pt-2 pb-4">
            <SidebarSection collapsible defaultOpen>
              <SidebarSectionTitle className="font-medium text-muted-foreground">
                Legal
              </SidebarSectionTitle>
              <SidebarSectionContent>
                {LEGAL_LINKS.map((link) => (
                  <SidebarItem key={link.slug} active={pathname === link.to}>
                    {({ itemPrefix, ref: _ref, ...itemProps }) => (
                      <Link to={link.to} {...itemProps}>
                        {itemPrefix}
                        {link.label}
                      </Link>
                    )}
                  </SidebarItem>
                ))}
                <SidebarItem active={pathname === "/"}>
                  {({ itemPrefix, ref: _ref, ...itemProps }) => (
                    <Link to="/" {...itemProps}>
                      {itemPrefix}
                      Home
                    </Link>
                  )}
                </SidebarItem>
              </SidebarSectionContent>
            </SidebarSection>
          </div>
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}
