"use client";

import {
  type AriaAttributes,
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { SelectEmpty } from "./select-empty";
import { SelectSearch, type SelectSearchProps } from "./select-search";

/** Props for listbox. */
type ListboxProps = {
  /** ID applied to the rendered element. */
  id: string;
  /** ARIA role applied to the rendered element. */
  role: "listbox";
  /** Tab index applied to the rendered element. */
  tabIndex: -1;
  /** ARIA multiselectable state forwarded to the rendered element. */
  "aria-multiselectable": boolean | undefined;
  /** ID of the active descendant for composite focus. */
  "aria-activedescendant": string | undefined;
  /** ID of the element that labels this component. */
  "aria-labelledby": string;
  /** ARIA required state forwarded to the rendered element. */
  "aria-required": boolean | undefined;
  /** ARIA invalid state forwarded to the rendered control. */
  "aria-invalid": AriaAttributes["aria-invalid"] | undefined;
  /** Called when key down occurs. */
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
};

/** Props for searchable listbox. */
export type SearchableListboxProps = Omit<ListboxProps, "onKeyDown">;

interface PartitionWrapperProps extends Record<string, unknown> {
  children?: ReactNode;
}

type PartitionKind = "search" | "options" | "empty";

export function SearchableContent({
  children,
  listboxProps,
  ref,
}: {
  children: ReactNode;
  listboxProps: SearchableListboxProps;
  ref: Ref<HTMLDivElement>;
}) {
  const { searchChildren, optionChildren, emptyChildren } = partitionSelectSearchChildren(children);
  // Order the search row by its position prop: "top" renders it before the
  // listbox, "bottom" (default) after — matching the documented placement and
  // the border compoundVariants in select-search.tsx.
  const searchAtTop = getSearchPosition(searchChildren) === "top";

  const listbox = (
    <div {...listboxProps} ref={ref} className="p-1 space-y-0.5 outline-none">
      {optionChildren}
    </div>
  );

  return (
    <>
      {searchAtTop && searchChildren}
      {listbox}
      {emptyChildren}
      {!searchAtTop && searchChildren}
    </>
  );
}

function getSearchPosition(searchChildren: ReactNode): "top" | "bottom" {
  return findSearchPosition(searchChildren) ?? "bottom";
}

function findSearchPosition(searchChildren: ReactNode): "top" | "bottom" | null {
  for (const child of Children.toArray(searchChildren)) {
    if (isSelectSearchElement(child) && isValidElement<SelectSearchProps>(child)) {
      return child.props.position ?? "bottom";
    }
    if (isValidElement<{ children?: ReactNode }>(child)) {
      const nestedPosition = findSearchPosition(child.props.children);
      if (nestedPosition !== null) return nestedPosition;
    }
  }
  return null;
}

function isSelectSearchElement(child: ReactNode): boolean {
  return isValidElement(child) && child.type === SelectSearch;
}

function isSelectEmptyElement(child: ReactNode): boolean {
  return isValidElement(child) && child.type === SelectEmpty;
}

function partitionSelectSearchChildren(children: ReactNode): {
  searchChildren: ReactNode[];
  optionChildren: ReactNode[];
  emptyChildren: ReactNode[];
} {
  const searchChildren: ReactNode[] = [];
  const optionChildren: ReactNode[] = [];
  const emptyChildren: ReactNode[] = [];

  for (const child of Children.toArray(children)) {
    if (isSelectSearchElement(child)) {
      searchChildren.push(child);
      continue;
    }

    if (isSelectEmptyElement(child)) {
      emptyChildren.push(child);
      continue;
    }

    if (
      !isValidElement<PartitionWrapperProps>(child) ||
      !containsPartitionedSelectElement(child.props.children)
    ) {
      optionChildren.push(child);
      continue;
    }

    const nested = partitionSelectSearchChildren(child.props.children);
    if (child.type === Fragment) {
      searchChildren.push(...nested.searchChildren);
      optionChildren.push(...nested.optionChildren);
      emptyChildren.push(...nested.emptyChildren);
    } else {
      const primaryPartition = getPrimaryPartition(nested);
      const partitions = [
        { kind: "search", children: nested.searchChildren, target: searchChildren },
        { kind: "options", children: nested.optionChildren, target: optionChildren },
        { kind: "empty", children: nested.emptyChildren, target: emptyChildren },
      ] satisfies Array<{
        kind: PartitionKind;
        children: ReactNode[];
        target: ReactNode[];
      }>;

      for (const partition of partitions) {
        if (partition.children.length === 0) continue;
        const overrides =
          partition.kind === primaryPartition
            ? undefined
            : getSecondaryWrapperSemanticOverrides(child.props);
        partition.target.push(
          cloneElement(
            child,
            { ...overrides, key: `${child.key}:${partition.kind}` },
            partition.children,
          ),
        );
      }
    }
  }

  return { searchChildren, optionChildren, emptyChildren };
}

function getPrimaryPartition({
  searchChildren,
  optionChildren,
}: {
  searchChildren: ReactNode[];
  optionChildren: ReactNode[];
}): PartitionKind {
  if (optionChildren.length > 0) return "options";
  if (searchChildren.length > 0) return "search";
  return "empty";
}

function getSecondaryWrapperSemanticOverrides(
  props: PartitionWrapperProps,
): Partial<PartitionWrapperProps> {
  const overrides: Partial<PartitionWrapperProps> = {
    id: undefined,
    role: undefined,
    tabIndex: undefined,
    htmlFor: undefined,
  };
  for (const name of Object.keys(props)) {
    if (name.startsWith("aria-")) overrides[name] = undefined;
  }
  return overrides;
}

function containsPartitionedSelectElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (isSelectSearchElement(child) || isSelectEmptyElement(child)) return true;
    if (!isValidElement<PartitionWrapperProps>(child)) return false;
    return containsPartitionedSelectElement(child.props.children);
  });
}
