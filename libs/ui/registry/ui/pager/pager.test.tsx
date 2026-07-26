import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Pager } from "./index";
import type { PagerLinkRenderProps } from "./pager-link";

describe("Pager", () => {
  it("links are keyboard accessible", async () => {
    render(
      <Pager>
        <Pager.Link direction="previous" href="/prev">
          Previous
        </Pager.Link>
        <Pager.Link direction="next" href="/next">
          Next
        </Pager.Link>
      </Pager>,
    );
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Next" })).toHaveFocus();
  });

  it("passes props to render function children", () => {
    const renderFn = (props: PagerLinkRenderProps) => (
      <a
        href={props.href}
        rel={props.rel}
        data-direction={props.direction}
        aria-label="Custom destination"
      >
        Custom
      </a>
    );
    render(
      <Pager>
        <Pager.Link direction="next" href="/next">
          {renderFn}
        </Pager.Link>
      </Pager>,
    );
    const link = screen.getByRole("link", { name: "Custom destination" });
    expect(link).toHaveAttribute("href", "/next");
    expect(link).toHaveAttribute("rel", "next");
    expect(link).toHaveAttribute("data-direction", "next");
  });

  // The pager row is a single line of text links: the padding grows the target, the vertical
  // pull-back keeps the row height unchanged, and pointer-coarse trades that pull-back for a real
  // 44px minimum. jsdom computes no layout, so the recipe is asserted through its class tokens.
  it("applies the touch hit-area recipe to both directions", () => {
    render(
      <Pager>
        <Pager.Link direction="previous" href="/prev">
          Previous
        </Pager.Link>
        <Pager.Link direction="next" href="/next">
          Next
        </Pager.Link>
      </Pager>,
    );
    for (const name of ["Previous", "Next"]) {
      expect(screen.getByRole("link", { name })).toHaveClass(
        "inline-flex",
        "gap-1",
        "py-2",
        "-my-2",
        "pointer-coarse:my-0",
        "pointer-coarse:min-h-11",
      );
    }
  });

  it("passes the hit-area recipe into render-prop className", () => {
    let injected = "";
    render(
      <Pager>
        <Pager.Link direction="next" href="/next">
          {(props: PagerLinkRenderProps) => {
            injected = props.className;
            return (
              <a href={props.href} rel={props.rel} className={props.className}>
                Custom
              </a>
            );
          }}
        </Pager.Link>
      </Pager>,
    );
    expect(injected).toContain("py-2");
    expect(injected).toContain("-my-2");
    expect(injected).toContain("pointer-coarse:min-h-11");
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <Pager>
        <Pager.Link direction="previous" href="/prev">
          Previous
        </Pager.Link>
        <Pager.Link direction="next" href="/next">
          Next
        </Pager.Link>
      </Pager>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
