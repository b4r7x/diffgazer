import {
  hasEnabledMetadataItem,
  hasMetadataItem,
  type ListboxMetadataItem,
} from "./listbox-metadata";

type ContainerRole = "listbox" | "menu";

interface ListboxQuery {
  itemRole: string;
  containerRole: ContainerRole;
  idPrefix: string;
  getItemId: (idPrefix: string, id: string) => string;
}

/** Builds the DOM id used by aria-activedescendant for a logical listbox item id. */
export function getEncodedListboxItemId(idPrefix: string, id: string): string {
  return `${idPrefix}-${encodeURIComponent(id)}`;
}

/** Returns the nearest composite-owner selector for the given container role. */
export function getListboxOwnerSelector(containerRole: ContainerRole) {
  return containerRole === "listbox" ? '[role="listbox"]' : '[role="menu"]';
}

/** Returns true when an item belongs to the current composite rather than a nested listbox/menu. */
export function isOwnedListboxItem(
  element: HTMLElement,
  container: HTMLElement,
  containerRole: ContainerRole,
) {
  const owner = element.closest(getListboxOwnerSelector(containerRole));
  return owner === null || owner === container;
}

/** Checks whether a logical item id maps to a mounted, owned DOM option. */
export function hasDomItem(options: {
  container: HTMLElement | null;
  query: ListboxQuery;
  id: string | null;
  includeDisabled?: boolean;
}): boolean {
  const { container, query, id, includeDisabled = false } = options;
  if (!container || id === null) return false;
  const element = container.ownerDocument.getElementById(query.getItemId(query.idPrefix, id));
  const disabled =
    element?.getAttribute("aria-disabled") === "true" || element?.hasAttribute("data-disabled");
  return Boolean(
    element &&
      container.contains(element) &&
      isOwnedListboxItem(element, container, query.containerRole) &&
      element.getAttribute("role") === query.itemRole &&
      element.dataset.value === id &&
      (includeDisabled || !disabled),
  );
}

/** Returns owned item elements for keyboard navigation or typeahead. */
export function getListboxItems(
  container: HTMLElement | null,
  itemRole: string,
  containerRole: ContainerRole,
  includeDisabled = false,
) {
  if (!container) return [];
  const disabledFilter = includeDisabled ? "" : ':not([aria-disabled="true"]):not([data-disabled])';
  return Array.from(
    container.querySelectorAll<HTMLElement>(`[role="${itemRole}"]${disabledFilter}`),
  ).filter((item) => isOwnedListboxItem(item, container, containerRole));
}

/** Resolves the first item id that keyboard navigation can highlight. */
export function getFirstNavigableItemId<TId extends string>(
  container: HTMLElement | null,
  itemRole: string,
  containerRole: ContainerRole,
  items?: ListboxMetadataItem<TId>[],
): TId | null {
  if (items) {
    const item =
      containerRole === "menu" ? items[0] : items.find((candidate) => !candidate.disabled);
    return item?.id ?? null;
  }

  const firstItem = getListboxItems(
    container,
    itemRole,
    containerRole,
    containerRole === "menu",
  )[0];
  // DOM boundary: data-value is opaque to TS; consumers parameterize TId.
  return firstItem?.dataset.value !== undefined ? (firstItem.dataset.value as TId) : null;
}

/** Resolves the logical active descendant from metadata, highlight, and selection state. */
export function resolveActiveDescendant<TId extends string>(
  items: ListboxMetadataItem<TId>[] | undefined,
  highlighted: TId | null,
  selectedId: TId | null,
  containerRole: ContainerRole,
): TId | null {
  if (!items) return highlighted ?? selectedId;
  // APG menus keep disabled items focusable, so they can be the active descendant.
  // Listboxes never expose disabled options as selected.
  if (containerRole === "menu") {
    if (hasMetadataItem(items, highlighted)) return highlighted;
    if (hasEnabledMetadataItem(items, selectedId)) return selectedId;
    return null;
  }
  if (hasEnabledMetadataItem(items, highlighted)) return highlighted;
  if (hasEnabledMetadataItem(items, selectedId)) return selectedId;
  return null;
}

/** Reads accessible text from aria-label, aria-labelledby, and visible descendant text. */
export function getAccessibleText(el: HTMLElement, visited: Set<HTMLElement> = new Set()): string {
  if (visited.has(el)) return "";
  visited.add(el);

  const ariaLabel = el.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id))
      .filter((node): node is HTMLElement => node !== null)
      .map((node) => getAccessibleText(node, visited))
      .join(" ")
      .trim();
    if (label) return label;
  }

  let text = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as HTMLElement;
      if (child.getAttribute("aria-hidden") !== "true") {
        text += getAccessibleText(child, visited);
      }
    }
  }
  return text;
}
