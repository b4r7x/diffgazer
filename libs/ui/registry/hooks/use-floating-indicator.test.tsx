import { act, render, waitFor, within } from "@testing-library/react";
import { type RefObject, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useFloatingIndicator } from "./use-floating-indicator";

function IndicatorProbe({ container }: { container: HTMLDivElement }) {
  const containerRef = useRef<HTMLDivElement>(container);
  const rect = useFloatingIndicator(containerRef as RefObject<HTMLDivElement>, "beta");
  return <div data-testid="width">{rect?.width ?? 0}</div>;
}

function ReplacingIndicatorProbe({ version }: { version: "first" | "second" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rect = useFloatingIndicator(containerRef, "beta");
  const targetWidth = version === "first" ? 40 : 80;
  const targetLeft = version === "first" ? 30 : 90;

  return (
    <>
      <div
        key={version}
        data-testid="container"
        ref={(node) => {
          containerRef.current = node;
          if (node) {
            node.getBoundingClientRect = () =>
              ({ left: 10, top: 5, width: 200, height: 40 }) as DOMRect;
          }
        }}
      >
        <button
          type="button"
          data-testid="target"
          data-value="beta"
          ref={(node) => {
            if (node) {
              node.getBoundingClientRect = () =>
                ({ left: targetLeft, top: 10, width: targetWidth, height: 20 }) as DOMRect;
            }
          }}
        >
          Beta
        </button>
      </div>
      <output data-testid="rect">{rect ? `${rect.left}:${rect.width}` : "none"}</output>
    </>
  );
}

function restoreProperty(
  target: typeof globalThis,
  key: "ResizeObserver" | "MutationObserver",
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
  } else {
    Reflect.deleteProperty(target, key);
  }
}

describe("useFloatingIndicator", () => {
  it("measures the active item inside a same-origin iframe ownerDocument", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) {
      iframe.remove();
      throw new Error("iframe.contentDocument is null; cannot exercise cross-document indicator");
    }

    const container = iframeDoc.createElement("div");
    const activeItem = iframeDoc.createElement("button");
    activeItem.setAttribute("data-value", "beta");
    activeItem.textContent = "Beta";
    activeItem.getBoundingClientRect = () =>
      ({
        left: 40,
        top: 8,
        width: 60,
        height: 24,
        right: 100,
        bottom: 32,
        x: 40,
        y: 8,
        toJSON: () => ({}),
      }) as DOMRect;
    container.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 200,
        height: 40,
        right: 200,
        bottom: 40,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    container.append(activeItem);
    iframeDoc.body.appendChild(container);

    const mount = iframeDoc.createElement("div");
    iframeDoc.body.appendChild(mount);
    render(<IndicatorProbe container={container} />, { container: mount });

    expect(within(mount).getByTestId("width")).toHaveTextContent("60");

    iframe.remove();
  });

  it("re-measures when resize/mutation callbacks fire, and disconnects and re-observes a replaced container", async () => {
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
    const mutationObserverDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "MutationObserver",
    );
    const resizeObservers: Array<{
      observe: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      callback: ResizeObserverCallback;
    }> = [];
    const mutationObservers: Array<{
      observe: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      callback: MutationCallback;
    }> = [];

    class MockResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        resizeObservers.push(this);
      }
    }

    class MockMutationObserver {
      observe = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
      callback: MutationCallback;

      constructor(callback: MutationCallback) {
        this.callback = callback;
        mutationObservers.push(this);
      }
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: MockResizeObserver,
    });
    Object.defineProperty(globalThis, "MutationObserver", {
      configurable: true,
      value: MockMutationObserver,
    });

    const view = render(<ReplacingIndicatorProbe version="first" />);
    try {
      expect(view.getByTestId("rect")).toHaveTextContent("20:40");

      const firstTarget = view.getByTestId("target");
      firstTarget.getBoundingClientRect = () =>
        ({ left: 50, top: 10, width: 60, height: 20 }) as DOMRect;
      act(() => {
        resizeObservers[0]?.callback([], resizeObservers[0] as unknown as ResizeObserver);
      });
      expect(view.getByTestId("rect")).toHaveTextContent("40:60");

      view.rerender(<ReplacingIndicatorProbe version="second" />);

      await waitFor(() => expect(view.getByTestId("rect")).toHaveTextContent("80:80"));
      expect(resizeObservers[0]?.disconnect).toHaveBeenCalled();
      expect(mutationObservers[0]?.disconnect).toHaveBeenCalled();

      const secondTarget = view.getByTestId("target");
      secondTarget.getBoundingClientRect = () =>
        ({ left: 120, top: 10, width: 30, height: 20 }) as DOMRect;
      act(() => {
        mutationObservers[1]?.callback([], mutationObservers[1] as unknown as MutationObserver);
      });
      expect(view.getByTestId("rect")).toHaveTextContent("110:30");
    } finally {
      view.unmount();
      restoreProperty(globalThis, "ResizeObserver", resizeObserverDescriptor);
      restoreProperty(globalThis, "MutationObserver", mutationObserverDescriptor);
    }
  });
});
