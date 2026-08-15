import type { NavItem } from "../schemas/presentation/navigation.js";

export type MenuGroup = NavItem["group"];

/** Exhaustive by construction: a new `MenuGroup` must state its rank here. */
const MENU_GROUP_RANK = {
  review: 0,
  navigation: 1,
  system: 2,
} as const satisfies Record<MenuGroup, number>;

export interface MenuItemWithDivider {
  item: NavItem;
  showDividerBefore: boolean;
}

/**
 * Annotates each item with whether a divider should be rendered before it.
 *
 * Output ordering matches the canonical `MENU_GROUP_RANK`
 * (review → navigation → system) regardless of the caller's input order.
 * Within each group, the relative order of items is preserved (stable sort).
 *
 * This guarantees the home menu rendering contract:
 * callers do not need to keep their menu definitions group-sorted.
 */
export function withGroupDividers(items: readonly NavItem[]): MenuItemWithDivider[] {
  // Array.prototype.sort is stable, so equal-rank items keep the caller's input
  // order without an explicit original-index tie-breaker.
  const sorted = [...items].sort((a, b) => MENU_GROUP_RANK[a.group] - MENU_GROUP_RANK[b.group]);

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
