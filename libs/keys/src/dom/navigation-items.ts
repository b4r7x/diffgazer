import { composedClosest } from "./element-guards.js";
import { containsActiveElement, documentOrder, isReachable } from "./focusable.js";

/** Data attribute used by @diffgazer/keys to mark navigable DOM items. */
export const NAVIGATION_ITEM_ATTRIBUTE = "data-diffgazer-navigation-item";

/** Navigation item types recognized by DOM query helpers and navigation hooks. */
export type NavigationItemType =
  | "radio"
  | "checkbox"
  | "option"
  | "menuitem"
  | "menuitemcheckbox"
  | "menuitemradio"
  | "button"
  | "tab";

/** Query used to discover navigable items inside a container. */
export interface NavigationItemQuery {
  /** Item role or data-contract type to query. */
  type: NavigationItemType;
  /**
   * Exclude items that expose or inherit a disabled state: aria-disabled,
   * data-disabled, or native disabled on the item or an ancestor.
   */
  skipDisabled?: boolean;
  /** Exclude items owned by nested composite containers. */
  scopeToContainer?: boolean;
  /** Override the composite owner selector used for scoping, or null to disable owner scoping. */
  ownerSelector?: string | null;
}

function disabledSelector(skipDisabled: boolean): string {
  return skipDisabled ? ':not([aria-disabled="true"]):not([data-disabled]):not(:disabled)' : "";
}

/** True when an aria-disabled/data-disabled ancestor (not the element itself) disables the item. */
function hasDisabledAncestor(element: HTMLElement): boolean {
  const disabledContainer = composedClosest(element, '[aria-disabled="true"],[data-disabled]');
  return disabledContainer !== null && disabledContainer !== element;
}

function findElements(container: HTMLElement, selector: string): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

function queryAllMatchingGroups(
  container: HTMLElement,
  selectors: string[],
  filter?: (element: HTMLElement) => boolean,
): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const merged: HTMLElement[] = [];

  for (const selector of selectors) {
    const elements = findElements(container, selector);
    for (const el of elements) {
      if (seen.has(el)) continue;
      if (filter && !filter(el)) continue;
      seen.add(el);
      merged.push(el);
    }
  }

  // Merged results from multiple selectors may interleave; restore DOM order.
  if (merged.length > 1) {
    merged.sort(documentOrder);
  }

  return merged;
}

function matchesNavigationDataContract(element: HTMLElement, type: NavigationItemType): boolean {
  const explicitType = element.getAttribute(NAVIGATION_ITEM_ATTRIBUTE);
  return (
    explicitType === null || explicitType === "" || explicitType === "true" || explicitType === type
  );
}

function buildNavigationSelectors(type: NavigationItemType, skipDisabled: boolean): string[] {
  const disabled = disabledSelector(skipDisabled);
  const nativeRoleSelectors: Partial<Record<NavigationItemType, string[]>> = {
    button: [`button[data-value]${disabled}`],
    checkbox: [`input[type="checkbox"][data-value]${disabled}`],
    radio: [`input[type="radio"][data-value]${disabled}`],
  };

  return [
    `[${NAVIGATION_ITEM_ATTRIBUTE}][data-value]${disabled}`,
    `[role="${type}"][data-value]${disabled}`,
    ...(nativeRoleSelectors[type] ?? []),
  ];
}

function ownerSelectorForType(type: NavigationItemType): string | null {
  switch (type) {
    case "radio":
      return '[role="radiogroup"]';
    case "checkbox":
      return '[role="group"]';
    case "option":
      return '[role="listbox"]';
    case "menuitem":
    case "menuitemcheckbox":
    case "menuitemradio":
      return '[role="menu"]';
    case "tab":
      return '[role="tablist"]';
    case "button":
      return null;
  }
}

function isOwnedByContainer(
  element: HTMLElement,
  container: HTMLElement,
  query: NavigationItemQuery,
): boolean {
  if (query.scopeToContainer === false) return true;

  if (query.ownerSelector !== undefined) {
    if (query.ownerSelector === null) return true;
    const owner = element.closest(query.ownerSelector);
    return owner === null || owner === container;
  }

  const ownerSelector = ownerSelectorForType(query.type);
  if (!ownerSelector) return true;

  const owner = element.closest(ownerSelector);
  return owner === null || owner === container;
}

/**
 * Finds navigable descendants matching the role/data contract in DOM order.
 * Items hidden by `hidden`, `inert`, or `aria-hidden="true"` (self or ancestor,
 * across shadow boundaries) are always excluded because they are not
 * accessibility-reachable. Disabled items and items under an
 * aria-disabled/data-disabled ancestor are skipped by default.
 */
export function getNavigationItems(
  container: HTMLElement | null,
  query: NavigationItemQuery,
): HTMLElement[] {
  if (!container) return [];

  const skipDisabled = query.skipDisabled ?? true;

  return queryAllMatchingGroups(
    container,
    buildNavigationSelectors(query.type, skipDisabled),
    (element) =>
      matchesNavigationDataContract(element, query.type) &&
      isOwnedByContainer(element, container, query) &&
      isReachable(element) &&
      (!skipDisabled || !hasDisabledAncestor(element)),
  );
}

/** Finds one navigable item by its `data-value`. */
export function findNavigationItemByValue(
  container: HTMLElement | null,
  query: NavigationItemQuery & { value: string },
): HTMLElement | null {
  return (
    getNavigationItems(container, query).find((element) => element.dataset.value === query.value) ??
    null
  );
}

/** Returns the public data attributes needed for role-independent navigation. */
export function getNavigationItemProps(
  type: NavigationItemType,
  value: string,
): {
  "data-diffgazer-navigation-item": NavigationItemType;
  "data-value": string;
} {
  return {
    [NAVIGATION_ITEM_ATTRIBUTE]: type,
    "data-value": value,
  };
}

/** Returns the `data-value` for the navigable item containing DOM focus. */
export function getFocusedNavigationValue(
  container: HTMLElement | null,
  query: NavigationItemQuery,
): string | null {
  const focusedItem = getNavigationItems(container, query).find(containsActiveElement);
  return focusedItem?.dataset.value ?? null;
}

/**
 * Moves DOM focus to a navigable item by value, with optional first/last
 * fallback, and returns the focused value.
 */
export function focusNavigationItem(
  container: HTMLElement | null,
  query: NavigationItemQuery & {
    value: string;
    fallback?: "first" | "last" | "none";
    preventScroll?: boolean;
  },
): string | null {
  const items = getNavigationItems(container, query);
  const target =
    items.find((element) => element.dataset.value === query.value) ??
    (query.fallback === "first" ? items[0] : undefined) ??
    (query.fallback === "last" ? items.at(-1) : undefined) ??
    null;

  if (!target || target.dataset.value === undefined) return null;

  target.focus({ preventScroll: query.preventScroll });
  return target.dataset.value;
}
