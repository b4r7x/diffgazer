import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useFloatingPosition } from "@/hooks/use-floating-position";

function makeDOMRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    right: x + width,
    bottom: y + height,
    left: x,
    toJSON: () => ({}),
  } as DOMRect;
}

function AnchorHiddenHarness({
  getTriggerRect,
  getWrapperRect,
}: {
  getTriggerRect: () => DOMRect;
  getWrapperRect: () => DOMRect;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { position, contentRef } = useFloatingPosition({
    triggerRef,
    open: true,
    side: "bottom",
    align: "start",
    avoidCollisions: false,
  });

  return (
    <div
      ref={(node) => {
        if (node) node.getBoundingClientRect = getWrapperRect;
      }}
      style={{ overflowY: "auto", height: 200 }}
    >
      <button
        type="button"
        ref={(node) => {
          triggerRef.current = node;
          if (node) node.getBoundingClientRect = getTriggerRect;
        }}
      >
        Trigger
      </button>
      <div
        ref={contentRef}
        data-anchor-hidden={position?.anchorHidden ? "" : undefined}
        style={
          position
            ? {
                position: "fixed",
                left: position.x,
                top: position.y,
                ...(position.anchorHidden
                  ? { opacity: 0, pointerEvents: "none" as const, animation: "none" }
                  : null),
              }
            : { position: "fixed", opacity: 0 }
        }
      >
        Floating content
      </div>
    </div>
  );
}

describe("floating-position anchor-hidden presentation", () => {
  it("suppresses floating content when the anchor scrolls out of its clip region", async () => {
    let triggerY = 150;
    const { container } = render(
      <AnchorHiddenHarness
        getTriggerRect={() => makeDOMRect(100, triggerY, 80, 40)}
        getWrapperRect={() => makeDOMRect(0, 100, 400, 200)}
      />,
    );

    const floating = await screen.findByText("Floating content");
    await waitFor(() => {
      expect(floating).not.toHaveAttribute("data-anchor-hidden");
    });

    triggerY = 400;
    const scrollContainer = container.firstElementChild as HTMLDivElement;
    act(() => {
      scrollContainer.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => {
      expect(floating).toHaveAttribute("data-anchor-hidden", "");
    });
    expect(floating).toHaveStyle({ opacity: "0", pointerEvents: "none" });
  });
});

describe("FloatingPositionBasicExample", () => {
  it("opens and positions floating content from the trigger", async () => {
    const user = userEvent.setup();
    const { default: FloatingPositionBasicExample } = await import("./floating-position-basic");

    render(<FloatingPositionBasicExample />);
    await user.click(screen.getByRole("button", { name: /open floating/i }));

    expect(await screen.findByText("Floating content")).toBeInTheDocument();
  });
});
