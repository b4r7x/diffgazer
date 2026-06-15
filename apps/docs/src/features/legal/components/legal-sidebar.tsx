import {
  SidebarItem,
  SidebarSection,
  SidebarSectionContent,
  SidebarSectionTitle,
} from "@diffgazer/ui/components/sidebar";
import { Link, useLocation } from "@tanstack/react-router";
import { chromeSidebarItemClassName, isPrimaryNavigationClick } from "@/components/layout/sidebar";
import { TreeSidebarShell } from "@/components/layout/tree-sidebar-shell";
import { LEGAL_LINKS } from "../lib/legal-pages";

const NAV_LINKS = [{ slug: "home", label: "Home", to: "/" }, ...LEGAL_LINKS] as const;

export function LegalSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <TreeSidebarShell>
      <SidebarSection collapsible defaultOpen>
        <SidebarSectionTitle className="font-medium text-muted-foreground">
          Legal
        </SidebarSectionTitle>
        <SidebarSectionContent>
          {NAV_LINKS.map((link) => (
            <SidebarItem
              key={link.slug}
              active={pathname === link.to}
              className={chromeSidebarItemClassName}
              onClick={(event) => {
                if (isPrimaryNavigationClick(event)) onNavigate?.();
              }}
            >
              {({ itemPrefix, ref: _ref, ...itemProps }) => (
                <Link to={link.to} {...itemProps}>
                  {itemPrefix}
                  {link.label}
                </Link>
              )}
            </SidebarItem>
          ))}
        </SidebarSectionContent>
      </SidebarSection>
    </TreeSidebarShell>
  );
}
