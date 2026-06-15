"use client";

import { type TocProps, Toc as TocRoot } from "./toc";
import { TocItem, type TocItemProps, type TocItemRenderProps, tocItemVariants } from "./toc-item";
import { TocList, type TocListProps } from "./toc-list";

/** Root aside wrapper and optional heading label. */
const Toc = Object.assign(TocRoot, {
  List: TocList,
  Item: TocItem,
});

export { Toc, type TocProps };
export { TocList, type TocListProps };
export { TocItem, type TocItemProps, type TocItemRenderProps, tocItemVariants };
