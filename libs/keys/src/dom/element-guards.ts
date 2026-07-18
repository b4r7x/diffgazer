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

/** Realm-safe Node guard using a known owner window. */
export function isNode(
  value: unknown,
  ownerView: (Window & typeof globalThis) | null,
): value is Node {
  return Boolean(ownerView && value instanceof ownerView.Node);
}

/** Returns the shadow host when a node lives in a shadow root, else null. */
export function getShadowHost(node: Node): Element | null {
  const view = getOwnerView(node);
  const root = node.getRootNode();
  return view && root instanceof view.ShadowRoot ? root.host : null;
}

/** Returns the deepest active element, descending through open shadow roots. */
export function getDeepActiveElement(root: Document | ShadowRoot): Element | null {
  let active = root.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

/** Returns true when `container` contains `target` in the composed tree, across shadow boundaries. */
export function composedContains(container: Node, target: Node | null): boolean {
  let node: Node | null = target;
  while (node) {
    if (container.contains(node)) return true;
    node = getShadowHost(node);
  }
  return false;
}

/** Returns the nearest self-or-ancestor matching `selector` in the composed tree, across shadow boundaries. */
export function composedClosest(element: Element, selector: string): Element | null {
  let current: Element | null = element;
  while (current) {
    const match = current.closest(selector);
    if (match) return match;
    current = getShadowHost(current);
  }
  return null;
}

/**
 * Returns the deepest composed event target, past the retargeted shadow host.
 * Empty `composedPath()` (before dispatch) falls back to `event.target`.
 */
export function getComposedEventTarget(event: Event): EventTarget | null {
  return event.composedPath()[0] ?? event.target;
}

/**
 * Returns true for form-like or editable elements that can own keyboard input,
 * including select and non-text input types.
 */
export function isInputElement(target: EventTarget | null): boolean {
  if (!isHTMLElement(target)) return false;
  const tag = target.tagName.toLowerCase();
  return Boolean(
    tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable,
  );
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
