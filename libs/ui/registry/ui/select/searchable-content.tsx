"use client";

import { type AriaAttributes, Children, cloneElement, Fragment, isValidElement, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { SelectEmpty } from "./select-empty";
import { SelectSearch } from "./select-search";

type ListboxProps = {
  id: string;
  role: "listbox";
  tabIndex: -1;
  "aria-multiselectable": boolean | undefined;
  "aria-activedescendant": string | undefined;
  "aria-labelledby": string;
  "aria-required": boolean | undefined;
  "aria-invalid": AriaAttributes["aria-invalid"] | undefined;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
};

export type SearchableListboxProps = Omit<ListboxProps, "onKeyDown">;

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

  return (
    <>
      {searchChildren}
      <div {...listboxProps} ref={ref} className="p-1 space-y-0.5 outline-none">
        {optionChildren}
      </div>
      {emptyChildren}
    </>
  );
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

    if (!isValidElement<{ children?: ReactNode }>(child) || !containsPartitionedSelectElement(child.props.children)) {
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
