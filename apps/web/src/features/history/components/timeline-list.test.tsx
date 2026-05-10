import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimelineList } from "./timeline-list";

const items = [
  { id: "all", label: "All", count: 3 },
  { id: "today", label: "Today", count: 2 },
  { id: "yesterday", label: "Yesterday", count: 1 },
];

describe("TimelineList", () => {
  it("handles arrow navigation when the timeline zone becomes active", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <TimelineList
        items={items}
        selectedId="all"
        onSelect={onSelect}
        keyboardEnabled
      />,
    );

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
    await user.keyboard("{ArrowDown}");

    expect(onSelect).toHaveBeenCalledWith("today");
  });

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
