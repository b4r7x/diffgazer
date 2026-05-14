export function getOwnerView(value: unknown): (Window & typeof globalThis) | null {
  const element = value as { ownerDocument?: Document } | null;
  return element?.ownerDocument?.defaultView ?? null;
}

export function isHTMLElement(value: unknown): value is HTMLElement {
  const View = getOwnerView(value);
  return Boolean(View && value instanceof View.HTMLElement);
}

export function isHTMLInputElement(value: unknown): value is HTMLInputElement {
  const View = getOwnerView(value);
  return Boolean(View && value instanceof View.HTMLInputElement);
}

export function isHTMLTextAreaElement(value: unknown): value is HTMLTextAreaElement {
  const View = getOwnerView(value);
  return Boolean(View && value instanceof View.HTMLTextAreaElement);
}

export function isNode(value: unknown, ownerView: (Window & typeof globalThis) | null): value is Node {
  return Boolean(ownerView && value instanceof ownerView.Node);
}
