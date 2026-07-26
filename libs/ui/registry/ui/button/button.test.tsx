import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { type ButtonRenderProps, buttonVariants } from "./button";
import { Button } from "./index";

describe("Button", () => {
  // Reflow is a layout guarantee jsdom cannot measure, so this asserts the classes that carry it.
  // They are the contract, not incidental styling: a long label must wrap inside the button instead
  // of pushing its own row wider, and only the icon size opts back out.
  // The wrap mode is `wrap-break-word`, never `wrap-anywhere`: `anywhere` drops the button's
  // min-content width to a single character, so any min-w-0 ancestor collapses a short label
  // ("Small", "Disabled") into a one-letter vertical slab.
  it("keeps text sizes reflowable and reserves no-wrap sizing for icon buttons", () => {
    const minimumHeights = { sm: "min-h-7", md: "min-h-9", lg: "min-h-11" } as const;
    for (const size of ["sm", "md", "lg"] as const) {
      const classes = buttonVariants({ size }).split(" ");
      expect(classes).toContain("max-w-full");
      expect(classes).toContain("wrap-break-word");
      expect(classes).not.toContain("wrap-anywhere");
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
    expect(screen.getByRole("button", { name: "Native" })).toHaveAttribute("data-highlighted", "");

    rerender(<Button highlighted={false}>Native</Button>);
    expect(screen.getByRole("button", { name: "Native" })).not.toHaveAttribute("data-highlighted");
  });

  it("exposes highlighted state on the anchor branch", () => {
    const { rerender } = render(
      <Button as="a" href="/test" highlighted>
        Anchor
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Anchor" })).toHaveAttribute("data-highlighted", "");

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
      "",
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

// touch-target contract (mobile campaign): the pointer-coarse hit area is the public contract and
// jsdom cannot measure layout, so these assert the tokens that carry it. One Tailwind spacing unit
// is 4px, so an `-inset-y-N` overhang is N*4px per side.
describe("Button coarse-pointer hit area", () => {
  const TAILWIND_UNIT_PX = 4;
  /** Per-size vertical overhang in Tailwind units, and the minimum stacking gap the docs promise. */
  const COARSE_SIZES = [
    ["sm", 2, 16],
    ["md", 1, 8],
    ["icon", 1, 8],
  ] as const satisfies ReadonlyArray<readonly ["sm" | "md" | "icon", number, number]>;

  it("extends sm, md, and icon to 44px from their own containing block", () => {
    for (const [size, overhangUnits] of COARSE_SIZES) {
      const classes = buttonVariants({ size }).split(" ");
      // The pseudo-element is positioned against the size itself, not an ancestor.
      expect(classes).toContain("relative");
      expect(classes).toContain("pointer-coarse:before:absolute");
      expect(classes).toContain(`pointer-coarse:before:-inset-y-${overhangUnits}`);
    }
    // lg already measures 44px, so it neither grows nor becomes a containing block.
    const lgClasses = buttonVariants({ size: "lg" }).split(" ");
    expect(lgClasses).toContain("min-h-11");
    expect(lgClasses).not.toContain("relative");
    expect(lgClasses.join(" ")).not.toContain("pointer-coarse:before");
  });

  it("keeps the text sizes vertical-only so a button row never overlaps, and widens icon", () => {
    expect(buttonVariants({ size: "sm" }).split(" ")).toContain("pointer-coarse:before:inset-x-0");
    expect(buttonVariants({ size: "md" }).split(" ")).toContain("pointer-coarse:before:inset-x-0");
    // icon is 36px wide, so it is the one size that must also grow horizontally.
    expect(buttonVariants({ size: "icon" }).split(" ")).toContain(
      "pointer-coarse:before:-inset-x-1",
    );
  });

  // Stacked buttons are the shape this recipe can break: the overhang is symmetric, so two
  // vertically adjacent buttons need at least twice the overhang between them or their hit areas
  // overlap and a tap lands on the wrong control.
  it("gives stacked buttons an overhang matching the documented minimum gap", () => {
    render(
      <div>
        <Button size="sm">First</Button>
        <Button size="sm">Second</Button>
      </div>,
    );
    for (const name of ["First", "Second"]) {
      expect(screen.getByRole("button", { name }).className).toContain(
        "pointer-coarse:before:-inset-y-2",
      );
    }

    for (const [, overhangUnits, documentedGapPx] of COARSE_SIZES) {
      expect(overhangUnits * TAILWIND_UNIT_PX * 2).toBe(documentedGapPx);
    }
  });
});

describe("disabled primary contrast (parsed from CSS)", () => {
  const THEME_CSS = readFileSync(
    resolve(fileURLToPath(import.meta.url), "../../../../styles/theme.css"),
    "utf8",
  );

  /**
   * Body of a rule block, matched whitespace-tolerantly so reformatting theme.css cannot
   * strand these assertions on a selector that no longer matches character for character.
   */
  function block(selector: string): string {
    const pattern = selector
      .split(",")
      .map((part) => part.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(",\\s*");
    const body = THEME_CSS.match(new RegExp(`${pattern}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1];
    if (body === undefined) throw new Error(`Selector not found in CSS: ${selector}`);
    return body;
  }

  /** Reads a custom property, following one level of `var()` aliasing. */
  function readVar(blockText: string, name: string): string {
    const value = blockText.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();
    if (value === undefined) throw new Error(`Custom property not found: ${name}`);
    const alias = value.match(/^var\((--[\w-]+)\)$/)?.[1];
    return alias === undefined ? value : readVar(blockText, alias);
  }

  function luminance(hex: string): number {
    const v = hex.replace("#", "");
    const channel = (offset: number) => {
      const s = Number.parseInt(v.slice(offset, offset + 2), 16) / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  }

  function contrast(a: string, b: string): number {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  // The disabled treatment is a computed-color contract jsdom cannot measure, so this asserts the
  // classes that carry it: fading a filled button drags its label under 4.5:1, so the fill is
  // emptied instead of dimmed.
  it("empties the disabled primary fill instead of fading it", () => {
    const classes = buttonVariants({ variant: "primary" }).split(" ");
    for (const state of ["disabled", "aria-disabled"]) {
      expect(classes).toContain(`${state}:bg-transparent`);
      expect(classes).toContain(`${state}:text-muted-foreground`);
      // Without this the base fade still applies and washes the pair out.
      expect(classes).toContain(`${state}:opacity-100`);
    }
  });

  it.each([
    ["dark", ':root, [data-theme="dark"]'],
    ["light", '[data-theme="light"]'],
  ])("keeps the disabled primary label readable in %s", (_theme, selector) => {
    const theme = block(selector);
    expect(
      contrast(readVar(theme, "--muted-foreground"), readVar(theme, "--background")),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
