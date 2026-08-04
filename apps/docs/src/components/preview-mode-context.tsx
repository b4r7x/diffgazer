import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MAIN_SCROLL_RESTORATION_ID } from "@/lib/main-scroll-bootstrap";

export type PreviewMode = "preview" | "code";

interface PreviewModeContextValue {
  mode: PreviewMode;
  /**
   * Switches every example on the page. `anchor` is the root of the example the
   * reader clicked; it stays visually stationary while examples above it change
   * height.
   */
  setMode: (mode: PreviewMode, anchor: HTMLElement | null) => void;
}

const PreviewModeContext = createContext<PreviewModeContextValue | null>(null);

/**
 * One preview/code value for every example on a page: switching any one strip
 * switches all of them, so a reader comparing two examples' source no longer
 * flips a tab per example. Page-scoped and not persisted — every page opens on
 * the preview.
 */
export function PreviewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<PreviewMode>("preview");
  const [pendingAnchor, setPendingAnchor] = useState<HTMLElement | null>(null);
  const anchorTopRef = useRef(0);

  const setMode = useCallback((next: PreviewMode, anchor: HTMLElement | null) => {
    anchorTopRef.current = anchor?.getBoundingClientRect().top ?? 0;
    setPendingAnchor(anchor);
    setModeState(next);
  }, []);

  // Runs after the switched panes have committed, so the anchor's new position
  // is final. Only a click through setMode arms it; plain scrolling never does.
  useLayoutEffect(() => {
    if (!pendingAnchor) return;
    setPendingAnchor(null);
    const delta = pendingAnchor.getBoundingClientRect().top - anchorTopRef.current;
    if (Math.abs(delta) < 0.5) return;
    // The docs shell never scrolls the document: the article scrolls inside
    // #main-content, so compensating the view would be inert. Only an example
    // mounted outside that shell falls back to it.
    const scroll: ScrollToOptions = { top: delta, behavior: "instant" };
    const scroller =
      pendingAnchor.closest(`#${MAIN_SCROLL_RESTORATION_ID}`) ??
      pendingAnchor.ownerDocument.getElementById(MAIN_SCROLL_RESTORATION_ID);
    if (scroller) scroller.scrollBy(scroll);
    else pendingAnchor.ownerDocument.defaultView?.scrollBy(scroll);
  }, [pendingAnchor]);

  // The anchor bookkeeping re-renders this provider twice per click; the value
  // only changes with the mode, so consumers do not follow it there.
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return <PreviewModeContext value={value}>{children}</PreviewModeContext>;
}

/** The shared page mode, or null for a DemoPreview mounted outside a docs page. */
export function usePreviewMode(): PreviewModeContextValue | null {
  return useContext(PreviewModeContext);
}
