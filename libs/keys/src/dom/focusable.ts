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
  return element.parentElement ?? getShadowHost(element);
}

function isHidden(element: HTMLElement): boolean {
  let current: Element | null = element;
  while (current) {
    const style = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (style && (style.display === "none" || style.visibility === "hidden")) {
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

/**
 * Returns false when a hidden, inert, or aria-hidden="true" self-or-ancestor
 * (across shadow boundaries) removes the element from keyboard reach. Shared
 * with navigation discovery so it skips the same unreachable items focus does.
 */
export function isReachable(element: HTMLElement): boolean {
  return !isHidden(element) && !isInert(element) && !isAriaHidden(element);
}

function isInsideDisabledFieldset(element: HTMLElement): boolean {
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

/** Sort comparator that returns elements in DOM order across document realms. */
export function documentOrder(a: HTMLElement, b: HTMLElement): number {
  const pos = a.compareDocumentPosition(b);
  if (pos & DOCUMENT_POSITION_FOLLOWING) return -1;
  if (pos & DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

/**
 * Returns all focusable descendants in DOM order, including programmatic focus
 * targets that are not reachable by Tab.
 */
export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .sort(documentOrder)
    .filter((element) => isFocusable(element));
}

function isRadioInput(element: HTMLElement): element is HTMLInputElement {
  return isHTMLInputElement(element) && element.type === "radio";
}

function getRadioFormIndex(element: HTMLInputElement): number {
  if (!element.form) return -1;
  return Array.from(element.ownerDocument.forms).indexOf(element.form);
}

function getRadioGroupKey(element: HTMLElement): string | null {
  if (!isRadioInput(element) || element.name === "") return null;
  return `${getRadioFormIndex(element)}:${element.name}`;
}

function isRadioGroupTabStop(element: HTMLElement, focusableElements: HTMLElement[]): boolean {
  const groupKey = getRadioGroupKey(element);
  if (groupKey === null) return true;

  const group = focusableElements.filter((candidate) => getRadioGroupKey(candidate) === groupKey);
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
  const focusableElements = getFocusableElements(container);
  return focusableElements
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => element.tabIndex >= 0)
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
