import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { App } from "./App";

describe("Landing App", () => {
  it("renders heading and install command", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /diffgazer/i })).toBeInTheDocument();
    expect(screen.getByText(/npm install/i)).toBeInTheDocument();
  });

  it("has documentation link", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: /documentation/i })).toHaveAttribute(
      "href",
      "https://docs.b4r7.dev",
    );
  });
});
