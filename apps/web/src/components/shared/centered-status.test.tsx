import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CenteredStatus } from "./centered-status";

describe("CenteredStatus", () => {
  it("exposes the info tone as a status region", () => {
    render(<CenteredStatus>Loading things...</CenteredStatus>);

    expect(screen.getByRole("status")).toHaveTextContent("Loading things...");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("exposes the error tone as an alert region", () => {
    render(<CenteredStatus tone="error">Something failed</CenteredStatus>);

    expect(screen.getByRole("alert")).toHaveTextContent("Something failed");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
