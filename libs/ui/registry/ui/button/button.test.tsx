import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { type ButtonRenderProps, buttonVariants } from "./button";
import { Button } from "./index";

describe("Button", () => {
  it("keeps text sizes reflowable and reserves no-wrap sizing for icon buttons", () => {
    const minimumHeights = { sm: "min-h-7", md: "min-h-9", lg: "min-h-11" } as const;
    for (const size of ["sm", "md", "lg"] as const) {
      const classes = buttonVariants({ size }).split(" ");
      expect(classes).toContain("max-w-full");
      expect(classes).toContain("wrap-anywhere");
      expect(classes).toContain("whitespace-normal");
      expect(classes).toContain(minimumHeights[size]);
      expect(classes).not.toContain("whitespace-nowrap");
    }

    const iconClasses = buttonVariants({ size: "icon" }).split(" ");
    expect(iconClasses).toContain("whitespace-nowrap");
    expect(iconClasses).toContain("h-9");
    expect(iconClasses).toContain("w-9");
  });

  it("renders as a button element by default and only submits a form when type=submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    const { rerender } = render(
      <form aria-label="Test form" onSubmit={onSubmit}>
        <Button>Click me</Button>
      </form>,
    );
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Click me" }));
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <form aria-label="Test form" onSubmit={onSubmit}>
        <Button type="submit">Click me</Button>
      </form>,
    );
    await user.click(screen.getByRole("button", { name: "Click me" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("exposes highlighted state on the native button branch", () => {
    const { rerender } = render(<Button highlighted>Native</Button>);
    expect(screen.getByRole("button", { name: "Native" })).toHaveAttribute(
      "data-highlighted",
      "true",
    );

    rerender(<Button highlighted={false}>Native</Button>);
    expect(screen.getByRole("button", { name: "Native" })).not.toHaveAttribute("data-highlighted");
  });

  it("exposes highlighted state on the anchor branch", () => {
    const { rerender } = render(
      <Button as="a" href="/test" highlighted>
        Anchor
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Anchor" })).toHaveAttribute(
      "data-highlighted",
      "true",
    );

    rerender(
      <Button as="a" href="/test" highlighted={false}>
        Anchor
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Anchor" })).not.toHaveAttribute("data-highlighted");
  });

  it("provides highlighted state to the render-prop branch", () => {
    function ComposedButton({ highlighted }: { highlighted: boolean }) {
      return (
        <Button highlighted={highlighted}>
          {(buttonProps: ButtonRenderProps) => (
            <button type="button" data-highlighted={buttonProps["data-highlighted"]}>
              Composed
            </button>
          )}
        </Button>
      );
    }

    const { rerender } = render(<ComposedButton highlighted />);
    expect(screen.getByRole("button", { name: "Composed" })).toHaveAttribute(
      "data-highlighted",
      "true",
    );

    rerender(<ComposedButton highlighted={false} />);
    expect(screen.getByRole("button", { name: "Composed" })).not.toHaveAttribute(
      "data-highlighted",
    );
  });

  it("fires onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole("button"));
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
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    await user.click(screen.getByRole("button"));
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
    const user = userEvent.setup();
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
    await user.tab();

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

  it.each([
    "disabled",
    "loading",
  ] as const)("prevents %s render-prop anchor activation", (state) => {
    render(
      <Button<HTMLAnchorElement> disabled={state === "disabled"} loading={state === "loading"}>
        {({ ref, disabled: _disabled, onClick, ...buttonProps }) => (
          <a ref={ref} href="/blocked" onClick={onClick} {...buttonProps}>
            Blocked link
          </a>
        )}
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Blocked link" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });

    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("tabindex", "-1");
    expect(link).not.toHaveAttribute("disabled");
  });

  it("prevents activation on a disabled custom render-prop host", () => {
    render(
      <Button<HTMLDivElement> disabled>
        {({ ref, disabled: _disabled, onClick, tabIndex, ...buttonProps }) => (
          // biome-ignore lint/a11y/useSemanticElements: This test exercises a custom render-prop host.
          <div
            ref={ref}
            role="button"
            tabIndex={tabIndex}
            onClick={onClick}
            onKeyDown={(event) => event.preventDefault()}
            {...buttonProps}
          >
            Custom action
          </div>
        )}
      </Button>,
    );
    const customHost = screen.getByRole("button", { name: "Custom action" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });

    customHost.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(customHost).toHaveAttribute("aria-disabled", "true");
    expect(customHost).not.toHaveAttribute("disabled");
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
