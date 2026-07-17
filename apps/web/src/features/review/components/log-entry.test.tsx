// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LogEntry } from "./log-entry";

describe("LogEntry", () => {
  it("renders an invalid Date timestamp as text", () => {
    render(<LogEntry timestamp={new Date("invalid")} tag="system" message="Ready" />);

    expect(screen.getByText("[Invalid Date]")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });
});
