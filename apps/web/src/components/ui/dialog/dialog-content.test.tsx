import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogContent } from "./dialog-content";
import { DialogContext, type DialogContextValue } from "./dialog-context";
import type { ReactNode } from "react";

function renderWithDialog(
  children: ReactNode,
  contextOverrides: Partial<DialogContextValue> = {}
) {
  const defaultContext: DialogContextValue = {
    open: true,
    onOpenChange: vi.fn(),
    titleId: "dialog-title",
    descriptionId: "dialog-desc",
    ...contextOverrides,
  };

  return {
    ...render(
      <DialogContext.Provider value={defaultContext}>
        {children}
      </DialogContext.Provider>
    ),
    context: defaultContext,
  };
}

describe("DialogContent", () => {
  it("should render when open is true", () => {
    const { unmount } = renderWithDialog(
      <DialogContent>
        <p>Dialog body</p>
      </DialogContent>
    );
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Dialog body")).toBeDefined();
    unmount();
  });

  it("should not render when open is false", () => {
    const { unmount } = renderWithDialog(
      <DialogContent>
        <p>Hidden body</p>
      </DialogContent>,
      { open: false }
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();
  });

  it("should have aria-modal attribute", () => {
    const { unmount } = renderWithDialog(
      <DialogContent>
        <p>Modal content</p>
      </DialogContent>
    );
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    unmount();
  });

  it("should call onOpenChange(false) when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const { context, unmount } = renderWithDialog(
      <DialogContent>
        <p>Backdrop test</p>
      </DialogContent>
    );
    const backdrop = document.querySelector('[aria-hidden="true"]');
    if (backdrop) {
      await user.click(backdrop as HTMLElement);
      expect(context.onOpenChange).toHaveBeenCalledWith(false);
    }
    unmount();
  });

  it("should auto-focus first focusable element", () => {
    const { unmount } = renderWithDialog(
      <DialogContent>
        <button>First btn</button>
        <button>Second btn</button>
      </DialogContent>
    );
    expect(document.activeElement?.textContent).toBe("First btn");
    unmount();
  });

  it("should set aria-labelledby and aria-describedby", () => {
    const { unmount } = renderWithDialog(
      <DialogContent>
        <p>Aria test</p>
      </DialogContent>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-labelledby")).toBe("dialog-title");
    expect(dialog.getAttribute("aria-describedby")).toBe("dialog-desc");
    unmount();
  });
});
