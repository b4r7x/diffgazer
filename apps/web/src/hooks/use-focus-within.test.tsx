import { render, screen } from "@testing-library/react";
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
