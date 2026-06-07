import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./index";

describe("Skeleton", () => {
  it("renders decorative placeholder hidden from assistive tech", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild;
    expect(el).toHaveAttribute("aria-hidden", "true");
  });

  it("forwards consumer className for dimensions", () => {
    const { container } = render(<Skeleton className="w-32 h-4" />);
    const el = container.firstElementChild;
    expect(el?.className).toContain("w-32");
    expect(el?.className).toContain("h-4");
  });

  it("spreads additional HTML attributes", () => {
    const { getByTestId } = render(<Skeleton data-testid="skel" />);
    expect(getByTestId("skel")).toBeInTheDocument();
  });
});
