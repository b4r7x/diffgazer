"use client";

import { type NavigationListProps, NavigationList as NavigationListRoot } from "./navigation-list";
import { NavigationListBadge } from "./navigation-list-badge";
import { NavigationListGroup, type NavigationListGroupProps } from "./navigation-list-group";
import { NavigationListItem, type NavigationListItemProps } from "./navigation-list-item";
import { NavigationListMeta, type NavigationListMetaProps } from "./navigation-list-meta";
import { NavigationListProgress, type NavigationListProgressProps } from "./navigation-list-progress";
import { NavigationListStatus, type NavigationListStatusProps } from "./navigation-list-status";
import { NavigationListSubtitle, type NavigationListSubtitleProps } from "./navigation-list-subtitle";
import { NavigationListTitle, type NavigationListTitleProps } from "./navigation-list-title";

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
