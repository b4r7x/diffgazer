export function isHTMLElement(value: unknown): value is HTMLElement {
  const element = value as { ownerDocument?: Document } | null;
  const View = element?.ownerDocument?.defaultView;
  return Boolean(View && value instanceof View.HTMLElement);
}
