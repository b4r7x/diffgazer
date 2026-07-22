import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TimelineList } from "./timeline-list";

const items = [
  { id: "all", label: "All", count: 3 },
  { id: "today", label: "Today", count: 2 },
  { id: "yesterday", label: "Yesterday", count: 1 },
];

describe("TimelineList pointer selection", () => {
  it("reports a newly clicked date once", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <TimelineList
        items={[
          { id: "all", label: "All", count: 2 },
          { id: "2026-02-09", label: "Feb 9", count: 1 },
        ]}
        selectedId="all"
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("option", { name: /Feb 9/i }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith("2026-02-09");
  });
});

describe("TimelineList", () => {
  it("exposes section counts as option descriptions", () => {
    render(
      <TimelineList items={items} selectedId="all" onSelect={vi.fn()} keyboardEnabled={false} />,
    );

    expect(screen.getByRole("option", { name: "All" })).toHaveAccessibleDescription("3 runs");
    expect(screen.getByRole("option", { name: "Yesterday" })).toHaveAccessibleDescription("1 run");
  });

  it("keeps the selected section exposed as selected when keyboard focus is elsewhere", () => {
    render(
      <TimelineList items={items} selectedId="today" onSelect={vi.fn()} keyboardEnabled={false} />,
    );

    const selected = screen.getByRole("option", { name: "Today" });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected).toHaveAttribute("data-selected");
    expect(selected).not.toHaveAttribute("data-highlighted");
  });
});
