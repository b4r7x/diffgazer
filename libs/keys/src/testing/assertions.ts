/// <reference lib="dom" />

export function requireValue<T>(value: T | null | undefined, label: string): NonNullable<T> {
  if (value == null) {
    throw new Error(`Expected ${label}`);
  }
  return value;
}

export function queryTestElement<T extends HTMLElement = HTMLElement>(
  root: ParentNode,
  selectorOrId: string,
): T {
  const selector = selectorOrId.startsWith("#") ? selectorOrId : `#${selectorOrId}`;
  return requireValue(root.querySelector<T>(selector), selector);
}

export function requireFrameDocument(frame: HTMLIFrameElement): Document {
  return requireValue(frame.contentDocument, "iframe document");
}
