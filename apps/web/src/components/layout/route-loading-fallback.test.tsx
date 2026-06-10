import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteLoadingFallback } from "./route-loading-fallback";

describe("RouteLoadingFallback", () => {
  it("renders a loading status region with label text", () => {
    render(<RouteLoadingFallback />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
