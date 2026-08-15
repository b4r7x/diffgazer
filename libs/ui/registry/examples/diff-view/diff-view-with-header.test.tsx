import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DiffViewWithHeader from "./diff-view-with-header";

describe("diff-view with header example", () => {
  it("keeps the derived path caption while aria-label names the figure", () => {
    render(<DiffViewWithHeader />);

    expect(screen.getByRole("figure", { name: "Score helper diff" })).toBeInTheDocument();
    expect(screen.getByText("src/utils/score.ts")).toBeInTheDocument();
  });
});
