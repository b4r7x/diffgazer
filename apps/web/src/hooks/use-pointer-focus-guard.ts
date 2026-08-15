import { isFocusable, isReachable } from "@diffgazer/keys";
import { type RefObject, useEffect } from "react";

// What makes an element a press target on its own, independent of any tabindex:
// a native control, or an explicit ARIA role — which a11y lint already requires
// on anything carrying a click handler.
const INTERACTIVE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button",
  "input",
  "select",
  "textarea",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable="false"])',
  "summary",
  "[role]",
].join(",");

/**
 * True for wrappers that panes use to park programmatic focus — a bare
 * `tabIndex={-1}` box around prose, so focus survives the control it sat on
 * disappearing. The keys focusable selector counts `[tabindex]`, so such a
 * wrapper reads as focusable, but a press on it is a dead-space press. A
 * negative tabindex on a real control (roving list items) is not a park.
 */
function isFocusPark(element: HTMLElement): boolean {
  return element.tabIndex < 0 && !element.matches(INTERACTIVE_SELECTOR);
}

/**
 * Keeps DOM focus with the active widget when a mouse press lands on
 * non-interactive dead space. Without it the browser moves focus to the
 * nearest click-focusable ancestor — the sink container (`<main>`) or
 * `<body>` — which unplugs every container-bound keyboard surface and blinks
 * pane focus chrome on every background click.
 *
 * Presses on dead space get their mousedown default-prevented, so focus never
 * leaves the widget (the VS Code model — keyboard is the priority surface;
 * the cost is that drag text selection cannot start on dead space). Presses
 * on interactive targets — controls, labels, scrollbar gutters — keep native
 * behavior. If focus was already parked on a sink (skip link, removed widget),
 * a dead-space press pulls it back to the last real owner.
 */
export function usePointerFocusGuard(sinkRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const sink = sinkRef.current;
    if (!sink) return;
    const doc = sink.ownerDocument;

    let lastRealFocus: HTMLElement | null = null;

    const isSink = (node: Element | null): boolean =>
      node === sink || node === doc.body || node === doc.documentElement;

    const isInteractive = (target: Element): boolean => {
      for (let el: Element | null = target; el && !isSink(el); el = el.parentElement) {
        // Labels are not focusable themselves but their mousedown default
        // focuses the associated control.
        if (el.localName === "label") return true;
        if (el instanceof HTMLElement && isFocusable(el) && !isFocusPark(el)) return true;
      }
      return false;
    };

    // A press in the scrollbar gutter targets the scroll container itself;
    // offsetX/Y are measured from the padding-box origin, so the gutter starts
    // at clientWidth/clientHeight regardless of border width. Preventing it
    // would break dragging the scrollbar.
    const isScrollbarPress = (event: MouseEvent, target: Element): boolean => {
      const canScroll =
        target.scrollHeight > target.clientHeight || target.scrollWidth > target.clientWidth;
      return (
        canScroll && (event.offsetX >= target.clientWidth || event.offsetY >= target.clientHeight)
      );
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && !isSink(target)) lastRealFocus = target;
    };

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (isInteractive(target) || isScrollbarPress(event, target)) return;

      event.preventDefault();

      if (isSink(doc.activeElement) && lastRealFocus?.isConnected && isReachable(lastRealFocus)) {
        lastRealFocus.focus({ preventScroll: true });
      }
    };

    doc.addEventListener("focusin", handleFocusIn, true);
    doc.addEventListener("mousedown", handleMouseDown, true);
    return () => {
      doc.removeEventListener("focusin", handleFocusIn, true);
      doc.removeEventListener("mousedown", handleMouseDown, true);
    };
  }, [sinkRef]);
}
