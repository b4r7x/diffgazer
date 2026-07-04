"use client";

import { type SidebarProps, Sidebar as SidebarRoot } from "./sidebar";
import { SidebarContent, type SidebarContentProps } from "./sidebar-content";
import type { SidebarState } from "./sidebar-context";
import { SidebarFooter, type SidebarFooterProps } from "./sidebar-footer";
import { SidebarHeader, type SidebarHeaderProps } from "./sidebar-header";
import type { SidebarIntent } from "./sidebar-intent";
import {
  SidebarItem,
  type SidebarItemAsAnchorProps,
  type SidebarItemAsButtonProps,
  type SidebarItemProps,
  type SidebarItemRenderProps,
} from "./sidebar-item";
import { SidebarItemBadge, type SidebarItemBadgeProps } from "./sidebar-item-badge";
import { SidebarItemLabel, type SidebarItemLabelProps } from "./sidebar-item-label";
import {
  SIDEBAR_STATE_COOKIE,
  SidebarProvider,
  type SidebarProviderProps,
} from "./sidebar-provider";
import { SidebarSection, type SidebarSectionProps } from "./sidebar-section";
import { SidebarSectionContent, type SidebarSectionContentProps } from "./sidebar-section-content";
import {
  SidebarSectionTitle,
  type SidebarSectionTitleHeadingLevel,
  type SidebarSectionTitleProps,
} from "./sidebar-section-title";
import { SidebarTrigger, type SidebarTriggerProps } from "./sidebar-trigger";
import type { SidebarVariant } from "./sidebar-variants";

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
