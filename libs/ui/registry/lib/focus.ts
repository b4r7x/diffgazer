export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

export type SelectableItemRole = "checkbox" | "radio";

export interface FocusSelectableItemOptions {
  role: SelectableItemRole;
  value?: string | null;
}

const EXPLICIT_SELECTABLE_OWNER_SELECTOR = "[data-diffgazer-selectable-owner]";
const ROLE_SELECTABLE_OWNER_SELECTOR = '[role="group"],[role="radiogroup"],[role="listbox"],[role="menu"],[role="tablist"]';

function isOwnedByContainer(item: HTMLElement, container: HTMLElement) {
  const explicitOwner = item.closest(EXPLICIT_SELECTABLE_OWNER_SELECTOR);
  if (explicitOwner) return explicitOwner === container;
  return item.closest(ROLE_SELECTABLE_OWNER_SELECTOR) === container;
}

export function getSelectableItemElements(
  container: HTMLElement | null,
  role: SelectableItemRole,
) {
  const items = Array.from(
    container?.querySelectorAll<HTMLElement>(`[role="${role}"][data-value]:not([aria-disabled="true"])`) ?? [],
  );

  if (!container) return [];
  return items.filter((item) => isOwnedByContainer(item, container));
}

export function getSelectableItemByValue(
  items: HTMLElement[],
  value: string | null | undefined,
) {
  if (value == null) return null;
  return items.find((item) => item.dataset.value === value) ?? null;
}

export function focusSelectableItem(
  container: HTMLElement | null,
  options: FocusSelectableItemOptions,
) {
  const items = getSelectableItemElements(container, options.role);
  const target = getSelectableItemByValue(items, options.value) ?? items[0] ?? null;
  const targetValue = target?.dataset.value ?? null;
  target?.focus();
  return targetValue;
}
