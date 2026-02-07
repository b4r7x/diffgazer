import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
    renderWithDialog(
      <DialogContent>
        <p>Dialog body</p>
      </DialogContent>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Dialog body")).toBeInTheDocument();
  });

  it("should not render when open is false", () => {
    renderWithDialog(
      <DialogContent>
        <p>Hidden body</p>
      </DialogContent>,
      { open: false }
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("should have aria-modal attribute", () => {
    renderWithDialog(
      <DialogContent>
        <p>Modal content</p>
      </DialogContent>
    );
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  });

  it("should call onOpenChange(false) when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const { context } = renderWithDialog(
      <DialogContent>
        <p>Backdrop test</p>
      </DialogContent>
    );
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop as HTMLElement);
    expect(context.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should auto-focus first focusable element", () => {
    renderWithDialog(
      <DialogContent>
        <button>First btn</button>
        <button>Second btn</button>
      </DialogContent>
    );
    expect(document.activeElement?.textContent).toBe("First btn");
  });

  it("should set aria-labelledby and aria-describedby", () => {
    renderWithDialog(
      <DialogContent>
        <p>Aria test</p>
      </DialogContent>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-labelledby")).toBe("dialog-title");
    expect(dialog.getAttribute("aria-describedby")).toBe("dialog-desc");
  });

  it("should trap focus forward with Tab", async () => {
    const user = userEvent.setup();
    renderWithDialog(
      <DialogContent>
        <button>First</button>
        <button>Second</button>
        <button>Third</button>
      </DialogContent>
    );

    // Auto-focused on "First"
    expect(document.activeElement?.textContent).toBe("First");

    // Tab from last element should wrap to first
    // Focus Third first
    screen.getByText("Third").focus();
    expect(document.activeElement?.textContent).toBe("Third");

    await user.tab();
    expect(document.activeElement?.textContent).toBe("First");
  });

  it("should trap focus backward with Shift+Tab", async () => {
    const user = userEvent.setup();
    renderWithDialog(
      <DialogContent>
        <button>First</button>
        <button>Second</button>
        <button>Third</button>
      </DialogContent>
    );

    // Auto-focused on "First"
    expect(document.activeElement?.textContent).toBe("First");

    await user.tab({ shift: true });
    expect(document.activeElement?.textContent).toBe("Third");
  });

  it("should keep focus within dialog boundaries", async () => {
    const user = userEvent.setup();
    renderWithDialog(
      <DialogContent>
        <button>Only</button>
      </DialogContent>
    );

    expect(document.activeElement?.textContent).toBe("Only");
    await user.tab();
    expect(document.activeElement?.textContent).toBe("Only");
    await user.tab({ shift: true });
    expect(document.activeElement?.textContent).toBe("Only");
  });

  it("should lock body scroll when open and restore on unmount", () => {
    document.body.style.overflow = "";

    const { unmount } = renderWithDialog(
      <DialogContent>
        <p>Scroll lock test</p>
      </DialogContent>
    );

    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    expect(document.body.style.overflow).toBe("");
  });
});
