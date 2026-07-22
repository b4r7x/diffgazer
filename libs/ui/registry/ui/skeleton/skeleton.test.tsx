import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Skeleton } from "./index";

describe("Skeleton", () => {
  it("renders decorative placeholder hidden from assistive tech", async () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps aria-hidden="true" when spread consumer props include a conflicting aria-hidden value', () => {
    const consumerProps: ComponentProps<"div"> = { "aria-hidden": "false" };
    const { container } = render(<Skeleton {...consumerProps} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("forwards consumer style for dimensions", () => {
    const { container } = render(<Skeleton style={{ height: 16, width: 128 }} />);
    const el = container.firstElementChild;
    expect(el).toHaveStyle({ height: "16px", width: "128px" });
  });

  it("spreads additional HTML attributes", () => {
    const { container } = render(<Skeleton id="loading-placeholder" />);
    expect(container.firstElementChild).toHaveAttribute("id", "loading-placeholder");
  });
});
