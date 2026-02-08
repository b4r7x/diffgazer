import { type RefObject } from "react";

interface ScrollIntoViewOptions {
  padding?: number;
  itemSelector?: string;
}

interface UseScrollIntoViewReturn {
  isItemVisible: (itemIndex: number, options?: ScrollIntoViewOptions) => boolean;
  scrollItemIntoView: (itemIndex: number, options?: ScrollIntoViewOptions) => void;
}

export function useScrollIntoView(containerRef: RefObject<HTMLDivElement | null>): UseScrollIntoViewReturn {
  const isItemVisible = (
    itemIndex: number,
    options: ScrollIntoViewOptions = {}
  ): boolean => {
    const container = containerRef.current;
    if (!container) return true;

    const { itemSelector = '[role="option"]' } = options;
    const items = container.querySelectorAll<HTMLElement>(itemSelector);
    const item = items[itemIndex];
    if (!item) return true;

    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    return (
      itemRect.top >= containerRect.top &&
      itemRect.bottom <= containerRect.bottom
    );
  };

  const scrollItemIntoView = (
    itemIndex: number,
    options: ScrollIntoViewOptions = {}
  ) => {
    const container = containerRef.current;
    if (!container) return;

    const { padding = 8, itemSelector = '[role="option"]' } = options;
    const items = container.querySelectorAll<HTMLElement>(itemSelector);
    const item = items[itemIndex];
    if (!item) return;

    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    if (itemRect.top < containerRect.top + padding) {
      container.scrollTop -= containerRect.top + padding - itemRect.top;
    } else if (itemRect.bottom > containerRect.bottom - padding) {
      container.scrollTop += itemRect.bottom - containerRect.bottom + padding;
    }
  };

  return { isItemVisible, scrollItemIntoView };
}
