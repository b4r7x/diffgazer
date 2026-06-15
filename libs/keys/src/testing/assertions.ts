/// <reference lib="dom" />

/** Returns a non-null value or throws with the provided label. */
export function requireValue<T>(value: T | null | undefined, label: string): NonNullable<T> {
  if (value == null) {
    throw new Error(`Expected ${label}`);
  }
  return value;
}

/** Queries a test element by selector or id and throws when it is missing. */
export function queryTestElement<T extends HTMLElement = HTMLElement>(
  root: ParentNode,
  selectorOrId: string,
): T {
  const selector = selectorOrId.startsWith("#") ? selectorOrId : `#${selectorOrId}`;
  return requireValue(root.querySelector<T>(selector), selector);
}

/** Returns an iframe's content document or throws when it is unavailable. */
export function requireFrameDocument(frame: HTMLIFrameElement): Document {
  return requireValue(frame.contentDocument, "iframe document");
}
