import { containsActiveElement, getFocusableElements as getFocusableElementsImpl } from "./focusable.js";

export const NAVIGATION_ITEM_ATTRIBUTE = "data-diffgazer-navigation-item";

export type NavigationItemType =
  | "radio"
  | "checkbox"
  | "option"
  | "menuitem"
  | "menuitemcheckbox"
  | "menuitemradio"
  | "button"
  | "tab";

export interface NavigationItemQuery {
  type: NavigationItemType;
  skipDisabled?: boolean;
  scopeToContainer?: boolean;
  ownerSelector?: string | null;
}

function disabledSelector(skipDisabled: boolean): string {
  return skipDisabled
    ? ':not([aria-disabled="true"]):not([data-disabled]):not(:disabled)'
    : "";
}

function findElements(container: HTMLElement, selector: string): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

function queryFirstMatchingGroup(
  container: HTMLElement,
  selectors: string[],
  filter?: (element: HTMLElement) => boolean,
): HTMLElement[] {
  for (const selector of selectors) {
    const elements = filter
      ? findElements(container, selector).filter(filter)
      : findElements(container, selector);
    if (elements.length > 0) return elements;
  }
  return [];
}

function matchesNavigationDataContract(element: HTMLElement, type: NavigationItemType): boolean {
  const explicitType = element.getAttribute(NAVIGATION_ITEM_ATTRIBUTE);
  return explicitType === null || explicitType === "" || explicitType === "true" || explicitType === type;
}

function buildNavigationSelectors(
  type: NavigationItemType,
  skipDisabled: boolean,
): string[] {
  const disabled = disabledSelector(skipDisabled);
  const dataContractSelectors = [
    `[${NAVIGATION_ITEM_ATTRIBUTE}="${type}"][data-value]${disabled}`,
    `[${NAVIGATION_ITEM_ATTRIBUTE}="true"][data-value]${disabled}`,
    `[${NAVIGATION_ITEM_ATTRIBUTE}=""][data-value]${disabled}`,
    `[${NAVIGATION_ITEM_ATTRIBUTE}][data-value]${disabled}`,
  ];
  const nativeRoleSelectors: Partial<Record<NavigationItemType, string[]>> = {
    button: [`button[data-value]${disabled}`],
    checkbox: [`input[type="checkbox"][data-value]${disabled}`],
    radio: [`input[type="radio"][data-value]${disabled}`],
  };

  return [
    dataContractSelectors.join(","),
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

export function getNavigationItems(
  container: HTMLElement | null,
  query: NavigationItemQuery,
): HTMLElement[] {
  if (!container) return [];

  return queryFirstMatchingGroup(
    container,
    buildNavigationSelectors(query.type, query.skipDisabled ?? true),
    (element) => matchesNavigationDataContract(element, query.type)
      && isOwnedByContainer(element, container, query),
  );
}

export function findNavigationItemByValue(
  container: HTMLElement | null,
  query: NavigationItemQuery & { value: string },
): HTMLElement | null {
  return getNavigationItems(container, query).find((element) => element.dataset.value === query.value) ?? null;
}

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

export function getFocusedNavigationValue(
  container: HTMLElement | null,
  query: NavigationItemQuery,
): string | null {
  const focusedItem = getNavigationItems(container, query).find(containsActiveElement);
  return focusedItem?.dataset.value ?? null;
}

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

/**
 * Re-exported from `./focusable.js` for ergonomic discovery alongside navigation utilities.
 */
export const getFocusableElements = getFocusableElementsImpl;
