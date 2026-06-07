export function requireValue<T>(value: T | null | undefined, label: string): NonNullable<T> {
  if (value == null) {
    throw new Error(`Expected ${label}`);
  }
  return value;
}

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
