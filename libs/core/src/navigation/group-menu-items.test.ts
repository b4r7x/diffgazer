import { describe, expect, it } from "vitest";
import type { NavItem } from "../schemas/presentation/navigation.js";
import { withGroupDividers } from "./group-menu-items.js";

describe("withGroupDividers", () => {
  it("returns an empty list for empty input", () => {
    expect(withGroupDividers([])).toEqual([]);
  });

  it("never shows a divider before the first item", () => {
    const single: NavItem[] = [{ id: "quit", label: "Quit", group: "system" }];
    expect(withGroupDividers(single)).toEqual([{ item: single[0], showDividerBefore: false }]);
  });

  it("renders items in canonical review→navigation→system order regardless of input order", () => {
    const shuffled: NavItem[] = [
      { id: "quit", label: "Quit", variant: "danger", group: "system" },
      { id: "help", label: "Help", group: "system" },
      { id: "settings", label: "Settings", group: "navigation" },
      { id: "review-unstaged", label: "Review Unstaged", group: "review" },
      { id: "history", label: "History", group: "navigation" },
      { id: "review-staged", label: "Review Staged", group: "review" },
    ];

    const annotated = withGroupDividers(shuffled);

    // Groups are reordered to canonical sequence; within each group the
    // caller's input order is preserved (stable sort).
    expect(annotated.map((entry) => entry.item.id)).toEqual([
      "review-unstaged", // review (came at index 3 in input — first review item)
      "review-staged", // review (came at index 5 in input)
      "settings", // navigation (came at index 2 in input — first nav item)
      "history", // navigation (came at index 4)
      "quit", // system (came at index 0 in input — first system item)
      "help", // system (came at index 1)
    ]);
    expect(annotated.map((entry) => entry.showDividerBefore)).toEqual([
      false, // review-unstaged — first
      false, // review-staged — same group (review)
      true, // settings — new group (navigation)
      false, // history — same group
      true, // quit — new group (system)
      false, // help — same group
    ]);
  });
});
