import { Toc as TocRoot, type TocProps } from "./toc";
import { TocList, type TocListProps } from "./toc-list";
import { TocItem, type TocItemProps, type TocItemRenderProps, tocItemVariants } from "./toc-item";

const Toc = Object.assign(TocRoot, {
  List: TocList,
  Item: TocItem,
});

export { Toc, type TocProps };
export { TocList, type TocListProps };
export { TocItem, type TocItemProps, type TocItemRenderProps, tocItemVariants };
