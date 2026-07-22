// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LogEntry } from "./entry";

describe("LogEntry", () => {
  it("renders the bracketed timestamp, tag, source, and message", () => {
    render(<LogEntry timestamp="14:05:09" tag="tool" source="git diff" message="Ready" />);

    expect(screen.getByText("[14:05:09]")).toBeInTheDocument();
    expect(screen.getByText("tool")).toBeInTheDocument();
    expect(screen.getByText("git diff")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });
});
