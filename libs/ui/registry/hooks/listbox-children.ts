import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { type ListboxMetadataItem } from "./listbox-metadata";

export interface ListboxItemElementProps {
  id?: string;
  disabled?: boolean;
  hidden?: boolean;
  inert?: boolean;
  "aria-hidden"?: boolean | "true" | "false";
  expanded?: boolean;
  defaultExpanded?: boolean;
  children?: ReactNode;
}

type ListboxChildType = ReactElement["type"];

export interface CollectListboxItemsOptions {
  itemTypes: readonly ListboxChildType[];
  containerTypes?: readonly ListboxChildType[];
}

function isRenderSeedHidden(props: ListboxItemElementProps): boolean {
  return (
    props.hidden === true ||
    props.inert === true ||
    props["aria-hidden"] === true ||
    props["aria-hidden"] === "true"
  );
}

function isRenderSeedContainerVisible(props: ListboxItemElementProps): boolean {
  return !isRenderSeedHidden(props) && (props.expanded ?? props.defaultExpanded ?? true);
}

/** Collects item IDs and disabled state that are inspectable during render. */
export function collectListboxItems<TId extends string = string>(
  children: ReactNode,
  { itemTypes, containerTypes = [] }: CollectListboxItemsOptions,
): ListboxMetadataItem<TId>[] {
  const items: ListboxMetadataItem<TId>[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<ListboxItemElementProps>(child)) return;
    if (itemTypes.includes(child.type) && typeof child.props.id === "string") {
      if (isRenderSeedHidden(child.props)) return;
      // Child id is opaque to TS; consumers parameterize TId.
      items.push({ id: child.props.id as TId, disabled: child.props.disabled });
      return;
    }
    if (
      child.type === Fragment ||
      (containerTypes.includes(child.type) && isRenderSeedContainerVisible(child.props))
    ) {
      items.push(...collectListboxItems<TId>(child.props.children, { itemTypes, containerTypes }));
    }
  });

  return items;
}
