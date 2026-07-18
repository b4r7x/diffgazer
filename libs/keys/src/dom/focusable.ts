import {
  composedClosest,
  composedContains,
  getDeepActiveElement,
  getShadowHost,
  isHTMLElement,
  isHTMLInputElement,
} from "./element-guards.js";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([type="hidden"]):not([disabled])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable="false"])',
  "details > summary:first-of-type",
  "[tabindex]:not([disabled])",
].join(",");

function getComposedParentElement(element: Element): Element | null {
  return element.assignedSlot ?? element.parentElement ?? getShadowHost(element);
}

export function getComposedChildren(element: Element): Element[] {
  if (element.shadowRoot) return Array.from(element.shadowRoot.children);
  if (element.localName === "slot") {
    const assigned = (element as HTMLSlotElement).assignedElements({ flatten: true });
    if (assigned.length > 0) return assigned;
  }
  return Array.from(element.children);
}

function isHidden(element: HTMLElement): boolean {
  const elementVisibility = element.ownerDocument.defaultView?.getComputedStyle(element).visibility;
  if (elementVisibility === "hidden" || elementVisibility === "collapse") return true;

  let current: Element | null = element;
  while (current) {
    const style = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (
      current.getAttribute("hidden") === "until-found" ||
      style?.display === "none" ||
      style?.getPropertyValue("content-visibility") === "hidden"
    ) {
      return true;
    }
    current = getComposedParentElement(current);
  }
  return false;
}

function isInert(element: HTMLElement): boolean {
  return composedClosest(element, "[inert]") !== null;
}

function isAriaHidden(element: HTMLElement): boolean {
  // Per ARIA, aria-hidden="false" does NOT re-expose content hidden by an aria-hidden="true" ancestor.
  return composedClosest(element, '[aria-hidden="true"]') !== null;
}

function isHiddenByClosedDetails(element: HTMLElement): boolean {
  let current = getComposedParentElement(element);

  while (current) {
    if (current.localName === "details" && !current.hasAttribute("open")) {
      const firstSummary = Array.from(current.children).find(
        (child) => child.localName === "summary",
      );
      if (!firstSummary || !composedContains(firstSummary, element)) return true;
    }
    current = getComposedParentElement(current);
  }

  return false;
}

/**
 * Returns false when a hidden, inert, or aria-hidden="true" self-or-ancestor
 * (across shadow boundaries) removes the element from keyboard reach. Shared
 * with navigation discovery so it skips the same unreachable items focus does.
 */
export function isReachable(element: HTMLElement): boolean {
  return (
    !isHidden(element) &&
    !isInert(element) &&
    !isAriaHidden(element) &&
    !isHiddenByClosedDetails(element)
  );
}

export function isInsideDisabledFieldset(element: HTMLElement): boolean {
  let fieldset = element.closest<HTMLFieldSetElement>("fieldset[disabled]");
  while (fieldset) {
    const legend = fieldset.querySelector(":scope > legend");
    if (legend?.contains(element)) {
      // Descendants of the first <legend> are not disabled per spec; keep searching upward.
      fieldset = fieldset.parentElement?.closest<HTMLFieldSetElement>("fieldset[disabled]") ?? null;
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Returns true for visible, non-disabled elements that can receive programmatic
 * focus, including `tabIndex={-1}` targets.
 */
export function isFocusable(element: HTMLElement | null): boolean {
  if (!isHTMLElement(element)) return false;
  if (!element.matches(FOCUSABLE_SELECTOR)) return false;
  if (!isReachable(element)) return false;
  if (isInsideDisabledFieldset(element)) return false;
  return true;
}

// jsdom returns compound-selector matches out of tree order; normalize.
const DOCUMENT_POSITION_PRECEDING = 0x02;
const DOCUMENT_POSITION_FOLLOWING = 0x04;

function nativeDocumentOrder(a: HTMLElement, b: HTMLElement): number {
  const pos = a.compareDocumentPosition(b);
  if (pos & DOCUMENT_POSITION_FOLLOWING) return -1;
  if (pos & DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

function composedPath(element: HTMLElement): Element[] {
  const path: Element[] = [];
  let current: Element | null = element;
  while (current) {
    path.push(current);
    current = getComposedParentElement(current);
  }
  return path.reverse();
}

/** Sort comparator that returns elements in composed order across open shadow roots. */
export function documentOrder(a: HTMLElement, b: HTMLElement): number {
  if (a === b) return 0;

  const aPath = composedPath(a);
  const bPath = composedPath(b);
  let index = 0;
  while (aPath[index] && aPath[index] === bPath[index]) index += 1;

  if (index === 0) return nativeDocumentOrder(a, b);
  if (index === aPath.length) return -1;
  if (index === bPath.length) return 1;

  const parent = aPath[index - 1];
  const aSibling = aPath[index];
  const bSibling = bPath[index];
  if (!parent || !aSibling || !bSibling) return nativeDocumentOrder(a, b);

  const children = getComposedChildren(parent);
  const aIndex = children.indexOf(aSibling);
  const bIndex = children.indexOf(bSibling);
  return aIndex >= 0 && bIndex >= 0 ? aIndex - bIndex : nativeDocumentOrder(a, b);
}

function getComposedDescendants(container: HTMLElement): HTMLElement[] {
  const matches: HTMLElement[] = [];
  const visit = (element: Element) => {
    if (
      isHTMLElement(element) &&
      element.matches(FOCUSABLE_SELECTOR) &&
      !element.shadowRoot?.delegatesFocus
    ) {
      matches.push(element);
    }
    for (const child of getComposedChildren(element)) visit(child);
  };

  for (const child of getComposedChildren(container)) visit(child);
  return matches;
}

/**
 * Returns all focusable descendants in DOM order, including programmatic focus
 * targets that are not reachable by Tab.
 */
export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return getComposedDescendants(container).filter((element) => isFocusable(element));
}

function isRadioInput(element: HTMLElement): element is HTMLInputElement {
  return isHTMLInputElement(element) && element.type === "radio";
}

function isRadioGroupTabStop(element: HTMLElement, focusableElements: HTMLElement[]): boolean {
  if (!isRadioInput(element) || element.name === "") return true;
  const root = element.getRootNode();

  const group = focusableElements.filter(
    (candidate) =>
      isRadioInput(candidate) &&
      candidate.name === element.name &&
      candidate.form === element.form &&
      candidate.getRootNode() === root,
  );
  const checked = group.find((candidate) => isRadioInput(candidate) && candidate.checked);
  return element === (checked ?? group[0]);
}

function tabIndexOrder(element: HTMLElement): number {
  return element.tabIndex > 0 ? element.tabIndex : Number.MAX_SAFE_INTEGER;
}

/**
 * Returns browser Tab-order descendants, excluding negative tabindex targets
 * and collapsing native radio groups to one Tab stop.
 */
export function getTabbableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const focusableElements = getFocusableElements(container).filter(
    (element) => element.tabIndex >= 0,
  );
  return focusableElements
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => isRadioGroupTabStop(element, focusableElements))
    .sort((a, b) => tabIndexOrder(a.element) - tabIndexOrder(b.element) || a.index - b.index)
    .map(({ element }) => element);
}

/** Returns the first focusable descendant in DOM order. */
export function getFirstFocusableElement(container: HTMLElement | null): HTMLElement | null {
  return getFocusableElements(container)[0] ?? null;
}

/** Returns true when the element contains its owner document's deep active element, across shadow roots. */
export function containsActiveElement(element: HTMLElement): boolean {
  const activeElement = getDeepActiveElement(element.ownerDocument);
  return isHTMLElement(activeElement) && composedContains(element, activeElement);
}
