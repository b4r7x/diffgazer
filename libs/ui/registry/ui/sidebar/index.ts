"use client";

import { Sidebar as SidebarRoot, type SidebarProps } from "./sidebar";
import { SidebarProvider, type SidebarProviderProps, SIDEBAR_STATE_COOKIE } from "./sidebar-provider";
import { SidebarTrigger, type SidebarTriggerProps } from "./sidebar-trigger";
import { SidebarHeader, type SidebarHeaderProps } from "./sidebar-header";
import { SidebarContent, type SidebarContentProps } from "./sidebar-content";
import { SidebarSection, type SidebarSectionProps } from "./sidebar-section";
import { SidebarSectionContent, type SidebarSectionContentProps } from "./sidebar-section-content";
import {
  SidebarSectionTitle,
  type SidebarSectionTitleProps,
  type SidebarSectionTitleHeadingLevel,
} from "./sidebar-section-title";
import {
  SidebarItem,
  type SidebarItemProps,
  type SidebarItemAsButtonProps,
  type SidebarItemAsAnchorProps,
  type SidebarItemRenderProps,
} from "./sidebar-item";
import { SidebarItemLabel, type SidebarItemLabelProps } from "./sidebar-item-label";
import { SidebarItemBadge, type SidebarItemBadgeProps } from "./sidebar-item-badge";
import { SidebarFooter, type SidebarFooterProps } from "./sidebar-footer";
import type { SidebarVariant } from "@/lib/sidebar-variants";
import type { SidebarIntent } from "@/lib/sidebar-intent";
import type { SidebarState } from "./sidebar-context";

const Sidebar = Object.assign(SidebarRoot, {
  Provider: SidebarProvider,
  Trigger: SidebarTrigger,
  Header: SidebarHeader,
  Content: SidebarContent,
  Section: SidebarSection,
  SectionTitle: SidebarSectionTitle,
  SectionContent: SidebarSectionContent,
  Item: SidebarItem,
  ItemLabel: SidebarItemLabel,
  ItemBadge: SidebarItemBadge,
  Footer: SidebarFooter,
});

export { Sidebar, type SidebarProps };
export { SidebarProvider, type SidebarProviderProps, SIDEBAR_STATE_COOKIE };
export { SidebarTrigger, type SidebarTriggerProps };
export { SidebarHeader, type SidebarHeaderProps };
export { SidebarContent, type SidebarContentProps };
export { SidebarSection, type SidebarSectionProps };
export { SidebarSectionContent, type SidebarSectionContentProps };
export { SidebarSectionTitle, type SidebarSectionTitleProps, type SidebarSectionTitleHeadingLevel };
export {
  SidebarItem,
  type SidebarItemProps,
  type SidebarItemAsButtonProps,
  type SidebarItemAsAnchorProps,
  type SidebarItemRenderProps,
};
export { SidebarItemLabel, type SidebarItemLabelProps };
export { SidebarItemBadge, type SidebarItemBadgeProps };
export { SidebarFooter, type SidebarFooterProps };
export { useSidebar } from "./sidebar-context";
export type { SidebarVariant, SidebarIntent, SidebarState };
