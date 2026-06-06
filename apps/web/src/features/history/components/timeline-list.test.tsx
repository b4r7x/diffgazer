import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TimelineList } from "./timeline-list";

const items = [
  { id: "all", label: "All", count: 3 },
  { id: "today", label: "Today", count: 2 },
  { id: "yesterday", label: "Yesterday", count: 1 },
];

describe("TimelineList", () => {
  it("exposes section counts as option descriptions", () => {
    render(
      <TimelineList
        items={items}
        selectedId="all"
        onSelect={vi.fn()}
        keyboardEnabled={false}
      />,
    );

    expect(screen.getByRole("option", { name: "All" })).toHaveAccessibleDescription("3 reviews");
    expect(screen.getByRole("option", { name: "Yesterday" })).toHaveAccessibleDescription("1 review");
  });
});
