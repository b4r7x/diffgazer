import { KeyboardProvider } from "@diffgazer/keys";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axeCore from "axe-core";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { DeleteConfigurationDialog } from "./delete-configuration-dialog";

function renderDialog(overrides: Partial<ComponentProps<typeof DeleteConfigurationDialog>> = {}) {
  const props: ComponentProps<typeof DeleteConfigurationDialog> = {
    open: true,
    onOpenChange: vi.fn(),
    name: "Google Gemini",
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(
    <KeyboardProvider>
      <DeleteConfigurationDialog {...props} />
    </KeyboardProvider>,
  );
  return props;
}

function dialog(): HTMLElement {
  return screen.getByRole("alertdialog", { name: "Delete configuration?" });
}

describe("DeleteConfigurationDialog", () => {
  it("is a modal alert dialog naming the record, opened on Cancel so Enter deletes nothing", async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    const alert = dialog();
    expect(alert).toHaveAttribute("aria-modal", "true");
    expect(alert).toHaveAccessibleDescription("This cannot be undone");
    expect(within(alert).getByText(/Removes Google Gemini/)).toBeInTheDocument();
    const cancel = within(alert).getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());
    // Colour contrast is a token contract jsdom cannot compute.
    const results = await axeCore.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);

    await user.keyboard("{Enter}");
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("deletes and closes from the destructive action, reached by Tab", async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    await user.tab();
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(props.onConfirm).toHaveBeenCalledOnce();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("moves between Cancel and Delete with Left/Right and activates the focused action", async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const del = screen.getByRole("button", { name: "Delete" });
    await waitFor(() => expect(cancel).toHaveFocus());

    await user.keyboard("{ArrowRight}");
    expect(del).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(cancel).toHaveFocus();
    // The row does not wrap: Left on the safe action stays put.
    await user.keyboard("{ArrowLeft}");
    expect(cancel).toHaveFocus();

    await user.keyboard("{ArrowRight}{Enter}");
    expect(props.onConfirm).toHaveBeenCalledOnce();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes on Escape without deleting", () => {
    const props = renderDialog();

    // fireEvent retained: dialog cancel is a native Event; userEvent has no cancel dispatch.
    fireEvent(dialog(), new Event("cancel", { bubbles: false }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});
