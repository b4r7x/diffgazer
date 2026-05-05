import { Sidebar as SidebarRoot, type SidebarProps } from "./sidebar";
import { SidebarProvider, type SidebarProviderProps } from "./sidebar-provider";
import { SidebarTrigger, type SidebarTriggerProps } from "./sidebar-trigger";
import { SidebarHeader, type SidebarHeaderProps } from "./sidebar-header";
import { SidebarContent, type SidebarContentProps } from "./sidebar-content";
import { SidebarSection, type SidebarSectionProps } from "./sidebar-section";
import { SidebarSectionTitle, type SidebarSectionTitleProps } from "./sidebar-section-title";
import { SidebarItem, type SidebarItemProps, type SidebarItemAsButtonProps, type SidebarItemAsAnchorProps, type SidebarItemRenderProps } from "./sidebar-item";
import { SidebarItemLabel, type SidebarItemLabelProps } from "./sidebar-item-label";
import { SidebarItemBadge, type SidebarItemBadgeProps } from "./sidebar-item-badge";
import { SidebarFooter, type SidebarFooterProps } from "./sidebar-footer";

const Sidebar = Object.assign(SidebarRoot, {
  Provider: SidebarProvider,
  Trigger: SidebarTrigger,
  Header: SidebarHeader,
  Content: SidebarContent,
  Section: SidebarSection,
  SectionTitle: SidebarSectionTitle,
  Item: SidebarItem,
  ItemLabel: SidebarItemLabel,
  ItemBadge: SidebarItemBadge,
  Footer: SidebarFooter,
});

export { Sidebar, type SidebarProps };
export { SidebarProvider, type SidebarProviderProps };
export { SidebarTrigger, type SidebarTriggerProps };
export { SidebarHeader, type SidebarHeaderProps };
export { SidebarContent, type SidebarContentProps };
export { SidebarSection, type SidebarSectionProps };
export { SidebarSectionTitle, type SidebarSectionTitleProps };
export { SidebarItem, type SidebarItemProps, type SidebarItemAsButtonProps, type SidebarItemAsAnchorProps, type SidebarItemRenderProps };
export { SidebarItemLabel, type SidebarItemLabelProps };
export { SidebarItemBadge, type SidebarItemBadgeProps };
export { SidebarFooter, type SidebarFooterProps };
export { useSidebar } from "./sidebar-context";
