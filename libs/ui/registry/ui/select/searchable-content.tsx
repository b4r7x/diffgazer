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

/**
 * Dropdown select with search, multiple selection, card variant, and controlled keyboard
 * integration points. 8 composable parts.
 */
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

function getSearchPosition(searchChildren: ReactNode[]): "top" | "bottom" {
  const search = searchChildren.find((child) =>
    isValidElement<SelectSearchProps>(child),
  ) as ReactNode;
  if (isValidElement<SelectSearchProps>(search)) {
    return search.props.position ?? "bottom";
  }
  return "bottom";
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

  Children.forEach(children, (child) => {
    if (isSelectSearchElement(child)) {
      searchChildren.push(child);
      return;
    }

    if (isSelectEmptyElement(child)) {
      emptyChildren.push(child);
      return;
    }

    if (
      !isValidElement<{ children?: ReactNode }>(child) ||
      !containsPartitionedSelectElement(child.props.children)
    ) {
      optionChildren.push(child);
      return;
    }

    const nested = partitionSelectSearchChildren(child.props.children);
    searchChildren.push(...nested.searchChildren);
    emptyChildren.push(...nested.emptyChildren);
    if (nested.optionChildren.length === 0) return;

    if (child.type === Fragment) {
      optionChildren.push(...nested.optionChildren);
    } else {
      optionChildren.push(cloneElement(child, undefined, nested.optionChildren));
    }
  });

  return { searchChildren, optionChildren, emptyChildren };
}

function containsPartitionedSelectElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (isSelectSearchElement(child) || isSelectEmptyElement(child)) return true;
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    return containsPartitionedSelectElement(child.props.children);
  });
}
