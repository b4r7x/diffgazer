/**
 * Stable id for the main content scroller. TanStack Router's scroll restoration
 * keys cached offsets by `[data-scroll-restoration-id=…]`; naming the element
 * replaces the generated `nth-child` cache key with a selector the framework
 * can restore before hydration.
 */
export const MAIN_SCROLL_RESTORATION_ID = "main-content";
