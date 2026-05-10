export interface RestoreFocusOptions {
  preventScroll?: boolean;
}

function getDocument(): Document | null {
  return typeof document === "undefined" ? null : document;
}

function isHTMLElement(element: Element | null): element is HTMLElement {
  const View = element?.ownerDocument.defaultView;
  return Boolean(View && element instanceof View.HTMLElement);
}

export function getRestorableFocusTarget(ownerDocument?: Document): HTMLElement | null {
  const doc = ownerDocument ?? getDocument();
  if (!doc) return null;

  const activeElement = doc.activeElement;
  if (!isHTMLElement(activeElement)) return null;
  if (activeElement === doc.body || activeElement === doc.documentElement) return null;
  if (!activeElement.isConnected) return null;

  return activeElement;
}

export function restoreFocus(
  target: HTMLElement | null,
  options: RestoreFocusOptions = {},
): boolean {
  if (!target?.isConnected) return false;

  try {
    target.focus({ preventScroll: options.preventScroll });
  } catch {
    target.focus();
  }

  return target.ownerDocument.activeElement === target;
}
