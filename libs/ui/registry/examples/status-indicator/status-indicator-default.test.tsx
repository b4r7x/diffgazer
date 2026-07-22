import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatusIndicatorDefault from "./status-indicator-default";

describe("StatusIndicatorDefault", () => {
  it("does not duplicate matching status text in the canonical example", () => {
    render(<StatusIndicatorDefault />);

    expect(
      screen
        .getAllByRole("status")
        .slice(0, 3)
        .map((status) => status.textContent),
    ).toEqual(["Online", "Busy", "Offline"]);
  });
});
