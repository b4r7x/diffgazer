import { render, within } from "@testing-library/react";
import { type RefObject, useRef } from "react";
import { describe, expect, it } from "vitest";
import { useFloatingIndicator } from "./use-floating-indicator";

function IndicatorProbe({ container }: { container: HTMLDivElement }) {
  const containerRef = useRef<HTMLDivElement>(container);
  const rect = useFloatingIndicator(containerRef as RefObject<HTMLDivElement>, "beta");
  return <div data-testid="width">{rect?.width ?? 0}</div>;
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
});
