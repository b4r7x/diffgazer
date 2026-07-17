import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Select } from "./index";

function renderTruncatedValue(truncateAfter: number) {
  const { container } = render(
    <Select multiple defaultValue={["apple", "banana", "cherry"]}>
      <Select.Trigger aria-label="Fruit">
        <Select.Value display="truncate" truncateAfter={truncateAfter} />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="apple">Apple</Select.Item>
        <Select.Item value="banana">Banana</Select.Item>
        <Select.Item value="cherry">Cherry</Select.Item>
      </Select.Content>
    </Select>,
  );

  return {
    container,
    trigger: screen.getByRole("combobox", { name: "Fruit" }),
  };
}

describe("SelectValue truncateAfter", () => {
  it("floors fractional counts before calculating visible and overflow items", () => {
    expect(renderTruncatedValue(1.9).trigger).toHaveTextContent("Apple +2 more");
  });

  it.each([
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])("treats %s as zero visible items", (truncateAfter) => {
    expect(renderTruncatedValue(truncateAfter).trigger).toHaveTextContent("+3 more");
  });

  it("has no accessibility violations with an overflow value", async () => {
    const { container } = renderTruncatedValue(1);

    expect(await axe(container)).toHaveNoViolations();
  });
});
