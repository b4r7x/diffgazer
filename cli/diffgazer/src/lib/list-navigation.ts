import type { ReactElement, ReactNode } from "react";
import { Children, Fragment, isValidElement } from "react";

export function collectChildItems<T>(
  children: ReactNode,
  extract: (element: ReactElement) => T | null,
): T[] {
  const items: T[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      items.push(...collectChildItems((child.props as { children: ReactNode }).children, extract));
      return;
    }
    const result = extract(child);
    if (result !== null) {
      items.push(result);
    }
  });
  return items;
}
