"use client";

import { NavigationList as NavigationListRoot, type NavigationListProps } from "./navigation-list";
import { NavigationListItem, type NavigationListItemProps } from "./navigation-list-item";
import { NavigationListTitle, type NavigationListTitleProps } from "./navigation-list-title";
import { NavigationListStatus, type NavigationListStatusProps } from "./navigation-list-status";
import { NavigationListBadge } from "./navigation-list-badge";
import { NavigationListSubtitle, type NavigationListSubtitleProps } from "./navigation-list-subtitle";
import { NavigationListMeta, type NavigationListMetaProps } from "./navigation-list-meta";
import { NavigationListProgress, type NavigationListProgressProps } from "./navigation-list-progress";
import { NavigationListGroup, type NavigationListGroupProps } from "./navigation-list-group";

const NavigationList = Object.assign(NavigationListRoot, {
  Item: NavigationListItem,
  Badge: NavigationListBadge,
  Title: NavigationListTitle,
  Status: NavigationListStatus,
  Meta: NavigationListMeta,
  Subtitle: NavigationListSubtitle,
  Progress: NavigationListProgress,
  Group: NavigationListGroup,
});

export { NavigationList, type NavigationListProps };
export type { NavigationListIndicator } from "./navigation-list-context";
export { NavigationListItem, type NavigationListItemProps };
export { NavigationListBadge };
export type { BadgeProps as NavigationListBadgeProps } from "../badge/badge";
export { NavigationListTitle, type NavigationListTitleProps };
export { NavigationListStatus, type NavigationListStatusProps };
export { NavigationListMeta, type NavigationListMetaProps };
export { NavigationListSubtitle, type NavigationListSubtitleProps };
export { NavigationListProgress, type NavigationListProgressProps };
export { NavigationListGroup, type NavigationListGroupProps };
