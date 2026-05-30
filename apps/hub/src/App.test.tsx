import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { App } from "./App";
import { siteLinks } from "./siteLinks";

describe("Hub App", () => {
  it("renders the portfolio heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /b4r7/i })).toBeInTheDocument();
  });

  it("links to each property from siteLinks", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: /diffgazer/i })).toHaveAttribute(
      "href",
      siteLinks.diffgazer,
    );
    expect(screen.getByRole("link", { name: /docs/i })).toHaveAttribute(
      "href",
      siteLinks.docs,
    );
    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute(
      "href",
      siteLinks.github,
    );
  });
});
