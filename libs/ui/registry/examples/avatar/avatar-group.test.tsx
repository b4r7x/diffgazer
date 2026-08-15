import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AvatarGroupExample from "./avatar-group";

describe("avatar group example", () => {
  it("names every group after its visible caption", () => {
    render(<AvatarGroupExample />);

    const names = screen.getAllByRole("group").map((group) => group.getAttribute("aria-label"));

    expect(names).toEqual([
      "overlap (default) — max=3",
      'spacing="gap" — max=3',
      "responsive (no max) — resize to see",
    ]);
    for (const name of names) {
      expect(screen.getByText(name ?? "")).toBeInTheDocument();
    }
  });
});
