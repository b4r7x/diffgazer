import type { AriaAttributes } from "react";

/** Resolves an aria-invalid value while allowing component-level invalid state to force true. */
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

/** Merges whitespace-delimited ARIA id lists into one normalized id string. */
export function mergeIds(...values: Array<string | undefined>) {
  const ids = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/** Narrows a value to an HTMLElement from the same ownerDocument as the container. */
export function isHTMLElementForContainer(
  value: unknown,
  container: HTMLElement | null,
): value is HTMLElement {
  const View = container?.ownerDocument.defaultView;
  return Boolean(View && value instanceof View.HTMLElement);
}

/** Narrows a value to an HTMLDialogElement using the element's ownerDocument realm. */
export function isHTMLDialogElement(value: unknown): value is HTMLDialogElement {
  const element = value as { ownerDocument?: Document } | null;
  const View = element?.ownerDocument?.defaultView;
  return Boolean(View && value instanceof View.HTMLDialogElement);
}
