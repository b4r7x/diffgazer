import type { NavItem } from "../schemas/presentation/navigation.js";

export type MenuGroup = NavItem["group"];

export interface GroupedMenuItems {
  review: NavItem[];
  navigation: NavItem[];
  system: NavItem[];
}

export const MENU_GROUP_ORDER: readonly MenuGroup[] = ["review", "navigation", "system"] as const;

export function groupMenuItems(items: readonly NavItem[]): GroupedMenuItems {
  const groups: GroupedMenuItems = {
    review: [],
    navigation: [],
    system: [],
  };
  for (const item of items) {
    groups[item.group].push(item);
  }
  return groups;
}

export interface MenuItemWithDivider {
  item: NavItem;
  showDividerBefore: boolean;
}

/**
 * Annotates each item with whether a divider should be rendered before it.
 *
 * Output ordering matches the canonical `MENU_GROUP_ORDER`
 * (review → navigation → system) regardless of the caller's input order.
 * Within each group, the relative order of items is preserved (stable sort).
 *
 * This guarantees the home menu rendering contract:
 * callers do not need to keep their menu definitions group-sorted.
 */
export function withGroupDividers(items: readonly NavItem[]): MenuItemWithDivider[] {
  const groupRank = new Map<MenuGroup, number>(MENU_GROUP_ORDER.map((group, index) => [group, index]));
  const sorted = items
    .map((item, index) => ({ item, index, rank: groupRank.get(item.group) ?? MENU_GROUP_ORDER.length }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item);

  const result: MenuItemWithDivider[] = [];
  let lastGroup: MenuGroup | undefined;
  for (const item of sorted) {
    result.push({
      item,
      showDividerBefore: lastGroup !== undefined && lastGroup !== item.group,
    });
    lastGroup = item.group;
  }
  return result;
}
