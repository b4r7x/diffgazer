import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SeverityBar } from "./severity-bar";
import { DEFAULT_BAR_WIDTH, BAR_FILLED_CHAR, BAR_EMPTY_CHAR } from "./constants";

describe("SeverityBar", () => {
  it("should render with correct fill proportion", () => {
    const { container } = render(
      <SeverityBar label="High" count={5} max={10} severity="high" />
    );
    const text = container.textContent ?? "";
    const filledCount = (text.match(new RegExp(BAR_FILLED_CHAR, "g")) ?? []).length;
    const emptyCount = (text.match(new RegExp(BAR_EMPTY_CHAR, "g")) ?? []).length;
    expect(filledCount).toBe(Math.round((5 / 10) * DEFAULT_BAR_WIDTH));
    expect(filledCount + emptyCount).toBe(DEFAULT_BAR_WIDTH);
  });

  it("should render zero fill when max is 0", () => {
    const { container } = render(
      <SeverityBar label="Low" count={5} max={0} severity="low" />
    );
    const text = container.textContent ?? "";
    const filledCount = (text.match(new RegExp(BAR_FILLED_CHAR, "g")) ?? []).length;
    expect(filledCount).toBe(0);
  });

  it("should render full bar when count equals max", () => {
    const { container } = render(
      <SeverityBar label="Blocker" count={10} max={10} severity="blocker" />
    );
    const text = container.textContent ?? "";
    const filledCount = (text.match(new RegExp(BAR_FILLED_CHAR, "g")) ?? []).length;
    expect(filledCount).toBe(DEFAULT_BAR_WIDTH);
  });

  it("should display count and label", () => {
    const { container } = render(
      <SeverityBar label="Medium" count={3} max={10} severity="medium" />
    );
    expect(container.textContent).toContain("Medium");
    expect(container.textContent).toContain("3");
  });
});
