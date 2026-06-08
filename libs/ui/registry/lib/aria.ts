import type { AriaAttributes } from "react";

export function resolveAriaInvalid(
  ariaInvalid: AriaAttributes["aria-invalid"],
  forceInvalid?: boolean,
) {
  if (forceInvalid) return true;
  if (
    ariaInvalid === true ||
    ariaInvalid === "true" ||
    ariaInvalid === "grammar" ||
    ariaInvalid === "spelling"
  ) {
    return ariaInvalid;
  }
  if (ariaInvalid === false || ariaInvalid === "false") return ariaInvalid;
  return undefined;
}

export function mergeIds(...values: Array<string | undefined>) {
  const ids = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function isHTMLElementForContainer(
  value: unknown,
  container: HTMLElement | null,
): value is HTMLElement {
  const View = container?.ownerDocument.defaultView;
  return Boolean(View && value instanceof View.HTMLElement);
}

export function isHTMLDialogElement(value: unknown): value is HTMLDialogElement {
  const element = value as { ownerDocument?: Document } | null;
  const View = element?.ownerDocument?.defaultView;
  return Boolean(View && value instanceof View.HTMLDialogElement);
}
