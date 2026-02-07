import type { RefObject, KeyboardEvent } from "react";

type Orientation = "horizontal" | "vertical";

interface UseTabNavigationOptions {
  containerRef: RefObject<HTMLElement | null>;
  orientation?: Orientation;
  wrap?: boolean;
}

interface UseTabNavigationReturn {
  onKeyDown: (event: KeyboardEvent) => void;
}

/**
 * Keyboard navigation for tab lists.
 * Handles ArrowLeft/Right (horizontal) or ArrowUp/Down (vertical) + Home/End.
 * Queries [role="tab"]:not([disabled]) elements inside the container.
 *
 * Focuses and activates tabs via the DOM — pair with your own value/onChange.
 */
export function useTabNavigation({
  containerRef,
  orientation = "horizontal",
  wrap = true,
}: UseTabNavigationOptions): UseTabNavigationReturn {
  const onKeyDown = (event: KeyboardEvent) => {
    const isHorizontal = orientation === "horizontal";
    const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";
    const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";

    if (
      event.key !== prevKey &&
      event.key !== nextKey &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const tabs = Array.from(
      container.querySelectorAll<HTMLElement>(
        `[role="tab"]:not([disabled])`
      )
    );
    if (tabs.length === 0) return;

    const active = document.activeElement;
    const currentIndex = tabs.indexOf(active as HTMLElement);

    let nextIndex: number;
    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    } else if (event.key === prevKey) {
      if (currentIndex <= 0) {
        nextIndex = wrap ? tabs.length - 1 : 0;
      } else {
        nextIndex = currentIndex - 1;
      }
    } else {
      if (currentIndex >= tabs.length - 1) {
        nextIndex = wrap ? 0 : tabs.length - 1;
      } else {
        nextIndex = currentIndex + 1;
      }
    }

    const nextTab = tabs[nextIndex];
    if (nextTab) {
      nextTab.focus();
      nextTab.click();
    }
  };

  return { onKeyDown };
}
