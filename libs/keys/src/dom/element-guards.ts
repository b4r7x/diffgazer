/** Returns the `Window` realm for a DOM value, or null for non-DOM values. */
export function getOwnerView(value: unknown): (Window & typeof globalThis) | null {
  const element = value as { ownerDocument?: Document } | null;
  return element?.ownerDocument?.defaultView ?? null;
}

/** Realm-safe HTMLElement guard for elements from iframes or other documents. */
export function isHTMLElement(value: unknown): value is HTMLElement {
  const View = getOwnerView(value);
  return Boolean(View && value instanceof View.HTMLElement);
}

/** Realm-safe HTMLInputElement guard. */
export function isHTMLInputElement(value: unknown): value is HTMLInputElement {
  const View = getOwnerView(value);
  return Boolean(View && value instanceof View.HTMLInputElement);
}

/** Realm-safe HTMLTextAreaElement guard. */
export function isHTMLTextAreaElement(value: unknown): value is HTMLTextAreaElement {
  const View = getOwnerView(value);
  return Boolean(View && value instanceof View.HTMLTextAreaElement);
}

/** Realm-safe HTMLDialogElement guard. */
export function isHTMLDialogElement(value: unknown): value is HTMLDialogElement {
  const View = getOwnerView(value);
  return Boolean(View && value instanceof View.HTMLDialogElement);
}

/** Realm-safe Node guard using a known owner window. */
export function isNode(
  value: unknown,
  ownerView: (Window & typeof globalThis) | null,
): value is Node {
  return Boolean(ownerView && value instanceof ownerView.Node);
}

/**
 * Returns true for form-like or editable elements that can own keyboard input,
 * including select and non-text input types.
 */
export function isInputElement(target: EventTarget | null): boolean {
  if (!isHTMLElement(target)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

const NON_EDITABLE_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function hasContentEditableAttribute(element: HTMLElement): boolean {
  if (element.isContentEditable) return true;
  const value = element.getAttribute("contenteditable");
  if (value === null) return false;
  return value === "" || value === "true" || value === "plaintext-only";
}

/**
 * Returns true only for enabled text-editable targets that should keep typing
 * keys instead of global shortcuts.
 */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!isHTMLElement(target)) return false;

  if (isHTMLTextAreaElement(target)) {
    return !target.disabled && !target.readOnly;
  }

  if (isHTMLInputElement(target)) {
    if (target.disabled || target.readOnly) return false;
    const type = (target.type || "text").toLowerCase();
    return !NON_EDITABLE_INPUT_TYPES.has(type);
  }

  return hasContentEditableAttribute(target);
}
