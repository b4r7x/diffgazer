import { Children, isValidElement, type ReactNode } from "react";

/** Returns whether value selected. */
export function isValueSelected(value: string | null | string[], itemValue: string): boolean {
  return Array.isArray(value) ? value.includes(itemValue) : value === itemValue;
}

/** Returns node text. */
export function getNodeText(node: ReactNode): string | undefined {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    const text = node.map(getNodeText).filter(Boolean).join("");
    return text || undefined;
  }
  if (isValidElement<{ children?: ReactNode }>(node)) return getNodeText(node.props.children);
  return undefined;
}

export function toSelectedArray(value: string | null | string[], multiple: boolean): string[] {
  if (multiple) return Array.isArray(value) ? value : [];
  return value === null ? [] : [value as string];
}

export function toOptionId(listboxId: string, value: string): string {
  const encoded = Array.from(value, (char) => char.codePointAt(0)?.toString(36) ?? "0").join("-");
  return `${listboxId}-opt-${encoded || "empty"}`;
}

/** Returns whether active option visible. */
export function isActiveOptionVisible(
  options: ReadonlyMap<string, { label: string; disabled: boolean }>,
  value: string | null,
  searchQuery: string,
  matches: (label: string, query: string) => boolean,
): value is string {
  if (value === null) return false;
  const option = options.get(value);
  return !!option && !option.disabled && matches(option.label, searchQuery);
}

export function containsSelectSearchElement(
  children: ReactNode,
  isSelectSearchElement: (child: ReactNode) => boolean,
): boolean {
  return Children.toArray(children).some((child) => {
    if (isSelectSearchElement(child)) return true;
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    return containsSelectSearchElement(child.props.children, isSelectSearchElement);
  });
}
