import {
  findNavigationItemByValue,
  getNavigationItems,
  type NavigationItemType,
} from "@diffgazer/keys";
import {
  hasEnabledMetadataItem,
  hasMetadataItem,
  type ListboxMetadataItem,
} from "./listbox-metadata";

type ContainerRole = "listbox" | "menu";
type ListboxItemRole = Extract<
  NavigationItemType,
  "option" | "menuitem" | "menuitemcheckbox" | "menuitemradio"
>;

interface ListboxQuery {
  itemRole: ListboxItemRole;
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
  const element = findNavigationItemByValue(container, {
    type: query.itemRole,
    value: id,
    skipDisabled: !includeDisabled,
    ownerSelector: getListboxOwnerSelector(query.containerRole),
  });
  return Boolean(
    element &&
      element.id === query.getItemId(query.idPrefix, id) &&
      element.dataset.value === id &&
      isOwnedListboxItem(element, container, query.containerRole),
  );
}

/** Returns owned item elements for keyboard navigation or typeahead. */
export function getListboxItems(
  container: HTMLElement | null,
  itemRole: ListboxItemRole,
  containerRole: ContainerRole,
  includeDisabled = false,
) {
  return getNavigationItems(container, {
    type: itemRole,
    skipDisabled: !includeDisabled,
    ownerSelector: getListboxOwnerSelector(containerRole),
  });
}

/** Resolves the first item id that keyboard navigation can highlight. */
export function getFirstNavigableItemId<TId extends string>(
  container: HTMLElement | null,
  itemRole: ListboxItemRole,
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

const NON_NAMING_ELEMENTS = new Set(["script", "style", "template", "noscript"]);

function isHiddenFromAccessibleName(el: HTMLElement): boolean {
  if (
    el.hidden ||
    el.hasAttribute("inert") ||
    el.getAttribute("aria-hidden") === "true" ||
    NON_NAMING_ELEMENTS.has(el.localName)
  ) {
    return true;
  }

  const styles = el.ownerDocument.defaultView?.getComputedStyle(el);
  return (
    styles?.display === "none" ||
    styles?.visibility === "hidden" ||
    styles?.visibility === "collapse" ||
    styles?.getPropertyValue("content-visibility") === "hidden"
  );
}

/** Reads accessible text from aria-label, aria-labelledby, and visible descendant text. */
export function getAccessibleText(
  el: HTMLElement,
  visited: Set<HTMLElement> = new Set(),
  allowHiddenRoot = false,
): string {
  if (visited.has(el)) return "";
  visited.add(el);
  if (!allowHiddenRoot && isHiddenFromAccessibleName(el)) return "";

  const ariaLabel = el.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id))
      .filter((node): node is HTMLElement => node !== null)
      // The accessible-name algorithm allows a directly referenced hidden label
      // to contribute, while its hidden descendants still follow normal rules.
      .map((node) => getAccessibleText(node, visited, true))
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
      text += getAccessibleText(child, visited);
    }
  }
  return text;
}
