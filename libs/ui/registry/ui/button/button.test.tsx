import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import type { ButtonRenderProps } from "./button";
import { Button } from "./index";

describe("Button", () => {
  it("renders as a button element by default", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("fires onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });

  it("renders as an anchor when as='a'", () => {
    render(
      <Button as="a" href="/test">
        Link
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Link" });
    expect(link).toHaveAttribute("href", "/test");
  });

  it("shows loading state with aria-busy and a data-loading hook, staying focusable", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toHaveAttribute("data-loading", "true");
    // Loading is a busy state, not a native disable: the button keeps focus and
    // exposes aria-disabled instead of dropping focus to <body>.
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute("aria-disabled", "true");
    btn.focus();
    expect(btn).toHaveFocus();
  });

  it("does not fire onClick while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps a focused button focusable when it enters loading", () => {
    const { rerender } = render(<Button>Save</Button>);
    const btn = screen.getByRole("button");
    btn.focus();
    expect(btn).toHaveFocus();

    rerender(<Button loading>Save</Button>);
    expect(btn).toHaveFocus();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("renders the spinner indicator after the lazy chunk resolves", async () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button");
    // querySelector: Spinner is wrapped in aria-hidden so it is excluded from
    // the accessibility tree; this structural assertion confirms the lazy
    // Suspense fallback resolved and the spinner mounted inside the button.
    await waitFor(() => {
      expect(btn.querySelector('[role="status"][aria-label="Loading"]')).not.toBeNull();
    });
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("prevents disabled anchor navigation without firing consumer clicks", () => {
    const spy = vi.fn();
    render(
      <Button as="a" href="/test" disabled onClick={spy}>
        Link
      </Button>,
    );
    const link = screen.getByRole("link");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });

    link.dispatchEvent(event);

    expect(spy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("removes a disabled anchor from the tab order and makes it non-navigable", async () => {
    render(
      <>
        <Button as="a" href="/before">
          Before
        </Button>
        <Button as="a" href="/test" disabled>
          Link
        </Button>
        <Button as="a" href="/after">
          After
        </Button>
      </>,
    );
    const disabled = screen.getByRole("link", { name: "Link" });
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    expect(disabled).toHaveAttribute("tabindex", "-1");
    expect(disabled).not.toHaveAttribute("href");

    screen.getByRole("link", { name: "Before" }).focus();
    await userEvent.tab();

    expect(screen.getByRole("link", { name: "After" })).toHaveFocus();
    expect(disabled).not.toHaveFocus();
  });

  it("keeps a consumer tabIndex on an enabled anchor but forces -1 when disabled", () => {
    const { rerender } = render(
      <Button as="a" href="/test" tabIndex={0}>
        Link
      </Button>,
    );
    expect(screen.getByRole("link")).toHaveAttribute("tabindex", "0");

    rerender(
      <Button as="a" href="/test" tabIndex={0} disabled>
        Link
      </Button>,
    );
    expect(screen.getByRole("link")).toHaveAttribute("tabindex", "-1");
  });

  it("renders bracket decoration when bracket is true", () => {
    render(<Button bracket>Action</Button>);
    const btn = screen.getByRole("button");
    expect(btn.textContent).toContain("[");
    expect(btn.textContent).toContain("]");
  });

  it("supports render prop children", () => {
    render(<Button variant="primary">{(_props: ButtonRenderProps) => <div>Custom</div>}</Button>);
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("lets a consumer aria-busy and aria-label win in the button branch", () => {
    render(
      <Button loading aria-busy={false} aria-label="Saving your draft">
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Saving your draft" });
    expect(btn).toHaveAttribute("aria-busy", "false");
  });

  it("lets a consumer aria-busy and aria-label win in the anchor branch", () => {
    render(
      <Button as="a" href="/x" loading aria-busy={false} aria-label="Loading link">
        Go
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Loading link" });
    expect(link).toHaveAttribute("aria-busy", "false");
  });

  it("has no a11y violations", async () => {
    const { container } = render(<Button>Click me</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations as anchor", async () => {
    const { container } = render(
      <Button as="a" href="/test">
        Link
      </Button>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
