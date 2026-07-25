import { requireValue } from "@diffgazer/core/testing/assertions";

export function requireElement<T extends Element>(element: T | null | undefined, label: string): T {
  return requireValue(element, label);
}

export function requireAttribute(element: Element, name: string): string {
  const value = element.getAttribute(name);
  if (value === null) {
    throw new Error(`Expected ${name} on ${element.tagName}`);
  }
  return value;
}

export function closestElement<T extends Element = HTMLElement>(
  element: Element,
  selector: string,
  label: string,
): T {
  return requireElement(element.closest<T>(selector), label);
}
