import { type RefObject, useEffect, useState } from "react";

/**
 * Reports whether the referenced element's content overflows it horizontally,
 * so a scroll container can join the tab order only while there is something to
 * scroll. Docs example stages own their horizontal overflow, and a stage the
 * reader cannot scroll must not be a tab stop.
 *
 * The stage's own box does not change when a lazily loaded example grows inside
 * it, so the content wrapper is observed alongside the stage itself. Only the
 * first child present at mount is observed, so the caller must keep a stable
 * first-child wrapper and mount lazy content inside it rather than in its place.
 */
export function useIsScrollable(ref: RefObject<HTMLElement | null>): boolean {
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => setIsScrollable(element.scrollWidth > element.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const content = element.firstElementChild;
    if (content) observer.observe(content);
    measure();

    return () => observer.disconnect();
  }, [ref]);

  return isScrollable;
}
