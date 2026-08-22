import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useFocusWithin } from "@/hooks/use-focus-within";

function FocusWithinHarness({ caption }: { caption: string }) {
  const { focusWithin, props } = useFocusWithin<HTMLDivElement>();

  return (
    <>
      <div {...props}>
        <button type="button">first</button>
        <button type="button">second</button>
      </div>
      <button type="button">outside</button>
      <p>{focusWithin ? "pane focused" : "pane resting"}</p>
      <p>{caption}</p>
    </>
  );
}

describe("useFocusWithin", () => {
  it("reports focus once it enters a descendant", async () => {
    const user = userEvent.setup();
    render(<FocusWithinHarness caption="first render" />);

    expect(screen.getByText("pane resting")).toBeInTheDocument();

    await user.tab();

    expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
    expect(screen.getByText("pane focused")).toBeInTheDocument();
  });

  it("stays focused while focus moves between descendants", async () => {
    const user = userEvent.setup();
    render(<FocusWithinHarness caption="first render" />);

    await user.tab();
    await user.tab();

    expect(screen.getByRole("button", { name: "second" })).toHaveFocus();
    expect(screen.getByText("pane focused")).toBeInTheDocument();
  });

  it("reports resting once focus leaves for an outside element", async () => {
    const user = userEvent.setup();
    render(<FocusWithinHarness caption="first render" />);

    await user.tab();
    await user.tab();
    await user.tab();

    expect(screen.getByRole("button", { name: "outside" })).toHaveFocus();
    expect(screen.getByText("pane resting")).toBeInTheDocument();
  });

  it("keeps the pane marked while the window itself loses focus", async () => {
    const user = userEvent.setup();
    render(<FocusWithinHarness caption="first render" />);

    await user.tab();
    const first = screen.getByRole("button", { name: "first" });
    expect(screen.getByText("pane focused")).toBeInTheDocument();

    // Deactivating the browser window reaches the page as a bare focusout with no
    // relatedTarget while the button keeps DOM focus -- what tells it apart from an
    // in-page move.
    // fireEvent retained: userEvent has no gesture for deactivating the window.
    fireEvent.focusOut(first, { relatedTarget: null });

    expect(first).toHaveFocus();
    expect(screen.getByText("pane focused")).toBeInTheDocument();

    // Returning to the window re-fires focusin on the same element: still one mark.
    // fireEvent retained: same window-level event pair, unreachable through userEvent.
    fireEvent.focusIn(first);

    expect(screen.getByText("pane focused")).toBeInTheDocument();
  });

  it("clears the pane mark when in-page focus drops to nothing", async () => {
    const user = userEvent.setup();
    render(<FocusWithinHarness caption="first render" />);

    await user.tab();
    expect(screen.getByText("pane focused")).toBeInTheDocument();

    // A click on dead space blurs the control with no new focus target: the same
    // relatedTarget-less focusout the window blur fires, but DOM focus really left.
    await user.click(document.body);

    expect(screen.getByRole("button", { name: "first" })).not.toHaveFocus();
    expect(screen.getByText("pane resting")).toBeInTheDocument();
  });

  it("keeps tracking focus across an unrelated rerender", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FocusWithinHarness caption="first render" />);

    await user.tab();
    rerender(<FocusWithinHarness caption="second render" />);

    expect(screen.getByText("second render")).toBeInTheDocument();
    expect(screen.getByText("pane focused")).toBeInTheDocument();

    await user.tab();
    await user.tab();

    expect(screen.getByRole("button", { name: "outside" })).toHaveFocus();
    expect(screen.getByText("pane resting")).toBeInTheDocument();
  });
});
