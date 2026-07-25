// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { createElement, createRef } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-is-mobile";

interface StubMql extends MediaQueryList {
  listeners: Set<() => void>;
}

function installMatchMedia(target: Window, initialMatches: boolean) {
  const created: StubMql[] = [];
  let matches = initialMatches;

  const matchMedia = vi.fn((media: string) => {
    const listeners = new Set<() => void>();
    const mql = {
      media,
      onchange: null,
      get matches() {
        return matches;
      },
      addEventListener: vi.fn((_type: string, listener: () => void) => {
        listeners.add(listener);
      }),
      removeEventListener: vi.fn((_type: string, listener: () => void) => {
        listeners.delete(listener);
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      listeners,
    } as unknown as StubMql;
    created.push(mql);
    return mql;
  });

  Object.defineProperty(target, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  return {
    matchMedia,
    created,
    setMatches(next: boolean) {
      matches = next;
      act(() => {
        for (const mql of created) {
          for (const listener of mql.listeners) listener();
        }
      });
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useIsMobile", () => {
  it("reports true when the viewport matches the mobile breakpoint", () => {
    const media = installMatchMedia(window, true);
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
    expect(media.matchMedia).toHaveBeenCalledWith("(max-width: 1023px)");
  });

  it("reports false when the viewport does not match", () => {
    installMatchMedia(window, false);
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it("updates when the media query fires a change event", () => {
    const media = installMatchMedia(window, false);
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
    media.setMatches(true);
    expect(result.current).toBe(true);
  });

  it("removes the change listener on unmount", () => {
    const media = installMatchMedia(window, true);
    const { unmount } = renderHook(() => useIsMobile());

    const mql = media.created[0];
    if (!mql) throw new Error("Expected a MediaQueryList to be created");
    expect(mql.listeners.size).toBe(1);

    unmount();
    expect(mql.listeners.size).toBe(0);
    expect(mql.removeEventListener).toHaveBeenCalled();
  });

  it("resubscribes to a new query when the breakpoint changes", () => {
    const media = installMatchMedia(window, true);
    const { rerender } = renderHook(({ breakpoint }) => useIsMobile(breakpoint), {
      initialProps: { breakpoint: 1024 },
    });

    expect(media.matchMedia).toHaveBeenCalledWith("(max-width: 1023px)");
    const first = media.created[0];
    if (!first) throw new Error("Expected a MediaQueryList to be created");

    rerender({ breakpoint: 768 });

    expect(media.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
    expect(first.listeners.size).toBe(0);
  });

  it("follows the owner document's viewport when given an element ref", () => {
    installMatchMedia(window, false);
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const frameWindow = iframe.contentWindow;
    const frameDocument = iframe.contentDocument;
    if (!frameWindow || !frameDocument) throw new Error("Expected an iframe window and document");
    installMatchMedia(frameWindow, true);

    const ref = createRef<HTMLElement>();
    ref.current = frameDocument.body;
    const { result } = renderHook(() => useIsMobile(1024, ref));

    expect(result.current).toBe(true);
    iframe.remove();
  });

  it("returns false during server rendering", () => {
    installMatchMedia(window, true);
    function Probe() {
      return createElement("output", null, String(useIsMobile()));
    }

    expect(renderToString(createElement(Probe))).toContain(">false<");
  });
});
