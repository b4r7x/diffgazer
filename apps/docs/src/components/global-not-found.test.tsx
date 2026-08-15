import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalNotFound } from "./global-not-found";

// Boundary mock: TanStack Router is the external routing library; links need deterministic hrefs in this component test.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock } = await import("@/testing/router-mock");
  return { Link: RouterLinkMock };
});

describe("GlobalNotFound", () => {
  it("names its primary action in the ACTION row, like the docs 404", () => {
    render(<GlobalNotFound />);

    expect(screen.getByRole("link", { name: "Open docs" })).toHaveAttribute("href", "/ui");
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");

    const panel = screen
      .getByRole("heading", { name: "Page not found" })
      .closest('[data-slot="panel"]');
    if (!(panel instanceof HTMLElement)) throw new Error("Fault panel not found");
    const actionTerm = within(panel).getByText("ACTION:");
    expect(actionTerm.nextElementSibling).toHaveTextContent("OPEN_DOCS");
  });
});
