import { NavigationList as NavigationListRoot, type NavigationListProps } from "./navigation-list";
import { NavigationListItem, type NavigationListItemProps } from "./navigation-list-item";
import { NavigationListTitle, type NavigationListTitleProps } from "./navigation-list-title";
import { NavigationListStatus, type NavigationListStatusProps } from "./navigation-list-status";
import { NavigationListBadge } from "./navigation-list-badge";
import { NavigationListSubtitle, type NavigationListSubtitleProps } from "./navigation-list-subtitle";
import { NavigationListMeta, type NavigationListMetaProps } from "./navigation-list-meta";

const NavigationList = Object.assign(NavigationListRoot, {
  Item: NavigationListItem,
  Badge: NavigationListBadge,
  Title: NavigationListTitle,
  Status: NavigationListStatus,
  Meta: NavigationListMeta,
  Subtitle: NavigationListSubtitle,
});

export { NavigationList, type NavigationListProps };
export { NavigationListItem, type NavigationListItemProps };
export { NavigationListBadge };
export type { BadgeProps as NavigationListBadgeProps } from "../badge/badge";
export { NavigationListTitle, type NavigationListTitleProps };
export { NavigationListStatus, type NavigationListStatusProps };
export { NavigationListMeta, type NavigationListMetaProps };
export { NavigationListSubtitle, type NavigationListSubtitleProps };
