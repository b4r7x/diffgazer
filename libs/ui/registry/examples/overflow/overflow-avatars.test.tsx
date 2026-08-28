import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OverflowAvatarsExample from "./overflow-avatars";

describe("OverflowAvatarsExample", () => {
  it("names avatars with full person names instead of fallback initials", () => {
    render(<OverflowAvatarsExample />);

    expect(screen.getAllByRole("img", { name: "Felix" })).toHaveLength(2);
    expect(screen.getAllByRole("img", { name: "Aria" })).toHaveLength(2);
    expect(screen.queryByRole("img", { name: "FX" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "AR" })).not.toBeInTheDocument();
  });
});
