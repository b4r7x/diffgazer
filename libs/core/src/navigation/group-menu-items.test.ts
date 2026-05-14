import { describe, it, expect } from "vitest";
import type { NavItem } from "../schemas/ui/navigation.js";
import { groupMenuItems, withGroupDividers } from "./group-menu-items.js";

const FIXTURE: NavItem[] = [
  { id: "review-unstaged", label: "Review Unstaged", group: "review" },
  { id: "review-staged", label: "Review Staged", group: "review" },
  { id: "resume-review", label: "Resume", group: "review" },
  { id: "history", label: "History", group: "navigation" },
  { id: "settings", label: "Settings", group: "navigation" },
  { id: "help", label: "Help", group: "system" },
  { id: "quit", label: "Quit", variant: "danger", group: "system" },
];

describe("groupMenuItems", () => {
  it("partitions items into review, navigation, and system arrays", () => {
    const grouped = groupMenuItems(FIXTURE);
    expect(grouped.review.map((item) => item.id)).toEqual([
      "review-unstaged",
      "review-staged",
      "resume-review",
    ]);
    expect(grouped.navigation.map((item) => item.id)).toEqual(["history", "settings"]);
    expect(grouped.system.map((item) => item.id)).toEqual(["help", "quit"]);
  });

  it("returns empty arrays for empty input", () => {
    expect(groupMenuItems([])).toEqual({ review: [], navigation: [], system: [] });
  });

  it("preserves source order within each group", () => {
    const shuffled: NavItem[] = [
      { id: "quit", label: "Quit", group: "system" },
      { id: "review-unstaged", label: "Review Unstaged", group: "review" },
      { id: "help", label: "Help", group: "system" },
      { id: "review-staged", label: "Review Staged", group: "review" },
    ];
    const grouped = groupMenuItems(shuffled);
    expect(grouped.review.map((item) => item.id)).toEqual(["review-unstaged", "review-staged"]);
    expect(grouped.system.map((item) => item.id)).toEqual(["quit", "help"]);
  });
});

describe("withGroupDividers", () => {
  it("marks divider before first item of each new group only", () => {
    const annotated = withGroupDividers(FIXTURE);
    expect(annotated.map((entry) => entry.showDividerBefore)).toEqual([
      false, // review-unstaged — first
      false, // review-staged — same group
      false, // resume-review — same group
      true, // history — new group
      false, // settings — same group
      true, // help — new group
      false, // quit — same group
    ]);
  });

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
      "review-staged",   // review (came at index 5 in input)
      "settings",        // navigation (came at index 2 in input — first nav item)
      "history",         // navigation (came at index 4)
      "quit",            // system (came at index 0 in input — first system item)
      "help",            // system (came at index 1)
    ]);
    expect(annotated.map((entry) => entry.showDividerBefore)).toEqual([
      false, // review-unstaged — first
      false, // review-staged — same group (review)
      true,  // settings — new group (navigation)
      false, // history — same group
      true,  // quit — new group (system)
      false, // help — same group
    ]);
  });

  it("preserves relative order within each group (stable sort)", () => {
    const items: NavItem[] = [
      { id: "history", label: "History", group: "navigation" },
      { id: "review-staged", label: "Review Staged", group: "review" },
      { id: "settings", label: "Settings", group: "navigation" },
      { id: "review-unstaged", label: "Review Unstaged", group: "review" },
    ];

    const annotated = withGroupDividers(items);

    // review group preserves staged-before-unstaged because that was its input order.
    expect(annotated.map((entry) => entry.item.id)).toEqual([
      "review-staged",
      "review-unstaged",
      "history",
      "settings",
    ]);
  });
});
