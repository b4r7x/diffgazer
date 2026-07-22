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
